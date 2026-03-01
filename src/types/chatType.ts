interface ChatType {
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
    createdAt: Date;
    role: "user" | "assistant";
    attachments?: ChatAttachment[];
}

export type { ChatType, ChatMessage, ChatAttachment };