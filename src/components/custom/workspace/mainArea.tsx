'use client'

import { Button } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ArrowBigDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useActiveTabs } from "@/context/activeTabsContext";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { useSettingsOpen } from "@/context/settingOpenContext";
import { useCreateNoteDialogOpen } from "@/context/createNoteDialogOpenContext";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import Editor from "./editor";
import { useContent } from "@/context/contentContext";
import Chat from "./chat";
import { useUserAuth } from "@/context/userAuthContext";
import { useUser } from "@/context/userContext";
import { useChatMessages } from "@/context/chatMessagesContext";
import FoldersTab from "./foldersTab";
import { Note, Folder } from "@/types/folderStructureTypes";
import { useFetchedFolders } from "@/context/fetchedFoldersContext";
import { useFetchedNotes } from "@/context/fetchedNotesContext";
import NotesTab from "./notesTab";
import ChatsTab from "./chatsTab";
import TabCard from "./tabCard";

export default function MainArea() {
    const { userAuth, setUserAuth } = useUserAuth();
    const { user, setUser } = useUser();

    const { activeTab, setActiveTab } = useActiveTabs();
    const { setSettingsOpen } = useSettingsOpen();
    const { setCreateNoteDialogOpen } = useCreateNoteDialogOpen();

    // Accessed note state - shared between Folders and Editor
    const [accessedNote, setAccessedNote] = useState<Note | null>(null);
    const [isNoteOpened, setIsNoteOpened] = useState(false);
    const { content, setContent } = useContent();

    // Chat states
    const { setCurrentChatId, setChatMessages, chatTitle, setChatTitle, currentChatId } = useChatMessages();
    const [isRenamingChat, setIsRenamingChat] = useState(false);
    const [tempChatTitle, setTempChatTitle] = useState(chatTitle);

    const { setFetchedFolders } = useFetchedFolders();
    const { setFetchedNotes } = useFetchedNotes();

    const [foldersLoaded, setFoldersLoaded] = useState(false);
    const [notesLoaded, setNotesLoaded] = useState(false);

    // fetch user auth
    useEffect(() => {
        const fetchUserAuth = async () => {
            const { data } = await supabase.auth.getUser();
            setUserAuth(data.user);
        };
        fetchUserAuth();
    }, []);

    // fetch folders and notes
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

    // Fetch user data
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

    // Tab switching effect
    useEffect(() => {
        if (activeTab === 1 && !isNoteOpened) {
            setCreateNoteDialogOpen(true);
            setAccessedNote(null);
            setContent("");
        } else if (activeTab === 2) {
            setCurrentChatId(null);
            setChatMessages([]);
            setChatTitle("New Chat");
        }
    }, [activeTab]);

    // Global Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (e.ctrlKey && key === "u" && e.shiftKey) {
                e.preventDefault();
                setActiveTab(0);
            } else if (e.ctrlKey && key === "i" && e.shiftKey) {
                e.preventDefault();
                setActiveTab(1);
            } else if (e.ctrlKey && key === "o" && e.shiftKey) {
                e.preventDefault();
                setActiveTab(2);
            } else if (e.ctrlKey && key === "," && !e.shiftKey) {
                e.preventDefault();
                setSettingsOpen(true);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeTab, accessedNote, content]);

    return (
        <SidebarInset className="bg-background">
            {/* Top Toolbar */}
            <div className="bg-background text-foreground h-12 w-[calc(100%-0.5rem)] rounded-lg absolute top-2 flex items-center justify-between px-4 z-10 transition-all duration-300">
                <div className="w-full flex justify-left gap-2">
                    <TabCard title="Folders" type="folder" active={activeTab === 0} />
                    <TabCard title="Notes" type="note" active={activeTab === 1} />
                    <TabCard title="Chats" type="chat" active={activeTab === 2} />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-card text-foreground h-[calc(100%-4.5rem)] w-[calc(100%-0.5rem)] rounded-lg absolute bottom-2 p-4 border border-sidebar-border overflow-hidden">
                {activeTab === 0 ? (
                    <FoldersTab
                        accessedNote={accessedNote}
                        setAccessedNote={setAccessedNote}
                        setIsNoteOpened={setIsNoteOpened}
                        foldersLoaded={foldersLoaded}
                        notesLoaded={notesLoaded}
                    />
                ) : activeTab === 1 ? (
                    <NotesTab accessedNote={accessedNote} setAccessedNote={setAccessedNote} />
                ) : (
                    <ChatsTab />
                )}
            </div>
        </SidebarInset>
    );
}