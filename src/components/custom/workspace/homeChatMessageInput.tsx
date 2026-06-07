import { useSettings } from "@/context/settingsContext";
import { useState, useRef, useCallback, useEffect, useMemo, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUp, Edit, FileImage, FileTypeCorner, Leaf, Lightbulb, Mic, Mic2, Plus, Square, Trash2, X, Zap, FileText, Folder, Wrench } from "lucide-react";
import { useChatMessages } from "@/context/chatMessagesContext";
import { useTabs } from "@/context/tabsContext";
import { useUser } from "@/context/userContext";
import { useIsLoading } from "@/context/isLoadingContext";
import { ChatMessage, ChatAttachment, MessagePart, ToolCall, Models } from "@/types/chatType";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import PremiumWaveform from "@/components/custom/PremiumWaveform";
import getSystemPromptString from "@/constants/systemPromptString";
import { WORKSPACE_TOOL_DECLARATIONS, executeToolCall } from "@/lib/workspaceTools";
import { useFetchedNotes } from "@/context/fetchedNotesContext";
import { useFetchedFolders } from "@/context/fetchedFoldersContext";
import { cn } from "@/lib/utils";
import { useEditMessage } from "@/context/editMessageContext";
import { SelectionQuote, getSelectionQuoteMarkdown } from "./selectionQuote";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

// ── @mention types ──────────────────────────────────────────────────────────
type MentionItem = { id: string; title: string; type: "note" | "folder"; path?: string; color?: string };

export interface HomeChatMessageInputRef {
    setContent: (content: string) => void;
    focusAndSelectText: (textToSelect: string) => void;
}

interface HomeChatMessageInputProps {}

