import { Button } from "@/components/ui/button";
import Editor from "./editor";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Note } from "@/types/folderStructureTypes";
import { useUser } from "@/context/userContext";
import { useContent } from "@/context/contentContext";
import { useChatMessages } from "@/context/chatMessagesContext";
import { useSidebar } from "@/components/ui/sidebar";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChatType } from "@/types/chatType";
import Chat from "./chat";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AArrowDown, AArrowUp, CircleSlash, FolderDown, MoreVertical, Pen, Pencil, PenSquare, Plus, Search, Trash2, X } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import handleSearch from "@/lib/handleSearch";
import { useTabs } from "@/context/tabsContext";

interface ChatsTabProps {
    initialChatId: string | null;
}

export default function ChatsTab({ initialChatId }: ChatsTabProps) {
    const { state, setOpen } = useSidebar();
    const { user } = useUser();
    const { chatTitle, setChatTitle, setChatMessages, currentChatId, setCurrentChatId, refreshTrigger, refreshChats } = useChatMessages();
    const { activeTabId, updateTabTitle, updateTabChatId } = useTabs();
    const [isRenamingChat, setIsRenamingChat] = useState(false);
    const [tempChatTitle, setTempChatTitle] = useState(chatTitle);
    const [chats, setChats] = useState<ChatType[]>([]);
    const [chatsFetched, setChatsFetched] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Sync tab title with chat title
    useEffect(() => {
        if (!activeTabId || !currentChatId) return;
        // Don't sync if we haven't finished loading the correct chat for this tab yet
        if (initialChatId && currentChatId !== initialChatId) return;

        updateTabTitle(activeTabId, chatTitle || "New Chat");
        updateTabChatId(activeTabId, currentChatId);
    }, [chatTitle, currentChatId, activeTabId, initialChatId, updateTabTitle, updateTabChatId]);

    // Restore chat from initialChatId on mount
    const { chatCache } = useChatMessages();

    useEffect(() => {
        if (!initialChatId) {
            setCurrentChatId(null);
            setChatMessages([]);
            setChatTitle("New Chat");
            return;
        }

        // If we already have this chat open, don't do anything
        if (currentChatId === initialChatId) return;

        // Check cache first
        if (chatCache[initialChatId]) {
            const cached = chatCache[initialChatId];
            setCurrentChatId(initialChatId);
            setChatTitle(cached.title);
            setChatMessages(cached.messages);
            return;
        }

        // Load just the chat metadata from DB
        const loadChat = async () => {
            const { data: chatData, error } = await supabase
                .from("chats")
                .select("*")
                .eq("id", initialChatId)
                .single();

            if (chatData) {
                setChatTitle(chatData.title);
                setCurrentChatId(initialChatId);
            } else if (error) {
                console.error("Error loading chat:", error);
                toast.error("Failed to load chat");
            }
        };
        loadChat();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialChatId]);

    // Filtered chats state
    const [filteredChats, setFilteredChats] = useState<ChatType[]>([]);


    // Chat side functions
    const handleRenameChat = async () => {
        if (!user) return;
        setTempChatTitle(chatTitle);
        setIsRenamingChat(true);
    };
    const renameChat = async () => {
        if (!user || !currentChatId) return;
        const { data, error } = await supabase
            .from("chats")
            .update({ title: tempChatTitle })
            .eq("id", currentChatId)
            .select()
            .single();
        if (data) setChatTitle(data.title);
        if (error) console.error("Error renaming chat:", error);
    };
    const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
        e.stopPropagation();
        // if (!confirm("Are you sure you want to delete this chat?")) return;

        const { error } = await supabase
            .from('chats')
            .delete()
            .eq('id', chatId);

        if (error) {
            console.error("Error deleting chat:", error);
            toast.error("Failed to delete chat", { duration: 1000 });
        } else {
            toast.success("Chat deleted", { duration: 1000 });
            if (currentChatId === chatId) {
                setCurrentChatId(null);
                setChatMessages([]);
            }
            refreshChats();
        }
    };

    // Fetch chats data
    useEffect(() => {
        if (!user) return;

        const fetchChats = async () => {
            const { data, error } = await supabase
                .from('chats')         // your table name
                .select('*')          // select all columns
                .eq('user_id', user.id);           // select only those of the user

            if (error) {
                console.error(error);
                return;
            }

            if (data) {
                // Map the data to ensure correct types (Date objects) and property names
                const mappedChats: ChatType[] = data.map((item: any) => ({
                    id: item.id,
                    title: item.title || "Untitled Chat",
                    description: item.description || "",
                    // Handle both camelCase (if mapped) and snake_case (raw DB)
                    createdAt: new Date(item.created_at || item.createdAt || new Date()),
                    updatedAt: new Date(item.updated_at || item.updatedAt || new Date())
                }));
                setChats(mappedChats);
            }
        };
        fetchChats();
        setChatsFetched(true);
    }, [user, refreshTrigger]);

    // Update filtered chats when chats change, preserving sort order
    useEffect(() => {
        setFilteredChats([...chats].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
    }, [chats]);

    return (
        <div className="flex flex-col h-full relative">
            <div className="flex items-center absolute top-1 left-0 right-0 z-50 p-1 rounded-3xl w-fit bg-popover/40 backdrop-blur-md shadow-lg mx-auto ">
                {isRenamingChat ? (
                    <Input
                        value={tempChatTitle}
                        onChange={(e) => setTempChatTitle(e.target.value)}
                        onBlur={() => setIsRenamingChat(false)}
                        autoFocus
                        maxLength={34}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") { setIsRenamingChat(false); renameChat(); }
                            if (e.key === "Escape") setIsRenamingChat(false);
                        }}
                        className="text-center border-none shadow-none text-lg! font-medium focus-visible:ring-0 w-full bg-transparent! w-[364px]"
                    />
                ) : currentChatId ? (
                    <Button variant="ghost" className="text-lg p-2 rounded-3xl px-4" onClick={handleRenameChat}>{chatTitle}</Button>
                ) : (
                    <span className="text-lg font-medium p-2 rounded-3xl px-4">New Chat</span>
                )}
            </div>
            <div className="absolute right-2 flex items-center gap-1 rounded-3xl p-1 mt-1 z-50 bg-popover/40 backdrop-blur-md shadow-lg">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" className="w-10 h-10 p-0 rounded-full">
                            <PenSquare size={24} color="white" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>New Chat</p>
                    </TooltipContent>
                </Tooltip>

                <DropdownMenu>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="w-10 h-10 p-0 rounded-full">
                                    <MoreVertical size={24} color="white" />
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Options</p>
                        </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="p-2">
                        <DropdownMenuItem className="group cursor-pointer">
                            <Pencil size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                            Rename Chat
                        </DropdownMenuItem >
                        <DropdownMenuItem className="group cursor-pointer">
                            <FolderDown size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                            Move To
                        </DropdownMenuItem >
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                            onClick={(e) => { }}
                        >
                            <Trash2 size={16} className="text-destructive" />
                            Delete Chat
                        </DropdownMenuItem>

                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <Chat />

            {/* Search panel — collapses to a round button, expands on click */}
            <div
                className="absolute top-0 left-0 z-50"
                style={{
                    transition: "width 300ms cubic-bezier(0.34, 1.56, 0.64, 1), background 250ms ease",
                    width: isSearchOpen ? "min(320px, 90vw)" : "2.5rem",
                }}
            >
                {/* Collapsed: round search button */}
                <div className="flex items-center justify-center p-1 rounded-3xl w-fit bg-popover/40 backdrop-blur-md shadow-lg absolute top-0 left-0 z-50 border border-border" style={{
                    transition: "opacity 200ms ease, transform 200ms ease",
                    opacity: isSearchOpen ? 0 : 1,
                    pointerEvents: isSearchOpen ? "none" : "auto",
                    transform: isSearchOpen ? "scale(0.7)" : "scale(1)",
                }}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                aria-label="Open search"
                                onClick={() => {
                                    setIsSearchOpen(true);
                                    setTimeout(() => searchInputRef.current?.focus(), 320);
                                }}
                                variant="ghost"
                                size="icon"
                                style={{
                                    transition: "opacity 200ms ease, transform 200ms ease",
                                    opacity: isSearchOpen ? 0 : 1,
                                    pointerEvents: isSearchOpen ? "none" : "auto",
                                    transform: isSearchOpen ? "scale(0.7)" : "scale(1)",
                                    top: 0,
                                    left: 0,
                                }}
                                className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 cursor-pointer"
                            >
                                <Search size={16} className="text-foreground/80" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Previous Chats</p>
                        </TooltipContent>
                    </Tooltip>
                </div>

                {/* Expanded panel */}
                <div
                    style={{
                        transition: "opacity 250ms ease, transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                        opacity: isSearchOpen ? 1 : 0,
                        pointerEvents: isSearchOpen ? "auto" : "none",
                        transform: isSearchOpen ? "scale(1) translateY(0)" : "scale(0.92) translateY(-6px)",
                        transformOrigin: "top left",
                    }}
                    className="flex flex-col bg-card/30 backdrop-blur-md p-2 rounded-xl shadow-xl border border-border"
                >
                    {/* Search input row */}
                    <InputGroup className="w-full shadow-md dark:bg-popover/40 backdrop-blur-md! border-border ">
                        <InputGroupAddon align="inline-end" className="cursor-pointer">
                            <InputGroupText className="bg-transparent cursor-pointer">
                                <KbdGroup>
                                    <Kbd className="bg-popover text-muted-foreground">Ctrl + K</Kbd>
                                </KbdGroup>
                                <Search size={15} />
                            </InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                            ref={searchInputRef}
                            placeholder="Look for a chat..."
                            aria-placeholder="Look for a chat..."
                            className="bg-card cursor-pointer"
                            onChange={(e) => setFilteredChats(handleSearch(e.target.value, chats))}
                            onKeyDown={(e) => { if (e.key === "Escape") setIsSearchOpen(false); }}
                        />
                        {/* Close button */}
                        <InputGroupAddon align="inline-end" className="cursor-pointer">
                            <InputGroupText className="bg-transparent cursor-pointer" onClick={() => setIsSearchOpen(false)}>
                                <X size={15} />
                            </InputGroupText>
                        </InputGroupAddon>
                    </InputGroup>

                    {/* Chat list */}
                    <div
                        style={{
                            transition: "max-height 350ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 250ms ease",
                            maxHeight: isSearchOpen ? "50vh" : "0px",
                            opacity: isSearchOpen ? 1 : 0,
                            overflow: "hidden",
                        }}
                        className="mt-2 rounded-lg shadow-md"
                    >
                        <ScrollArea className="flex-1 rounded-lg border border-border px-1 shadow-lg bg-popover/40 backdrop-blur-md h-full max-h-[50vh] overflow-y-auto">
                            <div className="h-1" key={"division-scroll"}></div>
                            {chats.length > 0 && chatsFetched ? filteredChats.map((chat, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between pl-4 pr-2 py-2 rounded-lg hover:bg-popover cursor-pointer transition-all duration-100 ease-in-out mb-1"
                                >
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex flex-row items-center gap-2 w-full" onClick={() => {
                                                if (chat.id && chat.id !== currentChatId) {
                                                    const cached = chatCache[chat.id];
                                                    if (cached) {
                                                        setChatMessages(cached.messages);
                                                        setChatTitle(cached.title);
                                                    } else {
                                                        setChatMessages([]);
                                                        setChatTitle(chat.title);
                                                    }
                                                    setCurrentChatId(chat.id);
                                                }
                                                setIsSearchOpen(false);
                                            }}>
                                                <p className="text-sm">{chat.title.length > 20 ? chat.title.slice(0, 20).trimEnd().concat("...") : chat.title}</p>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" sideOffset={16}>
                                            <p>{chat.title}</p>
                                            <p className="text-xs text-muted-foreground">{chat.description}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" className="p-1 h-6 w-6 cursor-pointer" asChild>
                                                        <MoreVertical size={16} className="text-muted-foreground" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="right">
                                                    <p>Options</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-44" align="start">
                                            <DropdownMenuGroup>
                                                <div className="flex flex-col p-2">
                                                    <p>{chat.title}</p>
                                                    <p className="text-xs text-muted-foreground/50">{chat.updatedAt.toLocaleString()}</p>
                                                    <div className="w-full h-[1px] bg-foreground/10 my-1"></div>
                                                    <p className="text-xs text-muted-foreground">{chat.description}</p>
                                                </div>
                                                <DropdownMenuItem className="group cursor-pointer">
                                                    <Pencil size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    Rename Chat
                                                </DropdownMenuItem >
                                                <DropdownMenuItem className="group cursor-pointer">
                                                    <FolderDown size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    Move To
                                                </DropdownMenuItem >
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                                    onClick={(e) => handleDeleteChat(e, chat.id!)}
                                                >
                                                    <Trash2 size={16} className="text-destructive" />
                                                    Delete Chat
                                                </DropdownMenuItem>
                                            </DropdownMenuGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )) : chatsFetched ? (
                                <div className="flex flex-col items-center justify-center h-full my-5 text-center">
                                    <CircleSlash size={48} className="text-muted-foreground mb-2" />
                                    <p className="font-medium text-muted-foreground">No chats found</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full gap-1 my-1">
                                    <Skeleton className="w-full h-10 rounded-full" />
                                    <Skeleton className="w-full h-10 rounded-full" />
                                    <Skeleton className="w-full h-10 rounded-full" />
                                    <Skeleton className="w-full h-10 rounded-full" />
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>
            </div>
        </div>
    )
}
