"use client";
import { useState, createContext, useContext, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TabType = "folder" | "note" | "chat" | "home";

export interface Tab {
    id: string;
    type: TabType;
    /** Displayed title in the tab card */
    title: string;
    /** For folder tabs – current path string, e.g. "/Projects/Work" */
    location?: string;
    /** For note tabs */
    noteId?: string;
    /** For chat tabs */
    chatId?: string;
}

interface TabsContextType {
    tabs: Tab[];
    activeTabId: string | null;
    activeTab: Tab | null;
    openTab: (tab: Omit<Tab, "id">) => string;
    closeTab: (id: string) => void;
    setActiveTabId: (id: string) => void;
    updateTabTitle: (id: string, title: string) => void;
    updateTabLocation: (id: string, location: string) => void;
    updateTabNoteId: (id: string, noteId: string | undefined) => void;
    updateTabChatId: (id: string, chatId: string | undefined) => void;
    moveTab: (fromIndex: number, toIndex: number) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _counter = 0;
function genId(): string {
    return `tab-${Date.now()}-${_counter++}`;
}

const DEFAULT_TITLE: Record<TabType, string> = {
    folder: "Folders",
    note: "Notes",
    chat: "New Chat",
    home: "Home",
};

// ─── Context ─────────────────────────────────────────────────────────────────

const TabsContext = createContext<TabsContextType | undefined>(undefined);

function TabsProvider({ children }: { children: React.ReactNode }) {
    const initialId = genId();
    const [tabs, setTabs] = useState<Tab[]>([
        { id: initialId, type: "home", title: "Home", location: "/" },
    ]);
    const [activeTabId, setActiveTabIdState] = useState<string | null>(initialId);

    const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

    const setActiveTabId = useCallback((id: string) => {
        setActiveTabIdState(id);
    }, []);

    const openTab = useCallback((tabData: Omit<Tab, "id">): string => {
        const id = genId();
        const newTab: Tab = {
            ...tabData,
            id,
            title: tabData.title || DEFAULT_TITLE[tabData.type],
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabIdState(id);
        return id;
    }, []);

    const closeTab = useCallback((id: string) => {
        setTabs((prev) => {
            const idx = prev.findIndex((t) => t.id === id);
            const next = prev.filter((t) => t.id !== id);
            // If we closed the active tab, activate adjacent tab
            setActiveTabIdState((current) => {
                if (current !== id) return current;
                const newActive = next[Math.max(0, idx - 1)];
                return newActive?.id ?? null;
            });
            return next;
        });
    }, []);

    const updateTabTitle = useCallback((id: string, title: string) => {
        setTabs((prev) => {
            const tab = prev.find(t => t.id === id);
            if (tab && tab.title === title) return prev;
            return prev.map((t) => (t.id === id ? { ...t, title } : t));
        });
    }, []);

    const updateTabLocation = useCallback((id: string, location: string) => {
        setTabs((prev) => {
            const tab = prev.find(t => t.id === id);
            if (tab && tab.location === location) return prev;
            return prev.map((t) => (t.id === id ? { ...t, location } : t));
        });
    }, []);

    const updateTabNoteId = useCallback((id: string, noteId: string | undefined) => {
        setTabs((prev) => {
            const tab = prev.find(t => t.id === id);
            if (tab && tab.noteId === noteId) return prev;
            return prev.map((t) => (t.id === id ? { ...t, noteId } : t));
        });
    }, []);

    const updateTabChatId = useCallback((id: string, chatId: string | undefined) => {
        setTabs((prev) => {
            const tab = prev.find(t => t.id === id);
            if (tab && tab.chatId === chatId) return prev;
            return prev.map((t) => (t.id === id ? { ...t, chatId } : t));
        });
    }, []);

    const moveTab = useCallback((fromIndex: number, toIndex: number) => {
        setTabs((prev) => {
            const next = [...prev];
            const [removed] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, removed);
            return next;
        });
    }, []);

    return (
        <TabsContext.Provider
            value={{
                tabs,
                activeTabId,
                activeTab,
                openTab,
                closeTab,
                setActiveTabId,
                updateTabTitle,
                updateTabLocation,
                updateTabNoteId,
                updateTabChatId,
                moveTab,
            }}
        >
            {children}
        </TabsContext.Provider>
    );
}

function useTabs() {
    const context = useContext(TabsContext);
    if (context === undefined) {
        throw new Error("useTabs must be used within a TabsProvider");
    }
    return context;
}

export { TabsProvider, useTabs };
