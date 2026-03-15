interface ToolCall {
    name: string;
    args: Record<string, any>;
    status: 'loading' | 'done' | 'error';
    result?: string;
}

type MessagePart =
    | { type: 'text'; content: string }
    | { type: 'toolCall'; toolCall: ToolCall }

interface ChatType {
    id?: string;
    title: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
}

interface ChatAttachment {
    id: string;
    message_id?: string;
    file_url: string;
    file_name: string;
    file_type: string;    // generic label: "image" | "pdf"
    mime_type: string;    // actual MIME type, e.g. "image/png", "application/pdf"
    file_size: number;
    created_at: Date;
}

interface ChatMessage {
    id: string;
    content: string;
    thought?: string;
    thinkingTime?: number;
    createdAt: Date;
    role: "user" | "assistant";
    attachments?: ChatAttachment[];
    toolCalls?: ToolCall[];
    messageParts?: MessagePart[];
    isDone?: boolean;
}

interface Models {
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-3-flash-preview": "Gemini 3 Flash",
    // Defective model, it doesn't work well with tools
    // "gemini-3.1-flash-lite-preview": "Gemini 3.1 Flash Lite"
}

export type { ChatType, ChatMessage, ChatAttachment, Models, ToolCall, MessagePart };