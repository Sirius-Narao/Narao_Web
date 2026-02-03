"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext } from "react";

// create the type 
export type AreaLocationType = "folders" | "notes" | "chats";

interface AreaLocationContextType {
    areaLocation: AreaLocationType;
    setAreaLocation: Dispatch<SetStateAction<AreaLocationType>>;
}

const AreaLocationContext = createContext<AreaLocationContextType | undefined>(undefined);

function AreaLocationProvider({ children }: { children: React.ReactNode }) {
    const [areaLocation, setAreaLocation] = useState<AreaLocationType>("folders");

    return (
        <AreaLocationContext.Provider value={{ areaLocation, setAreaLocation }}>
            {children}
        </AreaLocationContext.Provider>
    );
}

function useAreaLocation() {
    const context = useContext(AreaLocationContext);
    if (context === undefined) {
        throw new Error("useAreaLocation must be used within a AreaLocationProvider");
    }
    return context;
}

export { AreaLocationProvider, useAreaLocation };
