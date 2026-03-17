import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowUp, Edit, FileImage, FileTypeCorner, Leaf, Lightbulb, Mic, Plus, Square, X, Zap } from "lucide-react"
import { useState, useRef, useEffect, Dispatch, SetStateAction } from "react"
import { useChatMessages } from "@/context/chatMessagesContext"
import { ChatMessage, ChatAttachment, Models, ToolCall, MessagePart } from "@/types/chatType"
import { v4 as uuidv4 } from "uuid"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { useUser } from "@/context/userContext"
import { useTabs } from "@/context/tabsContext"
import { useIsLoading } from "@/context/isLoadingContext"
import { useEditMessage } from "@/context/editMessageContext"
import { cn } from "@/lib/utils"
import { WORKSPACE_TOOL_DECLARATIONS, executeToolCall } from "@/lib/workspaceTools"
import { useFetchedNotes } from "@/context/fetchedNotesContext"
import { useFetchedFolders } from "@/context/fetchedFoldersContext"

const models = {
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-3-flash-preview": "Gemini 3 Flash",
    // Defective model, it doesn't work well with tools
    // "gemini-3.1-flash-lite-preview": "Gemini 3.1 Flash Lite"
}

interface ChatMessageInputProps {
    attachments: File[];
    setAttachments: Dispatch<SetStateAction<File[]>>;
}

