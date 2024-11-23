// src/context/UserContext.tsx
import {createContext, useContext, useState, ReactNode} from 'react';
import {User} from 'firebase/auth';

type UserContextType = {
    user: User | null;
    setUser: (user: User | null) => void;
    optedBanks: string[];
    setOptedBanks: (state: string[]) => void;
    transactionModeSelection: boolean; //false for files, true for transactions
    setTransactionMode: (state: boolean) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({children}: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [transactionModeSelection, setTransactionMode] = useState<boolean>(true);
    const [optedBanks, setOptedBanks] = useState<string[]>([]);

    return (
        <UserContext.Provider
            value={{user, setUser, transactionModeSelection, setTransactionMode, optedBanks, setOptedBanks}}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
