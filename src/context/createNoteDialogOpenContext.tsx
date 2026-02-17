"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, ReactNode } from "react";

// create the type 
export type CreateNoteDialogOpenType = boolean;

interface CreateNoteDialogOpenContextType {
    createNoteDialogOpen: CreateNoteDialogOpenType;
    setCreateNoteDialogOpen: Dispatch<SetStateAction<CreateNoteDialogOpenType>>;
}

const CreateNoteDialogOpenContext = createContext<CreateNoteDialogOpenContextType | undefined>(undefined);

function CreateNoteDialogOpenProvider({ children }: { children: ReactNode }) {
    const [createNoteDialogOpen, setCreateNoteDialogOpen] = useState<CreateNoteDialogOpenType>(false);

    return (
        <CreateNoteDialogOpenContext.Provider value={{ createNoteDialogOpen, setCreateNoteDialogOpen }}>
            {children}
        </CreateNoteDialogOpenContext.Provider>
    );
}

function useCreateNoteDialogOpen() {
    const context = useContext(CreateNoteDialogOpenContext);
    if (context === undefined) {
        throw new Error("useCreateNoteDialogOpen must be used within a CreateNoteDialogOpenProvider");
    }
    return context;
}

export { CreateNoteDialogOpenProvider, useCreateNoteDialogOpen };
