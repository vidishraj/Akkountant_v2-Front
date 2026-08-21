import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  streamAgentChat,
  uploadAttachment,
  listConversations,
  getConversation,
  deleteConversation as deleteConversationApi,
  AgentApiError,
  AgentType,
  AgentMessage,
  ServerConversationMessage,
  ServerAttachmentMeta,
} from "../../services/agentService";
import styles from "./AgentChat.module.scss";
import { useAgentChatBridge } from "../../contexts/AgentChatBridgeContext";

// ── Attachment policy ───────────────────────────────────────────────────────
// Must match the backend's allowed_types / max_size / per-message-cap exactly,
// otherwise users see "upload OK then chat-time reject", which is confusing.
// Claude Code's Read tool natively handles PDF + the common image formats below.
const ATTACHMENT_ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;
const ATTACHMENT_ACCEPT = ATTACHMENT_ALLOWED_TYPES.join(",");
const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB — matches backend
const ATTACHMENT_MAX_COUNT = 4;

// Investment agent only for v1 (Overseer scope decision in ak-1x4).
// Transaction / freelance agents do not get a paperclip yet.
const agentSupportsAttachments = (agentType: AgentType) =>
  agentType === "investment";

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

// All AgentType values — used to retire the dead localStorage cache once
// per session (ak-5v9 dropped localStorage as the primary store).
const ALL_AGENT_TYPES: AgentType[] = ["investment", "transaction", "freelance"];
const STORAGE_KEY_PREFIX = "agent-chat-history-";

/**
 * Attachment metadata persisted on a sent ChatMessage so its pills can re-render
 * on history reload. The id here is the backend uuid — single-use and already
 * cleaned up server-side by the time we render history, so when `expired` is
 * true the pill is purely informational (no preview-fetch, no re-attach).
 */
interface AttachmentMeta {
  id: string;
  filename: string;
  size: number;
  contentType: string;
  // True when the meta was loaded from server history; the /tmp file no longer
  // exists (single-use per turn + 1h sweeper), so the pill is purely a record
  // of what was attached — styled to make that obvious.
  expired?: boolean;
}

/**
 * In-flight or staged attachment in the input area (pre-send). Status drives
 * the pill appearance: spinner while uploading, normal chip when ready, red
 * border (clickable to retry) when failed. `tempId` is a client-side handle so
 * we can update the right entry as async uploads resolve.
 */
interface PendingAttachment {
  tempId: string;
  file: File;
  filename: string;
  size: number;
  contentType: string;
  status: "uploading" | "ready" | "error";
  attachmentId?: string;
  error?: string;
}

interface AgentChatProps {
  agentType: AgentType;
  onMutation: (mutations: string[]) => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  // Only set on user messages that were sent with one or more attachments.
  // Rendered as pills above the bubble content; not echoed to the API
  // (the API receives the ids out-of-band via streamAgentChat's attachments param).
  attachments?: AttachmentMeta[];
}

interface ConfirmState {
  tool: string;
  input: Record<string, unknown>;
  message: string;
}

const TOOL_LABELS: Record<string, string> = {
  fetch_portfolio_summary: "Fetching portfolio summary",
  fetch_user_securities: "Fetching securities",
  fetch_security_transactions: "Fetching transactions",
  search_securities: "Searching securities",
  fetch_security_rate: "Fetching rate",
  insert_investment: "Inserting investment",
  delete_single_investment: "Deleting investment",
  delete_all_investments: "Deleting all investments",
  fetch_epg_data: "Fetching EPG data",
  fetch_kite_holdings: "Fetching Kite holdings",
  fetch_kite_positions: "Fetching Kite positions",
  sync_kite_holdings: "Syncing Kite holdings",
  fetch_transactions: "Fetching transactions",
  fetch_calendar_transactions: "Fetching calendar data",
  update_transaction: "Updating transaction",
  fetch_opted_banks: "Fetching banks",
  fetch_file_details: "Fetching file details",
  scan_emails_for_transactions: "Scanning emails",
  scan_statements: "Scanning statements",
  delete_file: "Deleting file",
  create_invoice: "Creating invoice",
  get_invoices: "Fetching invoices",
  get_invoice_by_number: "Fetching invoice",
  update_invoice: "Updating invoice",
  delete_invoice: "Deleting invoice",
  create_customer: "Creating customer",
  get_customers: "Fetching customers",
  update_customer: "Updating customer",
  delete_customer: "Deleting customer",
  get_dashboard_analytics: "Fetching analytics",
  get_earnings_by_date_range: "Fetching earnings",
  fetch_epg_rates: "Fetching EPG rates",
  fetch_investment_history: "Fetching investment history",
  get_jobs_status: "Checking job status",
  trigger_rate_refresh: "Triggering rate refresh",
  get_rate_freshness: "Checking rate freshness",
};

