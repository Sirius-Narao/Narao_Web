import { ChatMessage } from "@/types/chatType";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { FileImage, FileTypeCorner, Sun } from "lucide-react";

export default function ChatMessageBlock({ message }: { message: ChatMessage }) {
    return (
        <div className={`flex flex-col relative w-full h-fit mb-8 ${message.role === "user" ? "items-end" : "items-start"}`}>
            {
                message.role === "user" ? (
                    <div className="flex flex-col relative w-fit h-fit max-w-[80%] items-end">
                        <div className="flex relative w-fit h-fit rounded-2xl bg-secondary/80 p-4 shadow-sm border border-border/10">
                            <MarkdownRenderer content={message.content} className="text-foreground" />
                        </div>
                        {/* Content such as images, pdfs, etc */}
                        {message.attachments && message.attachments.length > 0 && (
                            <div className="flex flex-row relative w-full h-fit mt-2 flex-wrap gap-2 justify-end">
                                {message.attachments.map((attachment) => (
                                    <div key={attachment.id} className="flex flex-row w-fit h-fit bg-secondary/80 px-4 py-2 rounded-lg shadow-sm border border-border/10 items-center gap-2">
                                        {attachment.type === "image" && (
                                            <FileImage className="w-4 h-4 text-primary" />
                                        )}
                                        {attachment.type === "pdf" && (
                                            <FileTypeCorner className="w-4 h-4 text-destructive" />
                                        )}
                                        <p>{attachment.name}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col relative w-full h-fit group">
                        <div className="flex relative w-full h-fit max-w-[90%] items-start">
                            <MarkdownRenderer
                                content={message.content}
                                className="text-foreground w-full"
                            />
                        </div>
                        {/* Potentially add actions here like Copy/Regenerate */}
                    </div>
                )
            }
        </div>
    )
}
