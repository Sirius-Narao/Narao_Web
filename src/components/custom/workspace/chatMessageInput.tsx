import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowUp, FileImage, FileTypeCorner, Lightbulb, Mic, Plus, X } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { generateGeminiResponse } from "@/app/actions/geminiChat"
import { useChatMessages } from "@/context/chatMessagesContext"
import { ChatMessage, ChatAttachment } from "@/types/chatType"
import { v4 as uuidv4 } from "uuid"

export default function ChatMessageInput() {
    const [content, setContent] = useState("")
    const [isThinking, setIsThinking] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [attachments, setAttachments] = useState<File[]>([])
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { chatMessages, setChatMessages } = useChatMessages()

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [content])

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

    const handleSend = async () => {
        if ((content.trim() === "" && attachments.length === 0) || isLoading) return;

        setIsLoading(true);

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
                createdAt: new Date()
            };

            const updatedHistory = [...chatMessages, userMessage];
            setChatMessages(updatedHistory);

            const currentContent = content;
            setContent("");
            setAttachments([]);

            // 3. Prepare Assistant placeholder
            const assistantId = uuidv4();
            const assistantMessage: ChatMessage = {
                id: assistantId,
                role: "assistant",
                content: "",
                createdAt: new Date()
            };
            setChatMessages(prev => [...prev, assistantMessage]);

            // 4. Call Streaming API
            const response = await fetch("/api/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    history: chatMessages,
                    userInput: currentContent,
                    attachments: apiAttachments,
                    isThinking: isThinking
                })
            });

            if (!response.ok) throw new Error("Failed to start stream");

            // 5. Read the stream
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullContent = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    fullContent += chunk;

                    // Update the specific assistant message in the context
                    setChatMessages(prev => prev.map(msg =>
                        msg.id === assistantId ? { ...msg, content: fullContent } : msg
                    ));
                }
            }

        } catch (error) {
            console.error("Failed to get streaming Gemini response:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="absolute flex flex-col w-[60%] bottom-0 left-[20%] right-[20%] gap-2 z-100">
            {/* Attachment Previews */}
            {attachments.length > 0 && (
                <div className="flex flex-row items-center gap-2 px-4 overflow-x-auto">
                    {attachments.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 bg-popover border border-border px-3 py-1.5 rounded-xl text-xs group relative animate-in fade-in slide-in-from-bottom-2">
                            {file.type.includes("jpeg") || file.type.includes("png") || file.type.includes("gif") || file.type.includes("webp") && (
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
            )}

            <div className="flex w-full bg-popover rounded-[30px] border border-border shadow-lg px-2 py-1 items-end justify-center gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => setAttachments(prev => [...prev, ...Array.from(e.target.files || [])])}
                />

                <div className="flex items-center pb-1 gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 rounded-full"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Plus />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Attach Image or PDF</p></TooltipContent>
                    </Tooltip>
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
                            <p>Think Deeper (Gemini 3 Pro +)</p>
                            <p className="text-xs text-muted-foreground">Improved reasoning, higher latency</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                <textarea
                    ref={textareaRef}
                    className="w-full resize-none bg-transparent py-3 focus:outline-none outline-none scrollbar-no-bg max-h-[156px] overflow-y-auto"
                    placeholder="Ask Gemini 3 anything..."
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
                                onClick={handleSend}
                                disabled={isLoading || (content.length === 0 && attachments.length === 0)}
                                className="h-10 w-10 rounded-full p-0 flex items-center justify-center"
                            >
                                {isLoading ? (
                                    <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <ArrowUp size={20} />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Send Message</p></TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </div>
    )
}
