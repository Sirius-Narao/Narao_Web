import { ChatMessage } from "@/types/chatType";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ChevronDown, Copy, Edit, FileImage, FileTypeCorner, Lightbulb, RefreshCcw, Sun, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

export default function ChatMessageBlock({ message }: { message: ChatMessage }) {
    const [isThoughtExpanded, setIsThoughtExpanded] = useState(false);
    return (
        <div className={`flex flex-col relative w-full h-fit mb-8 fade-up ${message.role === "user" ? "items-end" : "items-start"}`}>
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
                        {message.isDone && (
                            <div className="flex w-full h-fit max-w-[90%] items-center justify-end mt-2 fade-up">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size={"icon"} variant={"ghost"} onClick={() => { navigator.clipboard.writeText(message.content); toast.success("Copied to clipboard!", { position: "bottom-right", duration: 1000 }) }}>
                                            <Copy className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Copy</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size={"icon"} variant={"ghost"}>
                                            <Edit className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Edit</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col relative w-full h-fit group">
                        {message.thought && (
                            <div className="flex flex-col mb-4 p-4 bg-popover/30 rounded-xl border border-border max-w-[85%] text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 overflow-hidden transition-all duration-300">
                                <div className="flex flex-row w-full h-fit items-center justify-between cursor-pointer select-none" onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}>
                                    <span className="text-lg tracking-wider font-medium">
                                        {message.content ? (
                                            <div className="flex flex-row items-center gap-2">
                                                <Lightbulb className="w-4 h-4 text-muted-foreground" />
                                                <p>Thought</p>
                                                {message.thinkingTime !== undefined && (
                                                    <span className="">
                                                        {"for " + (message.thinkingTime / 1000).toFixed(1) + "s"}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-row items-center gap-2">
                                                <Spinner />
                                                <p className="animate-pulse">Thinking</p>
                                            </div>
                                        )}
                                    </span>
                                    <Button size={"icon"} variant={"ghost"} className="hover:bg-transparent">
                                        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", isThoughtExpanded ? "rotate-180" : "")} />
                                    </Button>
                                </div>
                                <div className={cn("grid transition-all duration-300 ease-in-out", isThoughtExpanded ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0")}>
                                    <div className="overflow-hidden">
                                        <MarkdownRenderer content={message.thought} className="italic opacity-50 text-sm" />
                                    </div>
                                </div>

                            </div>
                        )}
                        <div className="flex w-full h-fit max-w-[90%] items-start">
                            <MarkdownRenderer
                                content={message.content}
                                className="text-foreground w-full p-2"
                            />
                        </div>
                        {message.isDone && (
                            <div className="flex w-full h-fit max-w-[90%] items-start justify-start mt-2 fade-up">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size={"icon"} variant={"ghost"} onClick={() => { navigator.clipboard.writeText(message.content); toast.success("Copied to clipboard!", { position: "bottom-right", duration: 1000 }) }}>
                                            <Copy className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Copy</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size={"icon"} variant={"ghost"}>
                                            <ThumbsUp className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Like</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size={"icon"} variant={"ghost"}>
                                            <ThumbsDown className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Dislike</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size={"icon"} variant={"ghost"}>
                                            <RefreshCcw className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Regenerate</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        )}
                    </div>
                )
            }
        </div>
    )
}
