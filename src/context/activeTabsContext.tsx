"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext } from "react";

// create the type 
export type ActiveTabsType = number;

interface ActiveTabsContextType {
    activeTab: ActiveTabsType;
    setActiveTab: Dispatch<SetStateAction<ActiveTabsType>>;
}

const ActiveTabsContext = createContext<ActiveTabsContextType | undefined>(undefined);

function ActiveTabsProvider({ children }: { children: React.ReactNode }) {
    const [activeTab, setActiveTab] = useState<ActiveTabsType>(0);

    return (
        <ActiveTabsContext.Provider value={{ activeTab, setActiveTab }}>
            {children}
        </ActiveTabsContext.Provider>
    );
}

function useActiveTabs() {
    const context = useContext(ActiveTabsContext);
    if (context === undefined) {
        throw new Error("useActiveTabs must be used within a ActiveTabsProvider");
    }
    return context;
}

export { ActiveTabsProvider, useActiveTabs };
