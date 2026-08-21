import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  ReactNode,
} from "react";
import { AgentType, Conversation } from "../services/agentService";

interface AgentChatCommand {
  // - send_message: free-text payload; AgentChat opens the drawer + fires the
  //   payload as a user message.
  // - load_conversation: numeric conversation id as a string; AgentChat opens
  //   the drawer + switches to that thread.
  // - open_drawer: opens the drawer without sending or switching. Payload is
  //   ignored. Used by pages that want to trigger the drawer without a
  //   specific message — e.g. the WealthDigest "Ask follow-up" button, which
  //   navigates to a chat-hosting route and asks the drawer to open on
  //   arrival. Prevents the stale-command landmine: without this type, an
  //   Ask-follow-up click on a page that DOESN'T host AgentChat would leave
  //   a send_message command dangling in the bridge until the user's next
  //   navigation to Investments/Transactions/Freelance, at which point the
  //   drawer would spring open unexpectedly.
  type: "send_message" | "load_conversation" | "open_drawer";
  payload: string;
  timestamp: number;
}

interface AgentChatBridgeContextType {
  // ── Imperative command bridge (header → drawer) ─────────────────────────
  command: AgentChatCommand | null;
  setCommand: (cmd: AgentChatCommand) => void;
  clearCommand: () => void;

  // ── Shared conversation list (server-first, ak-5v9) ─────────────────────
  // The drawer (AgentChat) owns writes — fetches on mount, mutates on
  // send/delete. The header dropdown (AgentHeaderInput) is a read-only
  // consumer so both surfaces stay in sync without re-fetching twice.
  conversations: Conversation[];
  conversationsAgentType: AgentType | null;
  setConversations: (list: Conversation[], agentType: AgentType) => void;
  upsertConversation: (conv: Conversation) => void;
  removeConversation: (id: number) => void;
}

const AgentChatBridgeContext = createContext<
  AgentChatBridgeContextType | undefined
>(undefined);

interface AgentChatBridgeProviderProps {
  children: ReactNode;
}

const AgentChatBridgeProvider: React.FC<AgentChatBridgeProviderProps> = ({
  children,
}) => {
  const [command, setCommandState] = useState<AgentChatCommand | null>(null);
  const [conversations, setConversationsState] = useState<Conversation[]>([]);
  const [conversationsAgentType, setConversationsAgentType] =
    useState<AgentType | null>(null);

  const setCommand = useCallback(
    (cmd: AgentChatCommand) => setCommandState(cmd),
    []
  );
  const clearCommand = useCallback(() => setCommandState(null), []);

  const setConversations = useCallback(
    (list: Conversation[], agentType: AgentType) => {
      setConversationsAgentType(agentType);
      setConversationsState(list);
    },
    []
  );

  const upsertConversation = useCallback((conv: Conversation) => {
    setConversationsState((prev) => {
      const idx = prev.findIndex((c) => c.id === conv.id);
      // Reorder so the touched conversation moves to the top (matches the
      // server's updated_at DESC ordering after the next refetch).
      if (idx === -1) return [conv, ...prev];
      const next = [...prev];
      next.splice(idx, 1);
      return [conv, ...next];
    });
  }, []);

  const removeConversation = useCallback((id: number) => {
    setConversationsState((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return (
    <AgentChatBridgeContext.Provider
      value={{
        command,
        setCommand,
        clearCommand,
        conversations,
        conversationsAgentType,
        setConversations,
        upsertConversation,
        removeConversation,
      }}
    >
      {children}
    </AgentChatBridgeContext.Provider>
  );
};

const useAgentChatBridge = (): AgentChatBridgeContextType => {
  const context = useContext(AgentChatBridgeContext);
  if (!context) {
    throw new Error(
      "useAgentChatBridge must be used within an AgentChatBridgeProvider"
    );
  }
  return context;
};

export { AgentChatBridgeProvider, useAgentChatBridge };