const AGENT_TITLES: Record<AgentType, string> = {
  investment: "Investment Assistant",
  transaction: "Transaction Assistant",
  freelance: "Freelance Assistant",
};

// One-shot per browser session: clear the legacy localStorage cache that
// ak-5v9 retires. Idempotent thereafter — repeated calls are no-ops once the
// keys are gone.
let legacyCacheCleared = false;
const clearLegacyLocalStorageCache = () => {
  if (legacyCacheCleared) return;
  try {
    for (const agent of ALL_AGENT_TYPES) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${agent}`);
    }
  } catch {
    // Defensive: localStorage can throw in private mode / quota-exhausted.
    // Ignoring is fine — we'll just retry next mount.
  }
  legacyCacheCleared = true;
};

/**
 * Transform a server attachments_meta entry into the camelCase shape the UI
 * components use. Stamped `expired: true` because by the time the FE reloads
 * conversation history the underlying /tmp upload has been swept and the id
 * cannot resolve back to a file.
 */
const transformServerAttachment = (
  meta: ServerAttachmentMeta
): AttachmentMeta => ({
  id: meta.attachment_id,
  filename: meta.filename,
  size: meta.size,
  contentType: meta.content_type,
  expired: true,
});

const transformServerMessages = (
  serverMessages: ServerConversationMessage[]
): ChatMessage[] =>
  serverMessages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.attachments_meta && m.attachments_meta.length > 0
      ? { attachments: m.attachments_meta.map(transformServerAttachment) }
      : {}),
  }));

const AgentChat = ({ agentType, onMutation }: AgentChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const [confirmedTools, setConfirmedTools] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  // Store partial assistant content for conversation continuity after confirm
  const partialAssistantRef = useRef<object[] | null>(null);

  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  const {
    command,
    clearCommand,
    conversations,
    setConversations,
    upsertConversation,
    removeConversation,
  } = useAgentChatBridge();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachmentsEnabled = agentSupportsAttachments(agentType);
  const hasUploadingAttachment = pendingAttachments.some(
    (p) => p.status === "uploading"
  );
  const readyAttachmentCount = pendingAttachments.filter(
    (p) => p.status === "ready"
  ).length;

  const refreshConversations = useCallback(
    async (agent: AgentType) => {
      setConversationsLoading(true);
      setConversationsError(null);
      try {
        const list = await listConversations(agent);
        setConversations(list, agent);
        // First successful sync per session retires the legacy cache keys; no
        // migration of those chats (Overseer-approved drop).
        clearLegacyLocalStorageCache();
      } catch (err) {
        setConversationsError(
          err instanceof Error ? err.message : "Failed to load conversations"
        );
      } finally {
        setConversationsLoading(false);
      }
    },
    [setConversations]
  );

  // Reset per-conversation state and fetch the server list on mount /
  // agentType change. The localStorage primary store is retired (ak-5v9) —
  // GET /agent/conversations is authoritative; we accept the cold-fetch cost
  // for correctness.
  useEffect(() => {
    setActiveConversationId(null);
    setMessages([]);
    setConfirmedTools([]);
    partialAssistantRef.current = null;
    setPendingAttachments([]);
    void refreshConversations(agentType);
  }, [agentType, refreshConversations]);

  const startNewChat = useCallback(() => {
    if (isLoading) return;
    setActiveConversationId(null);
    setMessages([]);
    setConfirmedTools([]);
    partialAssistantRef.current = null;
    setPendingAttachments([]);
  }, [isLoading]);

  const switchConversation = useCallback(
    async (id: number) => {
      if (isLoading || id === activeConversationId) return;
      // Optimistically set the active id so the active-chip styling responds
      // before the fetch resolves. If it 404s we drop it back to null; on
      // transient 5xx / network we surface the error but keep the row so the
      // user can retry.
      setActiveConversationId(id);
      setMessages([]);
      setConfirmedTools([]);
      partialAssistantRef.current = null;
      setPendingAttachments([]);
      setConversationsError(null);
      try {
        const conv = await getConversation(id);
        setMessages(transformServerMessages(conv.messages));
      } catch (err) {
        setActiveConversationId(null);
        if (err instanceof AgentApiError && err.status === 404) {
          // Confirmed gone (not owner / deleted) — evict from the list.
          removeConversation(id);
        } else {
          // Transient (5xx / network / auth blip) — keep the row so the user
          // can retry; surface the failure via the error banner.
          setConversationsError(
            err instanceof Error ? err.message : "Failed to load conversation"
          );
        }
      }
    },
    [isLoading, activeConversationId, removeConversation]
  );

  const handleDeleteConversation = useCallback(
    async (id: number) => {
      // Optimistic remove — server returns 200 with a `{message: ...}` body
      // on success (we don't consume the body); if it errors we surface it
      // via the error banner and refetch to repair state.
      removeConversation(id);
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
        setConfirmedTools([]);
        partialAssistantRef.current = null;
        setPendingAttachments([]);
      }
      try {
        await deleteConversationApi(id);
      } catch (err) {
        setConversationsError(
          err instanceof Error ? err.message : "Failed to delete conversation"
        );
        // Reconcile against the server in case the optimistic remove diverged.
        void refreshConversations(agentType);
      }
    },
    [activeConversationId, agentType, refreshConversations, removeConversation]
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamedText, activeTool, confirmDialog, scrollToBottom]);

  // ── Attachment upload pipeline ────────────────────────────────────────────

  const uploadPending = useCallback(async (tempId: string, file: File) => {
    try {
      const attachment = await uploadAttachment(file);
      setPendingAttachments((prev) =>
        prev.map((p) =>
          p.tempId === tempId
            ? {
                ...p,
                status: "ready" as const,
                attachmentId: attachment.id,
                // Trust the server's sanitized filename / declared size / content_type
                // over what the browser claimed pre-upload.
                filename: attachment.filename,
                size: attachment.size,
                contentType: attachment.contentType,
              }
            : p
        )
      );
    } catch (err) {
      setPendingAttachments((prev) =>
        prev.map((p) =>
          p.tempId === tempId
            ? {
                ...p,
                status: "error" as const,
                error: err instanceof Error ? err.message : "Upload failed",
              }
            : p
        )
      );
    }
  }, []);

  const handleFilesPicked = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const room = ATTACHMENT_MAX_COUNT - pendingAttachments.length;
      if (room <= 0) return;

      const accepted: PendingAttachment[] = [];
      for (let i = 0; i < files.length && accepted.length < room; i++) {
        const file = files[i];
        // Client-side validation mirrors the backend exactly. Wrong types / oversized
        // files surface as immediate error pills with a clear reason — no round trip.
        if (!ATTACHMENT_ALLOWED_TYPES.includes(file.type as (typeof ATTACHMENT_ALLOWED_TYPES)[number])) {
          accepted.push({
            tempId: crypto.randomUUID(),
            file,
            filename: file.name,
            size: file.size,
            contentType: file.type || "application/octet-stream",
            status: "error",
            error: "Unsupported file type",
          });
          continue;
        }
        if (file.size > ATTACHMENT_MAX_SIZE) {
          accepted.push({
            tempId: crypto.randomUUID(),
            file,
            filename: file.name,
            size: file.size,
            contentType: file.type,
            status: "error",
            error: "File exceeds 10 MB limit",
          });
          continue;
        }
        accepted.push({
          tempId: crypto.randomUUID(),
          file,
          filename: file.name,
          size: file.size,
          contentType: file.type,
          status: "uploading",
        });
      }

      setPendingAttachments((prev) => [...prev, ...accepted]);
      // Fire uploads only for entries that passed client-side validation.
      for (const pending of accepted) {
        if (pending.status === "uploading") {
          void uploadPending(pending.tempId, pending.file);
        }
      }
    },
    [pendingAttachments.length, uploadPending]
  );

  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removePending = useCallback((tempId: string) => {
    // We intentionally don't call a delete endpoint here — even successful
    // uploads sit in /tmp and the backend's 1-hour sweeper will collect them.
    // Keeps the API surface minimal and avoids a roundtrip when the user is
    // just second-guessing their selection.
    setPendingAttachments((prev) => prev.filter((p) => p.tempId !== tempId));
  }, []);

  const retryPending = useCallback(
    (tempId: string) => {
      const target = pendingAttachments.find((p) => p.tempId === tempId);
      if (!target) return;
      // Skip retry for client-side rejections (wrong type / oversized) — those
      // would fail again identically. User can remove and pick a different file.
      if (
        !ATTACHMENT_ALLOWED_TYPES.includes(
          target.contentType as (typeof ATTACHMENT_ALLOWED_TYPES)[number]
        ) ||
        target.size > ATTACHMENT_MAX_SIZE
      ) {
        return;
      }
      setPendingAttachments((prev) =>
        prev.map((p) =>
          p.tempId === tempId
            ? { ...p, status: "uploading" as const, error: undefined }
            : p
        )
      );
      void uploadPending(tempId, target.file);
    },
    [pendingAttachments, uploadPending]
  );

  const buildMessagesForAPI = useCallback((): AgentMessage[] => {
    const apiMessages: AgentMessage[] = [];

    for (const msg of messages) {
      apiMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    return apiMessages;
  }, [messages]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const messageText = text || inputText.trim();
      // Block sends while uploads are still in flight; lets a user with only
      // attachments-and-no-text fire as soon as the upload(s) finish.
      if (isLoading || hasUploadingAttachment) return;
      if (!messageText && readyAttachmentCount === 0) return;

      // Snapshot ready attachments for this turn, then clear the input row.
      // Errored / pending pills are dropped — they were never sent.
      const readyAttachments = pendingAttachments.filter(
        (p) => p.status === "ready" && p.attachmentId
      );
      const attachmentIds = readyAttachments.map((p) => p.attachmentId as string);
      const attachmentMeta: AttachmentMeta[] = readyAttachments.map((p) => ({
        id: p.attachmentId as string,
        filename: p.filename,
        size: p.size,
        contentType: p.contentType,
      }));

      const userMsg: ChatMessage = {
        role: "user",
        content: messageText,
        ...(attachmentMeta.length > 0 ? { attachments: attachmentMeta } : {}),
      };
      // Capture the post-append messages list so optimistic upsert below can
      // count correctly (state updates are async, can't read `messages` for
      // the new total).
      const messagesAfterSend = [...messages, userMsg];
      setMessages(messagesAfterSend);
      setInputText("");
      setPendingAttachments([]);
      setIsLoading(true);
      setStreamedText("");
      setActiveTool(null);
      setConfirmDialog(null);

      // Capture the conversation id at send-time. If the backend assigns one
      // via the leading SSE event, this ref holds it for the onDone hook so we
      // can refetch the list with the right placeholder.
      let conversationIdForTurn: number | null = activeConversationId;

      // Build API messages including the new user message
      const apiMessages: AgentMessage[] = [
        ...buildMessagesForAPI(),
        { role: "user", content: messageText },
      ];

      // If we have a partial assistant message from a confirm flow, include it
      if (partialAssistantRef.current) {
        // Insert partial_assistant before the latest user message
        apiMessages.splice(apiMessages.length - 1, 0, {
          role: "partial_assistant",
          content: partialAssistantRef.current,
        });
        partialAssistantRef.current = null;
      }

      let fullText = "";

      try {
        await streamAgentChat(
          agentType,
          apiMessages,
          confirmedTools,
          {
          onConversationId: (id) => {
            // Pin the id for this turn + any follow-ups in this session. If
            // we already had one (existing convo), the backend should echo it
            // — overwriting with the same value is harmless.
            conversationIdForTurn = id;
            setActiveConversationId(id);
            // Optimistic placeholder so the chip appears immediately; refetch
            // after onDone replaces it with the server-derived title/count.
            const firstUserText = messagesAfterSend.find((m) => m.role === "user")?.content;
            const placeholderTitle = firstUserText
              ? firstUserText.slice(0, 60)
              : attachmentMeta[0]?.filename.slice(0, 60) ?? "New chat";
            upsertConversation({
              id,
              title: placeholderTitle,
              agent_type: agentType,
              updated_at: new Date().toISOString(),
              msg_count: messagesAfterSend.length,
            });
          },
          onText: (content) => {
            fullText += content;
            setStreamedText(fullText);
          },
          onToolExec: (tool) => {
            setActiveTool(tool);
          },
          onConfirm: (tool, input, message) => {
            setActiveTool(null);
            setConfirmDialog({ tool, input, message });
          },
          onPartialAssistant: (content) => {
            partialAssistantRef.current = content;
          },
          onDone: (mutations) => {
            setActiveTool(null);
            if (fullText) {
              setMessages((prev) => [
                ...prev,
                { role: "assistant" as const, content: fullText },
              ]);
              setStreamedText("");
            }
            setIsLoading(false);
            // Refetch the list so title / msg_count / updated_at land from
            // server truth. Only worth doing once we know the id (otherwise
            // the list is unchanged from this turn).
            if (conversationIdForTurn !== null) {
              void refreshConversations(agentType);
            }
            if (mutations.length > 0) {
              onMutation(mutations);
            }
          },
          onError: (message) => {
            setActiveTool(null);
            setIsLoading(false);
            setStreamedText("");
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: `Error: ${message}` },
            ]);
          },
          },
          attachmentIds.length > 0 ? attachmentIds : undefined,
          activeConversationId ?? undefined
        );
      } catch (err) {
        setIsLoading(false);
        setStreamedText("");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Connection error: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
        ]);
      }
    },
    [
      inputText,
      isLoading,
      hasUploadingAttachment,
      readyAttachmentCount,
      pendingAttachments,
      messages,
      activeConversationId,
      agentType,
      confirmedTools,
      buildMessagesForAPI,
      onMutation,
      refreshConversations,
      upsertConversation,
    ]
  );

  const handleConfirm = useCallback(
    (approved: boolean) => {
      if (!confirmDialog) return;

      if (approved) {
        setConfirmedTools((prev) => [...prev, confirmDialog.tool]);
        // Re-send with the tool confirmed
        sendMessage(`Yes, proceed with ${confirmDialog.tool}`);
      } else {
        sendMessage("No, cancel that operation.");
      }
      setConfirmDialog(null);
    },
    [confirmDialog, sendMessage]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleVoice = () => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      setInputText(transcript);

      if (event.results[event.results.length - 1].isFinal) {
        setIsRecording(false);
      }
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const hasSpeechAPI = !!(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );

  // Listen for commands from header input (and from other pages via the
  // bridge, e.g. WealthDigest's "Ask follow-up" button which dispatches
  // open_drawer just before/after navigating here).
  useEffect(() => {
    if (!command) return;
    if (command.type === "send_message") {
      setIsOpen(true);
      setTimeout(() => sendMessage(command.payload), 50);
    } else if (command.type === "load_conversation") {
      // The header dispatches the numeric id as a string (the command bridge
      // is a generic string payload). Parse defensively.
      const id = Number(command.payload);
      if (Number.isFinite(id)) {
        setIsOpen(true);
        void switchConversation(id);
      }
    } else if (command.type === "open_drawer") {
      // Payload is ignored — just open the drawer. Used when the caller
      // wants the drawer visible without sending or switching.
      setIsOpen(true);
    }
    clearCommand();
  }, [command, clearCommand, sendMessage, switchConversation]);

  // Only show the agent's own conversations even though the bridge may briefly
  // hold a prior agent's list during an agentType swap (mount-effect repopulates
  // shortly after).
  const visibleConversations = conversations.filter(
    (c) => c.agent_type === agentType
  );

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className={styles.overlay} onClick={() => setIsOpen(false)} />
      )}

      {/* Drawer */}
      {isOpen && (
        <div className={styles.drawer}>
          <div className={styles.header}>
            <h3>{AGENT_TITLES[agentType]}</h3>
            <button
              className={styles.closeBtn}
              onClick={() => setIsOpen(false)}
            >
              x
            </button>
          </div>

          {(visibleConversations.length > 0 || conversationsLoading) && (
            <div className={styles.historyBar}>
              <button
                className={`${styles.newChatBtn} ${
                  !activeConversationId ? styles.newChatBtnActive : ""
                }`}
                onClick={startNewChat}
                disabled={isLoading}
                title="New chat"
              >
                +
              </button>
              {visibleConversations.map((conv) => (
                <button
                  key={conv.id}
                  className={`${styles.historyChip} ${
                    conv.id === activeConversationId
                      ? styles.historyChipActive
                      : ""
                  }`}
                  onClick={() => switchConversation(conv.id)}
                  disabled={isLoading}
                  title={`${conv.title} (${conv.msg_count} msgs)`}
                >
                  <span className={styles.chipTitle}>{conv.title}</span>
                  <span
                    className={styles.chipDelete}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteConversation(conv.id);
                    }}
                  >
                    x
                  </span>
                </button>
              ))}
            </div>
          )}

          {conversationsError && (
            <div className={styles.conversationsError} role="alert">
              {conversationsError}
            </div>
          )}

          <div className={styles.messages}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`${styles.message} ${
                  msg.role === "user"
                    ? styles.userMessage
                    : styles.assistantMessage
                }`}
              >
                {msg.role === "user" && msg.attachments && msg.attachments.length > 0 && (
                  <div className={styles.messageAttachments}>
                    {msg.attachments.map((att) => {
                      const pillClass = att.expired
                        ? `${styles.attachmentPill} ${styles.attachmentPillStatic} ${styles.attachmentPillExpired}`
                        : `${styles.attachmentPill} ${styles.attachmentPillStatic}`;
                      const titleText = att.expired
                        ? `${att.filename} (${att.contentType}) — expired, no longer fetchable`
                        : `${att.filename} (${att.contentType})`;
                      return (
                        <span
                          key={`${att.id}-${i}`}
                          className={pillClass}
                          title={titleText}
                        >
                          <span className={styles.attachmentPillName}>
                            {att.filename}
                          </span>
                          <span className={styles.attachmentPillSize}>
                            {formatBytes(att.size)}
                          </span>
                          {att.expired && (
                            <span className={styles.attachmentPillExpiredTag}>
                              expired
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
                {msg.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            ))}

            {isLoading && !activeTool && !streamedText && !confirmDialog && (
              <div className={styles.thinkingIndicator}>
                <div className={styles.thinkingDots}>
                  <span />
                  <span />
                  <span />
                </div>
                Thinking...
              </div>
            )}

            {activeTool && (
              <div className={styles.toolChip}>
                <div className={styles.spinner} />
                {TOOL_LABELS[activeTool] || activeTool}...
              </div>
            )}

            {streamedText && (
              <div className={styles.streamingIndicator}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamedText}
                </ReactMarkdown>
              </div>
            )}

            {confirmDialog && (
              <div className={styles.confirmDialog}>
                <div className={styles.confirmMessage}>
                  {confirmDialog.message}
                </div>
                <div className={styles.confirmActions}>
                  <button
                    className={`${styles.confirmBtn} ${styles.confirmYes}`}
                    onClick={() => handleConfirm(true)}
                  >
                    Confirm
                  </button>
                  <button
                    className={`${styles.confirmBtn} ${styles.confirmNo}`}
                    onClick={() => handleConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {attachmentsEnabled && pendingAttachments.length > 0 && (
            <div className={styles.attachmentRow}>
              {pendingAttachments.map((p) => {
                const pillClass =
                  p.status === "error"
                    ? `${styles.attachmentPill} ${styles.attachmentPillError}`
                    : p.status === "uploading"
                      ? `${styles.attachmentPill} ${styles.attachmentPillUploading}`
                      : styles.attachmentPill;
                const isRetryable =
                  p.status === "error" &&
                  ATTACHMENT_ALLOWED_TYPES.includes(
                    p.contentType as (typeof ATTACHMENT_ALLOWED_TYPES)[number]
                  ) &&
                  p.size <= ATTACHMENT_MAX_SIZE;
                return (
                  <span
                    key={p.tempId}
                    className={pillClass}
                    title={
                      p.status === "error"
                        ? `${p.filename} — ${p.error || "failed"}${
                            isRetryable ? " (click to retry)" : ""
                          }`
                        : `${p.filename} (${p.contentType})`
                    }
                    onClick={
                      isRetryable ? () => retryPending(p.tempId) : undefined
                    }
                    style={
                      isRetryable ? { cursor: "pointer" } : undefined
                    }
                  >
                    {p.status === "uploading" && (
                      <span className={styles.attachmentPillSpinner} />
                    )}
                    <span className={styles.attachmentPillName}>
                      {p.filename}
                    </span>
                    <span className={styles.attachmentPillSize}>
                      {formatBytes(p.size)}
                    </span>
                    <button
                      type="button"
                      className={styles.attachmentPillRemove}
                      onClick={(e) => {
                        e.stopPropagation();
                        removePending(p.tempId);
                      }}
                      aria-label={`Remove ${p.filename}`}
                    >
                      x
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className={styles.inputArea}>
            {attachmentsEnabled && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ATTACHMENT_ACCEPT}
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => {
                    handleFilesPicked(e.target.files);
                    // Reset so picking the same file twice in a row still fires onChange.
                    e.target.value = "";
                  }}
                />
                <button
                  className={styles.attachBtn}
                  onClick={triggerFilePicker}
                  disabled={
                    isLoading ||
                    pendingAttachments.length >= ATTACHMENT_MAX_COUNT
                  }
                  title={
                    pendingAttachments.length >= ATTACHMENT_MAX_COUNT
                      ? `Max ${ATTACHMENT_MAX_COUNT} attachments`
                      : "Attach PDF or image (max 10MB)"
                  }
                >
                  {"\u{1F4CE}"}
                </button>
              </>
            )}
            <textarea
              ref={inputRef}
              className={styles.textInput}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your data..."
              rows={1}
              disabled={isLoading}
            />
            {hasSpeechAPI && (
              <button
                className={`${styles.micBtn} ${isRecording ? styles.micActive : ""}`}
                onClick={toggleVoice}
                title={isRecording ? "Stop recording" : "Voice input"}
              >
                {isRecording ? "||" : "\u{1F3A4}"}
              </button>
            )}
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage()}
              disabled={
                isLoading ||
                hasUploadingAttachment ||
                (!inputText.trim() && readyAttachmentCount === 0)
              }
              title="Send message"
            >
              {"\u{27A4}"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AgentChat;
