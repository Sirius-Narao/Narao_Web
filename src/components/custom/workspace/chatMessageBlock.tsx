import { ChatMessage } from "@/types/chatType";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Check, ChevronDown, Copy, Edit, FileImage, FileTypeCorner, Lightbulb, RefreshCcw, Sun, ThumbsDown, ThumbsUp, TriangleAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useIsLoading } from "@/context/isLoadingContext";
import { useEditMessage } from "@/context/editMessageContext";
import { useChatMessages } from "@/context/chatMessagesContext";

const THINKING_PHRASES = [
    "Let me think about it... ",
    "Gathering my thoughts... ",
    "Analyzing your request... ",
    "Almost there... ",
    "Why am I taking so long... "
];

export default function ChatMessageBlock({ message }: { message: ChatMessage }) {
    const [isThoughtExpanded, setIsThoughtExpanded] = useState(false);
    const { isLoading } = useIsLoading();
    const { requestEdit, requestRegenerate } = useEditMessage();
    const [phraseIndex, setPhraseIndex] = useState(0);
    const { chatMessages } = useChatMessages()
    const [displayText, setDisplayText] = useState("");

    useEffect(() => {
        if (!isLoading) {
            setDisplayText("");
            setPhraseIndex(0);
            return;
        }

        let i = -1;
        const phrase = THINKING_PHRASES[phraseIndex];
        setDisplayText(phrase.slice(0, 1));
        const interval = setInterval(() => {
            i++;
            setDisplayText(phrase.slice(0, i + 1));
            if (i >= phrase.length) {
                clearInterval(interval);
                setTimeout(() => {
                    setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
                }, 1500);
            }
        }, 20);
        return () => clearInterval(interval);
    }, [isLoading, phraseIndex]);

    return (
        <div className={`flex flex-col relative w-full h-fit mb-8 fade-up ${message.role === "user" ? "items-end" : "items-start"}`}>
            {
                message.role === "user" ? (
                    <div className="flex flex-col relative w-fit h-fit max-w-[80%] items-end">
                        {message.content && <div className="flex relative w-fit h-fit rounded-2xl bg-secondary/80 p-4 px-6 shadow-sm border border-border/10">
                            <MarkdownRenderer content={message.content} className="text-foreground" />
                        </div>}
                        {/* Content such as images, pdfs, etc */}
                        {message.attachments && message.attachments.length > 0 && (
                            <div className="flex flex-row relative w-full h-fit mt-2 flex-wrap gap-2 justify-end">
                                {message.attachments.map((attachment) => (
                                    <div key={attachment.id} className="flex flex-row w-fit h-fit bg-secondary/80 px-4 py-2 rounded-lg shadow-sm border border-border/10 items-center gap-2">
                                        {attachment.file_type === "image" && (
                                            <FileImage className="w-4 h-4 text-primary" />
                                        )}
                                        {attachment.file_type === "pdf" && (
                                            <FileTypeCorner className="w-4 h-4 text-destructive" />
                                        )}
                                        <p>{attachment.file_name}</p>
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
                                        <Button size={"icon"} variant={"ghost"} onClick={() => requestEdit(message.id, message.content)}>
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
                        {isLoading && chatMessages[chatMessages.length - 1]?.id === message.id && !message.content && !message.toolCalls?.length && (
                            <div className="flex flex-row items-center mb-2 p-2">
                                <p className="text-muted-foreground animate-pulse">
                                    {displayText.slice(0, displayText.length - 1)}
                                </p>
                                <p className="text-primary">
                                    {displayText.slice(displayText.length - 1, displayText.length)}
                                </p>
                            </div>
                        )}
                        {/* Tool call cards */}
                        {message.toolCalls && message.toolCalls.length > 0 && (
                            <div className="flex flex-col gap-1.5 mb-3 max-w-[85%]">
                                {message.toolCalls.map((tc, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border bg-popover/40 backdrop-blur-sm text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1"
                                    >
                                        <Wrench className="w-3 h-3 shrink-0 text-primary/70" />
                                        <span className="font-mono text-primary/80">{tc.name.replace(/_/g, " ")}</span>
                                        {Object.keys(tc.args).length > 0 && (
                                            <span className="truncate opacity-60 max-w-[220px]">
                                                {Object.entries(tc.args)
                                                    .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
                                                    .join(" · ")}
                                            </span>
                                        )}
                                        <span className="ml-auto shrink-0">
                                            {tc.status === 'loading' ? (
                                                <Spinner className="w-3 h-3" />
                                            ) : tc.status === 'done' ? (
                                                <Check className="w-3 h-3 text-green-500" />
                                            ) : (
                                                <TriangleAlert className="w-3 h-3 text-destructive" />
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
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
                        {(message.isDone && !message.content) && (
                            <div className="flex w-full h-fit max-w-[90%] items-center gap-2 justify-start mt-2 fade-up">
                                <TriangleAlert className="w-% h-5 text-muted-foreground" />
                                <p className="text-muted-foreground text-lg">Message stopped.</p>
                            </div>
                        )}
                        {message.isDone && message.content && (
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
                                        <Button size={"icon"} variant={"ghost"} disabled={isLoading} onClick={() => requestRegenerate(message.id)}>
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
