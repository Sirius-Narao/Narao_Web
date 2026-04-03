"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, ReactNode } from "react";
import { Note, FetchedNotes } from "@/types/folderStructureTypes";

interface FetchedNotesContextType {
    fetchedNotes: FetchedNotes;
    setFetchedNotes: Dispatch<SetStateAction<FetchedNotes>>;
    loading: boolean;
    setLoading: Dispatch<SetStateAction<boolean>>;
}


const FetchedNotesContext = createContext<FetchedNotesContextType | undefined>(undefined);

function FetchedNotesProvider({ children }: { children: ReactNode }) {
    const [fetchedNotes, setFetchedNotes] = useState<FetchedNotes>([]);
    const [loading, setLoading] = useState<boolean>(false);

    return (
        <FetchedNotesContext.Provider value={{ fetchedNotes, setFetchedNotes, loading, setLoading }}>
            {children}
        </FetchedNotesContext.Provider>
    );
}

function useFetchedNotes() {
    const context = useContext(FetchedNotesContext);
    if (context === undefined) {
        throw new Error("useFetchedNotes must be used within a FetchedNotesProvider");
    }
    return context;
}

export { FetchedNotesProvider, useFetchedNotes };
