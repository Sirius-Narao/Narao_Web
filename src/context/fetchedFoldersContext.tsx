"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, ReactNode } from "react";
import { Folder, FetchedFolders } from "@/types/folderStructureTypes";

interface FetchedFoldersContextType {
    fetchedFolders: FetchedFolders;
    setFetchedFolders: Dispatch<SetStateAction<FetchedFolders>>;
}


const FetchedFoldersContext = createContext<FetchedFoldersContextType | undefined>(undefined);

function FetchedFoldersProvider({ children }: { children: ReactNode }) {
    const [fetchedFolders, setFetchedFolders] = useState<FetchedFolders>([]);


    return (
        <FetchedFoldersContext.Provider value={{ fetchedFolders, setFetchedFolders }}>
            {children}
        </FetchedFoldersContext.Provider>
    );
}

function useFetchedFolders() {
    const context = useContext(FetchedFoldersContext);
    if (context === undefined) {
        throw new Error("useFetchedFolders must be used within a FetchedFoldersProvider");
    }
    return context;
}

export { FetchedFoldersProvider, useFetchedFolders };