const HomeChatMessageInput = forwardRef<HomeChatMessageInputRef, HomeChatMessageInputProps>((props, ref) => {
    const { settings, setSettings } = useSettings();
    const [content, setContent] = useState("");

    // Expose setContent to parent via ref
    useImperativeHandle(ref, () => ({
        setContent: (newContent: string) => {
            setContent(newContent);
            if (editorRef.current) {
                editorRef.current.innerHTML = newContent;
            }
        },
        focusAndSelectText: (textToSelect: string) => {
            if (editorRef.current) {
                editorRef.current.focus();
                const text = editorRef.current.innerText || "";
                const index = text.indexOf(textToSelect);
                if (index !== -1) {
                    const selection = window.getSelection();
                    if (selection) {
                        const range = document.createRange();
                        const walker = document.createTreeWalker(
                            editorRef.current,
                            NodeFilter.SHOW_TEXT,
                            null
                        );
                        let charCount = 0;
                        let startNode: Text | null = null;
                        let startOffset = 0;
                        let endNode: Text | null = null;
                        let endOffset = 0;

                        while (walker.nextNode()) {
                            const node = walker.currentNode as Text;
                            const nodeLength = node.textContent?.length || 0;
                            
                            if (!startNode && charCount + nodeLength > index) {
                                startNode = node;
                                startOffset = index - charCount;
                            }
                            
                            if (!endNode && charCount + nodeLength >= index + textToSelect.length) {
                                endNode = node;
                                endOffset = index + textToSelect.length - charCount;
                                break;
                            }
                            
                            charCount += nodeLength;
                        }

                        if (startNode && endNode) {
                            range.setStart(startNode, startOffset);
                            range.setEnd(endNode, endOffset);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                    }
                }
            }
        }
    }), []);
    const [isLoading, setIsLoading] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);

    // out-of-credits mid-stream guard
    const [outOfCredits, setOutOfCredits] = useState(false);
    const outOfCreditsRef = useRef(false);

    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const { user, setUser } = useUser();
    const { openTab } = useTabs();
    const { setIsLoading: setGlobalIsLoading } = useIsLoading();

    // Audio recording
    const { recordingState, audioURL, audioBlob, startRecording, stopRecording, reset: resetRecording, analyserNode } = useAudioRecorder();
    const isRecording = recordingState === "recording";
    const hasRecording = !!audioBlob && !isRecording;
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Auto-attach flag: set to true when user presses ✓ during recording
    const [pendingAutoAttach, setPendingAutoAttach] = useState(false);

    // ── @mention state ──────────────────────────────────────────────────────
    const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = closed
    const [mentionStart, setMentionStart] = useState<number>(-1);          // caret pos of "@"
    const [mentionIndex, setMentionIndex] = useState(0);                   // highlighted item index
    const mentionListRef = useRef<HTMLDivElement>(null);

    // Workspace contexts for tool execution
    const { fetchedNotes, setFetchedNotes } = useFetchedNotes();
    const { fetchedFolders, setFetchedFolders } = useFetchedFolders();

    const {
        refreshChats,
        setChatCache,
        setActiveTabId,
        initTabState,
        setTabState,
        setChatMessages,
        chatInputHTML,
        setChatInputHTML,
        chatQuote,
        setChatQuote
    } = useChatMessages();

    const [currentModel, setCurrentModel] = useState<keyof Models>("gemini-3-flash-preview");
    const systemPromptString = getSystemPromptString();

    // ── @mention helpers ────────────────────────────────────────────────────
    const getFolderPath = useCallback((folderId: string): string => {
        const folder = fetchedFolders.find(f => f.id === folderId);
        if (!folder) return "/";
        if (!folder.parent_id) return `/${folder.name}`;
        return `${getFolderPath(folder.parent_id)}/${folder.name}`;
    }, [fetchedFolders]);

    const allMentionItems = useMemo<MentionItem[]>(() => [
        ...fetchedNotes.map(n => ({ id: n.id, title: n.title, type: "note" as const })),
        ...fetchedFolders.map(f => ({ id: f.id, title: f.name, path: getFolderPath(f.id), color: f.color, type: "folder" as const })),
    ], [fetchedNotes, fetchedFolders]);

    const mentionSuggestions = useMemo<MentionItem[]>(() => {
        if (mentionQuery === null) return [];
        const q = mentionQuery.toLowerCase();
        return allMentionItems
            .filter(item => item.title.toLowerCase().includes(q))
            .slice(0, 8);
    }, [mentionQuery, allMentionItems]);

    // Sync highlighted index when suggestions change
    useEffect(() => { setMentionIndex(0) }, [mentionSuggestions]);

    const closeMention = useCallback(() => {
        setMentionQuery(null);
        setMentionStart(-1);
    }, []);

    const getEditorText = useCallback((): string => {
        const el = editorRef.current;
        if (!el) return "";
        const walk = (node: Node): string => {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
            if ((node as Element).tagName === "BR") return "\n";
            return Array.from(node.childNodes).map(walk).join("");
        };
        return walk(el);
    }, []);

    const getCaretOffset = useCallback((): number => {
        const el = editorRef.current;
        if (!el) return 0;
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return 0;
        const range = sel.getRangeAt(0).cloneRange();
        range.selectNodeContents(el);
        range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
        return range.toString().length;
    }, []);

    const confirmMention = useCallback((item: MentionItem) => {
        const el = editorRef.current;
        if (!el) return;

        const caretPos = getCaretOffset();

        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let charCount = 0;
        let startNode: Text | null = null;
        let startOffset = 0;
        let endNode: Text | null = null;
        let endOffset = 0;

        let node = walker.nextNode() as Text | null;
        while (node) {
            const len = node.textContent?.length ?? 0;

            if (!startNode && charCount + len > mentionStart) {
                startNode = node;
                startOffset = mentionStart - charCount;
            }

            if (!endNode && charCount + len >= caretPos) {
                endNode = node;
                endOffset = caretPos - charCount;
                break;
            }

            charCount += len;
            node = walker.nextNode() as Text | null;
        }

        if (!startNode && endNode) {
            startNode = endNode;
            startOffset = Math.max(0, endOffset - (caretPos - mentionStart));
        }

        if (!startNode || !endNode) return;

        startOffset = Math.min(startOffset, startNode.length);
        endOffset = Math.min(endOffset, endNode.length);

        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        range.deleteContents();

        const chip = document.createElement("span");
        chip.className = "mention-token";
        chip.contentEditable = "false";
        chip.textContent = `@${item.title}`;
        chip.dataset.mentionId = item.id;
        chip.dataset.mentionType = item.type;
        if (item.type === "folder") {
            chip.dataset.path = item.path || "/";
        }

        const space = document.createTextNode("\u00A0");

        range.insertNode(space);
        range.insertNode(chip);

        const sel = window.getSelection();
        if (sel) {
            const newRange = document.createRange();
            newRange.setStartAfter(space);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
        }

        setContent(getEditorText());
        closeMention();
        editorRef.current?.focus();
    }, [mentionStart, closeMention, getEditorText, getCaretOffset]);

    // Recording duration timer
    useEffect(() => {
        if (isRecording) {
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
        }
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        };
    }, [isRecording]);

    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, "0");
        const s = (secs % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    const handleMicToggle = async () => {
        if (isRecording) {
            // Stop and discard the recording
            resetRecording();
            setRecordingDuration(0);
        } else if (hasRecording) {
            resetRecording();
            await startRecording();
        } else {
            await startRecording();
        }
    };

    const handleDiscardRecording = () => {
        setPendingAutoAttach(false);
        resetRecording();
        setRecordingDuration(0);
    };

    const handleSendRecording = useCallback(async (blob: Blob) => {
        if (!user) return;
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        // Upload in the background — attach optimistically as a local File
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
        setAttachments(prev => [...prev, file]);
        resetRecording();
        setRecordingDuration(0);
        toast.success("Voice note attached!", { position: "bottom-right", duration: 2000 });
    }, [user, resetRecording, setAttachments]);

    // Auto-attach: fires as soon as MediaRecorder's onstop delivers the blob
    useEffect(() => {
        if (pendingAutoAttach && audioBlob) {
            setPendingAutoAttach(false);
            handleSendRecording(audioBlob);
        }
    }, [pendingAutoAttach, audioBlob, handleSendRecording]);

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
    }, [content]);

    // MIME types we treat as plain text (sent as { kind: "text" } to the API)
    const TEXT_MIME_TYPES = new Set([
        "text/plain",
        "text/markdown",
        "text/csv",
        "text/html",
        "text/css",
        "text/javascript",
        "text/typescript",
        "application/json",
        "application/xml",
        "text/xml",
        "application/javascript",
        "application/typescript",
    ]);

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

    const fileToApiPart = (file: File): Promise<
        | { kind: "text"; name: string; text: string }
        | { kind: "inline"; name: string; type: string; data: string }
    > => {
        const isText = TEXT_MIME_TYPES.has(file.type) ||
            /\.(txt|md|csv|json|xml|yaml|yml|toml|ini|log|ts|tsx|js|jsx|css|html|htm|sh|py|rb|java|c|cpp|h|rs|go|php)$/i.test(file.name);

        if (isText) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsText(file);
                reader.onload = () => resolve({ kind: "text", name: file.name, text: reader.result as string });
                reader.onerror = err => reject(err);
            });
        }
        return fileToBase64(file).then(data => ({ kind: "inline", name: file.name, type: file.type, data }));
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

    const updateChatName = async (chatId: string, firstUserContent: string, tabId: string) => {
        try {
            const response = await fetch(`/api/chat/gemini-3.1-flash-lite-preview`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    history: [],
                    userInput: `Summarize this message in MAX 3-5 words to make it a chat title, it has to be as descriptive as possible: "${firstUserContent}". Only return the title, nothing else. ${settings.language === "auto-detect" ? "Detect the language of the user and use it. Make it simple" : `Use the language ${settings.language} if you cannot detect the language of the query.`}`,
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
                    setTabState(tabId, { title: data[0].title });
                }
            }
        } catch (e) {
            console.error("Failed to update chat name:", e);
        }
    };

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
                            console.error("Error parsing description stream:", e);
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

    const addMessageToChatMessages = async (chatId: string, message: ChatMessage) => {
        try {
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
            if (message.creditsUsed != null) payload.credits_used = message.creditsUsed;

            const { error } = await supabase
                .from("chat_messages")
                .insert(payload);

            if (error) {
                console.error("Error adding message to chat_messages:", error);
                toast.error(`Failed to save message: ${error.message || error.code || "Unknown Supabase error"}`, { position: "bottom-right" });
            }
        } catch (e) {
            console.error("Failed to add message to chat:", e);
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
                    console.error(`Error adding attachment ${attachment.file_name} to chat_attachments:`, error);
                    toast.error(`Failed to save attachment ${attachment.file_name}`, { position: "bottom-right" });
                }
            }
        } catch (e) {
            console.error("Failed to add attachments to chat_attachments:", e);
        }
    };

    const computeCredits = (tokens: number, hasThought: boolean, hasAttachments: boolean): number => {
        const base = tokens / 100;
        let multiplier = 1.0;

        if (hasThought && hasAttachments) {
            multiplier = 1.8;
        } else if (hasAttachments) {
            multiplier = 1.5;
        } else if (hasThought) {
            multiplier = 1.2;
        }

        return Math.ceil(base * multiplier);
    };

    const deductCredits = async (totalTokens: number, isThinking: boolean = false, hasAttachments: boolean = false) => {
        if (!user || totalTokens <= 0) return;

        const creditsToDeduct = computeCredits(totalTokens, isThinking, hasAttachments);
        console.log("Total tokens:", totalTokens, "→ credits to deduct:", creditsToDeduct);

        try {
            const { error } = await supabase.rpc('decrement_credits', {
                uid: user.id,
                amount: creditsToDeduct
            });

            if (error) {
                console.error("Failed to deduct credits:", error);
            } else {
                setUser(prev =>
                    prev
                        ? { ...prev, credits_left: Math.max(prev.credits_left - creditsToDeduct, 0) }
                        : null
                );
            }
        } catch (e) {
            console.error("Credit deduction error:", e);
        }
    };

    const handleSend = async (contentOverride?: string) => {
        let effectiveContent = contentOverride ?? content;

        if (chatQuote) {
            const quoteMarkdown = getSelectionQuoteMarkdown(chatQuote.text, chatQuote.sourceName);
            effectiveContent = `${quoteMarkdown}${effectiveContent}`;
        }

        if ((effectiveContent.trim() === "" && attachments.length === 0) || isLoading) return;

        // Zero-credit guard
        if (user && user.credits_left <= 0) {
            toast.error("You've run out of credits! Please top up to continue.", { position: "bottom-right" });
            return;
        }

        editorRef.current?.focus();
        setIsLoading(true);
        setGlobalIsLoading(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const assistantId = uuidv4();
        let newChatId: string | null = null;
        let tabId: string | null = null;
        let accumulatedThought = "";
        let accumulatedAnswer = "";
        let thinkingDuration: number | undefined = undefined;
        let accumulatedMessageParts: MessagePart[] = [{ type: 'text', content: '' }];
        let accumulatedToolCalls: ToolCall[] = [];
        let totalTokensUsed = 0;
        let userMessage: ChatMessage | undefined = undefined;
        let updatedHistory: ChatMessage[] = [];

        try {
            // Prepare attachments
            const [uiAttachments, apiAttachments] = await Promise.all([
                Promise.all(attachments.map(async file => ({
                    id: uuidv4(),
                    file_name: file.name,
                    file_type: file.type.includes("pdf")
                        ? "pdf"
                        : TEXT_MIME_TYPES.has(file.type) || /\.(txt|md|csv|json|xml|yaml|yml|toml|ini|log|ts|tsx|js|jsx|css|html|htm|sh|py|rb|java|c|cpp|h|rs|go|php)$/i.test(file.name)
                            ? "text"
                            : "image",
                    mime_type: file.type,
                    file_url: await uploadAttachment(file, user!.id),
                    file_size: file.size,
                    created_at: new Date()
                } as ChatAttachment))),
                Promise.all(attachments.map(file => fileToApiPart(file)))
            ]);

            // Create user message
            userMessage = {
                id: uuidv4(),
                role: "user",
                content: effectiveContent.trim(),
                attachments: uiAttachments,
                createdAt: new Date(),
                isDone: true
            };

            updatedHistory = [userMessage];

            // Clear input
            setContent("");
            setChatInputHTML("");
            setChatQuote(null);
            if (editorRef.current) editorRef.current.innerHTML = "";
            setAttachments([]);

            // Prepare Assistant placeholder
            const assistantMessage: ChatMessage = {
                id: assistantId,
                role: "assistant",
                content: "",
                messageParts: [{ type: 'text', content: '' }],
                createdAt: new Date()
            };

            // Create new chat (always a new chat from Home)
            if (user?.id) {
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
                    toast.error("Failed to create chat", { position: "bottom-right" });
                    setIsLoading(false);
                    setGlobalIsLoading(false);
                    return;
                } else if (data) {
                    newChatId = data.id as string;

                    // Open new chat tab
                    tabId = openTab({ type: "chat", title: "New Chat", chatId: newChatId });

                    // Initialize tab state with the new chat ID and messages
                    const finalMessages = [...updatedHistory, assistantMessage];
                    initTabState(tabId);
                    setActiveTabId(tabId);

                    // Set tab state directly to ensure proper synchronization
                    setTabState(tabId, {
                        chatId: newChatId,
                        messages: finalMessages,
                        title: "New Chat",
                        inputHTML: ""
                    });

                    // Pre-fill cache
                    setChatCache(prev => ({
                        ...prev,
                        [newChatId!]: { messages: finalMessages, title: "New Chat" }
                    }));

                    // Save user message (must be awaited before attachments)
                    await addMessageToChatMessages(newChatId, userMessage);
                    await addAttachmentsToChatAttachments(userMessage.id, uiAttachments);

                    // Update chat name and description in background
                    updateChatName(newChatId, effectiveContent, tabId);
                    updateChatDescription(newChatId, effectiveContent);
                }
            }

            // Call Streaming API
            const response = await fetch(`/api/chat/${currentModel}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    history: updatedHistory,
                    userInput: effectiveContent,
                    attachments: apiAttachments,
                    isThinking: isThinking,
                    systemPrompt: systemPromptString + (settings.enableTools ? "" : "User has disabled tools. Do not use any tool. You can mention that tool are disabled."),
                    tools: settings.enableTools ? WORKSPACE_TOOL_DECLARATIONS : undefined
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Chat API error:", errorData);
                const fallbackContent = "We are unable to satisfy the request at the moment, please try again later or consider using another model.";

                const finalMsgs = [...updatedHistory, { ...assistantMessage, content: fallbackContent, isDone: true }];
                if (tabId) setTabState(tabId, { messages: finalMsgs });
                if (newChatId) {
                    await addMessageToChatMessages(newChatId, {
                        id: assistantId,
                        role: "assistant",
                        content: fallbackContent,
                        createdAt: new Date()
                    });
                }
                setIsLoading(false);
                setGlobalIsLoading(false);
                return;
            }

            const reader = response.body?.getReader();
            const textDecoder = new TextDecoder();
            let thinkingStartTime = Date.now();

            let geminiContents: any[] = [
                ...updatedHistory.map((msg: ChatMessage) => ({
                    role: msg.role === "user" ? "user" : "model",
                    parts: [{ text: msg.content || "" }]
                }))
            ];

            const processStreamInline = async (
                streamReader: ReadableStreamDefaultReader<Uint8Array>,
                msgId: string,
                signal: AbortSignal
            ): Promise<{ functionCalls: Array<{ name: string; args: Record<string, any>; thoughtSignature: string | null }>; tokenCount: number; roundText: string }> => {
                const functionCalls: Array<{ name: string; args: Record<string, any>; thoughtSignature: string | null }> = [];
                let tokenCount = 0;
                let buf = "";
                let roundText = "";

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
                                const updatedAssistantMessage = {
                                    ...assistantMessage,
                                    content: accumulatedAnswer,
                                    thought: accumulatedThought,
                                    thinkingTime: thinkingDuration,
                                    messageParts: accumulatedMessageParts,
                                    toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined
                                };
                                const nextMessages = [...updatedHistory, updatedAssistantMessage];
                                if (tabId) {
                                    setTabState(tabId, { messages: nextMessages });
                                }
                            } else if (data.type === "answer") {
                                if (thinkingDuration === undefined && accumulatedThought) {
                                    thinkingDuration = Date.now() - thinkingStartTime;
                                }
                                accumulatedAnswer += data.content;
                                roundText += data.content;

                                const lastIdx = accumulatedMessageParts.length - 1;
                                if (accumulatedMessageParts[lastIdx]?.type === 'text') {
                                    accumulatedMessageParts[lastIdx] = { type: 'text', content: (accumulatedMessageParts[lastIdx] as { type: 'text'; content: string }).content + data.content };
                                } else {
                                    accumulatedMessageParts.push({ type: 'text', content: data.content });
                                }

                                const updatedAssistantMessage = {
                                    ...assistantMessage,
                                    content: accumulatedAnswer,
                                    thought: accumulatedThought,
                                    thinkingTime: thinkingDuration,
                                    messageParts: accumulatedMessageParts,
                                    toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined
                                };
                                const nextMessages = [...updatedHistory, updatedAssistantMessage];
                                if (tabId) {
                                    setTabState(tabId, { messages: nextMessages });
                                }
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

                                const updatedAssistantMessage = {
                                    ...assistantMessage,
                                    content: accumulatedAnswer,
                                    thought: accumulatedThought,
                                    thinkingTime: thinkingDuration,
                                    messageParts: accumulatedMessageParts,
                                    toolCalls: accumulatedToolCalls
                                };
                                const nextMessages = [...updatedHistory, updatedAssistantMessage];
                                if (tabId) {
                                    setTabState(tabId, { messages: nextMessages });
                                }
                            } else if (data.type === "usageMetadata") {
                                tokenCount = data.totalTokens ?? 0;
                            }
                        } catch (e) {
                            console.error("Failed to parse stream line:", line, e);
                        }
                    }
                }
                return { functionCalls, tokenCount, roundText };
            };

            if (reader) {
                let currentReader = reader;
                let continueToolLoop = true;

                let currentFetchedNotes = [...fetchedNotes];
                let currentFetchedFolders = [...fetchedFolders];

                while (continueToolLoop) {
                    const { functionCalls, tokenCount, roundText } = await processStreamInline(currentReader, assistantId, controller.signal);
                    totalTokensUsed += tokenCount;

                    // Mid-stream credit exhaustion check
                    if (user && totalTokensUsed > 0) {
                        const totalCostSoFar = computeCredits(totalTokensUsed, accumulatedThought.length > 0, (userMessage?.attachments?.length ?? 0) > 0);
                        if (user.credits_left - totalCostSoFar <= 0) {
                            outOfCreditsRef.current = true;
                            setOutOfCredits(true);
                            controller.abort();
                            break;
                        }
                    }

                    if (functionCalls.length > 0) {
                        const modelFcParts: any[] = [];
                        if (roundText.length > 0) {
                            modelFcParts.push({ text: roundText });
                        }
                        functionCalls.forEach(fc => {
                            modelFcParts.push({
                                functionCall: { name: fc.name, args: fc.args },
                                ...(fc.thoughtSignature ? { thoughtSignature: fc.thoughtSignature } : {})
                            });
                        });
                        geminiContents.push({ role: "model", parts: modelFcParts });

                        const functionResponses: any[] = [];
                        for (const fc of functionCalls) {
                            let result: string;
                            let status: 'done' | 'error' = 'done';

                            await new Promise(resolve => setTimeout(resolve, 1500));

                            try {
                                result = await executeToolCall(fc.name, fc.args, {
                                    userId: user!.id,
                                    fetchedNotes: currentFetchedNotes,
                                    fetchedFolders: currentFetchedFolders,
                                    setFetchedNotes: (action) => {
                                        currentFetchedNotes = typeof action === 'function' ? action(currentFetchedNotes) : action;
                                        setFetchedNotes(action);
                                    },
                                    setFetchedFolders: (action) => {
                                        currentFetchedFolders = typeof action === 'function' ? action(currentFetchedFolders) : action;
                                        setFetchedFolders(action);
                                    }
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

                            const updatedAssistantMessage = {
                                ...assistantMessage,
                                content: accumulatedAnswer,
                                thought: accumulatedThought,
                                thinkingTime: thinkingDuration,
                                messageParts: accumulatedMessageParts,
                                toolCalls: accumulatedToolCalls
                            };
                            const nextMessages = [...updatedHistory, updatedAssistantMessage];
                            if (tabId) {
                                setTabState(tabId, { messages: nextMessages });
                            }
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
                        continueToolLoop = false;
                    }
                }

                const assistantMessageComplete: ChatMessage = {
                    id: assistantId,
                    role: "assistant",
                    content: accumulatedAnswer,
                    thought: accumulatedThought,
                    thinkingTime: thinkingDuration,
                    messageParts: accumulatedMessageParts,
                    toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
                    createdAt: new Date(),
                    isDone: true,
                    creditsUsed: computeCredits(totalTokensUsed, accumulatedThought.length > 0, (userMessage?.attachments?.length ?? 0) > 0)
                };
                const nextMessages = [...updatedHistory, assistantMessageComplete];
                if (tabId) {
                    setTabState(tabId, { messages: nextMessages });
                }

                // Update cache
                if (newChatId) {
                    setChatCache(prev => ({
                        ...prev,
                        [newChatId!]: { messages: nextMessages, title: "New Chat" }
                    }));
                }
            }

            if (newChatId) {
                await addMessageToChatMessages(newChatId, {
                    id: assistantId,
                    role: "assistant",
                    content: accumulatedAnswer,
                    thought: accumulatedThought,
                    thinkingTime: thinkingDuration,
                    messageParts: accumulatedMessageParts,
                    toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
                    createdAt: new Date(),
                    creditsUsed: computeCredits(totalTokensUsed, accumulatedThought.length > 0, (userMessage?.attachments?.length ?? 0) > 0)
                });
            }

            // Deduct credits
            await deductCredits(totalTokensUsed, accumulatedThought.length > 0, userMessage.attachments.length > 0);

        } catch (error: any) {
            if (error.name === 'AbortError') {
                const assistantMessageComplete: ChatMessage = {
                    id: assistantId,
                    role: "assistant",
                    content: accumulatedAnswer.trim(),
                    thought: accumulatedThought.trim(),
                    thinkingTime: thinkingDuration,
                    messageParts: accumulatedMessageParts,
                    toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
                    createdAt: new Date(),
                    isDone: true,
                    creditsUsed: computeCredits(totalTokensUsed, accumulatedThought.length > 0, (userMessage?.attachments?.length ?? 0) > 0)
                };
                const nextMessages = [...updatedHistory, assistantMessageComplete];
                if (tabId) {
                    setTabState(tabId, { messages: nextMessages });
                }

                if (!outOfCreditsRef.current) {
                    toast.warning("Answer stopped!");
                }

                if (newChatId) {
                    await addMessageToChatMessages(newChatId, {
                        id: assistantId,
                        role: "assistant",
                        content: accumulatedAnswer.trim(),
                        thought: accumulatedThought.trim(),
                        thinkingTime: thinkingDuration,
                        messageParts: accumulatedMessageParts,
                        toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
                        createdAt: new Date(),
                        creditsUsed: computeCredits(totalTokensUsed, accumulatedThought.length > 0, (userMessage?.attachments?.length ?? 0) > 0)
                    });
                }

                await deductCredits(totalTokensUsed, accumulatedThought.length > 0, userMessage?.attachments ? userMessage.attachments.length > 0 : false);
            } else {
                console.error("Failed to get streaming response:", error);
                const fallbackContent = "We are unable to satisfy the request at the moment, please try again later or consider using another model.";

                const assistantMessageComplete: ChatMessage = {
                    id: assistantId,
                    role: "assistant",
                    content: fallbackContent,
                    createdAt: new Date(),
                    isDone: true
                };
                const nextMessages = [...updatedHistory, assistantMessageComplete];
                if (tabId) {
                    setTabState(tabId, { messages: nextMessages });
                }

                if (newChatId) {
                    await addMessageToChatMessages(newChatId, {
                        id: assistantId,
                        role: "assistant",
                        content: fallbackContent,
                        createdAt: new Date()
                    });
                }
            }
        } finally {
            setIsLoading(false);
            setGlobalIsLoading(false);
            abortControllerRef.current = null;
            outOfCreditsRef.current = false;
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
        setGlobalIsLoading(false);
    };

    return (
        <>
            {/* ── Out-of-credits popup ─────────────────────────────────────── */}
            {outOfCredits && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
                    onClick={() => setOutOfCredits(false)}
                >
                    <div
                        className="relative flex flex-col items-center gap-4 rounded-3xl border border-border bg-popover/80 backdrop-blur-xl shadow-2xl px-8 py-8 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Icon */}
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-destructive/15 border border-destructive/25">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <path d="M12 9v4" />
                                <path d="M12 17h.01" />
                            </svg>
                        </div>
                        {/* Copy */}
                        <div className="flex flex-col items-center gap-1 text-center">
                            <h2 className="text-lg font-semibold tracking-tight">You've run out of credits</h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Your answer was cut short because you ran out of credits.
                                Top up your balance to continue chatting.
                            </p>
                        </div>
                        {/* Gradient rule */}
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                        {/* Actions */}
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setOutOfCredits(false)}
                                className="flex-1 rounded-xl border border-border bg-background/60 hover:bg-background/80 transition-colors px-4 py-2 text-sm font-medium cursor-pointer"
                            >
                                Dismiss
                            </button>
                            <button
                                onClick={() => setOutOfCredits(false)}
                                className="flex-1 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity px-4 py-2 text-sm font-semibold cursor-pointer"
                            >
                                Top up
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="md:max-w-2xl max-w-full w-full flex flex-col gap-2 z-50">
                {/* Quote Preview */}
                {chatQuote && (
                    <div className="hover:translate-y-[0px] translate-y-[60px] transition-all duration-300s">
                        <div className={cn("flex px-4 relative w-full sm:w-[90%] lg:w-[80%] mx-auto group animate-in fade-in fade-up")}>
                            <div className="w-full relative">
                                <SelectionQuote text={chatQuote.text} sourceName={chatQuote.sourceName} pendingEdit={false} />
                                <Button
                                    onClick={() => setChatQuote(null)}
                                    size="icon"
                                    className="absolute top-5 right-2 rounded-full bg-background/80 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all shadow-sm border border-border/50 opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                                    aria-label="Remove quote"
                                >
                                    <X />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Attachment Previews */}
                {attachments.length > 0 && (
                    <div className="flex flex-row items-center gap-2 px-4 flex-wrap justify-center">
                        {attachments.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 border border-border px-3 py-1.5 rounded-xl text-xs group relative animate-in fade-in fade-up shadow-lg bg-popover">
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
                                    className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-2 items-center items-end pb-1 w-full">

                    <div className={cn(
                        "flex w-full rounded-[30px] border-1 border-border shadow-lg px-2 py-1 justify-center gap-2 transition-all duration-200 z-100 bg-popover",
                        (isRecording || hasRecording) ? "items-center h-[50px]" : "items-end"
                    )}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            multiple
                            accept="image/*,.pdf,.txt,.md,.csv,.json,.xml,.yaml,.yml,.toml,.ini,.log,.ts,.tsx,.js,.jsx,.css,.html,.htm,.sh,.py,.rb,.java,.c,.cpp,.h,.rs,.go,.php"
                            onChange={(e) => {
                                setAttachments(prev => [...prev, ...Array.from(e.target.files || [])]);
                                e.target.value = "";
                            }}
                        />

                        {/* No review mode — audio is auto-attached on stop */}

                        {(isRecording || hasRecording) ? (
                            <div className="flex items-center justify-between w-full h-[40px] px-2 animate-in fade-in zoom-in-95 duration-200">
                                {/* Left: Subdued Plus button/icon */}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 rounded-full text-muted-foreground/30 hover:bg-transparent cursor-not-allowed flex-shrink-0"
                                    disabled
                                >
                                    <Plus size={20} />
                                </Button>

                                {/* Center: Premium Waveform Animation & Timer */}
                                <div className="flex items-center flex-grow min-w-0 mx-2">
                                    {/* Premium Waveform Animation */}
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        {/* Timer (subtle and premium) */}
                                        <span className="text-xs font-mono font-medium text-muted-foreground bg-muted/40 dark:bg-muted/10 px-2 py-0.5 rounded-full select-none">
                                            {formatDuration(recordingDuration)}
                                        </span>

                                        {/* Elegant Waveform Container */}
                                        <div className="flex-grow flex items-center justify-center h-[40px] px-2">
                                            <PremiumWaveform
                                                analyserNode={analyserNode}
                                                isRecording={isRecording}
                                                barCount={40}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Cancel (X) and Confirm/Submit (✓) buttons */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {/* Discard Recording */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={handleDiscardRecording}
                                                className="h-10 w-10 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            >
                                                <X size={20} />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Discard recording</p>
                                        </TooltipContent>
                                    </Tooltip>

                                    {/* Stop & Auto-Attach Recording */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="default"
                                                size="icon"
                                                onClick={() => {
                                                    setPendingAutoAttach(true);
                                                    stopRecording();
                                                }}
                                                className="h-10 w-10 rounded-full flex items-center justify-center transition-all shadow-md bg-primary text-primary-foreground hover:bg-primary/95"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M20 6 9 17l-5-5" />
                                                </svg>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Stop &amp; attach voice note</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="pb-1">
                                    <Popover>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-10 w-10 rounded-full"
                                                        disabled={attachments.length >= 3}
                                                    >
                                                        <Plus />
                                                    </Button>
                                                </PopoverTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent><p>Add files and more</p></TooltipContent>
                                        </Tooltip>
                                        <PopoverContent className="p-1 w-56" align="start" alignOffset={-10} sideOffset={16}>
                                            <div className="flex flex-col items-start">
                                                <Button
                                                    variant="ghost"
                                                    className="h-full w-full rounded-lg justify-start items-center text-left"
                                                    onClick={() => { if (attachments.length < 3) fileInputRef.current?.click(); else toast.error("Maximum 3 attachments allowed", { position: "bottom-right", duration: 1000 }) }}
                                                >
                                                    <Plus />
                                                    <span>Add Attachment</span>
                                                </Button>
                                                <div className="h-px bg-border w-[85%] mx-auto my-1"></div>
                                                <div
                                                    className="h-full w-full rounded-lg justify-between items-center text-left flex gap-2 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 py-2 px-3 cursor-pointer"
                                                    onClick={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); setIsThinking(!isThinking) }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Lightbulb className="w-4 h-4" />
                                                        <span className="text-sm font-medium">Think Longer</span>
                                                    </div>
                                                    <Switch
                                                        checked={isThinking}
                                                    />
                                                </div>
                                                <div
                                                    className="h-full w-full rounded-lg justify-between items-center text-left flex gap-2 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 py-2 px-3 cursor-pointer"
                                                    onClick={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); setSettings({ ...settings, enableTools: !settings.enableTools }) }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Wrench className="w-4 h-4" />
                                                        <span className="text-sm font-medium">Enable Tools</span>
                                                    </div>
                                                    <Switch
                                                        checked={settings.enableTools}
                                                    />
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="relative w-full">
                                    <div
                                        ref={editorRef}
                                        contentEditable
                                        suppressContentEditableWarning
                                        role="textbox"
                                        aria-multiline="true"
                                        aria-label={`Ask ${settings.aiName} anything...`}
                                        data-placeholder={`Ask ${settings.aiName} anything...`}
                                        className="mention-editor w-full focus:outline-none outline-none scrollbar-no-bg"
                                        onInput={(e) => {
                                            const el = e.currentTarget;
                                            const walk = (node: Node): string => {
                                                if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
                                                if ((node as Element).tagName === "BR") return "\n";
                                                if ((node as HTMLElement).classList?.contains("mention-token")) return node.textContent ?? "";
                                                return Array.from(node.childNodes).map(walk).join("");
                                            };
                                            const text = walk(el);
                                            setContent(text);
                                            setChatInputHTML(el.innerHTML);

                                            const sel = window.getSelection();
                                            if (!sel || sel.rangeCount === 0) return;
                                            const range = sel.getRangeAt(0).cloneRange();
                                            range.selectNodeContents(el);
                                            range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
                                            const caretOffset = range.toString().length;

                                            const slice = text.slice(0, caretOffset);
                                            const match = slice.match(/@([\w\s.-]*)$/);
                                            if (match) {
                                                const atPos = caretOffset - match[0].length;
                                                setMentionStart(atPos);
                                                setMentionQuery(match[1]);
                                            } else {
                                                closeMention();
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (mentionQuery !== null && mentionSuggestions.length > 0) {
                                                if (e.key === "ArrowDown") {
                                                    e.preventDefault();
                                                    setMentionIndex(i => (i + 1) % mentionSuggestions.length);
                                                    return;
                                                }
                                                if (e.key === "ArrowUp") {
                                                    e.preventDefault();
                                                    setMentionIndex(i => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                                                    return;
                                                }
                                                if (e.key === "Tab" || e.key === "Enter") {
                                                    e.preventDefault();
                                                    confirmMention(mentionSuggestions[mentionIndex]);
                                                    return;
                                                }
                                                if (e.key === "Escape") {
                                                    e.preventDefault();
                                                    closeMention();
                                                    return;
                                                }
                                            }

                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                                return;
                                            }
                                        }}
                                        onBlur={() => {
                                            setTimeout(() => closeMention(), 150);
                                        }}
                                        onPaste={(e) => {
                                            e.preventDefault();
                                            const text = e.clipboardData.getData("text/plain");
                                            document.execCommand("insertText", false, text);
                                        }}
                                        onClick={(e) => {
                                            const target = e.target as HTMLElement;
                                            const chip = target.closest(".mention-token") as HTMLElement;
                                            if (chip) {
                                                const id = chip.dataset.mentionId;
                                                const type = chip.dataset.mentionType;
                                                const title = chip.textContent?.slice(1) || "Item";
                                                if (id && type) {
                                                    if (type === "note") {
                                                        openTab({ type: "note", title, noteId: id });
                                                    } else if (type === "folder") {
                                                        openTab({ type: "folder", title, location: chip.dataset.path || "/" });
                                                    }
                                                }
                                            }
                                        }}
                                    />

                                    {mentionQuery !== null && mentionSuggestions.length > 0 && (
                                        <div
                                            ref={mentionListRef}
                                            className="mention-suggestions md:w-full w-64 left-2 right-auto"
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
                                                        e.preventDefault();
                                                        confirmMention(item);
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
                                            <p className="mention-suggestions-hint"><kbd className="hidden sm:inline-block">Tab</kbd> to confirm · <kbd className="hidden sm:inline-block">↑↓</kbd> to navigate · <kbd className="hidden sm:inline-block">Esc</kbd> to dismiss</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center pb-1 gap-1">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={cn(
                                                    "h-10 w-10 rounded-full transition-all duration-200 md:inline-flex hidden",
                                                    isRecording
                                                        ? "text-destructive bg-destructive/10 hover:bg-destructive/20"
                                                        : "hover:text-primary hover:bg-primary/10"
                                                )}
                                                onClick={handleMicToggle}
                                            >
                                                <Mic size={18} />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{isRecording ? "Stop recording" : "Record voice note"}</p>
                                        </TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="default"
                                                size="icon"
                                                onClick={() => isLoading ? handleStop() : handleSend()}
                                                disabled={(!isLoading && content.trim().length === 0 && attachments.length === 0) || user?.credits_left === 0}
                                                className="h-10 w-10 rounded-full p-0 flex items-center justify-center"
                                            >
                                                {isLoading ? (
                                                    <Square size={20} className="fill-current" />
                                                ) : (
                                                    <ArrowUp size={20} />
                                                )}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{isLoading ? "Stop generating" : "Send Message"}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
});

HomeChatMessageInput.displayName = 'HomeChatMessageInput';

export default HomeChatMessageInput;