export default function ChatMessageInput({ attachments, setAttachments }: ChatMessageInputProps) {
    const [content, setContent] = useState("")
    const [isThinking, setIsThinking] = useState(false)
    const { isLoading, setIsLoading } = useIsLoading()

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const { chatMessages, setChatMessages, currentChatId, setCurrentChatId, refreshChats, setChatTitle } = useChatMessages()

    // user context
    const { user } = useUser();
    const systemPromptString = `You are "Orthan AI", Narao's integrated assistant. You help in order to learn and to work mainly, so you use much markdown to highlight things. Narao is a note-taking app that uses AI to help users to learn and to work more efficiently. I am ${user?.username || "the user"}, and my preferences are: I like coding, AI, and technology. I am a student and I am learning about AI. Do not talk about yourself, only talk about the task except if explicitly asked.

    When you use math or physics formulas, ALWAYS wrap them in LaTeX delimiters:
    - Use "$$" on separate lines for block formulas (e.g., "$$\nE = mc^2\n$$").
    - Use "$" for inline formulas (e.g., "$E=mc^2$").
    - NEVER leave LaTeX commands (like \\frac, \\cdot, \\sum) outside of math delimiters.
    - Avoid common LaTeX errors like double subscripts without braces (use "E_{c_{init}}" instead of "E_c_{init}").

    When you use tools:
    - BEFORE calling a tool, briefly explain in natural language what you are about to do (e.g. "Let me search your workspace for notes about math...").
    - After getting a tool result, briefly acknowledge what you found before proceeding or calling another tool (e.g. "I found 3 notes. Let me now read the one about algebra.").
    - At the end, give a complete, helpful answer based on all the information you gathered.`;

    // Workspace contexts for tool execution
    const { fetchedNotes, setFetchedNotes } = useFetchedNotes();
    const { fetchedFolders, setFetchedFolders } = useFetchedFolders();

    // Model Settings
    const [currentModel, setCurrentModel] = useState<keyof Models>("gemini-3-flash-preview")

    // Popover Settings
    const [isSelectingModelPopoverOpen, setIsSelectingModelPopoverOpen] = useState(false)

    // active tab
    const { activeTab } = useTabs()

    // edit message context
    const { pendingEdit, clearEdit, pendingRegenerate, clearRegenerate } = useEditMessage()

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [content])

    useEffect(() => {
        if (activeTab?.type === "chat") {
            textareaRef.current?.focus()
        }
    }, [activeTab])

    // When an edit is requested: just populate the input and focus.
    // Deletion happens only when the user actually sends.
    useEffect(() => {
        if (!pendingEdit) return;
        setContent(pendingEdit.content);
        setTimeout(() => textareaRef.current?.focus(), 50);
    }, [pendingEdit]); // intentionally narrow dep — only fires when a new edit is requested

    // update chat name
    const updateChatName = async (chatId: string, firstUserContent: string) => {
        try {
            const response = await fetch(`/api/chat/gemini-3.1-flash-lite-preview`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    history: [],
                    userInput: `Summarize this message in MAX 3-5 words to make it a chat title, it has to be as descriptive as possible: "${firstUserContent}". Only return the title, nothing else.`,
                    isThinking: false
                })
            });

            const reader = response.body?.getReader();
            const textDecoder = new TextDecoder();
            let accumulatedAnswer = "";
            let buffer = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += textDecoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.type === "answer") {
                                accumulatedAnswer += parsed.content;
                            }
                        } catch (e) {
                            console.error("Error parsing title stream:", e);
                        }
                    }
                }
            }

            if (accumulatedAnswer) {
                const { data, error } = await supabase
                    .from("chats")
                    .update({
                        title: accumulatedAnswer.trim().replace(/^["']|["']$/g, '')
                    })
                    .select()
                    .eq("id", chatId);

                if (error) {
                    console.error("Error updating chat name:", error);
                } else {
                    refreshChats();
                    setChatTitle(data[0].title);
                }
            }
        } catch (e) {
            console.error("Failed to update chat name:", e);
        }
    };

    // convert file to base64 for the AI API call
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            };
            reader.onerror = error => reject(error);
        });
    };

    // Upload a file to Supabase Storage and return its persistent public URL
    const uploadAttachment = async (file: File, userId: string): Promise<string> => {
        const ext = file.name.split('.').pop();
        const path = `${userId}/${uuidv4()}.${ext}`;

        const { error } = await supabase.storage
            .from('chat-attachments')
            .upload(path, file, { contentType: file.type });

        if (error) throw new Error(`Upload failed: ${error.message}`);

        const { data } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(path);

        return data.publicUrl;
    };

    // update chat description
    const updateChatDescription = async (chatId: string, firstUserContent: string) => {
        try {
            const response = await fetch(`/api/chat/gemini-3.1-flash-lite-preview`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    history: [],
                    userInput: `Summarize this message in MAX 10-15 words to make it a chat description: "${firstUserContent}". Only return the description, nothing else.`,
                    isThinking: false
                })
            });

            const reader = response.body?.getReader();
            const textDecoder = new TextDecoder();
            let accumulatedAnswer = "";
            let buffer = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += textDecoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.type === "answer") {
                                accumulatedAnswer += parsed.content;
                            }
                        } catch (e) {
                            console.error("Error parsing title stream:", e);
                        }
                    }
                }
            }

            if (accumulatedAnswer) {
                const { error } = await supabase
                    .from("chats")
                    .update({
                        description: accumulatedAnswer.trim().replace(/^["']|["']$/g, '')
                    })
                    .eq("id", chatId);

                if (error) {
                    console.error("Error updating chat description:", error);
                } else {
                    refreshChats();
                }
            }
        } catch (e) {
            console.error("Failed to update chat description:", e);
        }
    };

    // add the each message to the chat_messages table
    const addMessageToChatMessages = async (chatId: string, message: ChatMessage) => {
        try {
            // Only include optional columns if they have values.
            // If 'thought'/'thinking_time' columns don't exist in the DB yet,
            // including them (even as null) causes a silent {} error from Supabase.
            const payload: Record<string, any> = {
                id: message.id,
                chat_id: chatId,
                content: message.content,
                role: message.role,
                created_at: message.createdAt.toISOString()
            };
            if (message.thought != null) payload.thought = message.thought;
            if (message.thinkingTime != null) payload.thinking_time = message.thinkingTime;
            if (message.messageParts != null) payload.message_parts = message.messageParts;
            if (message.toolCalls != null) payload.tool_calls = message.toolCalls;

            console.log("Attempting to insert into chat_messages with payload:", payload);

            const { error } = await supabase
                .from("chat_messages")
                .insert(payload);

            if (error) {
                // Supabase PostgrestError fields must be logged individually — the object itself shows as {}
                console.error("Error adding message to chat_messages:", {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                    raw: String(error),
                    rawObj: error
                });
                toast.error(`Failed to save message: ${error.message || error.code || "Unknown Supabase error"}`, { position: "bottom-right" });
            }
        } catch (e) {
            console.error("Failed to add message to chat_messages:", e);
        }
    };
    const addAttachmentsToChatAttachments = async (messageId: string, attachments: ChatAttachment[]) => {
        if (!user) return;
        try {
            for (const attachment of attachments) {
                const payload: Record<string, any> = {
                    id: attachment.id,
                    message_id: messageId,
                    user_id: user?.id,
                    file_name: attachment.file_name,
                    file_type: attachment.file_type,
                    mime_type: attachment.mime_type,
                    file_url: attachment.file_url,
                    file_size: attachment.file_size,
                    created_at: attachment.created_at.toISOString()
                };

                const { error } = await supabase
                    .from("chat_attachments")
                    .insert(payload);

                if (error) {
                    // Supabase PostgrestError fields must be logged individually — the object itself shows as {}
                    console.error(`Error adding attachment ${attachment.file_name} to chat_attachments:`, {
                        message: error.message,
                        code: error.code,
                        details: error.details,
                        hint: error.hint,
                        raw: String(error),
                        rawObj: error
                    });
                    toast.error(`Failed to save attachment ${attachment.file_name}: ${error.message || error.code || "Unknown Supabase error"}`, { position: "bottom-right" });
                }
            }
        } catch (e) {
            console.error("Failed to add attachments to chat_attachments:", e);
        }
    };

    // handle send function of the input
    const handleSend = async () => {
        if ((content.trim() === "" && attachments.length === 0) || isLoading) return;
        textareaRef.current?.focus()

        setIsLoading(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Declared outside try so it's accessible in catch for placeholder cleanup and partial saving
        const assistantId = uuidv4();
        let effectiveChatId = currentChatId;
        let accumulatedThought = "";
        let accumulatedAnswer = "";
        let thinkingDuration: number | undefined = undefined;
        let accumulatedMessageParts: MessagePart[] = [{ type: 'text', content: '' }];
        let accumulatedToolCalls: ToolCall[] = [];

        try {
            // 0. If this send is completing an edit: remove the original message
            //    and everything after it (the AI reply) from UI + DB first.
            // Compute the base history synchronously so we can use it below.
            let baseMessages = chatMessages;
            if (pendingEdit) {
                const editedIndex = chatMessages.findIndex(m => m.id === pendingEdit.messageId);
                if (editedIndex !== -1) {
                    baseMessages = chatMessages.slice(0, editedIndex);
                    const idsToDelete = chatMessages.slice(editedIndex).map(m => m.id);
                    setChatMessages(baseMessages);
                    if (currentChatId && idsToDelete.length > 0) {
                        supabase
                            .from("chat_messages")
                            .delete()
                            .in("id", idsToDelete)
                            .then(({ error }) => {
                                if (error) console.error("Error deleting messages for edit:", error);
                            });
                    }
                }
                clearEdit();
            }
            // 1. Prepare attachments — upload to Supabase Storage for persistence,
            //    and convert to base64 separately for the AI API call
            const [uiAttachments, apiAttachments] = await Promise.all([
                Promise.all(attachments.map(async file => ({
                    id: uuidv4(),
                    file_name: file.name,
                    file_type: file.type.includes("pdf") ? "pdf" : "image",
                    mime_type: file.type, // real MIME type, e.g. "image/png", "application/pdf"
                    file_url: await uploadAttachment(file, user!.id), // persistent URL
                    file_size: file.size,
                    created_at: new Date()
                } as ChatAttachment))),
                Promise.all(attachments.map(async file => ({
                    name: file.name,
                    type: file.type,
                    data: await fileToBase64(file)
                })))
            ]);

            // 2. Create and add user message
            const userMessage: ChatMessage = {
                id: uuidv4(),
                role: "user",
                content: content.trim(),
                attachments: uiAttachments,
                createdAt: new Date(),
                isDone: true
            };

            // Use baseMessages (already sliced if editing) to avoid including stale old messages
            const updatedHistory = [...baseMessages, userMessage];
            setChatMessages(updatedHistory);

            const currentContent = content;
            setContent("");
            setAttachments([]);

            // 3. Prepare Assistant placeholder
            const assistantMessage: ChatMessage = {
                id: assistantId,
                role: "assistant",
                content: "",
                messageParts: [{ type: 'text', content: '' }],
                createdAt: new Date()
            };
            setChatMessages(prev => [...prev, assistantMessage]);

            // 4. Create chat instance if it doesn't exist
            if (!effectiveChatId && user?.id) {
                const { data, error } = await supabase
                    .from("chats")
                    .insert({
                        user_id: user.id,
                        title: "New Chat",
                        created_at: new Date(),
                        updated_at: new Date()
                    })
                    .select()
                    .single();

                if (error) {
                    console.error("Error creating chat:", error);
                } else if (data) {
                    const newChatId = data.id as string;
                    effectiveChatId = newChatId;
                    setCurrentChatId(newChatId);
                    // Save user message for the new chat (must be awaited before attachments)
                    await addMessageToChatMessages(newChatId, userMessage);
                    // Save attachments linked to the user message
                    addAttachmentsToChatAttachments(userMessage.id, uiAttachments);
                    // Rename and describe the chat in the background
                    updateChatName(newChatId, currentContent);
                    updateChatDescription(newChatId, currentContent);
                }
            } else if (effectiveChatId) {
                // Save user message for existing chat (must be awaited before attachments)
                await addMessageToChatMessages(effectiveChatId, userMessage);
                addAttachmentsToChatAttachments(userMessage.id, uiAttachments);
            }

            // 4. Call Streaming API
            const response = await fetch(`/api/chat/${currentModel}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    history: updatedHistory,
                    userInput: currentContent,
                    attachments: apiAttachments,
                    isThinking: isThinking,
                    systemPrompt: systemPromptString,
                    tools: WORKSPACE_TOOL_DECLARATIONS
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Chat API error:", errorData);
                const fallbackContent = "We are unable to satisfy the request at the moment, please try again later or consider using another model.";
                // Update the assistant placeholder with the fallback message and mark as done
                setChatMessages(prev => prev.map(msg =>
                    msg.id === assistantId ? {
                        ...msg,
                        content: fallbackContent,
                        isDone: true
                    } : msg
                ));
                // Persist the fallback message to the database
                if (effectiveChatId) {
                    addMessageToChatMessages(effectiveChatId, {
                        id: assistantId,
                        role: "assistant",
                        content: fallbackContent,
                        createdAt: new Date()
                    });
                }
                setIsLoading(false);
                return;
            }

            // 5. Read the stream — inline per-chunk processing for real-time UI updates
            const reader = response.body?.getReader();
            const textDecoder = new TextDecoder();
            let thinkingStartTime = Date.now();

            // Accumulated Gemini conversation contents for multi-turn tool calling
            let geminiContents: any[] = [
                ...updatedHistory.map((msg: ChatMessage) => ({
                    role: msg.role === "user" ? "user" : "model",
                    parts: [{ text: msg.content || "" }]
                }))
            ];

            /**
             * Reads a stream chunk-by-chunk, updates UI in real-time, and returns
             * any functionCall parts that were emitted (so we can chain tool calls).
             */
            const processStreamInline = async (
                streamReader: ReadableStreamDefaultReader<Uint8Array>,
                msgId: string,
                signal: AbortSignal
            ): Promise<Array<{ name: string; args: Record<string, any>; thoughtSignature: string | null }>> => {
                const functionCalls: Array<{ name: string; args: Record<string, any>; thoughtSignature: string | null }> = [];
                let buf = "";

                while (true) {
                    if (signal.aborted) break;
                    const { done, value } = await streamReader.read();
                    if (done) break;

                    buf += textDecoder.decode(value, { stream: true });
                    const lines = buf.split("\n");
                    buf = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const data = JSON.parse(line);
                            if (data.type === "thought") {
                                accumulatedThought += data.content;
                                setChatMessages(prev => prev.map(msg =>
                                    msg.id === msgId ? { ...msg, thought: accumulatedThought } : msg
                                ));
                            } else if (data.type === "answer") {
                                if (thinkingDuration === undefined && accumulatedThought) {
                                    thinkingDuration = Date.now() - thinkingStartTime;
                                }
                                accumulatedAnswer += data.content;

                                const lastIdx = accumulatedMessageParts.length - 1;
                                if (accumulatedMessageParts[lastIdx]?.type === 'text') {
                                    accumulatedMessageParts[lastIdx] = { type: 'text', content: (accumulatedMessageParts[lastIdx] as { type: 'text'; content: string }).content + data.content };
                                } else {
                                    accumulatedMessageParts.push({ type: 'text', content: data.content });
                                }

                                // ← Real-time streaming: update UI on every text chunk
                                setChatMessages(prev => prev.map(msg => {
                                    if (msg.id !== msgId) return msg;
                                    return { ...msg, content: accumulatedAnswer, thought: accumulatedThought, thinkingTime: thinkingDuration, messageParts: accumulatedMessageParts };
                                }));
                            } else if (data.type === "functionCall") {
                                const fc = {
                                    name: data.content.name,
                                    args: data.content.args ?? {},
                                    thoughtSignature: data.content.thoughtSignature ?? null
                                };
                                functionCalls.push(fc);

                                accumulatedToolCalls.push({ name: fc.name, args: fc.args, status: 'loading' });
                                accumulatedMessageParts.push({ type: 'toolCall', toolCall: { name: fc.name, args: fc.args, status: 'loading' } });
                                accumulatedMessageParts.push({ type: 'text', content: '' });

                                // ← Tool card inserted at current position in messageParts, then new text segment opened
                                setChatMessages(prev => prev.map(msg => {
                                    if (msg.id !== msgId) return msg;
                                    return {
                                        ...msg,
                                        toolCalls: accumulatedToolCalls,
                                        messageParts: accumulatedMessageParts
                                    };
                                }));
                            }
                        } catch (e) {
                            console.error("Failed to parse stream line:", line, e);
                        }
                    }
                }
                return functionCalls;
            };

            if (reader) {
                let currentReader = reader;
                let continueToolLoop = true;

                while (continueToolLoop) {
                    const functionCalls = await processStreamInline(currentReader, assistantId, controller.signal);

                    if (functionCalls.length > 0) {
                        // Build model turn with thoughtSignatures
                        const modelFcParts: any[] = functionCalls.map(fc => ({
                            functionCall: { name: fc.name, args: fc.args },
                            ...(fc.thoughtSignature ? { thoughtSignature: fc.thoughtSignature } : {})
                        }));
                        geminiContents.push({ role: "model", parts: modelFcParts });

                        // Execute each tool, update card status as they complete
                        const functionResponses: any[] = [];
                        for (const fc of functionCalls) {
                            let result: string;
                            let status: 'done' | 'error' = 'done';

                            // Artificial delay to ensure the user can see the loading state
                            await new Promise(resolve => setTimeout(resolve, 1500));

                            try {
                                result = await executeToolCall(fc.name, fc.args, {
                                    userId: user!.id,
                                    fetchedNotes,
                                    fetchedFolders,
                                    setFetchedNotes,
                                    setFetchedFolders
                                });
                            } catch (err: any) {
                                result = `Error: ${err?.message || "unknown error"}`;
                                status = 'error';
                            }
                            functionResponses.push({
                                functionResponse: { name: fc.name, response: { result } }
                            });

                            const tcIdx = accumulatedToolCalls.findIndex(t => t.name === fc.name && t.status === 'loading');
                            if (tcIdx !== -1) accumulatedToolCalls[tcIdx] = { ...accumulatedToolCalls[tcIdx], status, result };

                            let patchedLast = false;
                            accumulatedMessageParts = accumulatedMessageParts.map(p => {
                                if (!patchedLast && p.type === 'toolCall' && p.toolCall.name === fc.name && p.toolCall.status === 'loading') {
                                    patchedLast = true;
                                    return { ...p, toolCall: { ...p.toolCall, status, result } };
                                }
                                return p;
                            });

                            // Update status in both toolCalls array AND the matching messagePart
                            setChatMessages(prev => prev.map(msg => {
                                if (msg.id !== assistantId) return msg;
                                return { ...msg, toolCalls: accumulatedToolCalls, messageParts: accumulatedMessageParts };
                            }));
                        }

                        geminiContents.push({ role: "user", parts: functionResponses });

                        const followUpResponse = await fetch(`/api/chat/${currentModel}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                _rawContents: geminiContents,
                                attachments: [],
                                isThinking,
                                systemPrompt: systemPromptString,
                                tools: WORKSPACE_TOOL_DECLARATIONS
                            }),
                            signal: controller.signal
                        });

                        if (!followUpResponse.ok || !followUpResponse.body) {
                            accumulatedAnswer += "\n\n*(An error occurred while processing tool results.)*";
                            continueToolLoop = false;
                            break;
                        }
                        currentReader = followUpResponse.body.getReader();

                    } else {
                        // No function calls — stream is done
                        continueToolLoop = false;
                    }
                }

                setChatMessages(prev => prev.map(msg =>
                    msg.id === assistantId ? { ...msg, isDone: true } : msg
                ));
            }

            if (effectiveChatId) {
                addMessageToChatMessages(effectiveChatId, {
                    id: assistantId,
                    role: "assistant",
                    content: accumulatedAnswer,
                    thought: accumulatedThought,
                    thinkingTime: thinkingDuration,
                    messageParts: accumulatedMessageParts,
                    toolCalls: accumulatedToolCalls,
                    createdAt: new Date()
                });
            }

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Request aborted by user - saving partial response');
                // Mark as done in UI even if aborted
                setChatMessages(prev => prev.map(msg =>
                    msg.id === assistantId ? {
                        ...msg,
                        isDone: true
                    } : msg
                ));
                toast.warning("Answer stopped!")

                // Save whatever we have to the database
                if (effectiveChatId) {
                    addMessageToChatMessages(effectiveChatId, {
                        id: assistantId,
                        role: "assistant",
                        content: accumulatedAnswer.trim(),
                        thought: accumulatedThought.trim(),
                        thinkingTime: thinkingDuration,
                        messageParts: accumulatedMessageParts,
                        toolCalls: accumulatedToolCalls,
                        createdAt: new Date()
                    });

                }
            } else {
                console.error("Failed to get streaming Gemini response:", error);
                const fallbackContent = "We are unable to satisfy the request at the moment, please try again later or consider using another model.";
                // Update the assistant placeholder with the fallback message and mark as done
                setChatMessages(prev => prev.map(msg =>
                    msg.id === assistantId ? {
                        ...msg,
                        content: fallbackContent,
                        isDone: true
                    } : msg
                ));
                // Persist the fallback message to the database
                if (effectiveChatId) {
                    addMessageToChatMessages(effectiveChatId, {
                        id: assistantId,
                        role: "assistant",
                        content: fallbackContent,
                        createdAt: new Date()
                    });
                }
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    // Handle regenerating an assistant answer
    const handleRegenerate = async (assistantMessageId: string) => {
        if (isLoading) return;

        // Find the assistant message and the user message before it
        const assistantIndex = chatMessages.findIndex(m => m.id === assistantMessageId);
        if (assistantIndex === -1) return;

        // The user message is the one right before the assistant message
        const userMessage = chatMessages.slice(0, assistantIndex).reverse().find(m => m.role === "user");
        if (!userMessage) return;

        const userMessageIndex = chatMessages.findIndex(m => m.id === userMessage.id);

        // Keep messages up to and including the user message; remove the assistant answer + anything after
        const baseMessages = chatMessages.slice(0, userMessageIndex + 1);
        const idsToDelete = chatMessages.slice(userMessageIndex + 1).map(m => m.id);

        setChatMessages(baseMessages);

        if (currentChatId && idsToDelete.length > 0) {
            supabase
                .from("chat_messages")
                .delete()
                .in("id", idsToDelete)
                .then(({ error }) => {
                    if (error) console.error("Error deleting messages for regeneration:", error);
                });
        }

        clearRegenerate();

        // Re-run the streaming API with the same user message content
        setIsLoading(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const newAssistantId = uuidv4();
        let effectiveChatId = currentChatId;
        let accumulatedThought = "";
        let accumulatedAnswer = "";
        let thinkingDuration: number | undefined = undefined;
        let accumulatedMessageParts: MessagePart[] = [{ type: 'text', content: '' }];
        let accumulatedToolCalls: ToolCall[] = [];

        // Add new assistant placeholder
        const assistantPlaceholder: ChatMessage = {
            id: newAssistantId,
            role: "assistant",
            content: "",
            messageParts: [{ type: 'text', content: '' }],
            createdAt: new Date()
        };
        setChatMessages(prev => [...prev, assistantPlaceholder]);

        try {
            const response = await fetch(`/api/chat/${currentModel}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    history: baseMessages,
                    userInput: userMessage.content,
                    attachments: [],
                    isThinking: isThinking,
                    systemPrompt: systemPromptString,
                    tools: WORKSPACE_TOOL_DECLARATIONS
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const fallbackContent = "We are unable to satisfy the request at the moment, please try again later or consider using another model.";
                setChatMessages(prev => prev.map(msg =>
                    msg.id === newAssistantId ? { ...msg, content: fallbackContent, isDone: true } : msg
                ));
                if (effectiveChatId) {
                    addMessageToChatMessages(effectiveChatId, {
                        id: newAssistantId,
                        role: "assistant",
                        content: fallbackContent,
                        createdAt: new Date()
                    });
                }
                setIsLoading(false);
                return;
            }

            const reader = response.body?.getReader();
            const textDecoder = new TextDecoder();
            const thinkingStartTime = Date.now();

            // Gemini contents for multi-turn tool calling in regenerate
            let geminiContents: any[] = [
                ...baseMessages.map((msg: ChatMessage) => ({
                    role: msg.role === "user" ? "user" : "model",
                    parts: [{ text: msg.content || "" }]
                }))
            ];

            const processStreamInlineRegen = async (
                streamReader: ReadableStreamDefaultReader<Uint8Array>,
                msgId: string,
                signal: AbortSignal
            ): Promise<Array<{ name: string; args: Record<string, any>; thoughtSignature: string | null }>> => {
                const functionCalls: Array<{ name: string; args: Record<string, any>; thoughtSignature: string | null }> = [];
                let buf = "";

                while (true) {
                    if (signal.aborted) break;
                    const { done, value } = await streamReader.read();
                    if (done) break;

                    buf += textDecoder.decode(value, { stream: true });
                    const lines = buf.split("\n");
                    buf = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const data = JSON.parse(line);
                            if (data.type === "thought") {
                                accumulatedThought += data.content;
                                setChatMessages(prev => prev.map(msg =>
                                    msg.id === msgId ? { ...msg, thought: accumulatedThought } : msg
                                ));
                            } else if (data.type === "answer") {
                                if (thinkingDuration === undefined && accumulatedThought) {
                                    thinkingDuration = Date.now() - thinkingStartTime;
                                }
                                accumulatedAnswer += data.content;

                                const lastIdx = accumulatedMessageParts.length - 1;
                                if (accumulatedMessageParts[lastIdx]?.type === 'text') {
                                    accumulatedMessageParts[lastIdx] = { type: 'text', content: (accumulatedMessageParts[lastIdx] as { type: 'text'; content: string }).content + data.content };
                                } else {
                                    accumulatedMessageParts.push({ type: 'text', content: data.content });
                                }

                                setChatMessages(prev => prev.map(msg => {
                                    if (msg.id !== msgId) return msg;
                                    return { ...msg, content: accumulatedAnswer, thought: accumulatedThought, thinkingTime: thinkingDuration, messageParts: accumulatedMessageParts };
                                }));
                            } else if (data.type === "functionCall") {
                                const fc = {
                                    name: data.content.name,
                                    args: data.content.args ?? {},
                                    thoughtSignature: data.content.thoughtSignature ?? null
                                };
                                functionCalls.push(fc);

                                accumulatedToolCalls.push({ name: fc.name, args: fc.args, status: 'loading' });
                                accumulatedMessageParts.push({ type: 'toolCall', toolCall: { name: fc.name, args: fc.args, status: 'loading' } });
                                accumulatedMessageParts.push({ type: 'text', content: '' });

                                setChatMessages(prev => prev.map(msg => {
                                    if (msg.id !== msgId) return msg;
                                    return {
                                        ...msg,
                                        toolCalls: accumulatedToolCalls,
                                        messageParts: accumulatedMessageParts
                                    };
                                }));
                            }
                        } catch (e) { console.error("Failed to parse stream line:", line, e); }
                    }
                }
                return functionCalls;
            };

            if (reader) {
                let currentReader = reader;
                let continueLoop = true;

                while (continueLoop) {
                    const functionCalls = await processStreamInlineRegen(currentReader, newAssistantId, controller.signal);

                    if (functionCalls.length > 0) {
                        const modelFcParts: any[] = functionCalls.map(fc => ({
                            functionCall: { name: fc.name, args: fc.args },
                            ...(fc.thoughtSignature ? { thoughtSignature: fc.thoughtSignature } : {})
                        }));
                        geminiContents.push({ role: "model", parts: modelFcParts });

                        const functionResponses: any[] = [];
                        for (const fc of functionCalls) {
                            let result: string;
                            let status: 'done' | 'error' = 'done';
                            try {
                                result = await executeToolCall(fc.name, fc.args, {
                                    userId: user!.id, fetchedNotes, fetchedFolders, setFetchedNotes, setFetchedFolders
                                });
                            } catch (err: any) {
                                result = `Error: ${err?.message}`;
                                status = 'error';
                            }
                            functionResponses.push({ functionResponse: { name: fc.name, response: { result } } });

                            const tcIdx = accumulatedToolCalls.map((t, j) => ({ t, j })).reverse()
                                .find(({ t }) => t.name === fc.name && t.status === 'loading')?.j ?? -1;
                            if (tcIdx !== -1) accumulatedToolCalls[tcIdx] = { ...accumulatedToolCalls[tcIdx], status, result };

                            let patchedLast = false;
                            accumulatedMessageParts = [...accumulatedMessageParts].reverse().map(p => {
                                if (!patchedLast && p.type === 'toolCall' && p.toolCall.name === fc.name && p.toolCall.status === 'loading') {
                                    patchedLast = true;
                                    return { ...p, toolCall: { ...p.toolCall, status, result } };
                                }
                                return p;
                            }).reverse();

                            setChatMessages(prev => prev.map(msg => {
                                if (msg.id !== newAssistantId) return msg;
                                return { ...msg, toolCalls: accumulatedToolCalls, messageParts: accumulatedMessageParts };
                            }));
                        }

                        geminiContents.push({ role: "user", parts: functionResponses });

                        const followUp = await fetch(`/api/chat/${currentModel}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                _rawContents: geminiContents,
                                attachments: [],
                                isThinking,
                                systemPrompt: systemPromptString,
                                tools: WORKSPACE_TOOL_DECLARATIONS
                            }),
                            signal: controller.signal
                        });

                        if (!followUp.ok || !followUp.body) { continueLoop = false; break; }
                        currentReader = followUp.body.getReader();

                    } else {
                        continueLoop = false;
                    }
                }
                setChatMessages(prev => prev.map(msg =>
                    msg.id === newAssistantId ? { ...msg, isDone: true } : msg
                ));
            }

            if (effectiveChatId) {
                addMessageToChatMessages(effectiveChatId, {
                    id: newAssistantId,
                    role: "assistant",
                    content: accumulatedAnswer,
                    thought: accumulatedThought,
                    thinkingTime: thinkingDuration,
                    messageParts: accumulatedMessageParts,
                    toolCalls: accumulatedToolCalls,
                    createdAt: new Date()
                });
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                setChatMessages(prev => prev.map(msg =>
                    msg.id === newAssistantId ? { ...msg, isDone: true } : msg
                ));
                toast.warning("Answer stopped!");
                if (effectiveChatId) {
                    addMessageToChatMessages(effectiveChatId, {
                        id: newAssistantId,
                        role: "assistant",
                        content: accumulatedAnswer.trim(),
                        thought: accumulatedThought.trim(),
                        thinkingTime: thinkingDuration,
                        messageParts: accumulatedMessageParts,
                        toolCalls: accumulatedToolCalls,
                        createdAt: new Date()
                    });
                }
            } else {
                console.error("Failed to get regenerated response:", error);
                const fallbackContent = "We are unable to satisfy the request at the moment, please try again later or consider using another model.";
                setChatMessages(prev => prev.map(msg =>
                    msg.id === newAssistantId ? { ...msg, content: fallbackContent, isDone: true } : msg
                ));
                if (effectiveChatId) {
                    addMessageToChatMessages(effectiveChatId, {
                        id: newAssistantId,
                        role: "assistant",
                        content: fallbackContent,
                        createdAt: new Date()
                    });
                }
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    // Trigger regeneration when pendingRegenerate is set
    useEffect(() => {
        if (!pendingRegenerate) return;
        handleRegenerate(pendingRegenerate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingRegenerate]);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();

            if (e.ctrlKey && key === "o" && e.shiftKey && !e.altKey) {
                e.preventDefault();
                textareaRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeTab, content]);

    return (
        <div className="absolute flex flex-col w-[60%] bottom-0 left-[20%] right-[20%] gap-2 z-50" >
            {/* Edit mode cancel pill */}
            {pendingEdit && (
                <div className="flex items-center justify-center animate-in fade-in">
                    <div className={cn("flex items-center gap-2 bg-popover/60 backdrop-blur-md border border-border px-3 py-1.5 rounded-xl text-xs group relative animate-in fade-in shadow-lg", pendingEdit && "bg-primary/10 border-primary/20")}>
                        <Edit size={12} className="text-primary" />
                        <span>Editing message</span>
                        <button
                            onClick={() => { clearEdit(); setContent(""); }}
                            className="ml-1 flex items-center justify-center rounded-full hover:text-foreground transition-colors"
                            aria-label="Cancel edit"
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>
            )}
            {/* Attachment Previews */}
            {attachments.length > 0 && (
                <div className="flex flex-row items-center gap-2 px-4 flex-wrap justify-center">
                    {attachments.map((file, index) => (
                        <div key={index} className={cn("flex items-center gap-2 bg-popover/60 backdrop-blur-md border border-border px-3 py-1.5 rounded-xl text-xs group relative animate-in fade-in slide-in-from-bottom-2 shadow-lg", pendingEdit && "bg-primary/10 border-primary/20")}>
                            {(file.type.includes("jpeg") || file.type.includes("png") || file.type.includes("webp")) && (
                                <FileImage className="w-4 h-4 text-primary" />
                            )}
                            {file.type.includes("pdf") && (
                                <FileTypeCorner className="w-4 h-4 text-destructive" />
                            )}
                            <span className="max-w-[100px] truncate">{file.name}</span>
                            <button
                                onClick={() => removeAttachment(index)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )
            }

            < div className="flex gap-2 items-center items-end pb-1" >
                <div className={cn("rounded-[30px] p-2 border-1 border-border transition-all duration-200 bg-popover/40 backdrop-blur-md shadow-lg", pendingEdit && "bg-primary/10 border-primary/20")}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-full"
                                disabled={attachments.length >= 3}
                                onClick={() => { if (attachments.length < 3) fileInputRef.current?.click(); else toast.error("Maximum 3 attachments allowed", { position: "bottom-right", duration: 1000 }) }}
                            >
                                <Plus />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Attach Image or PDF</p><p className="text-xs text-muted-foreground">Maximum 3 attachments allowed</p></TooltipContent>
                    </Tooltip>
                </div>
                <div className={cn("flex w-full rounded-[30px] border-1 border-border bg-popover/60 backdrop-blur-md shadow-lg px-2 py-1 items-end justify-center gap-2 transition-all duration-200", pendingEdit && "bg-primary/10 border-primary/20")}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        accept="image/*,.pdf"
                        onChange={(e) => {
                            setAttachments(prev => [...prev, ...Array.from(e.target.files || [])]);
                            e.target.value = "";
                        }}
                    />
                    <div className="flex items-center pb-1 gap-1">

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 rounded-full"
                                    onClick={() => setIsThinking(!isThinking)}
                                >
                                    <Lightbulb className={isThinking ? "text-primary transition-all duration-100" : "text-foreground transition-all duration-100"} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Think Deeper</p>
                                <p className="text-xs text-muted-foreground">Improved reasoning, higher latency</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    <textarea
                        ref={textareaRef}
                        className="w-full resize-none bg-transparent py-3 focus:outline-none outline-none scrollbar-no-bg max-h-[156px] overflow-y-auto"
                        placeholder="Ask Orthan AI anything..."
                        maxLength={100000}
                        rows={1}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                handleSend()
                            }
                        }}
                    />
                    <div className="flex items-center pb-1 gap-1">
                        <Popover open={isSelectingModelPopoverOpen}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className="rounded-full"
                                            onClick={() => setIsSelectingModelPopoverOpen(!isSelectingModelPopoverOpen)}
                                        >
                                            <p className="text-xs">{models[currentModel]}</p>
                                        </Button>
                                    </PopoverTrigger>
                                </TooltipTrigger>
                                <TooltipContent><p>Choose Model</p></TooltipContent>
                            </Tooltip>
                            <PopoverContent className="w-fit rounded-full p-2">
                                <div className="flex gap-2">
                                    {/* <p className="text-xs">Choose Model</p> */}
                                    {/* <div className="w-full h-[1px] bg-foreground/10"></div> */}
                                    {(Object.keys(models) as Array<keyof Models>).map((model) => (
                                        <div key={model}>
                                            <Button
                                                variant="outline"
                                                className="rounded-full"
                                                onClick={() => {
                                                    setCurrentModel(model)
                                                    setIsSelectingModelPopoverOpen(false)
                                                }}
                                            >
                                                {model === "gemini-2.5-flash" && <Zap className="" />}
                                                {model === "gemini-3-flash-preview" && <Lightbulb className="" />}
                                                {/* {model === "gemini-3.1-flash-lite-preview" && <Leaf className="" />} */}
                                                <p className="text-xs">{models[model]}</p>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full"><Mic /></Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Dictate</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="default"
                                    size="icon"
                                    onClick={isLoading ? handleStop : handleSend}
                                    disabled={!isLoading && content.length === 0 && attachments.length === 0}
                                    className="h-10 w-10 rounded-full p-0 flex items-center justify-center"
                                >
                                    {isLoading ? (
                                        <Square size={20} className="fill-current" />
                                    ) : (
                                        <ArrowUp size={20} />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{isLoading ? "Stop generating" : "Send Message"}</p></TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </div >
        </div >
    )
}
