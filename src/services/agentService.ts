import { auth } from "../components/FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

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
  callbacks: StreamCallbacks
): Promise<void> {
  const uid = await getFirebaseUID();

  const response = await fetch("http://127.0.0.1:8080/agent/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Firebase-ID": uid,
    },
    body: JSON.stringify({
      agent_type: agentType,
      messages,
      confirmed_tools: confirmedTools,
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
