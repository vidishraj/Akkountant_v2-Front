import { useState, useRef, useEffect } from "react";
import { AgentType } from "../../services/agentService";
import { useAgentChatBridge } from "../../contexts/AgentChatBridgeContext";
import styles from "./Header.module.scss";

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
  const { setCommand, conversations, conversationsAgentType } =
    useAgentChatBridge();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Show only conversations for the agent currently mounted in the page.
  // The bridge can briefly hold a prior agent's list during an agentType swap
  // — gating on conversationsAgentType keeps the dropdown from showing stale
  // entries from the previous tab.
  const visibleConversations =
    conversationsAgentType === agentType ? conversations : [];

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
    if (visibleConversations.length > 0) {
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

  const handleConversationClick = (id: number) => {
    setCommand({
      type: "load_conversation",
      // The command bridge carries a string payload — stringify the numeric
      // server id; the drawer parses it back with Number().
      payload: String(id),
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
      {showDropdown && visibleConversations.length > 0 && (
        <div className={styles.dropdown}>
          {visibleConversations.map((conv) => (
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
