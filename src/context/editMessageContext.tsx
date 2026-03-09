"use client";
import { createContext, useContext, useState, ReactNode } from "react";

interface PendingEdit {
    messageId: string;
    content: string;
}

interface EditMessageContextType {
    pendingEdit: PendingEdit | null;
    requestEdit: (messageId: string, content: string) => void;
    clearEdit: () => void;
    pendingRegenerate: string | null; // assistantMessageId to regenerate
    requestRegenerate: (assistantMessageId: string) => void;
    clearRegenerate: () => void;
}

const EditMessageContext = createContext<EditMessageContextType | undefined>(undefined);

function EditMessageProvider({ children }: { children: ReactNode }) {
    const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
    const [pendingRegenerate, setPendingRegenerate] = useState<string | null>(null);

    const requestEdit = (messageId: string, content: string) => {
        setPendingEdit({ messageId, content });
    };

    const clearEdit = () => {
        setPendingEdit(null);
    };

    const requestRegenerate = (assistantMessageId: string) => {
        setPendingRegenerate(assistantMessageId);
    };

    const clearRegenerate = () => {
        setPendingRegenerate(null);
    };

    return (
        <EditMessageContext.Provider value={{ pendingEdit, requestEdit, clearEdit, pendingRegenerate, requestRegenerate, clearRegenerate }}>
            {children}
        </EditMessageContext.Provider>
    );
}

function useEditMessage() {
    const context = useContext(EditMessageContext);
    if (context === undefined) {
        throw new Error("useEditMessage must be used within an EditMessageProvider");
    }
    return context;
}

export { EditMessageProvider, useEditMessage };
