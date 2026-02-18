import React, { createContext, useState, useContext, ReactNode } from "react";

interface AgentChatCommand {
  type: "send_message" | "load_conversation";
  payload: string;
  timestamp: number;
}

interface AgentChatBridgeContextType {
  command: AgentChatCommand | null;
  setCommand: (cmd: AgentChatCommand) => void;
  clearCommand: () => void;
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

  const setCommand = (cmd: AgentChatCommand) => setCommandState(cmd);
  const clearCommand = () => setCommandState(null);

  return (
    <AgentChatBridgeContext.Provider
      value={{ command, setCommand, clearCommand }}
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
