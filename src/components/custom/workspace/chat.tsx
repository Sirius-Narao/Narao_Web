import { ScrollArea } from "@/components/ui/scroll-area";
import ChatMessageInput from "./chatMessageInput";

export default function Chat() {
    return (
        <div className="flex flex-column relative w-full h-full px-[12%] py-12">
            <ScrollArea></ScrollArea>
            <ChatMessageInput />
        </div>
    )
}