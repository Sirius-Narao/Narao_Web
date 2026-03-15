'use client'

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Folder as FolderIcon,
    FileText,
    Plus,
    MoreVertical,
    MoveLeft,
    MoveRight,
    Search,
    AArrowUp,
    AArrowDown,
    CircleSlash,
    FolderPen,
    Palette,
    Check,
    FolderPlus,
    FilePlus,
    Trash,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Folder, Note, FolderColor } from "@/types/folderStructureTypes";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import dateConvert from "@/lib/dateConvert";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { useTabs } from "@/context/tabsContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { folderColorClasses, folderColors } from "@/constants/folderColors";
import { useCreateNoteDialogOpen } from "@/context/createNoteDialogOpenContext";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSub,
    ContextMenuSubTrigger,
    ContextMenuSubContent
} from "@/components/ui/context-menu";
import { useFetchedFolders } from "@/context/fetchedFoldersContext";
import { useFetchedNotes } from "@/context/fetchedNotesContext";
import { useUser } from "@/context/userContext";
import { useContent } from "@/context/contentContext";
import { toast } from "sonner";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";

interface FoldersTabProps {
    accessedNote: Note | null;
    setAccessedNote: (note: Note | null) => void;
    setIsNoteOpened: (opened: boolean) => void;
    foldersLoaded: boolean;
    notesLoaded: boolean;
    initialPath?: string;
}

