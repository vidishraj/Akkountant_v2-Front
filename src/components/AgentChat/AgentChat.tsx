import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  streamAgentChat,
  uploadAttachment,
  AgentType,
  AgentMessage,
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

/**
 * Attachment metadata persisted on a sent ChatMessage so its pills can re-render
 * on history reload. The id here is the backend uuid — but it is single-use and
 * already cleaned up server-side by the time we render history, so the pill is
 * purely informational (no re-attach / no preview-fetch).
 */
interface AttachmentMeta {
  id: string;
  filename: string;
  size: number;
  contentType: string;
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

interface SavedConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: number;
}

interface ConfirmState {
  tool: string;
  input: Record<string, unknown>;
  message: string;
}

const MAX_CONVERSATIONS = 5;
const STORAGE_KEY_PREFIX = "agent-chat-history-";

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
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  // Store partial assistant content for conversation continuity after confirm
  const partialAssistantRef = useRef<object[] | null>(null);

  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  const { command, clearCommand } = useAgentChatBridge();
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

  // Load conversations from localStorage on mount / agentType change
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${agentType}`);
      if (stored) {
        setConversations(JSON.parse(stored));
      } else {
        setConversations([]);
      }
    } catch {
      setConversations([]);
    }
    setActiveConversationId(null);
    setMessages([]);
    setConfirmedTools([]);
    partialAssistantRef.current = null;
    setPendingAttachments([]);
  }, [agentType]);

  // Persist conversations to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${agentType}`,
      JSON.stringify(conversations)
    );
  }, [conversations, agentType]);

  const saveCurrentConversation = useCallback(
    (currentMessages: ChatMessage[]) => {
      if (currentMessages.length === 0) return;

      setConversations((prev) => {
        if (activeConversationId) {
          // Update existing conversation
          return prev.map((c) =>
            c.id === activeConversationId
              ? { ...c, messages: currentMessages, timestamp: Date.now() }
              : c
          );
        } else {
          // Create new conversation
          const firstUserMsg = currentMessages.find((m) => m.role === "user");
          // Fall back to the first attachment's filename when the user sent
          // attachments-only (no text) — otherwise the history chip is blank.
          const trimmedText = firstUserMsg?.content.trim();
          const title = trimmedText
            ? trimmedText.slice(0, 30)
            : firstUserMsg?.attachments?.[0]
              ? firstUserMsg.attachments[0].filename.slice(0, 30)
              : "New chat";
          const newConv: SavedConversation = {
            id: crypto.randomUUID(),
            title,
            messages: currentMessages,
            timestamp: Date.now(),
          };
          setActiveConversationId(newConv.id);
          const updated = [newConv, ...prev];
          if (updated.length > MAX_CONVERSATIONS) {
            updated.pop();
          }
          return updated;
        }
      });
    },
    [activeConversationId]
  );

  const startNewChat = useCallback(() => {
    if (isLoading) return;
    setActiveConversationId(null);
    setMessages([]);
    setConfirmedTools([]);
    partialAssistantRef.current = null;
    setPendingAttachments([]);
  }, [isLoading]);

  const switchConversation = useCallback(
    (id: string) => {
      if (isLoading || id === activeConversationId) return;
      const conv = conversations.find((c) => c.id === id);
      if (!conv) return;
      setActiveConversationId(id);
      setMessages(conv.messages);
      setConfirmedTools([]);
      partialAssistantRef.current = null;
      setPendingAttachments([]);
    },
    [isLoading, activeConversationId, conversations]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
        setConfirmedTools([]);
        partialAssistantRef.current = null;
        setPendingAttachments([]);
      }
    },
    [activeConversationId]
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
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
      setPendingAttachments([]);
      setIsLoading(true);
      setStreamedText("");
      setActiveTool(null);
      setConfirmDialog(null);

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
              setMessages((prev) => {
                const updated = [
                  ...prev,
                  { role: "assistant" as const, content: fullText },
                ];
                // Save after state update via setTimeout to let React commit
                setTimeout(() => saveCurrentConversation(updated), 0);
                return updated;
              });
              setStreamedText("");
            } else {
              // No text but we still want to save if messages exist
              setMessages((prev) => {
                if (prev.length > 0) {
                  setTimeout(() => saveCurrentConversation(prev), 0);
                }
                return prev;
              });
            }
            setIsLoading(false);
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
          attachmentIds.length > 0 ? attachmentIds : undefined
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
      agentType,
      confirmedTools,
      buildMessagesForAPI,
      onMutation,
      saveCurrentConversation,
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

  // Listen for commands from header input
  useEffect(() => {
    if (!command) return;
    if (command.type === "send_message") {
      setIsOpen(true);
      setTimeout(() => sendMessage(command.payload), 50);
    } else if (command.type === "load_conversation") {
      setIsOpen(true);
      switchConversation(command.payload);
    }
    clearCommand();
  }, [command, clearCommand, sendMessage, switchConversation]);

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

          {conversations.length > 0 && (
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
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  className={`${styles.historyChip} ${
                    conv.id === activeConversationId
                      ? styles.historyChipActive
                      : ""
                  }`}
                  onClick={() => switchConversation(conv.id)}
                  disabled={isLoading}
                  title={conv.title}
                >
                  <span className={styles.chipTitle}>{conv.title}</span>
                  <span
                    className={styles.chipDelete}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                  >
                    x
                  </span>
                </button>
              ))}
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
                    {msg.attachments.map((att) => (
                      <span
                        key={att.id}
                        className={`${styles.attachmentPill} ${styles.attachmentPillStatic}`}
                        title={`${att.filename} (${att.contentType})`}
                      >
                        <span className={styles.attachmentPillName}>
                          {att.filename}
                        </span>
                        <span className={styles.attachmentPillSize}>
                          {formatBytes(att.size)}
                        </span>
                      </span>
                    ))}
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
