import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowUp, FileImage, FileTypeCorner, Leaf, Lightbulb, Mic, Plus, Square, X, Zap } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useChatMessages } from "@/context/chatMessagesContext"
import { ChatMessage, ChatAttachment, Models } from "@/types/chatType"
import { v4 as uuidv4 } from "uuid"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { useUser } from "@/context/userContext"
import { useActiveTabs } from "@/context/activeTabsContext"
import { Type } from "@google/genai"

const models = {
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-3-flash-preview": "Gemini 3 Flash",
    "gemini-3.1-flash-lite-preview": "Gemini 3.1 Flash Lite"
}

export default function ChatMessageInput() {
    const [content, setContent] = useState("")
    const [isThinking, setIsThinking] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [attachments, setAttachments] = useState<File[]>([])
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const { chatMessages, setChatMessages, currentChatId, setCurrentChatId, refreshChats, setChatTitle } = useChatMessages()

    // user context
    const { user } = useUser();
    const systemPromptString = `You are "Orthan AI", Narao's integrated assistant. You help in order to learn and to work mainly. You are expert in creating but also managing notes and folders. Narao is a note-taking app that uses AI to help users to learn and to work more efficiently. I am ${user?.username || "the user"}, and my preferences are: I like coding, AI, and technology. I am a student and I am learning about AI. Don't talk about yourself, only talk about the user and the task except if explicitely asked.`;

    // Model Settings
    const [currentModel, setCurrentModel] = useState<keyof Models>("gemini-3.1-flash-lite-preview")

    // Popover Settings
    const [isSelectingModelPopoverOpen, setIsSelectingModelPopoverOpen] = useState(false)

    // active tab
    const { activeTab } = useActiveTabs()

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [content])

    useEffect(() => {
        if (activeTab === 2) {
            textareaRef.current?.focus()
        }
    }, [activeTab])

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

    // convert file to base64 for attachments
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

        try {
            // 1. Prepare attachments
            const uiAttachments: ChatAttachment[] = attachments.map(file => ({
                id: uuidv4(),
                name: file.name,
                type: file.type.includes("pdf") ? "pdf" : "image",
                url: URL.createObjectURL(file),
                size: file.size,
                createdAt: new Date()
            }));

            const apiAttachments = await Promise.all(attachments.map(async file => ({
                name: file.name,
                type: file.type,
                data: await fileToBase64(file)
            })));

            // 2. Create and add user message
            const userMessage: ChatMessage = {
                id: uuidv4(),
                role: "user",
                content: content.trim(),
                attachments: uiAttachments,
                createdAt: new Date(),
                isDone: true
            };

            const updatedHistory = [...chatMessages, userMessage];
            setChatMessages(updatedHistory);

            const currentContent = content;
            setContent("");
            setAttachments([]);

            // 3. Prepare Assistant placeholder
            const assistantMessage: ChatMessage = {
                id: assistantId,
                role: "assistant",
                content: "",
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
                    // Save user message for the new chat
                    addMessageToChatMessages(newChatId, userMessage);
                    // Rename and describe the chat in the background
                    updateChatName(newChatId, currentContent);
                    updateChatDescription(newChatId, currentContent);
                }
            } else if (effectiveChatId) {
                // Save user message for existing chat
                addMessageToChatMessages(effectiveChatId, userMessage);
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
                    tools: allTools
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Chat API error:", errorData);
                // Remove the empty assistant placeholder
                setChatMessages(prev => prev.filter(msg => msg.id !== assistantId));
                const userMessage = errorData.message || "Something went wrong. Please try again.";
                toast.error(userMessage, { position: "bottom-right" });
                setIsLoading(false);
                return;
            }

            // 5. Read the stream
            const reader = response.body?.getReader();
            const textDecoder = new TextDecoder();
            let buffer = "";
            let thinkingStartTime = Date.now();

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        setChatMessages(prev => prev.map(msg =>
                            msg.id === assistantId ? {
                                ...msg,
                                isDone: true
                            } : msg
                        ));
                        break;
                    }

                    buffer += textDecoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");

                    // The last element might be a partial line, keep it in buffer
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        try {
                            const data = JSON.parse(line);
                            if (data.type === "thought") {
                                accumulatedThought += data.content;
                            } else if (data.type === "answer") {
                                if (thinkingDuration === undefined) {
                                    thinkingDuration = Date.now() - thinkingStartTime;
                                }
                                accumulatedAnswer += data.content;
                            } else if (data.type === "functionCall") {
                                console.log("Function call received:", data.content);
                            }

                            // Update the specific assistant message
                            setChatMessages(prev => prev.map(msg =>
                                msg.id === assistantId ? {
                                    ...msg,
                                    content: accumulatedAnswer,
                                    thought: accumulatedThought,
                                    thinkingTime: thinkingDuration
                                } : msg
                            ));
                        } catch (e) {
                            console.error("Failed to parse stream line:", line, e);
                        }
                    }
                }
            }

            if (effectiveChatId) {
                addMessageToChatMessages(effectiveChatId, {
                    id: assistantId,
                    role: "assistant",
                    content: accumulatedAnswer,
                    thought: accumulatedThought,
                    thinkingTime: thinkingDuration,
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
                if (effectiveChatId && (accumulatedAnswer.trim() || accumulatedThought.trim())) {
                    addMessageToChatMessages(effectiveChatId, {
                        id: assistantId,
                        role: "assistant",
                        content: accumulatedAnswer,
                        thought: accumulatedThought,
                        thinkingTime: thinkingDuration,
                        createdAt: new Date()
                    });
                }
            } else {
                console.error("Failed to get streaming Gemini response:", error);
                // Remove the empty assistant placeholder on unexpected errors
                setChatMessages(prev => prev.filter(msg => msg.id !== assistantId));
                toast.error(error?.message || "Something went wrong. Please try again.", { position: "bottom-right" });
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

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

    // -------------------------- AI FUNCTIONS --------------------------

    const searchFilesAndFoldersDeclaration = {
        name: "search_files_and_folders",
        description: "Gets a list of objects (note_name, note_description, localisation), and a list of objects (folder_name, localisation) given a query. This function is set to gain knowledge from the currently existing workspace architecture.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: "Query to search for existing folders and notes (e.g. 'math test functions ai matrices'). That searches by keywords, the more you have the better (MAX 30 keywords)."
                },
            },
            required: ["query"],
        },
    }
    const readNoteDeclaration = {
        name: "read_note",
        description: "Gets the content of the accessed note.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                localisation: {
                    type: Type.STRING,
                    description: "Absolute path to the note (e.g. '/maths/introduction')."
                },
            },
            required: ["localisation"],
        },
    }
    const modifyNote = {
        name: "modify_note",
        description: "Modify the whole content of the accessed note. Be mindful that it will replace the whole content of the note with the one you provide.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                localisation: {
                    type: Type.STRING,
                    description: "Absolute path to the note (e.g. '/maths/introduction')."
                },
                content: {
                    type: Type.STRING,
                    description: "Text that will replace the one inside the note (e.g. # Math Exercices \n 1. 2 + 2 = ?...). The use of markdown is recommended."
                }
            },
            required: ["localisation", "content"],
        },
    }

    // list of all functions for the AI
    const allTools = [searchFilesAndFoldersDeclaration, readNoteDeclaration, modifyNote]

    return (
        <div className="absolute flex flex-col w-[60%] bottom-0 left-[20%] right-[20%] gap-2 z-50" >
            {/* Attachment Previews */}
            {attachments.length > 0 && (
                <div className="flex flex-row items-center gap-2 px-4 flex-wrap justify-center">
                    {attachments.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 bg-popover border border-border px-3 py-1.5 rounded-xl text-xs group relative animate-in fade-in slide-in-from-bottom-2">
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

            < div className="flex gap-2 items-center" >
                <div className="bg-popover rounded-[30px] border border-border shadow-lg p-2">
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
                <div className="flex w-full bg-popover rounded-[30px] border border-border shadow-lg px-2 py-1 items-end justify-center gap-2">
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
                        disabled={isLoading}
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
                                                {model === "gemini-3.1-flash-lite-preview" && <Leaf className="" />}
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
