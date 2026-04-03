"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, ReactNode, useEffect, useMemo, useCallback } from "react";
import { ChatMessage } from "@/types/chatType";

interface ChatCacheEntry {
    messages: ChatMessage[];
    title: string;
}

// ── Per-tab state ─────────────────────────────────────────────────────────────
interface TabChatState {
    chatId: string | null;
    messages: ChatMessage[];
    title: string;
}

interface ChatMessagesContextType {
    // ── Active-tab derived accessors (backward-compat API) ────────────────────
    chatMessages: ChatMessage[];
    setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
    currentChatId: string | null;
    setCurrentChatId: Dispatch<SetStateAction<string | null>>;
    chatTitle: string;
    setChatTitle: Dispatch<SetStateAction<string>>;

    // ── Shared across tabs ────────────────────────────────────────────────────
    refreshTrigger: number;
    refreshChats: () => void;
    chatCache: Record<string, ChatCacheEntry>;
    setChatCache: Dispatch<SetStateAction<Record<string, ChatCacheEntry>>>;

    // ── Per-tab state management ──────────────────────────────────────────────
    /** The tab id that is currently "active" in this context. */
    activeTabId: string | null;
    setActiveTabId: (tabId: string | null | ((prev: string | null) => string | null)) => void;
    /** Ensure a tab slot is initialised (call on tab open). */
    initTabState: (tabId: string) => void;
    /** Remove a tab's slot when the tab is closed. */
    removeTabState: (tabId: string) => void;
    /** Read full state for any tab (used by ChatsTab on mount). */
    getTabState: (tabId: string) => TabChatState | undefined;
    /** Overwrite a specific field for a specific tab (used by ChatsTab). */
    setTabState: (tabId: string, patch: Partial<TabChatState>) => void;
}

const ChatMessagesContext = createContext<ChatMessagesContextType | undefined>(undefined);

function ChatMessagesProvider({ children }: { children: ReactNode }) {
    // ── Per-tab state map ─────────────────────────────────────────────────────
    const [tabStates, setTabStates] = useState<Record<string, TabChatState>>({});
    const [activeTabId, setActiveTabIdState] = useState<string | null>(null);

    // ── Shared state ──────────────────────────────────────────────────────────
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [chatCache, setChatCache] = useState<Record<string, ChatCacheEntry>>({});

    // ── Per-tab helpers ───────────────────────────────────────────────────────
    const setActiveTabId = useCallback((tabId: string | null | ((prev: string | null) => string | null)) => {
        setActiveTabIdState(prev => typeof tabId === "function" ? tabId(prev) : tabId);
    }, []);

    const initTabState = useCallback((tabId: string) => {
        setTabStates(prev => {
            if (prev[tabId]) return prev; // already exists
            return { ...prev, [tabId]: { chatId: null, messages: [], title: "New Chat" } };
        });
    }, []);

    const removeTabState = useCallback((tabId: string) => {
        setTabStates(prev => {
            const next = { ...prev };
            delete next[tabId];
            return next;
        });
    }, []);

    const getTabState = useCallback((tabId: string): TabChatState | undefined => {
        return tabStates[tabId];
    }, [tabStates]);

    const setTabState = useCallback((tabId: string, patch: Partial<TabChatState>) => {
        setTabStates(prev => {
            const existing = prev[tabId] ?? { chatId: null, messages: [], title: "New Chat" };
            return { ...prev, [tabId]: { ...existing, ...patch } };
        });
    }, []);

    // ── Active-tab derived state (backward-compat) ────────────────────────────
    const activeState: TabChatState = activeTabId
        ? (tabStates[activeTabId] ?? { chatId: null, messages: [], title: "New Chat" })
        : { chatId: null, messages: [], title: "New Chat" };

    const chatMessages = activeState.messages;
    const currentChatId = activeState.chatId;
    const chatTitle = activeState.title;

    const setChatMessages: Dispatch<SetStateAction<ChatMessage[]>> = useCallback((value) => {
        if (!activeTabId) return;
        setTabStates(prev => {
            const existing = prev[activeTabId] ?? { chatId: null, messages: [], title: "New Chat" };
            const next = typeof value === "function" ? (value as (v: ChatMessage[]) => ChatMessage[])(existing.messages) : value;
            if (next === existing.messages) return prev;
            return { ...prev, [activeTabId]: { ...existing, messages: next } };
        });
    }, [activeTabId]);

    const setCurrentChatId: Dispatch<SetStateAction<string | null>> = useCallback((value) => {
        if (!activeTabId) return;
        setTabStates(prev => {
            const existing = prev[activeTabId] ?? { chatId: null, messages: [], title: "New Chat" };
            const next = typeof value === "function" ? (value as (v: string | null) => string | null)(existing.chatId) : value;
            if (next === existing.chatId) return prev;
            return { ...prev, [activeTabId]: { ...existing, chatId: next } };
        });
    }, [activeTabId]);

    const setChatTitle: Dispatch<SetStateAction<string>> = useCallback((value) => {
        if (!activeTabId) return;
        setTabStates(prev => {
            const existing = prev[activeTabId] ?? { chatId: null, messages: [], title: "New Chat" };
            const next = typeof value === "function" ? (value as (v: string) => string)(existing.title) : value;
            if (next === existing.title) return prev;
            return { ...prev, [activeTabId]: { ...existing, title: next } };
        });
    }, [activeTabId]);

    // ── Keep cache in sync with active chat ───────────────────────────────────
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

    const refreshChats = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

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
        setChatCache,
        activeTabId,
        setActiveTabId,
        initTabState,
        removeTabState,
        getTabState,
        setTabState,
    }), [
        chatMessages, setChatMessages,
        currentChatId, setCurrentChatId,
        refreshTrigger, refreshChats,
        chatTitle, setChatTitle,
        chatCache,
        activeTabId, setActiveTabId,
        initTabState, removeTabState, getTabState, setTabState,
    ]);

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
export type { TabChatState };
