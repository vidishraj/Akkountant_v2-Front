import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  streamAgentChat,
  AgentType,
  AgentMessage,
} from "../../services/agentService";
import styles from "./AgentChat.module.scss";
import { useAgentChatBridge } from "../../contexts/AgentChatBridgeContext";

interface AgentChatProps {
  agentType: AgentType;
  onMutation: (mutations: string[]) => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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

  const { command, clearCommand } = useAgentChatBridge();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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
          const title = firstUserMsg
            ? firstUserMsg.content.slice(0, 30)
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
      if (!messageText || isLoading) return;

      const userMsg: ChatMessage = { role: "user", content: messageText };
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
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
        await streamAgentChat(agentType, apiMessages, confirmedTools, {
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
        });
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
                {msg.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            ))}

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

          <div className={styles.inputArea}>
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
              disabled={!inputText.trim() || isLoading}
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
