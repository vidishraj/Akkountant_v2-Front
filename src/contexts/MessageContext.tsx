import React, {createContext, useState, useContext, ReactNode} from 'react';

// Define the interface for the context state
interface MessagePayload {
    message: string;
    type: string;
}

interface MessageContextProp {
    payload: MessagePayload;
    setPayload: React.Dispatch<React.SetStateAction<MessagePayload>>;
}

// Create a context with a default value
const MessageContext = createContext<MessageContextProp | undefined>(undefined);

// Create a provider component
interface MessageProviderProps {
    children: ReactNode;
}

const MessageProvider: React.FC<MessageProviderProps> = ({children}) => {
    const [payload, setPayload] = useState<MessagePayload>({
        message: '',
        type: '',
    });

    return (
        <MessageContext.Provider value={{payload, setPayload}}>
            {children}
        </MessageContext.Provider>
    );
};

// Create a custom hook to consume the context
const useMessage = (): MessageContextProp => {
    const context = useContext(MessageContext);
    if (!context) {
        throw new Error('useMessage must be used within a MessageProvider');
    }
    return context;
};

export {MessageProvider, useMessage};
