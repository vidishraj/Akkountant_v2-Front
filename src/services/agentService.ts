import { auth } from "../components/FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { API_BASE_URL } from "./AxiosConfig.tsx";

export type AgentType = "investment" | "transaction" | "freelance";

export interface AgentMessage {
  role: "user" | "assistant" | "partial_assistant";
  content: string | object[];
}

export interface SSEEvent {
  type:
    | "text"
    | "tool_exec"
    | "confirm"
    | "done"
    | "error"
    | "partial_assistant"
    | "conversation_id"
    | "file_attachment";
  content?: string;
  tool?: string;
  input?: Record<string, unknown>;
  message?: string;
  mutations?: string[];
  // Set only on the LEADING "conversation_id" event the backend emits before
  // any work; FE captures this to pin the id for subsequent turns in the same chat.
  id?: number;
  // File-attachment payload (ak-cyo). Present only on `file_attachment` events.
  // Backend emits these when a tool call produces a downloadable artifact
  // (Freelance Assistant CSVs, etc). The FE splits the assistant message's
  // in-flight text at the point the event arrives so the card renders
  // inline where the file was produced in the narrative.
  url?: string;
  name?: string;
  size_bytes?: number;
  mime_type?: string;
  uuid?: string;
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
  // Agent-produced files that were emitted during THIS message's stream
  // (ak-cyo). Rendered as FileAttachmentCards below the message text on
  // history load. Present only on assistant messages that produced files;
  // absent on user messages and on legacy assistant messages that predate
  // the file_attachment feature.
  agent_attachments?: {
    url: string;
    name: string;
    size_bytes: number;
    mime_type: string;
    uuid: string;
  }[];
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

/**
 * Payload for an agent-produced file attachment SSE event. Matches the MCP
 * `file_attachment` content-block shape one-for-one (ak-cyo backend
 * contract). The FE renders each of these as an inline FileAttachmentCard
 * in the assistant message, at the position in the narrative where the
 * event arrived during streaming.
 */
export interface StreamedFileAttachment {
  url: string;
  name: string;
  size_bytes: number;
  mime_type: string;
  uuid: string;
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
  // Fires whenever the backend emits a file_attachment MCP block during the
  // stream. FE splits the in-flight text at this event's arrival so the card
  // renders inline where the file was produced in the narrative (ak-cyo).
  onFileAttachment?: (attachment: StreamedFileAttachment) => void;
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

/**
 * Marker used by onopen to short-circuit onmessage / retry on a non-2xx.
 * We already reported the error via callbacks.onError; the top-level catch
 * checks for this to avoid double-reporting.
 */
class ServerResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerResponseError";
  }
}

/**
 * POSTs a chat turn to /agent/chat and streams the SSE response through the
 * provided callbacks. Uses `@microsoft/fetch-event-source` rather than the
 * raw fetch() + response.body.getReader() pattern because iOS Safari / WebKit
 * has a known bug that aborts fetch-streamed POST responses after the first
 * flush if there's a silent gap before the second frame — which is exactly
 * what happens on the attachment path (backend spends N seconds vision-
 * processing images between the leading conversation_id event and the first
 * text token). The polyfill's WebKit fallback path bypasses the fetch-stream
 * layer entirely, so the connection stays open. (ak-7gs)
 */
export async function streamAgentChat(
  agentType: AgentType,
  messages: AgentMessage[],
  confirmedTools: string[],
  callbacks: StreamCallbacks,
  attachments?: string[],
  conversationId?: number
): Promise<void> {
  const uid = await getFirebaseUID();

  try {
    await fetchEventSource(`${API_BASE_URL}agent/chat`, {
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
      // Default behaviour pauses the stream when the tab is backgrounded; the
      // chat turn is short-lived and pausing would look like a hang, so keep
      // the connection alive regardless of visibility.
      openWhenHidden: true,
      onopen: async (response) => {
        // Match the pre-polyfill response.ok check. Draining response.text()
        // lets the connection close cleanly instead of dangling.
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          callbacks.onError(`Server error: ${response.status} - ${errorText}`);
          // Throwing here aborts the polyfill (no retry, no onmessage calls).
          throw new ServerResponseError(`HTTP ${response.status}`);
        }
      },
      onmessage: (ev) => {
        // The polyfill parses SSE framing itself and hands us the payload as
        // `ev.data` — the string that used to sit after "data: ", minus the
        // trailing "\n\n". Empty data lines (SSE keepalive `:` comments) come
        // through with ev.data === "".
        if (!ev.data) return;

        let event: SSEEvent;
        try {
          event = JSON.parse(ev.data);
        } catch {
          // Ignore malformed SSE lines (matches pre-polyfill behaviour).
          return;
        }

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
          case "file_attachment":
            // Agent produced a downloadable artifact mid-stream. Requires
            // all five fields to be present; a partial payload gets ignored
            // (defensive — matches the malformed-JSON silent-skip pattern
            // elsewhere in this loop).
            if (
              typeof event.url === "string" &&
              typeof event.name === "string" &&
              typeof event.size_bytes === "number" &&
              typeof event.mime_type === "string" &&
              typeof event.uuid === "string"
            ) {
              callbacks.onFileAttachment?.({
                url: event.url,
                name: event.name,
                size_bytes: event.size_bytes,
                mime_type: event.mime_type,
                uuid: event.uuid,
              });
            }
            break;
        }
      },
      onerror: (err) => {
        // The polyfill's default is to retry with exponential backoff on any
        // error. The caller controls retries at a higher level, so throw here
        // to abort the polyfill's retry loop.
        if (err instanceof ServerResponseError) {
          // Already surfaced via onopen; just rethrow to abort.
          throw err;
        }
        callbacks.onError(err instanceof Error ? err.message : String(err));
        throw err;
      },
    });
  } catch {
    // Every failure path already reported via callbacks.onError. Swallow so
    // the caller's try/catch doesn't stack a second "Connection error: ..."
    // message on top of the one we already surfaced.
  }
}
