"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, ReactNode } from "react";

// create the type 
export type IsLoadingType = boolean;

interface IsLoadingContextType {
    isLoading: IsLoadingType;
    setIsLoading: Dispatch<SetStateAction<IsLoadingType>>;
}

const IsLoadingContext = createContext<IsLoadingContextType | undefined>(undefined);

function IsLoadingProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState<IsLoadingType>(false);

    return (
        <IsLoadingContext.Provider value={{ isLoading, setIsLoading }}>
            {children}
        </IsLoadingContext.Provider>
    );
}

function useIsLoading() {
    const context = useContext(IsLoadingContext);
    if (context === undefined) {
        throw new Error("useIsLoading must be used within a IsLoadingProvider");
    }
    return context;
}

export { IsLoadingProvider, useIsLoading };
