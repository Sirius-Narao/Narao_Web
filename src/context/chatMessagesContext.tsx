"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, ReactNode } from "react";
import { ChatMessage } from "@/types/chatType";

interface ChatMessagesContextType {
    chatMessages: ChatMessage[];
    setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
    currentChatId: string | null;
    setCurrentChatId: Dispatch<SetStateAction<string | null>>;
    refreshTrigger: number;
    refreshChats: () => void;
    chatTitle: string;
    setChatTitle: Dispatch<SetStateAction<string>>;
}

const ChatMessagesContext = createContext<ChatMessagesContextType | undefined>(undefined);

function ChatMessagesProvider({ children }: { children: ReactNode }) {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [chatTitle, setChatTitle] = useState("New Chat");

    const refreshChats = () => {
        setRefreshTrigger(prev => prev + 1);
    };


    return (
        <ChatMessagesContext.Provider value={{ chatMessages, setChatMessages, currentChatId, setCurrentChatId, refreshTrigger, refreshChats, chatTitle, setChatTitle }}>
            {children}
        </ChatMessagesContext.Provider>
    );
}

function useChatMessages() {
    const context = useContext(ChatMessagesContext);
    if (context === undefined) {
        throw new Error("useChatMessages must be used within a ChatMessagesProvider");
    }
    return context;
}

export { ChatMessagesProvider, useChatMessages };
