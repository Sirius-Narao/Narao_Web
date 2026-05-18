"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import { ChatAttachment } from "@/types/chatType";

interface PendingEdit {
    messageId: string;
    content: string;
    attachments?: ChatAttachment[];
}

interface EditMessageContextType {
    pendingEdit: PendingEdit | null;
    requestEdit: (messageId: string, content: string, attachments?: ChatAttachment[]) => void;
    clearEdit: () => void;
    pendingRegenerate: string | null; // assistantMessageId to regenerate
    requestRegenerate: (assistantMessageId: string) => void;
    clearRegenerate: () => void;
    pendingQuickSend: string | null; // pre-filled content to immediately send
    requestQuickSend: (content: string) => void;
    clearQuickSend: () => void;
}

const EditMessageContext = createContext<EditMessageContextType | undefined>(undefined);

function EditMessageProvider({ children }: { children: ReactNode }) {
    const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
    const [pendingRegenerate, setPendingRegenerate] = useState<string | null>(null);
    const [pendingQuickSend, setPendingQuickSend] = useState<string | null>(null);

    const requestEdit = (messageId: string, content: string, attachments?: ChatAttachment[]) => {
        setPendingEdit({ messageId, content, attachments });
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

    const requestQuickSend = (content: string) => {
        setPendingQuickSend(content);
    };

    const clearQuickSend = () => {
        setPendingQuickSend(null);
    };

    return (
        <EditMessageContext.Provider value={{ pendingEdit, requestEdit, clearEdit, pendingRegenerate, requestRegenerate, clearRegenerate, pendingQuickSend, requestQuickSend, clearQuickSend }}>
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
