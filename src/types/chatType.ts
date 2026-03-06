interface ChatType {
    id?: string;
    title: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
}

interface ChatAttachment {
    id: string;
    messageId?: string;
    url: string;
    name: string;
    type: string;
    size: number;
    createdAt: Date;
}

interface ChatMessage {
    id: string;
    content: string;
    thought?: string;
    thinkingTime?: number;
    createdAt: Date;
    role: "user" | "assistant";
    attachments?: ChatAttachment[];
    isDone?: boolean;
}

interface Models {
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-3-flash-preview": "Gemini 3 Flash",
    "gemini-3.1-flash-lite-preview": "Gemini 3.1 Flash Lite"
}

export type { ChatType, ChatMessage, ChatAttachment, Models };