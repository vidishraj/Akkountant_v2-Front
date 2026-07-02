import { auth } from "../components/FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "./AxiosConfig.tsx";

export type AgentType = "investment" | "transaction" | "freelance";

export interface AgentMessage {
  role: "user" | "assistant" | "partial_assistant";
  content: string | object[];
}

export interface SSEEvent {
  type: "text" | "tool_exec" | "confirm" | "done" | "error" | "partial_assistant" | "conversation_id";
  content?: string;
  tool?: string;
  input?: Record<string, unknown>;
  message?: string;
  mutations?: string[];
  // Set only on the LEADING "conversation_id" event the backend emits before
  // any work; FE captures this to pin the id for subsequent turns in the same chat.
  id?: number;
}

/**
 * Conversation row as returned by GET /agent/conversations.
 * Excludes soft-deleted, ordered updated_at DESC.
 */
export interface Conversation {
  id: number;
  title: string;
  agent_type: AgentType;
  updated_at: string;
  msg_count: number;
}

/**
 * Attachment metadata on a historical user message, as returned by
 * GET /agent/conversations/<id>. The backend keys are snake_case; we keep them
 * as-is here and transform at the UI boundary to the camelCase shape the
 * AgentChat component uses for in-flight + history pills.
 *
 * Note: by the time a conversation is replayed, the underlying /tmp file has
 * been swept (single-use per turn + 1h sweeper), so the attachment_id is no
 * longer resolvable — we render history pills with an "expired" styling.
 */
export interface ServerAttachmentMeta {
  attachment_id: string;
  filename: string;
  content_type: string;
  size: number;
}

export interface ServerConversationMessage {
  role: "user" | "assistant";
  content: string;
  attachments_meta?: ServerAttachmentMeta[];
}

export interface ConversationWithMessages {
  id: number;
  title: string;
  agent_type: AgentType;
  messages: ServerConversationMessage[];
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
  // Fires once per stream, BEFORE any other event, with the conversation id the
  // backend assigned (auto-create) or echoed (existing convo). FE uses this to
  // pin the id for subsequent turns + show the conversation in the history list.
  onConversationId?: (id: number) => void;
}

// ── Conversation API client ────────────────────────────────────────────────

/**
 * Typed error thrown by every /agent/conversations client fn on non-2xx.
 * Callers can `instanceof` + inspect `.status` to distinguish 404 (evict the
 * row) from transient 5xx / network failures (keep the row, show a banner).
 */
export class AgentApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AgentApiError";
  }
}

async function authedFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const uid = await getFirebaseUID();
  const headers = new Headers(init.headers);
  headers.set("X-Firebase-ID", uid);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

/**
 * Response envelope for the list endpoint. BE returns `{conversations: [...]}`
 * even though the individual-conversation endpoints return bare objects — the
 * unwrap happens here so callers see a plain array.
 */
interface ConversationsListResponse {
  conversations: Conversation[];
}

export async function listConversations(
  agentType: AgentType
): Promise<Conversation[]> {
  const res = await authedFetch(
    `agent/conversations?agent_type=${encodeURIComponent(agentType)}`
  );
  if (!res.ok) {
    throw new AgentApiError(res.status, `listConversations failed: ${res.status}`);
  }
  const data = (await res.json()) as ConversationsListResponse;
  return data.conversations;
}

export async function getConversation(
  id: number
): Promise<ConversationWithMessages> {
  const res = await authedFetch(`agent/conversations/${id}`);
  if (!res.ok) {
    throw new AgentApiError(res.status, `getConversation failed: ${res.status}`);
  }
  return res.json();
}

export async function createConversation(
  agentType: AgentType,
  title?: string
): Promise<Conversation> {
  const res = await authedFetch("agent/conversations", {
    method: "POST",
    body: JSON.stringify({ agent_type: agentType, ...(title ? { title } : {}) }),
  });
  if (!res.ok) {
    throw new AgentApiError(res.status, `createConversation failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteConversation(id: number): Promise<void> {
  const res = await authedFetch(`agent/conversations/${id}`, {
    method: "DELETE",
  });
  // BE returns 200 with `{"message": "..."}` body on success (not 204 as the
  // spec sketch suggested); 404 if not owner / already deleted. Either way we
  // only care about the ok-ness — we do not consume the body.
  if (!res.ok) {
    throw new AgentApiError(res.status, `deleteConversation failed: ${res.status}`);
  }
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
  attachments?: string[],
  conversationId?: number
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
      // conversation_id is omitted on a fresh chat (backend auto-creates and
      // emits the LEADING "conversation_id" SSE event); set on subsequent turns
      // to persist into the existing thread.
      ...(typeof conversationId === "number" ? { conversation_id: conversationId } : {}),
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
          case "conversation_id":
            // Leading event — fires once at the top of the stream, before any
            // other event. Capture so FE can pin the id for subsequent turns.
            if (typeof event.id === "number") {
              callbacks.onConversationId?.(event.id);
            }
            break;
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
