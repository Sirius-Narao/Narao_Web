"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, ReactNode } from "react";

// create the type 
export type SettingsOpenType = boolean;

interface SettingsOpenContextType {
    settingsOpen: SettingsOpenType;
    setSettingsOpen: Dispatch<SetStateAction<SettingsOpenType>>;
}

const SettingsOpenContext = createContext<SettingsOpenContextType | undefined>(undefined);

function SettingsOpenProvider({ children }: { children: ReactNode }) {
    const [settingsOpen, setSettingsOpen] = useState<SettingsOpenType>(false);

    return (
        <SettingsOpenContext.Provider value={{ settingsOpen, setSettingsOpen }}>
            {children}
        </SettingsOpenContext.Provider>
    );
}

function useSettingsOpen() {
    const context = useContext(SettingsOpenContext);
    if (context === undefined) {
        throw new Error("useSettingsOpen must be used within a SettingsOpenProvider");
    }
    return context;
}

export { SettingsOpenProvider, useSettingsOpen };
