import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowUp, Edit, FileImage, FileTypeCorner, Leaf, Lightbulb, Mic, Mic2, MicOff, Plus, Square, Trash2, X, Zap, FileText, Folder } from "lucide-react"
import { useState, useRef, useEffect, useCallback, useMemo, Dispatch, SetStateAction } from "react"
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
import { WORKSPACE_TOOL_DECLARATIONS, buildWorkspaceIndex, executeToolCall } from "@/lib/workspaceTools"
import { useFetchedNotes } from "@/context/fetchedNotesContext"
import { useFetchedFolders } from "@/context/fetchedFoldersContext"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import WaveformAnimation from "@/components/custom/WaveformAnimation"
import { EDITOR_COLORS } from "@/constants/editorColors"
import { useSettings } from "@/context/settingsContext"
import getSystemPromptString from "@/constants/systemPromptString"

// ── @mention types ──────────────────────────────────────────────────────────
type MentionItem = { id: string; title: string; type: "note" | "folder"; path?: string; color?: string };

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

    const editorRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const { chatMessages, setChatMessages, currentChatId, setCurrentChatId, refreshChats, setChatTitle } = useChatMessages()

    // Audio recording
    const { recordingState, audioURL, audioBlob, startRecording, stopRecording, uploadRecording, reset: resetRecording, analyserNode } = useAudioRecorder()
    const isRecording = recordingState === "recording"
    const hasRecording = !!audioBlob && !isRecording
    const [recordingDuration, setRecordingDuration] = useState(0)
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // ── @mention state ──────────────────────────────────────────────────────
    const [mentionQuery, setMentionQuery] = useState<string | null>(null) // null = closed
    const [mentionStart, setMentionStart] = useState<number>(-1)          // caret pos of "@"
    const [mentionIndex, setMentionIndex] = useState(0)                   // highlighted item index
    const mentionListRef = useRef<HTMLDivElement>(null)

    // user context
    const { user } = useUser();

    // Workspace contexts for tool execution
    const { fetchedNotes, setFetchedNotes } = useFetchedNotes();
    const { fetchedFolders, setFetchedFolders } = useFetchedFolders();

    // Model Settings
    const [currentModel, setCurrentModel] = useState<keyof Models>("gemini-2.5-flash")

    // Popover Settings
    // const [isSelectingModelPopoverOpen, setIsSelectingModelPopoverOpen] = useState(false)

    // active tab
    const { activeTab, openTab } = useTabs()

    // edit message context
    const { pendingEdit, clearEdit, pendingRegenerate, clearRegenerate } = useEditMessage()

    // settings context
    const { settings } = useSettings();

    const systemPromptString = getSystemPromptString();

    // ── @mention helpers ────────────────────────────────────────────────────
    const getFolderPath = useCallback((folderId: string): string => {
        const folder = fetchedFolders.find(f => f.id === folderId);
        if (!folder) return "/";
        if (!folder.parent_id) return `/${folder.name}`;
        return `${getFolderPath(folder.parent_id)}/${folder.name}`;
    }, [fetchedFolders]);

    // ── @mention derived data ───────────────────────────────────────────────
    const allMentionItems = useMemo<MentionItem[]>(() => [
        ...fetchedNotes.map(n => ({ id: n.id, title: n.title, type: "note" as const })),
        ...fetchedFolders.map(f => ({ id: f.id, title: f.name, path: getFolderPath(f.id), color: f.color, type: "folder" as const })),
    ], [fetchedNotes, fetchedFolders])

    const mentionSuggestions = useMemo<MentionItem[]>(() => {
        if (mentionQuery === null) return []
        const q = mentionQuery.toLowerCase()
        return allMentionItems
            .filter(item => item.title.toLowerCase().includes(q))
            .slice(0, 8)
    }, [mentionQuery, allMentionItems])

    // Sync highlighted index when suggestions change
    useEffect(() => { setMentionIndex(0) }, [mentionSuggestions])

    // ── @mention helpers ────────────────────────────────────────────────────
    const closeMention = useCallback(() => {
        setMentionQuery(null)
        setMentionStart(-1)
    }, [])

    /** Extract plain text from the contenteditable div, normalising <br> → \n */
    const getEditorText = useCallback((): string => {
        const el = editorRef.current
        if (!el) return ""
        const walk = (node: Node): string => {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ""
            if ((node as Element).tagName === "BR") return "\n"
            return Array.from(node.childNodes).map(walk).join("")
        }
        return walk(el)
    }, [])

    /** Get the flat character offset of the current caret inside the editor div */
    const getCaretOffset = useCallback((): number => {
        const el = editorRef.current
        if (!el) return 0
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return 0
        const range = sel.getRangeAt(0).cloneRange()
        range.selectNodeContents(el)
        range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset)
        return range.toString().length
    }, [])

    /**
     * confirmMention — uses TreeWalker to locate the @query boundaries.
     * TreeWalker(SHOW_TEXT) visits every text node in document order, making
     * character counting consistent with getCaretOffset() (which uses range.toString()).
     */
    const confirmMention = useCallback((item: MentionItem) => {
        const el = editorRef.current
        if (!el) return

        const caretPos = getCaretOffset()
        // mentionStart is the flat-text offset of "@"
        // caretPos is where the user's cursor is (right after the query)

        // Walk all text nodes in DOM order and find the boundary nodes
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        let charCount = 0
        let startNode: Text | null = null
        let startOffset = 0
        let endNode: Text | null = null
        let endOffset = 0

        let node = walker.nextNode() as Text | null
        while (node) {
            const len = node.textContent?.length ?? 0

            if (!startNode && charCount + len > mentionStart) {
                startNode = node
                startOffset = mentionStart - charCount
            }

            if (!endNode && charCount + len >= caretPos) {
                endNode = node
                endOffset = caretPos - charCount
                break // both found
            }

            charCount += len
            node = walker.nextNode() as Text | null
        }

        // If start wasn't found yet but end was (edge: @ is at very end), use endNode
        if (!startNode && endNode) {
            startNode = endNode
            startOffset = Math.max(0, endOffset - (caretPos - mentionStart))
        }

        if (!startNode || !endNode) return

        // Clamp offsets to be safe
        startOffset = Math.min(startOffset, startNode.length)
        endOffset = Math.min(endOffset, endNode.length)

        // Delete the @query from the DOM
        const range = document.createRange()
        range.setStart(startNode, startOffset)
        range.setEnd(endNode, endOffset)
        range.deleteContents()

        // Build the chip span (contentEditable=false → caret jumps over it atomically)
        const chip = document.createElement("span")
        chip.className = "mention-token"
        chip.contentEditable = "false"
        chip.textContent = `@${item.title}`
        chip.dataset.mentionId = item.id
        chip.dataset.mentionType = item.type
        chip.onclick = () => {
            if (item.type === "note") {
                openTab({ type: "note", title: item.title, noteId: item.id })
            } else if (item.type === "folder") {
                openTab({ type: "folder", title: item.title, location: item.path || "/" })
            }
        }

        // Trailing non-breaking space so the caret can land after the chip
        const space = document.createTextNode("\u00A0")

        // Insert at the now-collapsed range position
        range.insertNode(space)
        range.insertNode(chip)

        // Place caret after the space
        const sel = window.getSelection()
        if (sel) {
            const newRange = document.createRange()
            newRange.setStartAfter(space)
            newRange.collapse(true)
            sel.removeAllRanges()
            sel.addRange(newRange)
        }

        setContent(getEditorText())
        closeMention()
        editorRef.current?.focus()
    }, [mentionStart, closeMention, getEditorText, getCaretOffset])

    useEffect(() => {
        if (activeTab?.type === "chat") {
            editorRef.current?.focus()
        }
    }, [activeTab])

    // Recording duration timer
    useEffect(() => {
        if (isRecording) {
            setRecordingDuration(0)
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1)
            }, 1000)
        } else {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current)
                recordingTimerRef.current = null
            }
        }
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
        }
    }, [isRecording])

    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, "0")
        const s = (secs % 60).toString().padStart(2, "0")
        return `${m}:${s}`
    }

    const handleMicToggle = async () => {
        if (isRecording) {
            stopRecording()
        } else if (hasRecording) {
            // Discard existing recording and start fresh
            resetRecording()
            await startRecording()
        } else {
            await startRecording()
        }
    }

    const handleDiscardRecording = () => {
        resetRecording()
        setRecordingDuration(0)
    }

    const handleSendRecording = async () => {
        if (!user || !audioBlob) return
        const result = await uploadRecording(user.id)
        if (!result) {
            toast.error("Failed to upload voice recording", { position: "bottom-right" })
            return
        }
        // Create a synthetic File from the blob to re-use the existing attachment flow
        const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm"
        const file = new File([audioBlob], `voice-${Date.now()}.${ext}`, { type: audioBlob.type })
        setAttachments(prev => [...prev, file])
        resetRecording()
        setRecordingDuration(0)
        toast.success("Voice note attached!", { position: "bottom-right", duration: 2000 })
    }

    // When an edit is requested: just populate the input and focus.
    // Deletion happens only when the user actually sends.
    useEffect(() => {
        if (!pendingEdit) return;
        if (editorRef.current) {
            editorRef.current.innerText = pendingEdit.content
        }
        setContent(pendingEdit.content);
        setTimeout(() => editorRef.current?.focus(), 50);
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
        editorRef.current?.focus()

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
            if (editorRef.current) editorRef.current.innerHTML = ""
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
                editorRef.current?.focus();
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
                            onClick={() => { clearEdit(); setContent(""); if (editorRef.current) editorRef.current.innerHTML = ""; }}
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
                            {(file.type.includes("webm") || file.type.includes("mp4") || file.type.includes("ogg") || file.name.startsWith("voice-")) && (
                                <Mic2 className="w-4 h-4 text-primary" />
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
                    {isRecording ? (
                        <div className="flex flex-col items-center justify-center w-full py-1 gap-1">
                            <WaveformAnimation analyserNode={analyserNode} isRecording={isRecording} barCount={32} />
                            <span className="text-xs text-destructive font-mono font-semibold animate-pulse">
                                {formatDuration(recordingDuration)}
                            </span>
                        </div>
                    ) : hasRecording ? (
                        <div className="flex flex-col items-center justify-center w-full py-1 gap-1.5">
                            <WaveformAnimation analyserNode={null} isRecording={false} barCount={32} />
                            {audioURL && (
                                <audio controls src={audioURL} className="h-7 w-full max-w-[240px] opacity-80" />
                            )}
                        </div>
                    ) : (
                        <div className="relative w-full">
                            {/* Single contenteditable div — no mirror needed */}
                            <div
                                ref={editorRef}
                                contentEditable
                                suppressContentEditableWarning
                                role="textbox"
                                aria-multiline="true"
                                aria-label="Ask Orthan AI anything..."
                                data-placeholder="Ask Orthan AI anything..."
                                className="mention-editor w-full focus:outline-none outline-none scrollbar-no-bg"
                                onInput={(e) => {
                                    const el = e.currentTarget
                                    const walk = (node: Node): string => {
                                        if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ""
                                        if ((node as Element).tagName === "BR") return "\n"
                                        // For mention-token spans, return their text as-is
                                        if ((node as HTMLElement).classList?.contains("mention-token")) return node.textContent ?? ""
                                        return Array.from(node.childNodes).map(walk).join("")
                                    }
                                    const text = walk(el)
                                    setContent(text)

                                    // Detect @mention trigger using caret offset
                                    const sel = window.getSelection()
                                    if (!sel || sel.rangeCount === 0) return
                                    const range = sel.getRangeAt(0).cloneRange()
                                    range.selectNodeContents(el)
                                    range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset)
                                    const caretOffset = range.toString().length

                                    const slice = text.slice(0, caretOffset)
                                    const match = slice.match(/@([\w\s.-]*)$/)
                                    if (match) {
                                        const atPos = caretOffset - match[0].length
                                        setMentionStart(atPos)
                                        setMentionQuery(match[1])
                                    } else {
                                        closeMention()
                                    }
                                }}
                                onKeyDown={(e) => {
                                    // @mention navigation
                                    if (mentionQuery !== null && mentionSuggestions.length > 0) {
                                        if (e.key === "ArrowDown") {
                                            e.preventDefault()
                                            setMentionIndex(i => (i + 1) % mentionSuggestions.length)
                                            return
                                        }
                                        if (e.key === "ArrowUp") {
                                            e.preventDefault()
                                            setMentionIndex(i => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length)
                                            return
                                        }
                                        if (e.key === "Tab" || e.key === "Enter") {
                                            e.preventDefault()
                                            confirmMention(mentionSuggestions[mentionIndex])
                                            return
                                        }
                                        if (e.key === "Escape") {
                                            e.preventDefault()
                                            closeMention()
                                            return
                                        }
                                    }

                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSend()
                                        return
                                    }
                                    // Shift+Enter inserts a newline naturally
                                }}
                                onBlur={() => {
                                    // Brief delay so click on suggestion registers first
                                    setTimeout(() => closeMention(), 150)
                                }}
                                onPaste={(e) => {
                                    // Strip HTML on paste — insert plain text only
                                    e.preventDefault()
                                    const text = e.clipboardData.getData("text/plain")
                                    document.execCommand("insertText", false, text)
                                }}
                            />
                            {/* @mention suggestion dropdown */}
                            {mentionQuery !== null && mentionSuggestions.length > 0 && (
                                <div
                                    ref={mentionListRef}
                                    className="mention-suggestions"
                                    role="listbox"
                                >
                                    <p className="mention-suggestions-label">Notes &amp; Folders</p>
                                    {mentionSuggestions.map((item, idx) => (
                                        <div
                                            key={item.id}
                                            role="option"
                                            aria-selected={idx === mentionIndex}
                                            className={cn(
                                                "mention-suggestion-item",
                                                idx === mentionIndex && "mention-suggestion-item--active"
                                            )}
                                            onMouseDown={(e) => {
                                                e.preventDefault() // prevent blur
                                                confirmMention(item)
                                            }}
                                            onMouseEnter={() => setMentionIndex(idx)}
                                        >
                                            {item.type === "note"
                                                ? <FileText size={13} className="mention-suggestion-icon mention-suggestion-icon--note" />
                                                : <Folder size={13} className="mention-suggestion-icon mention-suggestion-icon--folder" />
                                            }
                                            <span className="mention-suggestion-title">{item.title}</span>
                                            <span className="mention-suggestion-type">{item.type}</span>
                                        </div>
                                    ))}
                                    <p className="mention-suggestions-hint"><kbd>Tab</kbd> to confirm · <kbd>↑↓</kbd> to navigate · <kbd>Esc</kbd> to dismiss</p>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex items-center pb-1 gap-1">
                        {/* <Popover open={isSelectingModelPopoverOpen}>
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
                                    <p className="text-xs">Choose Model</p>
                                    <div className="w-full h-[1px] bg-foreground/10"></div>
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
                                                {model === "gemini-3.1-flash-lite-preview" && <Leaf className="" />}
                                                <p className="text-xs">{models[model]}</p>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover> */}
                        {hasRecording && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 rounded-full text-destructive hover:text-destructive"
                                        onClick={handleDiscardRecording}
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Discard recording</p></TooltipContent>
                            </Tooltip>
                        )}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={isRecording ? "destructive" : "ghost"}
                                    size="icon"
                                    className={cn(
                                        "h-10 w-10 rounded-full transition-all duration-200",
                                        isRecording && "animate-pulse shadow-lg shadow-destructive/40"
                                    )}
                                    onClick={handleMicToggle}
                                >
                                    {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isRecording ? "Stop recording" : hasRecording ? "Re-record" : "Voice note"}</p>
                            </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="default"
                                    size="icon"
                                    onClick={hasRecording ? handleSendRecording : isLoading ? handleStop : handleSend}
                                    disabled={!hasRecording && !isLoading && content.length === 0 && attachments.length === 0}
                                    className="h-10 w-10 rounded-full p-0 flex items-center justify-center"
                                >
                                    {isLoading && !hasRecording ? (
                                        <Square size={20} className="fill-current" />
                                    ) : (
                                        <ArrowUp size={20} />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{hasRecording ? "Send voice note" : isLoading ? "Stop generating" : "Send Message"}</p></TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </div >
        </div >
    )
}
