import { ChatMessage } from "@/types/chatType";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { BookOpen, Check, ChevronDown, Coins, Copy, Edit, FileImage, FileMinus, FilePen, FilePlus, FileTypeCorner, FolderMinus, FolderPlus, FolderSearch, Lightbulb, Move, Palette, PenTool, RefreshCcw, ThumbsDown, ThumbsUp, TriangleAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useIsLoading } from "@/context/isLoadingContext";
import { useEditMessage } from "@/context/editMessageContext";
import { useChatMessages } from "@/context/chatMessagesContext";
import { supabase } from "@/lib/supabaseClient";
import { useFetchedNotes } from "@/context/fetchedNotesContext";
import { useFetchedFolders } from "@/context/fetchedFoldersContext";
import { resolveNotePath, resolveFolderPath } from "@/lib/workspaceTools";
import { useTabs } from "@/context/tabsContext";

const THINKING_PHRASES = [
    "Let me think about it... ",
    "Gathering my thoughts... ",
    "Analyzing your request... ",
    "Almost there... ",
    "Why am I taking so long... "
];

type ToolName = keyof typeof TOOL_NAMES
const TOOL_NAMES = {
    "get_all_notes_and_folders": { loading: "Getting All Notes and Folders...", done: "Get All Notes and Folders", icon: <FolderSearch className="w-3 h-3 shrink-0 text-primary/70" /> },
    "read_note": { loading: "Reading Note(s)...", done: "Read Note(s)", icon: <BookOpen className="w-3 h-3 shrink-0 text-primary/70" /> },
    "create_note": { loading: "Creating Note(s)...", done: "Created Note(s)", icon: <FilePlus className="w-3 h-3 shrink-0 text-primary/70" /> },
    "delete_note": { loading: "Deleting Note(s)...", done: "Deleted Note(s)", icon: <FileMinus className="w-3 h-3 shrink-0 text-primary/70" /> },
    "rename_note": { loading: "Renaming Note(s)...", done: "Renamed Note(s)", icon: <PenTool className="w-3 h-3 shrink-0 text-primary/70" /> },
    "move_note": { loading: "Moving Note(s)...", done: "Moved Note(s)", icon: <Move className="w-3 h-3 shrink-0 text-primary/70" /> },
    "modify_note": { loading: "Modifying Note(s)...", done: "Modified Note(s)", icon: <FilePen className="w-3 h-3 shrink-0 text-primary/70" /> },
    "create_folder": { loading: "Creating Folder(s)...", done: "Created Folder(s)", icon: <FolderPlus className="w-3 h-3 shrink-0 text-primary/70" /> },
    "delete_folder": { loading: "Deleting Folder(s)...", done: "Deleted Folder(s)", icon: <FolderMinus className="w-3 h-3 shrink-0 text-primary/70" /> },
    "rename_folder": { loading: "Renaming Folder(s)...", done: "Renamed Folder(s)", icon: <PenTool className="w-3 h-3 shrink-0 text-primary/70" /> },
    "move_folder": { loading: "Moving Folder(s)...", done: "Moved Folder(s)", icon: <Move className="w-3 h-3 shrink-0 text-primary/70" /> },
    "change_color_folder": { loading: "Changing Folder Color(s)...", done: "Changed Folder Color(s)", icon: <Palette className="w-3 h-3 shrink-0 text-primary/70" /> },
}

