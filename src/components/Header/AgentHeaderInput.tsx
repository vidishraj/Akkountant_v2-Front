import { useState, useRef, useEffect, useCallback } from "react";
import { AgentType } from "../../services/agentService";
import { useAgentChatBridge } from "../../contexts/AgentChatBridgeContext";
import styles from "./Header.module.scss";

interface SavedConversation {
  id: string;
  title: string;
  timestamp: number;
}

const STORAGE_KEY_PREFIX = "agent-chat-history-";

const PLACEHOLDER: Record<AgentType, string> = {
  transaction: "Ask about transactions...",
  investment: "Ask about investments...",
  freelance: "Ask about freelance...",
};

interface AgentHeaderInputProps {
  agentType: AgentType;
}

const AgentHeaderInput = ({ agentType }: AgentHeaderInputProps) => {
  const [text, setText] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const { setCommand } = useAgentChatBridge();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(() => {
    try {
      const stored = localStorage.getItem(
        `${STORAGE_KEY_PREFIX}${agentType}`
      );
      if (stored) {
        const parsed = JSON.parse(stored) as SavedConversation[];
        setConversations(parsed);
      } else {
        setConversations([]);
      }
    } catch {
      setConversations([]);
    }
  }, [agentType]);

  // Reload conversations when agentType changes
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFocus = () => {
    loadConversations();
    if (conversations.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && text.trim()) {
      e.preventDefault();
      setCommand({
        type: "send_message",
        payload: text.trim(),
        timestamp: Date.now(),
      });
      setText("");
      setShowDropdown(false);
    }
  };

  const handleConversationClick = (id: string) => {
    setCommand({
      type: "load_conversation",
      payload: id,
      timestamp: Date.now(),
    });
    setShowDropdown(false);
  };

  return (
    <div className={styles.headerInput} ref={wrapperRef}>
      <input
        className={styles.headerInputField}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={PLACEHOLDER[agentType]}
      />
      {showDropdown && conversations.length > 0 && (
        <div className={styles.dropdown}>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={styles.dropdownItem}
              onMouseDown={() => handleConversationClick(conv.id)}
            >
              {conv.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentHeaderInput;
