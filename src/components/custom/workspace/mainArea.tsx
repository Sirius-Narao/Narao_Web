'use client'

import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Folders, MessageCircle, Pen, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTabs } from "@/context/tabsContext";
import { supabase } from "@/lib/supabaseClient";
import { useSettingsOpen } from "@/context/settingOpenContext";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useContent } from "@/context/contentContext";
import { useUserAuth } from "@/context/userAuthContext";
import { useUser } from "@/context/userContext";
import { useChatMessages } from "@/context/chatMessagesContext";
import { useFetchedFolders } from "@/context/fetchedFoldersContext";
import { useFetchedNotes } from "@/context/fetchedNotesContext";
import { Note, Folder } from "@/types/folderStructureTypes";
import FoldersTab from "./foldersTab";
import NotesTab from "./notesTab";
import ChatsTab from "./chatsTab";
import TabCard from "./tabCard";
import HomeTab from "./homeTab";
import { SelectionQuoteMenu } from "./selectionQuoteMenu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useIsMobile } from "@/hooks/use-mobile";

export default function MainArea() {
    const { userAuth, setUserAuth } = useUserAuth();
    const { user, setUser } = useUser();
    const { setSettingsOpen } = useSettingsOpen();
    const { setFetchedFolders } = useFetchedFolders();
    const { setFetchedNotes } = useFetchedNotes();
    const { setCurrentChatId, setChatMessages, setChatTitle, removeTabState } = useChatMessages();
    const { setContent } = useContent();
    const isMobile = useIsMobile();

    const { tabs, activeTab, openTab, closeTab, activeTabId, setActiveTabId } = useTabs();

    // Per-tab state: note/note open state tracked locally per folder tab
    const [accessedNote, setAccessedNote] = useState<Note | null>(null);
    const [isNoteOpened, setIsNoteOpened] = useState(false);

    const [foldersLoaded, setFoldersLoaded] = useState(false);
    const { loading: notesLoaded, setLoading: setNotesLoaded } = useFetchedNotes();

    // ─── Fetch user auth ──────────────────────────────────────────────────────
    useEffect(() => {
        const fetchUserAuth = async () => {
            const { data } = await supabase.auth.getUser();
            setUserAuth(data.user);
        };
        fetchUserAuth();
    }, []);

    // ─── Fetch folders & notes ────────────────────────────────────────────────
    useEffect(() => {
        const fetchFoldersAndNotes = async () => {
            if (!userAuth) return;

            const { data: foldersData, error: foldersError } = await supabase
                .from('folders')
                .select('*')
                .eq('user_id', userAuth.id);

            if (!foldersError && foldersData) {
                const mappedFolders: Folder[] = foldersData.map((f: any) => ({
                    id: String(f.id),
                    name: f.name,
                    user_id: String(f.user_id),
                    parent_id: f.parent_id ? String(f.parent_id) : undefined,
                    color: f.color,
                    createdAt: new Date(f.created_at),
                    updatedAt: new Date(f.updated_at),
                    is_reviewed: f.is_reviewed,
                }));
                setFetchedFolders(mappedFolders);
            }
            setFoldersLoaded(true);

            const { data: notesData, error: notesError } = await supabase
                .from('notes')
                .select('*')
                .eq('user_id', userAuth.id);

            if (!notesError && notesData) {
                const mappedNotes: Note[] = notesData.map((n: any) => ({
                    id: String(n.id),
                    title: n.title,
                    description: n.description || "",
                    content: n.content || "",
                    tags: n.tags || [],
                    folder_id: n.folder_id ? String(n.folder_id) : undefined,
                    createdAt: new Date(n.created_at),
                    updatedAt: new Date(n.updated_at),
                    is_reviewed: n.is_reviewed,
                }));
                setFetchedNotes(mappedNotes);
            }
            setNotesLoaded(true);
        };
        fetchFoldersAndNotes();
    }, [userAuth, setFetchedFolders, setFetchedNotes]);

    // ─── Fetch user profile ───────────────────────────────────────────────────
    useEffect(() => {
        if (!userAuth) return;
        const fetchUsers = async () => {
            if (!userAuth?.id) return;
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userAuth.id);
            if (!error) setUser(profiles?.[0]);
        };
        fetchUsers();
    }, [userAuth]);

    // ─── Open tab helpers ─────────────────────────────────────────────────────
    const handleOpenFolders = useCallback(() => {
        if (tabs.length < (isMobile ? 3 : 24)) {
            if (activeTab.type === "home") {
                closeTab(activeTabId);
            }
            openTab({ type: "folder", title: "Folders", location: "/" });
        } else {
            toast.error("Too many tabs open", { position: 'bottom-right' });
        }
    }, [openTab, tabs.length]);

    const handleNewNote = useCallback(() => {
        if (tabs.length < (isMobile ? 3 : 24)) {
            if (activeTab.type === "home") {
                closeTab(activeTabId);
            }
            openTab({ type: "note", title: "Notes", isSavedComplete: true });
        } else {
            toast.error("Too many tabs open", { position: 'bottom-right' });
        }
        setAccessedNote(null);
        setContent("");
    }, [openTab, setContent, tabs.length]);

    const handleNewChat = useCallback(() => {
        if (tabs.length < (isMobile ? 3 : 24)) {
            if (activeTab.type === "home") {
                closeTab(activeTabId);
            }
            openTab({ type: "chat", title: "New Chat" });
        } else {
            toast.error("Too many tabs open", { position: 'bottom-right' });
        }
        // Each ChatsTab now manages its own per-tab state, no global reset needed
    }, [openTab, tabs.length]);

    const openPreviousTab = useCallback(() => {
        if (activeTabId) {
            const index = tabs.findIndex(t => t.id === activeTabId);
            if (index > 0) {
                setActiveTabId(tabs[index - 1].id);
            }
        }
    }, [activeTabId, setActiveTabId, tabs]);

    const openNextTab = useCallback(() => {
        if (activeTabId) {
            const index = tabs.findIndex(t => t.id === activeTabId);
            if (index < tabs.length - 1) {
                setActiveTabId(tabs[index + 1].id);
            }
        }
    }, [activeTabId, setActiveTabId, tabs]);

    // ─── Global Shortcuts ────────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (e.ctrlKey && key === "," && !e.shiftKey) {
                e.preventDefault();
                setSettingsOpen(true);
            } else if (e.ctrlKey && key === "o" && e.shiftKey) {
                e.preventDefault();
                handleNewChat();
            } else if (e.ctrlKey && key === "i" && e.shiftKey) {
                e.preventDefault();
                handleNewNote();
            } else if (e.ctrlKey && key === "u" && e.shiftKey) {
                e.preventDefault();
                handleOpenFolders();
            } else if (e.ctrlKey && key === "n" && !e.shiftKey) {
                e.preventDefault();
                if (activeTabId) {
                    closeTab(activeTabId);
                    removeTabState(activeTabId);
                }
            } else if (e.ctrlKey && e.key === "ArrowLeft" && e.shiftKey) {
                e.preventDefault();
                if (activeTabId) {
                    openPreviousTab();
                }
            } else if (e.ctrlKey && e.key === "ArrowRight" && e.shiftKey) {
                e.preventDefault();
                if (activeTabId) {
                    openNextTab();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeTabId, closeTab, setSettingsOpen, handleNewChat, handleNewNote, handleOpenFolders, openPreviousTab, openNextTab]);

    useEffect(() => {
        if (!activeTab) {
            openTab({ type: "home", title: "Home" });
        }
    }, [activeTab, openTab, closeTab]);

    // ─── Render active tab content ─────────────────────────────────────────
    const renderContent = () => {
        if (!activeTab) return null;

        if (activeTab.type === "folder") {
            return (
                <FoldersTab
                    accessedNote={accessedNote}
                    setAccessedNote={setAccessedNote}
                    setIsNoteOpened={setIsNoteOpened}
                    foldersLoaded={foldersLoaded}
                    notesLoaded={notesLoaded}
                    initialPath={activeTab.location ?? "/"}
                />
            );
        }
        else if (activeTab.type === "note") {
            return (
                <NotesTab
                    accessedNote={accessedNote}
                    setAccessedNote={setAccessedNote}
                    initialNoteId={activeTab.noteId}
                />
            );
        }
        else if (activeTab.type === "chat") {
            return <ChatsTab tabId={activeTab.id} initialChatId={activeTab.chatId ?? null} />;
        } else if (activeTab.type === "home") {
            return <HomeTab setIsNoteOpened={setIsNoteOpened} setAccessedNote={setAccessedNote} />;
        }

        return null;
    };

    return (
        <SidebarInset className="bg-background overflow-hidden md:overflow-auto">
            <SelectionQuoteMenu />
            {/* ─── Top Toolbar / Tab Bar ─────────────────────────────────────── */}
            <div className="bg-background text-foreground md:h-12 h-14 w-[100%] absolute md:top-2 top-0 flex items-center justify-between z-10 transition-all duration-300">
                <div className="w-full flex justify-left gap-1 items-center">
                    {/* Mobile sidebar trigger */}
                    <div className="md:hidden flex-shrink-0">
                        <SidebarTrigger />
                    </div>
                    {/* Tab list */}
                    <div className="flex gap-1 max-w-[calc(100%-5.5rem)] md:max-w-[calc(100%-4rem)] overflow-hidden flex-shrink-0">
                        {tabs.map((tab, index) => (
                            <TabCard key={tab.id} tab={tab} index={index} />
                        ))}
                    </div>

                    {/* New tab button */}
                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="w-9 h-9 p-0 rounded-full cursor-pointer">
                                        <Plus size={24} />
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>New Tab</p>
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="start" className="p-2">
                            <DropdownMenuItem className="group cursor-pointer relative md:min-w-[240px] min-w-32" onClick={handleOpenFolders}>
                                <Folders size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                Open Folders
                                <KbdGroup className="hidden sm:inline-flex">
                                    <Kbd className="bg-card text-foreground absolute right-2">Ctrl + Shift + U</Kbd>
                                </KbdGroup>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="group cursor-pointer relative" onClick={handleNewNote}>
                                <Pen size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                New Note
                                <KbdGroup className="hidden sm:inline-flex">
                                    <Kbd className="bg-card text-foreground absolute right-2">Ctrl + Shift + I</Kbd>
                                </KbdGroup>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="group cursor-pointer relative" onClick={handleNewChat}>
                                <MessageCircle size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                New Chat
                                <KbdGroup className="hidden sm:inline-flex">
                                    <Kbd className="bg-card text-foreground absolute right-2">Ctrl + Shift + O</Kbd>
                                </KbdGroup>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* ─── Main Content Area ─────────────────────────────────────────── */}
            <div key={activeTab?.id} className="bg-card text-foreground md:h-[calc(100%-4.5rem)] h-[calc(100%-3.5rem)] w-full md:w-[calc(100%-0.5rem)] rounded-none md:rounded-lg absolute md:bottom-2 bottom-0 p-4 border border-sidebar-border overflow-hidden">
                {renderContent()}
            </div>
        </SidebarInset>
    );
}