function ToolCallCard({ part }: { part: any }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { fetchedNotes } = useFetchedNotes();
    const { fetchedFolders } = useFetchedFolders();
    const { openTab } = useTabs();

    return (
        <div
            className="group/tool flex flex-col justify-start items-start p-4 py-3 my-1 rounded-xl text-xs text-muted-foreground max-w-[85%] animate-in fade-in slide-in-from-top-1 hover:bg-popover/40 cursor-pointer border border-border"
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="flex gap-2 items-center w-full">
                {TOOL_NAMES[part.toolCall.name as keyof typeof TOOL_NAMES]?.icon || <Wrench className="w-3 h-3 shrink-0 text-primary/70" />}
                <span className="font-mono text-primary/80">{part.toolCall.status === "loading" ?
                    (TOOL_NAMES[part.toolCall.name as keyof typeof TOOL_NAMES]?.loading || `Running ${part.toolCall.name.replace(/_/g, " ")}...`) : (TOOL_NAMES[part.toolCall.name as keyof typeof TOOL_NAMES]?.done || `Ran ${part.toolCall.name.replace(/_/g, " ")}`)}
                </span>
                <span className="ml-auto shrink-0 relative flex items-center justify-center w-5 h-5">
                    <div className={cn(
                        "absolute inset-0 flex items-center justify-center transition-all duration-300",
                        "group-hover/tool:opacity-0 group-hover/tool:scale-75 opacity-100 scale-100"
                    )}>
                        {part.toolCall.status === 'loading' ? (
                            <Spinner className="w-3 h-3" />
                        ) : part.toolCall.status === 'done' ? (
                            <Check className="w-3 h-3 text-green-500" />
                        ) : (
                            <TriangleAlert className="w-3 h-3 text-destructive" />
                        )}
                    </div>
                    <div className={cn(
                        "absolute inset-0 flex items-center justify-center transition-all duration-300",
                        "group-hover/tool:opacity-100 group-hover/tool:scale-100 opacity-0 scale-75"
                    )}>
                        <ChevronDown className={cn("w-4 h-4 transition-transform duration-300", isExpanded ? "rotate-180" : "")} />
                    </div>
                </span>
            </div>
            <div className={cn("grid transition-all duration-300 ease-in-out w-full", isExpanded ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 mt-0")}>
                <div className={cn("overflow-hidden p-[1px] transition-all duration-300 ease-in-out", !isExpanded && "p-0")}>
                    {part.toolCall.args?.items && (
                        <span className="flex flex-wrap gap-1.5 mt-2">
                            {part.toolCall.args.items.map((item: any, idx: number) => {
                                const isFolderTool = part.toolCall.name.includes("folder");
                                let targetPath = item.localisation || item.path || (isFolderTool ? item.name : item.title);

                                // Special handling for creation tools to get the full path
                                if (part.toolCall.name === "create_note") {
                                    const folderPath = item.folder_path || item.folder || "/";
                                    targetPath = (folderPath.endsWith("/") ? folderPath : folderPath + "/") + item.title;
                                } else if (part.toolCall.name === "create_folder") {
                                    const parentPath = item.parent_path || item.parent || "/";
                                    targetPath = (parentPath.endsWith("/") ? parentPath : parentPath + "/") + item.name;
                                }

                                const note = !isFolderTool ? resolveNotePath(targetPath, fetchedNotes, fetchedFolders) : null;
                                const folder = isFolderTool ? resolveFolderPath(targetPath, fetchedFolders) : null;
                                const displayName = (isFolderTool ? (folder?.name || item.name) : (note?.title || item.title)) || targetPath;

                                return (
                                    <span key={idx} className="mention-text-link bg-primary text-primary-foreground px-3 py-1 rounded-lg border border-primary/10 flex items-center gap-2 font-medium shadow-sm cursor-pointer mention-token py-1! px-2!" onClick={(e) => {
                                        e.stopPropagation();
                                        if (note) {
                                            openTab({ noteId: note.id, title: note.title, type: 'note' });
                                        } else if (folder) {
                                            openTab({ title: folder.name, type: 'folder', location: targetPath });
                                        } else if (isFolderTool && folder === null) {
                                            // Handle root folder
                                            openTab({ title: "Root", type: 'folder', location: "/" });
                                        }
                                    }}>
                                        {isFolderTool ? <FolderPlus className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                                        {displayName}
                                    </span>
                                );
                            })}
                        </span>
                    )
                    }
                </div>
            </div>
        </div >
    );
}

export default function ChatMessageBlock({ message, isFollowUp }: { message: ChatMessage, isFollowUp: boolean }) {
    const [isThoughtExpanded, setIsThoughtExpanded] = useState(false);
    const { isLoading } = useIsLoading();
    const { requestEdit, requestRegenerate, requestQuickSend } = useEditMessage();
    const [phraseIndex, setPhraseIndex] = useState(0);
    const { chatMessages } = useChatMessages()
    const [displayText, setDisplayText] = useState("");

    // notes
    const { fetchedNotes } = useFetchedNotes();
    const { fetchedFolders } = useFetchedFolders();

    // isLiked state
    const [isLiked, setIsLiked] = useState(message.isLiked);
    const [isDisliked, setIsDisliked] = useState(message.isDisliked);

    const { openTab } = useTabs();

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

    const proceed = () => requestQuickSend("Okay, let's proceed!");
    const refuse = () => requestQuickSend("Do not proceed.");

    const likeMessage = async () => {
        if (isLiked) return;
        const { data, error } = await supabase
            .from('chat_messages')
            .update({ is_liked: true })
            .eq('id', message.id)
            .select()
            .single();

        if (error) {
            toast.error("Failed to like message");
            return;
        }

        setIsDisliked(false);
        setIsLiked(true);
    }

    const dislikeMessage = async () => {
        if (isDisliked) return;
        const { data, error } = await supabase
            .from('chat_messages')
            .update({ is_liked: false })
            .eq('id', message.id)
            .select()
            .single();

        if (error) {
            toast.error("Failed to dislike message");
            return;
        }

        setIsLiked(false);
        setIsDisliked(true);
    }

    // get note id by path (e.g. /maths/introduction)
    const getNoteIdByPath = (path: string) => {
        return resolveNotePath(path, fetchedNotes, fetchedFolders)?.id;
    }

    // get folder id by path (e.g. /maths/introduction)
    const getFolderIdByPath = (path: string) => {
        const folder = resolveFolderPath(path, fetchedFolders);
        if (folder === null) return undefined; // root
        return folder?.id;
    }

    return (
        <div className={`flex flex-col relative w-full h-fit mb-8 fade-up ${message.role === "user" ? "items-end" : "items-start"}`}>
            {
                message.role === "user" ? (
                    <div className="flex flex-col relative w-fit h-fit max-w-[80%] items-end">
                        {message.content && <div className="relative w-fit max-w-[100%] h-fit rounded-2xl bg-secondary/80 p-4 px-6 shadow-sm border border-border/10 overflow-hidden text-left">
                            <MarkdownRenderer content={message.content} className="text-foreground break-words" />
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
                                        <Button size={"icon"} variant={"ghost"} onClick={() => requestEdit(message.id, message.content, message.attachments)}>
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
                        {isLoading && chatMessages[chatMessages.length - 1]?.id === message.id && !message.content && !message.toolCalls?.length && !message.thought && (
                            <div className="flex flex-row items-center mb-2 p-2">
                                <p className="text-muted-foreground animate-pulse">
                                    {displayText.slice(0, displayText.length - 1)}
                                </p>
                                <p className="text-primary">
                                    {displayText.slice(displayText.length - 1, displayText.length)}
                                </p>
                            </div>
                        )}
                        {/* Interleaved message parts: text segments and tool cards in stream order */}
                        {message.messageParts && message.messageParts.length > 0 ? (
                            <div className="flex flex-col w-full">
                                {message.thought && (
                                    <div className="flex flex-col mb-4 p-4 bg-popover/30 rounded-xl border border-border max-w-[85%] text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 overflow-hidden transition-all duration-300">
                                        <div className="flex flex-row w-full h-fit items-center justify-between cursor-pointer select-none" onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}>
                                            <span className="text-lg tracking-wider font-medium">
                                                {message.content || (message.messageParts?.some(p => p.type === 'text' && (p as any).content)) ? (
                                                    <div className="flex flex-row items-center gap-2">
                                                        <Lightbulb className="w-4 h-4 text-muted-foreground" />
                                                        <p>Thought</p>
                                                        {message.thinkingTime !== undefined && (
                                                            <span>{"for " + (message.thinkingTime / 1000).toFixed(1) + "s"}</span>
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
                                {message.messageParts.map((part, i) =>
                                    part.type === 'toolCall' ? (
                                        <ToolCallCard key={i} part={part} />
                                    ) : part.content ? (
                                        <div key={i} className="w-full max-w-[90%] p-2">
                                            <MarkdownRenderer content={part.content} className="text-foreground" />
                                        </div>
                                    ) : null
                                )}
                                {!isLoading && message.content.endsWith("Do you want to proceed now?") && (
                                    <div className="w-fit p-2 flex flex-row gap-2">
                                        <Button variant="ghost" className="hover:bg-folder-green/20 hover:text-foreground bg-folder-green/20 cursor-pointer hover:bg-folder-green/50 dark:hover:bg-folder-green/50" onClick={() => { proceed() }}>Okay, let's proceed!</Button>
                                        <Button variant="ghost" className="hover:bg-folder-red/20 hover:text-foreground bg-folder-red/20 cursor-pointer hover:bg-folder-red/50 dark:hover:bg-folder-red/50" onClick={() => { refuse() }}>Do not proceed</Button>
                                    </div>
                                )}
                            </div>

                        ) : (
                            // Fallback for older messages without messageParts (loaded from DB)
                            <>
                                {message.toolCalls && message.toolCalls.length > 0 && (
                                    <div className="flex flex-col gap-1.5 mb-3 max-w-[85%]">
                                        {message.toolCalls.map((tc, i) => (
                                            <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border bg-popover/40 backdrop-blur-sm text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1">
                                                <Wrench className="w-3 h-3 shrink-0 text-primary/70" />
                                                <span className="font-mono text-primary/80">{tc.name.replace(/_/g, " ")}</span>
                                                <span className="ml-auto shrink-0">
                                                    {tc.status === 'loading' ? <Spinner className="w-3 h-3" /> : tc.status === 'done' ? <Check className="w-3 h-3 text-green-500" /> : <TriangleAlert className="w-3 h-3 text-destructive" />}
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
                                                            <span>{"for " + (message.thinkingTime / 1000).toFixed(1) + "s"}</span>
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
                                    <MarkdownRenderer content={message.content} className="text-foreground w-full p-2" />
                                </div>
                                {!isLoading && message.content.endsWith("Do you want to proceed now?") && !isFollowUp && (
                                    <div className="w-fit p-2 flex flex-row gap-2">
                                        <Button variant="ghost" className="hover:bg-folder-green/20 hover:text-foreground bg-folder-green/20 cursor-pointer hover:bg-folder-green/50 dark:hover:bg-folder-green/50" onClick={() => { proceed() }}>Okay, let's proceed!</Button>
                                        <Button variant="ghost" className="hover:bg-folder-red/20 hover:text-foreground bg-folder-red/20 cursor-pointer hover:bg-folder-red/50 dark:hover:bg-folder-red/50" onClick={() => { refuse() }}>Do not proceed</Button>
                                    </div>
                                )}
                            </>
                        )}
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
                                        <Button size={"icon"} variant={"ghost"} onClick={likeMessage} className={cn(isLiked && "hover:bg-folder-green/20 dark:hover:bg-folder-green/20")}>
                                            <ThumbsUp className={cn("w-4 h-4 text-muted-foreground", isLiked ? "text-folder-green" : "")} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Like</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size={"icon"} variant={"ghost"} onClick={dislikeMessage} className={cn(isDisliked && "hover:bg-folder-red/20 dark:hover:bg-folder-red/20")}>
                                            <ThumbsDown className={cn("w-4 h-4 text-muted-foreground", isDisliked ? "text-folder-red" : "")} />
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

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant={"ghost"} className="gap-2 flex">
                                            <Coins className="w-4 h-4 text-muted-foreground" />
                                            <p className="text-muted-foreground font-mono">{message.creditsUsed === null ? "0" : message.creditsUsed?.toLocaleString()}</p>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Credits used</p>
                                    </TooltipContent>
                                </Tooltip>

                            </div>
                        )}
                    </div>
                )
            }
        </div >
    )
}
