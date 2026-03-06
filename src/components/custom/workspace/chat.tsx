import { ScrollArea } from "@/components/ui/scroll-area";
import ChatMessageInput from "./chatMessageInput";
import { useState, useEffect } from "react";
import ChatMessageBlock from "./chatMessageBlock";
import { useChatMessages } from "@/context/chatMessagesContext";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/context/userContext";
import { ChatMessage } from "@/types/chatType";


export default function Chat() {
    const { chatMessages, setChatMessages, currentChatId, setCurrentChatId } = useChatMessages();
    const { user } = useUser();

    // Fetch messages when currentChatId changes
    useEffect(() => {
        if (!currentChatId) {
            setChatMessages([]);
            return;
        }

        let ignore = false;
        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from("chat_messages")
                .select("*")
                .eq("chat_id", currentChatId)
                .order("created_at", { ascending: true });

            if (error) {
                console.error("Error fetching messages:", error);
                return;
            }

            if (!ignore && data) {
                const mappedMessages: ChatMessage[] = data.map((msg: any) => ({
                    id: msg.id,
                    content: msg.content,
                    role: msg.role,
                    thought: msg.thought,
                    thinkingTime: msg.thinking_time,
                    createdAt: new Date(msg.created_at),
                    isDone: true
                }));

                setChatMessages(prev => {
                    // Combine mappedMessages from DB with any optimistic/streaming messages from prev array.
                    const dbIds = new Set(mappedMessages.map(m => m.id));
                    const missingLocal = prev.filter(m => !dbIds.has(m.id));
                    return [...mappedMessages, ...missingLocal];
                });
            }
        };

        fetchMessages();

        return () => {
            ignore = true;
        };
    }, [currentChatId, setChatMessages]);

    return (
        <div className="flex flex-col.....0 relative w-full h-full overflow-hidden">
            {/* Main scrollable area container */}
            <div className="flex-1 relative w-full h-full overflow-hidden">
                {/* Fixed fade effects at top and bottom */}
                <div className="absolute top-0 left-0 w-[calc(100%-12px)] h-16 bg-gradient-to-b from-card to-transparent pointer-events-none z-20" key={"fade-top"} />

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

                    <div className="h-32 " key={"padding-bottom"}></div>
                </ScrollArea>

                <div className="absolute bottom-0 left-0 w-[calc(100%-12px)] h-32 bg-gradient-to-t from-card to-transparent pointer-events-none z-20" key={"fade-bottom"} />
            </div>

            <ChatMessageInput />
        </div>
    )
}
