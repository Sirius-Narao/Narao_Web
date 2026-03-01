"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, ReactNode } from "react";
import { ChatMessage } from "@/types/chatType";

interface ChatMessagesContextType {
    chatMessages: ChatMessage[];
    setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}

const ChatMessagesContext = createContext<ChatMessagesContextType | undefined>(undefined);

function ChatMessagesProvider({ children }: { children: ReactNode }) {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);


    return (
        <ChatMessagesContext.Provider value={{ chatMessages, setChatMessages }}>
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
