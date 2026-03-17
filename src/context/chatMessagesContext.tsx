"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, ReactNode, useEffect, useMemo } from "react";
import { ChatMessage } from "@/types/chatType";

interface ChatCacheEntry {
    messages: ChatMessage[];
    title: string;
}

interface ChatMessagesContextType {
    chatMessages: ChatMessage[];
    setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
    currentChatId: string | null;
    setCurrentChatId: Dispatch<SetStateAction<string | null>>;
    refreshTrigger: number;
    refreshChats: () => void;
    chatTitle: string;
    setChatTitle: Dispatch<SetStateAction<string>>;
    chatCache: Record<string, ChatCacheEntry>;
    setChatCache: Dispatch<SetStateAction<Record<string, ChatCacheEntry>>>;
}

const ChatMessagesContext = createContext<ChatMessagesContextType | undefined>(undefined);

function ChatMessagesProvider({ children }: { children: ReactNode }) {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [chatTitle, setChatTitle] = useState("New Chat");
    const [chatCache, setChatCache] = useState<Record<string, ChatCacheEntry>>({});

    // Keep cache in sync with active chat
    useEffect(() => {
        if (currentChatId) {
            setChatCache(prev => {
                const existing = prev[currentChatId];
                if (existing && existing.messages === chatMessages && existing.title === chatTitle) {
                    return prev;
                }
                return {
                    ...prev,
                    [currentChatId]: { messages: chatMessages, title: chatTitle }
                };
            });
        }
    }, [chatMessages, chatTitle, currentChatId]);

    const refreshChats = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    const value = useMemo(() => ({
        chatMessages,
        setChatMessages,
        currentChatId,
        setCurrentChatId,
        refreshTrigger,
        refreshChats,
        chatTitle,
        setChatTitle,
        chatCache,
        setChatCache
    }), [chatMessages, currentChatId, refreshTrigger, chatTitle, chatCache]);

    return (
        <ChatMessagesContext.Provider value={value}>
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
