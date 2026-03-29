"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, useEffect } from "react";
import { Settings } from "@/types/settingsType";

// create the type
export type SettingsType = Settings;

interface SettingsContextType {
    settings: SettingsType;
    setSettings: Dispatch<SetStateAction<SettingsType>>;
}

const SETTINGS_STORAGE_KEY = "narao_settings";

const defaultSettings: SettingsType = {
    theme: "system",
    language: "en",
    customInstructions: {
        aboutUser: "",
        customPrompt: "",
    },
    plan: "free",
    aiName: "Narao AI",
};

function loadSettings(): SettingsType {
    try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
            return { ...defaultSettings, ...JSON.parse(stored) };
        }
    } catch {
        // localStorage unavailable or corrupt — fall back to defaults
    }
    return defaultSettings;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<SettingsType>(defaultSettings);

    // Load from localStorage on mount (client-side only)
    useEffect(() => {
        setSettings(loadSettings());
    }, []);

    // Persist to localStorage whenever settings change
    useEffect(() => {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        } catch {
            // localStorage unavailable — silently ignore
        }
    }, [settings]);

    return (
        <SettingsContext.Provider value={{ settings, setSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
}

export { SettingsProvider, useSettings };
