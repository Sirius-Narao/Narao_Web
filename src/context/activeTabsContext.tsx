"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext } from "react";

// create the type 
export type ActiveTabsType = number;

interface ActiveTabsContextType {
    activeTabs: ActiveTabsType;
    setActiveTabs: Dispatch<SetStateAction<ActiveTabsType>>;
}

const ActiveTabsContext = createContext<ActiveTabsContextType | undefined>(undefined);

function ActiveTabsProvider({ children }: { children: React.ReactNode }) {
    const [activeTabs, setActiveTabs] = useState<ActiveTabsType>(0);

    return (
        <ActiveTabsContext.Provider value={{ activeTabs, setActiveTabs }}>
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
