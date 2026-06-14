import { auth } from "../components/FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "./AxiosConfig.tsx";

export type AgentType = "investment" | "transaction" | "freelance";

export interface AgentMessage {
  role: "user" | "assistant" | "partial_assistant";
  content: string | object[];
}

export interface SSEEvent {
  type: "text" | "tool_exec" | "confirm" | "done" | "error" | "partial_assistant";
  content?: string;
  tool?: string;
  input?: Record<string, unknown>;
  message?: string;
  mutations?: string[];
}

/**
 * Metadata for an attachment that has been uploaded to the agent attach endpoint
 * and is referenced by id on the user's next chat message. The lifecycle is
 * ephemeral (per-turn): the backend deletes the file in its stream_chat finally
 * block and a sweeper purges stale uploads > 1h old, so this id is single-use.
 */
export interface Attachment {
  id: string;
  filename: string;
  size: number;
  contentType: string;
}

/**
 * Uploads a single file to POST /agent/attach (multipart/form-data, field name "file").
 * Returns the attachment metadata the chat call needs to reference the file.
 *
 * The browser sets the multipart boundary automatically when a FormData body is
 * passed — do NOT add a Content-Type header here, or the boundary will be missing
 * and the backend will reject the upload as malformed.
 */
export async function uploadAttachment(file: File): Promise<Attachment> {
  const uid = await getFirebaseUID();
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}agent/attach`, {
    method: "POST",
    headers: { "X-Firebase-ID": uid },
    body: form,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} ${errorText || ""}`.trim());
  }
  const data = await response.json();
  return {
    id: data.attachment_id,
    filename: data.filename,
    size: data.size,
    contentType: data.content_type,
  };
}

interface StreamCallbacks {
  onText: (content: string) => void;
  onToolExec: (tool: string, input: Record<string, unknown>) => void;
  onConfirm: (tool: string, input: Record<string, unknown>, message: string) => void;
  onDone: (mutations: string[]) => void;
  onError: (message: string) => void;
  onPartialAssistant?: (content: object[]) => void;
}

async function getFirebaseUID(): Promise<string> {
  const user = auth.currentUser;
  if (user) return user.uid;

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (loggedInUser) => {
      unsubscribe();
      if (loggedInUser) {
        resolve(loggedInUser.uid);
      } else {
        reject(new Error("User not authenticated"));
      }
    });
  });
}

export async function streamAgentChat(
  agentType: AgentType,
  messages: AgentMessage[],
  confirmedTools: string[],
  callbacks: StreamCallbacks,
  attachments?: string[]
): Promise<void> {
  const uid = await getFirebaseUID();

  const response = await fetch(`${API_BASE_URL}agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Firebase-ID": uid,
    },
    body: JSON.stringify({
      agent_type: agentType,
      messages,
      confirmed_tools: confirmedTools,
      // Only include attachments when present — keeps the wire format clean and
      // lets older backends ignore the field entirely.
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    callbacks.onError(`Server error: ${response.status} - ${errorText}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError("No response stream available");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      try {
        const event: SSEEvent = JSON.parse(line.slice(6));

        switch (event.type) {
          case "text":
            callbacks.onText(event.content || "");
            break;
          case "tool_exec":
            callbacks.onToolExec(event.tool || "", event.input || {});
            break;
          case "confirm":
            callbacks.onConfirm(
              event.tool || "",
              event.input || {},
              event.message || ""
            );
            break;
          case "partial_assistant":
            callbacks.onPartialAssistant?.(
              (event as unknown as { content: object[] }).content || []
            );
            break;
          case "done":
            callbacks.onDone(event.mutations || []);
            break;
          case "error":
            callbacks.onError(event.message || "Unknown error");
            break;
        }
      } catch {
        // Ignore malformed SSE lines
      }
    }
  }
}
