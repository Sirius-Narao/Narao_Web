import { ScrollArea } from "@/components/ui/scroll-area";
import ChatMessageInput from "./chatMessageInput";
import { useState, useEffect } from "react";
import { ChatMessage } from "@/types/chatType";
import ChatMessageBlock from "./chatMessageBlock";
import { useChatMessages } from "@/context/chatMessagesContext";


export default function Chat() {
    const { chatMessages, setChatMessages } = useChatMessages();

    // Initialize with demo messages if empty
    useEffect(() => {
        if (chatMessages.length === 0) {
            setChatMessages([]);
        }
    }, []);

    return (
        <div className="flex flex-col relative w-full h-full overflow-hidden">
            {/* Main scrollable area container */}
            <div className="flex-1 relative w-full overflow-hidden">
                {/* Fixed fade effects at top and bottom */}
                <div className="absolute top-0 left-0 w-[calc(100%-12px)] h-16 bg-gradient-to-b from-card to-transparent pointer-events-none z-20" key={"fade-top"} />

                <ScrollArea className="h-full w-full px-[12%]">
                    <div className="pt-20" key={"padding-top"}></div>

                    {chatMessages.map((message) => (
                        message.role === "user" ? (
                            <div className="flex flex-row relative w-full h-fit justify-end" key={message.id}>
                                <ChatMessageBlock message={message} />
                            </div>
                        ) : (
                            <ChatMessageBlock key={message.id} message={message} />
                        )
                    ))}

                    <div className="pb-32" key={"padding-bottom"}></div>
                </ScrollArea>

                <div className="absolute bottom-0 left-0 w-[calc(100%-12px)] h-32 bg-gradient-to-t from-card to-transparent pointer-events-none z-20" key={"fade-bottom"} />
            </div>

            <ChatMessageInput />
        </div>
    )
}
