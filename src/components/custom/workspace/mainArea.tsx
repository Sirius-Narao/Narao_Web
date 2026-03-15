'use client'

import { Button } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Folders, MessageCircle, Pen, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTabs } from "@/context/tabsContext";
import { supabase } from "@/lib/supabaseClient";
import { useSettingsOpen } from "@/context/settingOpenContext";
import { useCreateNoteDialogOpen } from "@/context/createNoteDialogOpenContext";
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

export default function MainArea() {
    const { userAuth, setUserAuth } = useUserAuth();
    const { user, setUser } = useUser();
    const { setSettingsOpen } = useSettingsOpen();
    const { setCreateNoteDialogOpen } = useCreateNoteDialogOpen();
    const { setFetchedFolders } = useFetchedFolders();
    const { setFetchedNotes } = useFetchedNotes();
    const { setCurrentChatId, setChatMessages, setChatTitle } = useChatMessages();
    const { setContent } = useContent();

    const { tabs, activeTab, openTab } = useTabs();

    // Per-tab state: note/note open state tracked locally per folder tab
    const [accessedNote, setAccessedNote] = useState<Note | null>(null);
    const [isNoteOpened, setIsNoteOpened] = useState(false);

    const [foldersLoaded, setFoldersLoaded] = useState(false);
    const [notesLoaded, setNotesLoaded] = useState(false);

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
                    updatedAt: new Date(f.updated_at)
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
                    updatedAt: new Date(n.updated_at)
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

    // ─── Global Shortcuts ────────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (e.ctrlKey && key === "," && !e.shiftKey) {
                e.preventDefault();
                setSettingsOpen(true);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // ─── Open tab helpers ─────────────────────────────────────────────────────
    const handleOpenFolders = () => {
        openTab({ type: "folder", title: "Folders", location: "/" });
    };

    const handleNewNote = () => {
        openTab({ type: "note", title: "Notes" });
        setCreateNoteDialogOpen(true);
        setAccessedNote(null);
        setContent("");
    };

    const handleNewChat = () => {
        openTab({ type: "chat", title: "New Chat" });
        setCurrentChatId(null);
        setChatMessages([]);
        setChatTitle("New Chat");
    };

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
        if (activeTab.type === "note") {
            return (
                <NotesTab
                    accessedNote={accessedNote}
                    setAccessedNote={setAccessedNote}
                    initialNoteId={activeTab.noteId}
                />
            );
        }
        if (activeTab.type === "chat") {
            return <ChatsTab initialChatId={activeTab.chatId ?? null} />;
        }
        return null;
    };

    return (
        <SidebarInset className="bg-background">
            {/* ─── Top Toolbar / Tab Bar ─────────────────────────────────────── */}
            <div className="bg-background text-foreground h-12 w-[calc(100%-0.5rem)] rounded-lg absolute top-3 pr-1 flex items-center justify-between z-10 transition-all duration-300">
                <div className="w-full flex justify-left gap-1 items-center">
                    {/* Tab list */}
                    <div className="flex gap-1 max-w-[calc(100%-2.5rem)] overflow-hidden flex-shrink-0">
                        {tabs.map((tab, index) => (
                            <TabCard key={tab.id} tab={tab} index={index} />
                        ))}
                    </div>

                    {/* New tab button */}
                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="w-10 h-10 p-0 rounded-full">
                                        <Plus size={24} color="white" />
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>New Tab</p>
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="start" className="p-2">
                            <DropdownMenuItem className="group cursor-pointer" onClick={handleOpenFolders}>
                                <Folders size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                Open Folders
                            </DropdownMenuItem>
                            <DropdownMenuItem className="group cursor-pointer" onClick={handleNewNote}>
                                <Pen size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                New Note
                            </DropdownMenuItem>
                            <DropdownMenuItem className="group cursor-pointer" onClick={handleNewChat}>
                                <MessageCircle size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                New Chat
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* ─── Main Content Area ─────────────────────────────────────────── */}
            <div key={activeTab?.id} className="bg-card text-foreground h-[calc(100%-4.5rem)] w-[calc(100%-0.5rem)] rounded-lg absolute bottom-2 p-4 border border-sidebar-border overflow-hidden">
                {renderContent()}
            </div>
        </SidebarInset>
    );
}