export default function FoldersTab({ accessedNote, setAccessedNote, setIsNoteOpened, foldersLoaded, notesLoaded, initialPath = "/" }: FoldersTabProps) {
    const { user } = useUser();
    const { fetchedFolders, setFetchedFolders } = useFetchedFolders();
    const { fetchedNotes, setFetchedNotes } = useFetchedNotes();
    const { activeTab, activeTabId, openTab, updateTabTitle, updateTabLocation } = useTabs();
    const { setContent } = useContent();
    const { createNoteDialogOpen, setCreateNoteDialogOpen } = useCreateNoteDialogOpen();

    // Path State — initialized from the tab's stored location
    const [path, setPath] = useState(initialPath);
    const [pathHistory, setPathHistory] = useState<string[]>([initialPath]);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

    // dropdown create new state
    const [isDropdownCreateNewOpen, setIsDropdownCreateNewOpen] = useState(false);

    // create note state
    const [noteFolder, setNoteFolder] = useState("/");
    const [noteName, setNoteName] = useState("");
    const [noteDescription, setNoteDescription] = useState("");

    // Virtual Folder Creation / Rename State
    const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
    const [tempFolderName, setTempFolderName] = useState("");
    const [isRenamingExistingFolder, setIsRenamingExistingFolder] = useState(false);
    const folderNameInputRef = useRef<HTMLInputElement>(null);

    // Note Rename State
    const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
    const [tempNoteName, setTempNoteName] = useState("");

    // Drag and drop state
    const [dragItem, setDragItem] = useState<{ type: 'folder' | 'note'; id: string } | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

    // Path History useEffect
    useEffect(() => {
        setPathHistory(prev => [...prev, path]);
    }, [path]);

    // Update tab title / location when path changes
    useEffect(() => {
        if (!activeTabId) return;
        const segments = path.split("/").filter(Boolean);
        const folderName = segments.length > 0 ? segments[segments.length - 1] : "Folders";
        updateTabTitle(activeTabId, folderName);
        updateTabLocation(activeTabId, path);
    }, [path, activeTabId]);

    const rootFolders = useMemo(() => fetchedFolders.filter(f => !f.parent_id), [fetchedFolders]);
    const rootNotes = useMemo(() => fetchedNotes.filter(n => !n.folder_id), [fetchedNotes]);

    const getContent = useCallback(() => {
        const cleanPath = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;

        if (cleanPath === "/" || cleanPath === "") {
            return { folders: rootFolders, notes: rootNotes };
        }

        const segments = cleanPath.split("/").filter(Boolean);
        let currentLevel = rootFolders;
        let currentFolder: Folder | undefined;

        for (const segment of segments) {
            currentFolder = currentLevel.find(f => f.name === segment);
            if (!currentFolder) return { folders: [], notes: [] };
            currentLevel = fetchedFolders.filter(f => f.parent_id === currentFolder?.id);
        }

        if (currentFolder) {
            const f = fetchedFolders.filter(f => f.parent_id === currentFolder?.id);
            const n = fetchedNotes.filter(n => n.folder_id === currentFolder?.id);
            return { folders: f, notes: n, currentFolder };
        }

        return { folders: [], notes: [], currentFolder: undefined };
    }, [path, rootFolders, rootNotes, fetchedFolders, fetchedNotes]);

    const { folders, notes, currentFolder } = getContent();

    const navigateToFolder = (folderName: string) => {
        const newPath = path === "/" ? `/${folderName}` : `${path}/${folderName}`;
        setPath(newPath);
    };

    const navigateToFolderAbsolutePath = (pathStr: string) => {
        const absolutePath = pathStr.startsWith("/") ? pathStr : `/${pathStr}`;
        setPath(absolutePath);
        setSearchOpen(false);
        setSearchQuery("");
    };

    const getFolderPath = useCallback((folderId: string): string => {
        const folder = fetchedFolders.find(f => f.id === folderId);
        if (!folder) return "/";
        if (!folder.parent_id) return `/${folder.name}`;
        return `${getFolderPath(folder.parent_id)}/${folder.name}`;
    }, [fetchedFolders]);

    const allFolderPaths = useMemo(() => {
        const paths = fetchedFolders.map(f => ({
            id: f.id,
            name: f.name,
            path: getFolderPath(f.id)
        })).sort((a, b) => a.path.localeCompare(b.path));

        return [{ id: "root", name: "Root", path: "/" }, ...paths];
    }, [fetchedFolders, getFolderPath]);

    const getNotePath = (noteId: string): string => {
        const note = fetchedNotes.find(n => n.id === noteId);
        if (!note || !note.folder_id) return "/";
        return getFolderPath(note.folder_id);
    };

    const goBack = useCallback(() => {
        setPath(prev => {
            if (prev === "/") return prev;
            return prev.split("/").slice(0, -1).join("/") || "/";
        });
    }, []);

    const goForward = useCallback(() => {
        setPathHistory(prev => {
            const lastPath = prev[prev.length - 2];
            if (lastPath) {
                setPath(lastPath);
                return prev.slice(0, -2);
            }
            return prev;
        });
    }, []);

    // Folder Actions
    const createFolder = useCallback(() => {
        if (renamingFolderId) return;

        let parent_id: string | undefined = undefined;
        if (path !== "/" && path !== "") {
            const parentFolder = allFolderPaths.find(p => p.path === path);
            if (parentFolder) parent_id = parentFolder.id;
        }

        const newFolder: Folder = {
            id: "temp-creation",
            name: "",
            user_id: user?.id || "",
            parent_id: parent_id,
            color: "folder-blue",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        setFetchedFolders(prev => [...prev, newFolder]);
        setRenamingFolderId(newFolder.id);
        setTempFolderName("");
    }, [path, allFolderPaths, renamingFolderId, user]);

    const cancelFolderCreation = () => {
        setFetchedFolders(prev => prev.filter(f => f.id !== "temp-creation"));
        setRenamingFolderId(null);
        setTempFolderName("");
    };

    const handleFolderSave = async () => {
        if (!renamingFolderId || !user) return;
        const targetName = tempFolderName.trim();
        if (!targetName) {
            cancelFolderCreation();
            return;
        }

        const duplicate = folders.some(f => f.id !== renamingFolderId && f.name.toLowerCase() === targetName.toLowerCase());
        if (duplicate) return;

        try {
            const { data, error } = await supabase
                .from("folders")
                .insert([{
                    name: targetName,
                    user_id: user.id,
                    parent_id: fetchedFolders.find(f => f.id === renamingFolderId)?.parent_id,
                    color: "folder-blue"
                }])
                .select()
                .single();

            if (error) throw error;

            const newFolderObj: Folder = {
                id: String(data.id),
                name: data.name,
                user_id: String(data.user_id),
                parent_id: data.parent_id ? String(data.parent_id) : undefined,
                color: data.color,
                createdAt: new Date(data.created_at),
                updatedAt: new Date(data.updated_at)
            };

            setFetchedFolders(prev => prev.map(f => f.id === "temp-creation" ? newFolderObj : f));
            toast.info(`Created ${data.name}`, { position: 'bottom-right' });
            setRenamingFolderId(null);
            setTempFolderName("");
        } catch (error) {
            console.error("Error creating folder:", error);
        }
    };

    const deleteFolder = async (folderId: string, folderName: string) => {
        if (!user) return;
        const { error } = await supabase.from("folders").delete().eq("id", folderId);
        if (error) {
            console.error("Error deleting folder:", error);
            return;
        }
        toast.warning(`Deleted ${folderName}`, { position: 'bottom-right' });
        setFetchedFolders(prev => prev.filter(f => f.id !== folderId));
    };

    const changeFolderColor = async (folderId: string, folderColor: FolderColor) => {
        const { error } = await supabase.from("folders").update({ color: folderColor }).eq("id", folderId);
        if (error) {
            console.error("Error updating folder:", error);
        } else {
            setFetchedFolders(prev => prev.map(f => String(f.id) === String(folderId) ? { ...f, color: folderColor } : f));
        }
    };

    const startFolderRename = (folderId: string, currentName: string) => {
        setIsRenamingExistingFolder(true);
        setRenamingFolderId(folderId);
        setTempFolderName(currentName);
        setTimeout(() => folderNameInputRef.current?.focus(), 0);
    };

    const handleFolderRenameSubmit = async () => {
        if (!renamingFolderId || !user) return;
        const targetName = tempFolderName.trim();
        if (!targetName) {
            cancelFolderRename();
            return;
        }

        const { error } = await supabase
            .from("folders")
            .update({ name: targetName, updated_at: new Date() })
            .eq("id", renamingFolderId);

        if (error) {
            console.error("Error renaming folder:", error);
        } else {
            setFetchedFolders(prev => prev.map(f => String(f.id) === String(renamingFolderId) ? { ...f, name: targetName } : f));
        }
        setRenamingFolderId(null);
        setTempFolderName("");
        setIsRenamingExistingFolder(false);
    };

    const cancelFolderRename = () => {
        setRenamingFolderId(null);
        setTempFolderName("");
        setIsRenamingExistingFolder(false);
    };

    // Note Actions
    const createNote = async () => {
        if (!user) return;

        let targetFolderId: string | undefined = undefined;
        if (noteFolder !== "/") {
            const targetPathObj = allFolderPaths.find(p => p.path === noteFolder);
            if (targetPathObj) targetFolderId = targetPathObj.id;
        }

        const notePayload = {
            user_id: user.id,
            title: noteName,
            description: noteDescription,
            content: "[]",
            tags: [],
            folder_id: targetFolderId
        };

        const { data, error } = await supabase.from("notes").insert([notePayload]).select().single();

        if (error) {
            console.error("Error creating note:", error);
            return;
        }

        const newNote: Note = {
            id: String(data.id),
            title: data.title,
            description: data.description || "",
            content: data.content || "",
            tags: data.tags || [],
            folder_id: data.folder_id ? String(data.folder_id) : undefined,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at)
        };

        setAccessedNote(newNote);
        setContent("");
        setIsNoteOpened(true);
        setFetchedNotes(prev => [...prev, newNote]);
        toast.info(`Created ${newNote.title}`, { position: 'bottom-right' });
        setCreateNoteDialogOpen(false);
        openTab({ type: "note", title: newNote.title, noteId: newNote.id });
    };

    const deleteNote = async (noteId: string) => {
        const { error } = await supabase.from("notes").delete().eq("id", noteId);
        if (error) {
            console.error("Error deleting note:", error);
            return;
        }
        setFetchedNotes(prev => prev.filter(n => n.id !== noteId));
        if (accessedNote?.id === noteId) {
            setAccessedNote(null);
            setIsNoteOpened(false);
        }
    };

    const startNoteRename = (noteId: string, currentTitle: string) => {
        setRenamingNoteId(noteId);
        setTempNoteName(currentTitle);
    };

    const handleNoteRenameSubmit = async () => {
        if (!renamingNoteId || !user) return;
        const targetTitle = tempNoteName.trim();
        if (!targetTitle) {
            cancelNoteRename();
            return;
        }

        const { data, error } = await supabase
            .from("notes")
            .update({ title: targetTitle, updated_at: new Date() })
            .select()
            .eq("id", renamingNoteId)
            .single();

        if (error) {
            console.error("Error renaming note:", error);
        } else {
            setFetchedNotes(prev => prev.map(n => String(n.id) === String(renamingNoteId) ? { ...n, title: targetTitle } : n));
            if (accessedNote?.id === renamingNoteId) {
                setAccessedNote({ ...accessedNote, title: targetTitle });
            }
            toast.info(`Renamed ${data.title} successfully`, { position: 'bottom-right' });
        }
        setRenamingNoteId(null);
        setTempNoteName("");
    };

    const cancelNoteRename = () => {
        setRenamingNoteId(null);
        setTempNoteName("");
    };

    const openNote = async (note: Note) => {
        if (!user) return;
        const { data, error } = await supabase.from("notes").select("*").eq("id", note.id).single();

        if (data) {
            setIsNoteOpened(true);
            const mappedNote: Note = {
                id: String(data.id),
                title: data.title,
                description: data.description || "",
                content: data.content || null,
                tags: data.tags || [],
                createdAt: new Date(data.created_at),
                updatedAt: new Date(data.updated_at)
            };
            setAccessedNote(mappedNote);
            setContent(mappedNote.content || "");
            openTab({ type: "note", title: mappedNote.title, noteId: mappedNote.id });
        } else if (error) {
            console.error("Error opening note:", error);
        }
    };

    // Drag and Drop
    const moveItemToFolder = async (itemType: 'folder' | 'note', itemId: string, targetFolderId: string | null) => {
        if (!user || (itemType === 'folder' && itemId === targetFolderId)) return;

        try {
            if (itemType === 'folder') {
                const { error } = await supabase.from('folders').update({ parent_id: targetFolderId }).eq('id', itemId);
                if (error) throw error;
                setFetchedFolders(prev => prev.map(f => f.id === itemId ? { ...f, parent_id: targetFolderId || undefined } : f));
            } else {
                const { error } = await supabase.from('notes').update({ folder_id: targetFolderId }).eq('id', itemId);
                if (error) throw error;
                setFetchedNotes(prev => prev.map(n => n.id === itemId ? { ...n, folder_id: targetFolderId || undefined } : n));
            }
        } catch (err) {
            console.error('Error moving item:', err);
        }
    };

    const getParentFolderIdOfCurrentPath = (): string | null => {
        const parentPath = path.split('/').slice(0, -1).join('/') || '/';
        if (parentPath === '/') return null;
        const found = allFolderPaths.find(p => p.path === parentPath);
        return found?.id ?? null;
    };

    // Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (activeTab?.type !== "folder") return;

            if (e.ctrlKey && key === "z" && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                goBack();
            } else if (e.ctrlKey && (e.shiftKey || e.altKey) && key === "z") {
                e.preventDefault();
                goForward();
            } else if (e.ctrlKey && e.altKey && key === "k") {
                e.preventDefault();
                searchInputRef.current?.focus();
            } else if (e.ctrlKey && key === "n" && e.shiftKey) {
                e.preventDefault();
                createFolder();
            } else if (e.ctrlKey && key === "n" && !e.shiftKey) {
                e.preventDefault();
                setCreateNoteDialogOpen(true);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeTab, goBack, goForward, createFolder, setCreateNoteDialogOpen]);

    if (!(foldersLoaded && notesLoaded)) {
        return (
            <div className="flex flex-col gap-2 h-full w-full">
                <Skeleton className="w-full h-14" />
                <div className="flex flex-wrap gap-4 p-4 content-start relative h-full">
                    <Skeleton className="w-32 h-28" />
                    <Skeleton className="w-32 h-28" />
                    <Skeleton className="w-32 h-28" />
                    <Skeleton className="w-32 h-28" />
                    <Skeleton className="w-32 h-28" />
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col gap-2 h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-2 relative w-full h-14">
                <div className="flex items-center gap-2 absolute left-2 rounded-3xl bg-popover border border-border p-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" className={cn("w-10 h-10 p-0 rounded-full cursor-pointer", path === "/" && "opacity-50")} onClick={goBack} disabled={path === "/"}>
                                <MoveLeft size={24} color="white" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="flex items-center gap-2">
                            <p>Go Back</p>
                            <KbdGroup>
                                <Kbd className="bg-popover text-foreground">Ctrl + Z</Kbd>
                            </KbdGroup>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" className={cn("w-10 h-10 p-0 rounded-full cursor-pointer", pathHistory.length <= 2 && "opacity-50")} onClick={goForward} disabled={pathHistory.length <= 2}>
                                <MoveRight size={24} color="white" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="flex items-center gap-2">
                            <p>Go Forward</p>
                            <KbdGroup>
                                <Kbd className="bg-popover text-foreground">Ctrl + Shift + Z</Kbd>
                            </KbdGroup>
                        </TooltipContent>
                    </Tooltip>
                </div>

                <div className="w-full flex justify-center ">
                    <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                        <PopoverAnchor asChild className="w-[40%]">
                            <div className="rounded-3xl bg-popover border border-border p-1">
                                <InputGroup className="w-[100%] cursor-pointer px-2 bg-transparent! border-none! shadow-none!">
                                    <InputGroupAddon align="inline-end" className="cursor-pointer">
                                        <InputGroupText className="cursor-pointer">
                                            <KbdGroup>
                                                <Kbd className="bg-card text-muted-foreground">Ctrl + Alt + K</Kbd>
                                            </KbdGroup>
                                            <Search size={18} />
                                        </InputGroupText>
                                    </InputGroupAddon>
                                    <InputGroupInput
                                        ref={searchInputRef}
                                        placeholder="Search..."
                                        className="cursor-pointer"
                                        onChange={(e) => { setSearchOpen(true); setSearchQuery(e.target.value) }}
                                        value={searchQuery}
                                    />
                                </InputGroup>
                            </div>
                        </PopoverAnchor>
                        <PopoverContent className="md:w-[464px] w-[200px] py-4 border border-border bg-card/80 backdrop-blur-md shadow-lg scrollbar-no-bg!" onOpenAutoFocus={(e) => e.preventDefault()}>
                            {searchQuery.length > 0 ? (
                                (() => {
                                    const filteredFolders = fetchedFolders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
                                    const filteredNotes = fetchedNotes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()));

                                    if (filteredFolders.length === 0 && filteredNotes.length === 0) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-8 gap-3 text-foreground/50">
                                                <CircleSlash size={36} strokeWidth={1.5} />
                                                <div className="text-center">
                                                    <p className="font-medium text-foreground">No matches found</p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="max-h-[300px] overflow-y-auto">
                                            {filteredFolders.length > 0 && (
                                                <div className="mb-4">
                                                    <p className="text-xs text-muted-foreground mb-1 px-4">Folders</p>
                                                    {filteredFolders.map(folder => (
                                                        <div key={folder.id} className="cursor-pointer hover:bg-foreground/10 p-2 px-4 flex items-center gap-2 rounded-lg transition-colors" onClick={() => navigateToFolderAbsolutePath(getFolderPath(folder.id))}>
                                                            <FolderIcon size={16} className="text-primary" />
                                                            <p className="text-sm">{folder.name}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {filteredNotes.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-1 px-4">Notes</p>
                                                    {filteredNotes.map(note => (
                                                        <div key={note.id} className="cursor-pointer hover:bg-foreground/10 p-2 px-4 flex items-center gap-2 rounded-lg transition-colors" onClick={() => navigateToFolderAbsolutePath(getNotePath(note.id))}>
                                                            <FileText size={16} className="text-muted-foreground" />
                                                            <p className="text-sm">{note.title}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="flex items-center justify-center py-8 gap-3 text-foreground/50">
                                    <Search size={36} strokeWidth={1.5} />
                                    <p className="font-medium">Search folders & notes</p>
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="absolute right-2 flex items-center gap-1 bg-popover border border-border rounded-3xl p-1">
                    <DropdownMenu open={isDropdownCreateNewOpen} onOpenChange={setIsDropdownCreateNewOpen}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="w-10 h-10 p-0 rounded-full">
                                        <Plus size={24} color="white" />
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Create New</p>
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="p-1">
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={createFolder}>
                                <FolderIcon size={16} /> New Folder
                                <KbdGroup className="ml-auto"><Kbd>Ctrl+Shift+N</Kbd></KbdGroup>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setCreateNoteDialogOpen(true)}>
                                <FileText size={16} /> New Note
                                <KbdGroup className="ml-auto"><Kbd>Ctrl+N</Kbd></KbdGroup>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

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
                                <p>Sort & More</p>
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="p-2">
                            <div className="flex flex-col gap-1">
                                <Toggle aria-label="Ascending" size="sm" variant="outline" className="justify-start gap-2" onClick={() => setSortOrder("asc")} pressed={sortOrder === "asc"}>
                                    <AArrowUp size={16} /> Ascending
                                </Toggle>
                                <Toggle aria-label="Descending" size="sm" variant="outline" className="justify-start gap-2" onClick={() => setSortOrder("desc")} pressed={sortOrder === "desc"}>
                                    <AArrowDown size={16} /> Descending
                                </Toggle>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Content Area */}
            <ContextMenu>
                <ContextMenuTrigger className="w-full flex-1 min-h-0">
                    <ScrollArea className="h-full w-full">
                        <div className="flex flex-wrap gap-4 p-4 content-start">
                            {path !== "/" && (
                                <div
                                    className={cn(
                                        "group flex flex-col items-center gap-2 p-4 hover:bg-muted/50 rounded-xl cursor-pointer w-32 h-28 justify-center transition-all duration-200 border border-transparent hover:border-sidebar-border",
                                        dragItem && dragOverFolderId === '__parent__' && "border-primary/60 bg-primary/10 scale-105"
                                    )}
                                    onClick={goBack}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverFolderId('__parent__'); }}
                                    onDragLeave={() => setDragOverFolderId(null)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (dragItem) {
                                            moveItemToFolder(dragItem.type, dragItem.id, getParentFolderIdOfCurrentPath());
                                        }
                                        setDragOverFolderId(null);
                                    }}
                                >
                                    <FolderIcon className={cn("w-12 h-12 group-hover:scale-110 transition-transform duration-200", currentFolder?.color && folderColorClasses[currentFolder.color]?.text, currentFolder?.color && folderColorClasses[currentFolder.color]?.fill)} />
                                    <p className="text-xs font-medium text-center truncate w-full px-1">...</p>
                                </div>
                            )}

                            {folders.slice().sort((a, b) => sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)).map(folder => (
                                <ContextMenu key={folder.id}>
                                    <Tooltip>
                                        <ContextMenuTrigger>
                                            <TooltipTrigger asChild>
                                                {renamingFolderId === folder.id ? (
                                                    <div className="group flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-xl cursor-default w-32 h-28 justify-center border border-primary/50">
                                                        <FolderIcon className={cn("w-12 h-12", folder.color && folderColorClasses[folder.color]?.text)} />
                                                        <Input
                                                            value={tempFolderName}
                                                            onChange={(e) => setTempFolderName(e.target.value)}
                                                            autoFocus
                                                            ref={folderNameInputRef}
                                                            maxLength={24}
                                                            className="h-6 w-full text-xs text-center px-1 bg-transparent border-none focus-visible:ring-0"
                                                            onBlur={() => isRenamingExistingFolder ? handleFolderRenameSubmit() : handleFolderSave()}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") isRenamingExistingFolder ? handleFolderRenameSubmit() : handleFolderSave();
                                                                else if (e.key === "Escape") isRenamingExistingFolder ? cancelFolderRename() : cancelFolderCreation();
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={cn(
                                                            "group flex flex-col items-center gap-2 p-4 hover:bg-muted/50 rounded-xl cursor-pointer w-32 h-28 justify-center transition-all duration-200 border border-transparent hover:border-sidebar-border overflow-hidden",
                                                            dragItem && dragOverFolderId === folder.id && dragItem.id !== folder.id && "border-primary/60 bg-primary/10 scale-105"
                                                        )}
                                                        draggable
                                                        onDragStart={() => setDragItem({ type: 'folder', id: folder.id })}
                                                        onDragEnd={() => { setDragItem(null); setDragOverFolderId(null); }}
                                                        onDragOver={(e) => { e.preventDefault(); if (dragItem?.id !== folder.id) setDragOverFolderId(folder.id); }}
                                                        onDragLeave={() => setDragOverFolderId(null)}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            if (dragItem && dragItem.id !== folder.id) moveItemToFolder(dragItem.type, dragItem.id, folder.id);
                                                            setDragOverFolderId(null);
                                                        }}
                                                        onDoubleClick={() => startFolderRename(folder.id, folder.name)}
                                                        onClick={() => navigateToFolder(folder.name)}
                                                    >
                                                        <FolderIcon className={cn("w-12 h-12 group-hover:scale-110 transition-transform duration-200", folder.color && folderColorClasses[folder.color]?.text, folder.color && folderColorClasses[folder.color]?.fill)} />
                                                        <p className="text-xs font-medium text-center truncate w-full px-1">{folder.name}</p>
                                                    </div>
                                                )}
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="flex flex-col px-4 py-2 items-center">
                                                <p className="font-medium">{folder.name}</p>
                                                <p className="text-xs text-muted-foreground">{folder.updatedAt ? `Updated ${dateConvert(folder.updatedAt.toString())}` : 'Never updated'}</p>
                                            </TooltipContent>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent className="w-48">
                                            <ContextMenuItem onClick={() => startFolderRename(folder.id, folder.name)} className="gap-2">
                                                <FolderPen size={14} /> Rename
                                            </ContextMenuItem>
                                            <ContextMenuSub>
                                                <ContextMenuSubTrigger className="gap-2"><Palette size={14} /> Color</ContextMenuSubTrigger>
                                                <ContextMenuSubContent className="grid grid-cols-5 gap-1 p-2">
                                                    {folderColors.map(color => (
                                                        <button
                                                            key={color.value}
                                                            className={cn("w-6 h-6 rounded-full border border-border flex items-center justify-center hover:scale-110 transition-transform", color.bgClass)}
                                                            onClick={() => changeFolderColor(folder.id, color.value)}
                                                        >
                                                            {folder.color === color.value && <Check size={12} className="text-white" />}
                                                        </button>
                                                    ))}
                                                </ContextMenuSubContent>
                                            </ContextMenuSub>
                                            <ContextMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => deleteFolder(folder.id, folder.name)}>
                                                <Trash size={14} /> Delete
                                            </ContextMenuItem>
                                        </ContextMenuContent>
                                    </Tooltip>
                                </ContextMenu>
                            ))}

                            {notes.slice().sort((a, b) => sortOrder === "asc" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)).map(note => (
                                <ContextMenu key={note.id}>
                                    <Tooltip>
                                        <ContextMenuTrigger>
                                            <TooltipTrigger asChild>
                                                {renamingNoteId === note.id ? (
                                                    <div className="group flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-xl cursor-default w-32 h-28 justify-center border border-primary/50">
                                                        <FileText className="w-10 h-10 text-foreground/50" />
                                                        <Input
                                                            value={tempNoteName}
                                                            onChange={(e) => setTempNoteName(e.target.value)}
                                                            autoFocus
                                                            maxLength={48}
                                                            className="h-6 w-full text-xs text-center px-1 bg-transparent border-none focus-visible:ring-0"
                                                            onBlur={handleNoteRenameSubmit}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") handleNoteRenameSubmit();
                                                                else if (e.key === "Escape") cancelNoteRename();
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="group flex flex-col items-center gap-2 p-4 hover:bg-muted/50 rounded-xl cursor-pointer w-32 h-28 justify-center transition-all duration-200 border border-transparent hover:border-sidebar-border"
                                                        draggable
                                                        onDragStart={() => setDragItem({ type: 'note', id: note.id })}
                                                        onDragEnd={() => { setDragItem(null); setDragOverFolderId(null); }}
                                                        onDoubleClick={() => startNoteRename(note.id, note.title)}
                                                        onClick={() => openNote(note)}
                                                    >
                                                        <FileText className="w-10 h-10 text-foreground/50 group-hover:text-foreground group-hover:scale-110 transition-all duration-200" />
                                                        <p className="text-xs font-medium text-center truncate w-full px-1 mt-1">{note.title}</p>
                                                    </div>
                                                )}
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="flex flex-col gap-1 p-2 max-w-[200px]">
                                                <p className="font-medium truncate">{note.title}</p>
                                                {note.description && <p className="text-xs text-muted-foreground line-clamp-2">{note.description}</p>}
                                                <p className="text-xs text-muted-foreground">{note.updatedAt ? `Updated ${dateConvert(note.updatedAt.toString())}` : 'Never updated'}</p>
                                            </TooltipContent>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent className="w-48">
                                            <ContextMenuItem onClick={() => startNoteRename(note.id, note.title)} className="gap-2">
                                                <FolderPen size={14} /> Rename
                                            </ContextMenuItem>
                                            <ContextMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => deleteNote(note.id)}>
                                                <Trash size={14} /> Delete
                                            </ContextMenuItem>
                                        </ContextMenuContent>
                                    </Tooltip>
                                </ContextMenu>
                            ))}

                            {folders.length === 0 && notes.length === 0 && (
                                <div className="w-full flex flex-col items-center justify-center text-muted-foreground mt-20 gap-2 opacity-50">
                                    <FolderIcon size={64} strokeWidth={1} />
                                    <p className="text-lg">Folder is empty</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-48">
                    <ContextMenuItem onClick={createFolder} className="gap-2">
                        <FolderPlus size={14} /> Folder
                        <KbdGroup className="ml-auto "><Kbd className="bg-card">Ctrl+Shift+N</Kbd></KbdGroup>
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => setCreateNoteDialogOpen(true)} className="gap-2">
                        <FilePlus size={14} /> Note
                        <KbdGroup className="ml-auto"><Kbd className="bg-card">Ctrl+N</Kbd></KbdGroup>
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>

            {/* Create Note Dialog */}
            <Dialog open={createNoteDialogOpen} onOpenChange={setCreateNoteDialogOpen}>
                <DialogContent showCloseButton={false} className="w-[40%] pb-24">
                    <DialogHeader>
                        <DialogTitle>Create Note</DialogTitle>
                        <DialogDescription>Create a new note in your workspace</DialogDescription>
                    </DialogHeader>

                    <Field className="gap-1">
                        <FieldLabel className="mb-1">Name</FieldLabel>
                        <Input value={noteName} onChange={(e) => setNoteName(e.target.value)} placeholder="Note Name" maxLength={24} />
                        <FieldDescription>*Max length is 24 characters</FieldDescription>
                    </Field>

                    <Field className="gap-1 w-full">
                        <FieldLabel className="mb-1">Description</FieldLabel>
                        <Textarea value={noteDescription} onChange={(e) => setNoteDescription(e.target.value)} maxLength={160} placeholder="Note Description" className="resize-none w-full min-h-[80px]" />
                        <FieldDescription>*Max length is 160 characters</FieldDescription>
                    </Field>

                    <Field className="flex flex-col gap-1">
                        <FieldLabel>Folder</FieldLabel>
                        <Combobox value={noteFolder} onValueChange={(val) => setNoteFolder(val || "/")}>
                            <ComboboxInput placeholder="Select a folder..." />
                            <ComboboxContent>
                                <ComboboxEmpty>No folder found.</ComboboxEmpty>
                                <ComboboxList>
                                    {allFolderPaths.map((f) => (
                                        <ComboboxItem key={f.id} value={f.path}>{f.path}</ComboboxItem>
                                    ))}
                                </ComboboxList>
                            </ComboboxContent>
                        </Combobox>
                    </Field>

                    <DialogFooter className="mt-4 gap-2">
                        <Button variant="outline" onClick={() => setCreateNoteDialogOpen(false)}>Cancel</Button>
                        <Button onClick={createNote} disabled={!noteName.trim()}>Create Note</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}