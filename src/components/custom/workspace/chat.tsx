import { ScrollArea } from "@/components/ui/scroll-area";
import ChatMessageInput from "./chatMessageInput";
import { useState, useEffect, useRef } from "react";
import ChatMessageBlock from "./chatMessageBlock";
import { useChatMessages } from "@/context/chatMessagesContext";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/userContext";
import { ChatMessage } from "@/types/chatType";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsLoading } from "@/context/isLoadingContext";
import { EditMessageProvider } from "@/context/editMessageContext";
import { Spinner } from "@/components/ui/spinner";

const LOADING_PHRASES = [
    "Loading... ",
    "Almost there... ",
    "You might be facing connection issues... "
];

export default function Chat() {
    const { chatMessages, setChatMessages, currentChatId, setCurrentChatId } = useChatMessages();
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [attachments, setAttachments] = useState<File[]>([])
    // for typing animation
    const [isLoadingChats, setIsLoadingChats] = useState(false)
    const [displayText, setDisplayText] = useState("");
    const [phraseIndex, setPhraseIndex] = useState(0);

    const { user } = useUser();

    // Fetch messages when currentChatId changes
    useEffect(() => {
        if (!currentChatId) {
            setChatMessages([]);
            return;
        }

        let ignore = false;
        const fetchMessages = async () => {
            setIsLoadingChats(true);
            const { data: messages, error } = await supabase
                .from("chat_messages")
                .select("*")
                .eq("chat_id", currentChatId)
                .order("created_at", { ascending: true });

            const { data: attachments, error: attachmentsError } = await supabase
                .from("chat_attachments")
                .select("*")
                .in("message_id", messages?.map(msg => msg.id) ?? [])
                .order("created_at", { ascending: true });

            if (error || attachmentsError) {
                console.error("Error fetching messages:", error || attachmentsError);
                return;
            }

            if (!ignore && messages) {
                setChatMessages(prev => {
                    const mappedMessages: ChatMessage[] = messages.map((msg: any) => {
                        return {
                            id: msg.id,
                            content: msg.content,
                            role: msg.role,
                            thought: msg.thought,
                            thinkingTime: msg.thinking_time,
                            messageParts: msg.message_parts,
                            toolCalls: msg.tool_calls,
                            createdAt: new Date(msg.created_at),
                            isDone: true,
                            attachments: attachments?.filter(attachment => attachment.message_id === msg.id)
                        };
                    });

                    const dbIds = new Set(mappedMessages.map(m => m.id));
                    const missingLocal = prev.filter(m => !dbIds.has(m.id));
                    return [...mappedMessages, ...missingLocal];
                });
            }
            setIsLoadingChats(false);
        };

        fetchMessages();

        return () => {
            ignore = true;
        };
    }, [currentChatId, setChatMessages]);

    // Auto-scroll to bottom whenever messages change (new message sent or AI streaming)
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages.length]);

    // Track scroll position of the ScrollArea viewport to show/hide the scroll-to-bottom button
    useEffect(() => {
        const container = scrollAreaRef.current;
        if (!container) return;

        // Radix ScrollArea renders its scrollable viewport with this attribute
        const viewport = container.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
        if (!viewport) return;

        const handleScroll = () => {
            const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 264;
            setIsAtBottom(atBottom);
        };

        viewport.addEventListener("scroll", handleScroll, { passive: true });
        return () => viewport.removeEventListener("scroll", handleScroll);
    }, []);

    // animation for typing loading
    useEffect(() => {
        if (!isLoadingChats) {
            setDisplayText("");
            setPhraseIndex(0);
            return;
        }

        let i = -1;
        const phrase = LOADING_PHRASES[phraseIndex];
        setDisplayText(phrase.slice(0, 1));
        const interval = setInterval(() => {
            i++;
            setDisplayText(phrase.slice(0, i + 1));
            if (i >= phrase.length) {
                clearInterval(interval);
                setTimeout(() => {
                    setPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
                }, 1500);
            }
        }, 20);
        return () => clearInterval(interval);
    }, [isLoadingChats, phraseIndex]);

    return (
        <EditMessageProvider>
            <div className="flex flex-col.....0 relative w-full h-full overflow-hidden">
                {/* Main scrollable area container */}
                <div className="flex-1 relative w-full h-full overflow-hidden">
                    {/* Fixed fade effects at top and bottom */}
                    <div className="absolute top-0 left-0 w-[calc(100%-12px)] h-16 bg-gradient-to-b from-card to-transparent pointer-events-none z-20" key={"fade-top"} />

                    {isLoadingChats ? (
                        <div className="flex items-center justify-center h-[60vh]">
                            <p className="text-muted-foreground animate-pulse text-3xl font-medium">
                                {displayText.slice(0, displayText.length - 1)}
                            </p>
                            <p className="text-primary animate-pulse text-3xl font-medium">
                                {displayText.slice(displayText.length - 1, displayText.length)}
                            </p>
                        </div>
                    ) : (
                        <div ref={scrollAreaRef} className="h-full w-full">
                            <ScrollArea className="h-full w-full px-[12%]">
                                <div className="h-20 " key={"padding-top"}></div>

                                {chatMessages.map((message) => (
                                    message.role === "user" ? (
                                        <div className="flex flex-row relative w-full h-fit justify-end" key={message.id}>
                                            <ChatMessageBlock message={message} />
                                        </div>
                                    ) : (
                                        <ChatMessageBlock key={message.id} message={message} />
                                    )
                                ))}
                                {chatMessages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-[50vh]">
                                        <p className="text-3xl font-medium text-muted-foreground fade-up fade-up-delay-1">Hi, I'm Orthan AI.</p>
                                        <p className="text-4xl font-medium fade-up fade-up-delay-2">How can I help you today?</p>
                                    </div>
                                )}

                                <div ref={bottomRef} className="h-32 " key={"padding-bottom"}></div>
                            </ScrollArea>
                        </div>
                    )}

                    <Button
                        variant={"outline"}
                        size={"icon"}
                        className={
                            cn(
                                "absolute right-0 left-0 mx-auto z-30 transition-all duration-300 border-1 dark:border-border bg-popover/60 dark:bg-popover/60 backdrop-blur-md shadow-lg",
                                isAtBottom ? "opacity-0 pointer-events-none" : "opacity-100",
                                attachments.length > 0 ? "bottom-28" : "bottom-20"
                            )}
                        onClick={() => {
                            const viewport = scrollAreaRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
                            if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
                        }}>
                        <ArrowDown />
                    </Button>

                    <div className="absolute bottom-0 left-0 w-[calc(100%-12px)] h-32 bg-gradient-to-t from-card to-transparent pointer-events-none z-20" key={"fade-bottom"} />
                </div>

                <ChatMessageInput attachments={attachments} setAttachments={setAttachments} />
            </div>
        </EditMessageProvider>
    )
}
