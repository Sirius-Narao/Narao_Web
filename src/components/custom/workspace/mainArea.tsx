'use client'

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SidebarInset } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileEdit, FolderEdit, MoreVertical, MoveLeft, MoveRight, Search, Folder as FolderIcon, FileText, FolderPen, Move, Trash, Palette, CircleSlash, AArrowUp, AArrowDown, Haze, Plus } from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { useCallback, useEffect, useRef, useState } from "react";
import { Folder, Note } from "@/types/folderStructureTypes";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import dateConvert from "@/lib/dateConvert";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { useActiveTabs } from "@/context/activeTabsContext";
import { Input } from "@/components/ui/input";
import UserType from "@/types/userType";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettingsOpen } from "@/context/settingOpenContext";
import { useCreateNoteDialogOpen } from "@/context/createNoteDialogOpenContext";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function MainArea() {
    // fetched data
    const [userAuth, setUserAuth] = useState<any>(null);
    const [user, setUser] = useState<UserType | null>(null);
    const [fetchedFolders, setFetchedFolders] = useState<Folder[]>([]);
    const [fetchedNotes, setFetchedNotes] = useState<Note[]>([]);

    // fetch states
    const [foldersLoaded, setFoldersLoaded] = useState(false);
    const [notesLoaded, setNotesLoaded] = useState(false);

    // Path State
    const [path, setPath] = useState("/");
    const [pathHistory, setPathHistory] = useState<string[]>(["/"])
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const { activeTab, setActiveTab } = useActiveTabs();

    // settings open state
    const { settingsOpen, setSettingsOpen } = useSettingsOpen();

    // create note dialog open state
    const { createNoteDialogOpen, setCreateNoteDialogOpen } = useCreateNoteDialogOpen();

    // fetch user auth
    useEffect(() => {
        const fetchUserAuth = async () => {
            const { data } = await supabase.auth.getUser();
            setUserAuth(data.user);
        }
        fetchUserAuth();
    }, [])

    // Fetch user data
    useEffect(() => {
        if (!userAuth) return;

        const fetchUsers = async () => {
            if (!userAuth?.id) return;

            const { data: profiles, error } = await supabase
                .from('profiles')         // your table name
                .select('*')          // select all columns
                .eq('id', userAuth.id);            // select only the 1rst user

            if (error) {
                console.error(error);
            }
            setUser(profiles?.[0]);
        };
        fetchUsers();
    }, [userAuth]);

    // Fetch folders data
    useEffect(() => {
        if (!user) return;

        const fetchFolders = async () => {
            const { data, error } = await supabase
                .from('folders')         // your table name
                .select('*')          // select all columns
                .eq('user_id', user.id);           // select only those of the user

            if (error) {
                console.error(error);
                return;
            }

            if (data) {
                // Map the data to ensure correct types (Date objects) and property names
                const mappedFolders: Folder[] = data.map((item: any) => ({
                    name: item.name || "Untitled Chat",
                    id: String(item.id || ""),
                    foldersIds: (item.folders_ids || item.foldersIds || []).map(String),
                    notesIds: (item.notes_ids || item.notesIds || []).map(String),
                    // Handle both camelCase (if mapped) and snake_case (raw DB)
                    createdAt: new Date(item.created_at || item.createdAt || new Date()),
                    updatedAt: new Date(item.updated_at || item.updatedAt || new Date())
                }));
                console.log("Mapped Folders:", mappedFolders);
                setFetchedFolders(mappedFolders);
                setFoldersLoaded(true);
            }
        };
        fetchFolders();
        console.log("fetchedFolders: ", fetchedFolders);

    }, [user]);

    // Fetch notes data
    useEffect(() => {
        if (!user) return;

        const fetchNotes = async () => {
            const { data, error } = await supabase
                .from('notes')         // your table name
                .select('*')          // select all columns
                .eq('user_id', user.id);           // select only those of the user

            if (error) {
                console.error(error);
                return;
            }

            if (data) {
                // Map the data to ensure correct types (Date objects) and property names
                const mappedNotes: Note[] = data.map((item: any) => ({
                    title: item.title || "Untitled Chat",
                    id: String(item.id || ""),
                    content: item.content || "",
                    description: item.description || "",
                    tags: item.tags || [],
                    // Handle both camelCase (if mapped) and snake_case (raw DB)
                    createdAt: new Date(item.created_at || item.createdAt || new Date()),
                    updatedAt: new Date(item.updated_at || item.updatedAt || new Date())
                }));
                console.log("Mapped Notes:", mappedNotes);
                setFetchedNotes(mappedNotes);
                setNotesLoaded(true);
            }
        };
        fetchNotes();
        console.log("fetchedNotes: ", fetchedNotes);

    }, [user]);

    // Path History useEffect
    useEffect(() => {
        setPathHistory([...pathHistory, path])
    }, [path])

    // Helper functions in folders
    const getFolderById = (id: string) => fetchedFolders.find(f => String(f.id) === String(id));
    const getNoteById = (id: string) => fetchedNotes.find(n => String(n.id) === String(id));

    const allChildFolderIds = new Set(fetchedFolders.flatMap(f => f.foldersIds || []));
    const allChildNoteIds = new Set(fetchedFolders.flatMap(f => f.notesIds || []));

    const rootFolders = fetchedFolders.filter(f => !allChildFolderIds.has(f.id));
    const rootNotes = fetchedNotes.filter(n => !allChildNoteIds.has(n.id));

    // Get content of current path
    const getContent = () => {
        console.log("Getting content for path:", path);
        const cleanPath = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;

        if (cleanPath === "/" || cleanPath === "") {
            console.log("Root content:", { folders: rootFolders, notes: rootNotes });
            return { folders: rootFolders, notes: rootNotes };
        }

        const segments = cleanPath.split("/").filter(Boolean);
        let currentLevel = rootFolders;
        let currentFolder: Folder | undefined;

        for (const segment of segments) {
            currentFolder = currentLevel.find(f => f.name === segment);
            if (!currentFolder) {
                console.log("Folder not found in path segment:", segment);
                return { folders: [], notes: [] };
            }

            currentLevel = (currentFolder.foldersIds || [])
                .map(id => getFolderById(id))
                .filter((f): f is Folder => !!f);
        }

        if (currentFolder) {
            console.log("Resolved Folder:", currentFolder);
            const f = (currentFolder.foldersIds || [])
                .map(id => getFolderById(id))
                .filter((f): f is Folder => !!f);
            const n = (currentFolder.notesIds || [])
                .map(id => getNoteById(id))
                .filter((n): n is Note => !!n);
            console.log("Folder Content - Notes IDs:", currentFolder.notesIds);
            console.log("Folder Content - Resolved Notes:", n);
            return { folders: f, notes: n };
        }

        return { folders: [], notes: [] };
    }
    const { folders, notes } = getContent();

    // Navigate to folder
    const navigateToFolder = (folderName: string) => {
        const newPath = path === "/" ? `/${folderName}` : `${path}/${folderName}`;
        setPath(newPath);
    }
    const navigateToFolderAbsolutePath = (path: string) => {
        const absolutePath = path.startsWith("/") ? path : `/${path}`;
        setPath(absolutePath);
        setSearchOpen(false);
        setSearchQuery("");
    }

    // Get folder path
    const getFolderPath = (folderId: string): string => {
        const findPath = (currentFolders: Folder[], currentPath: string): string | null => {
            for (const folder of currentFolders) {
                const folderPath = currentPath === "/" ? `/${folder.name}` : `${currentPath}/${folder.name}`;
                if (folder.id === folderId) return folderPath;

                const children = (folder.foldersIds || [])
                    .map(id => getFolderById(id))
                    .filter((f): f is Folder => !!f);

                const result = findPath(children, folderPath);
                if (result) return result;
            }
            return null;
        };

        return findPath(rootFolders, "/") || "/";
    };

    // Get note path
    const getNotePath = (noteId: string): string => {
        const folder = fetchedFolders.find(f => f.notesIds?.includes(noteId));
        if (!folder) return "/";
        return getFolderPath(folder.id);
    };

    // Functions for arrows BACK & FORWARD
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

    // Create folder function

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();

            if (e.ctrlKey && key === "z" && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                goBack();
            }
            else if (e.ctrlKey && (e.shiftKey || e.altKey) && key === "z") {
                e.preventDefault();
                goForward();
            }
            else if (e.ctrlKey && e.altKey && key === "k") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            else if (e.ctrlKey && key === "o" && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                setActiveTab(0);
            }
            else if (e.ctrlKey && key === "n" && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                setActiveTab(1);
                setCreateNoteDialogOpen(true);
            }
            else if (e.ctrlKey && key === "c" && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                setActiveTab(2);
            }
            else if (e.ctrlKey && key === "n" && e.shiftKey && !e.altKey) {
                e.preventDefault();
                // Create folder function
            }
            else if (e.ctrlKey && key === "," && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                setSettingsOpen(true);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <SidebarInset className="bg-background">

            {/* ------------------ Top Part -------------------- */}
            <div className="bg-background text-foreground h-[calc(100%-94vh)] w-[calc(100%-0.5rem)] rounded-lg absolute top-2 flex items-center justify-between relative">
                {/* Left Side */}
                <div className="flex items-center gap-2 absolute left-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" className={cn("w-10 h-10 p-0 rounded-full cursor-pointer", path === "/" && "opacity-50")} onClick={goBack} disabled={path === "/"} >
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

                {/* Middle */}
                {activeTab === 0 ? <div className="w-full flex justify-center">
                    <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                        <PopoverAnchor asChild className="w-[40%]" >
                            <InputGroup className="w-[40%] bg-card shadow-lg cursor-pointer px-2"
                                onClick={() => { }}>
                                <InputGroupAddon align="inline-end" className="cursor-pointer">
                                    <InputGroupText className="bg-transparent cursor-pointer">
                                        <KbdGroup className="">
                                            <Kbd className="bg-popover text-muted-foreground">Ctrl + Alt + K</Kbd>
                                        </KbdGroup>
                                        <Search />
                                    </InputGroupText>
                                </InputGroupAddon>
                                <InputGroupInput
                                    ref={searchInputRef}
                                    placeholder="Look for a folder or a note..."
                                    className="bg-card cursor-pointer "
                                    onChange={(e) => { setSearchOpen(true); setSearchQuery(e.target.value) }}
                                    value={searchQuery}
                                />
                            </InputGroup>
                        </PopoverAnchor>
                        <PopoverContent
                            className="w-[var(--radix-popover-anchor-width)] py-4"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            {searchQuery.length > 0 ? (
                                (() => {
                                    const filteredFolders = fetchedFolders.filter((folder) => folder.name.toLowerCase().includes(searchQuery.toLowerCase()));
                                    const filteredNotes = fetchedNotes.filter((note) => note.title.toLowerCase().includes(searchQuery.toLowerCase()));

                                    if (filteredFolders.length === 0 && filteredNotes.length === 0) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-8 gap-3 text-foreground/50 md:w-124 sm:w-64">
                                                <CircleSlash size={36} strokeWidth={1.5} />
                                                <div className="text-center">
                                                    <p className="font-medium text-foreground">No matches found</p>
                                                    <p className="text-sm">We couldn't find any folders or notes with that name.</p>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <>
                                            {filteredFolders.length > 0 && (
                                                <>
                                                    <p className="text-foreground/50 md:w-124 sm:w-64 mb-1">Folders</p>
                                                    {filteredFolders.map((folder) => (
                                                        <div key={folder.id} className="cursor-pointer hover:bg-foreground/10 p-2 px-4 flex items-center gap-2 rounded-lg transition-colors" onClick={() => navigateToFolderAbsolutePath(getFolderPath(folder.id))}>
                                                            <FolderIcon size={18} className="text-primary" />
                                                            <p className="text-sm">{folder.name}</p>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                            {filteredNotes.length > 0 && (
                                                <>
                                                    <p className={cn("text-foreground/50 md:w-124 sm:w-64 mb-1", filteredFolders.length > 0 && "mt-4")}>Notes</p>
                                                    {filteredNotes.map((note) => (
                                                        <div key={note.id} className="cursor-pointer hover:bg-foreground/10 p-2 px-4 flex items-center gap-2 rounded-lg transition-colors" onClick={() => navigateToFolderAbsolutePath(getNotePath(note.id))}>
                                                            <FileText size={18} className="text-muted-foreground" />
                                                            <p className="text-sm">{note.title}</p>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </>
                                    );
                                })()
                            ) : (
                                <div className="flex items-center justify-center h-full md:w-124 sm:w-64 py-8">
                                    <div className="flex flex-col items-center gap-3">
                                        <Search size={36} className="text-foreground/30" strokeWidth={1.5} />
                                        <p className="text-foreground/50 font-medium">Search for folders and notes</p>
                                    </div>
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>
                </div> : activeTab === 1 ?
                    <div className="w-full flex justify-center">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" className="w-124 sm:w-64 text-foreground text-lg">{"Title Placeholder"}</Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Change Note's Name</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    :
                    <div className="w-full flex justify-center">
                        <p>Settings</p>
                    </div>
                }

                {/* Right Side */}
                {activeTab === 0 && <div className="absolute right-2">
                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="w-10 h-10 p-0 rounded-full mr-1">
                                        <Plus size={24} color="white" />
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent className="flex items-center gap-2">
                                <p>Create New</p>
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="min-w-[32px] p-2 rounded-full">
                            <div className="flex items-center gap-2 p-2">
                                <Button variant="outline" className="p-0 rounded-full group">
                                    <FolderIcon size={24} className="text-foreground group-hover:text-primary transition-all duration-100" />
                                    Create Folder
                                    <KbdGroup>
                                        <Kbd className="bg-popover text-foreground">Ctrl + Shift + N</Kbd>
                                    </KbdGroup>
                                </Button>
                                <Button variant="outline" className="p-0 rounded-full group">
                                    <FileText size={24} className="text-foreground group-hover:text-primary transition-all duration-100" />
                                    Create Note
                                    <KbdGroup>
                                        <Kbd className="bg-popover text-foreground">Ctrl + N</Kbd>
                                    </KbdGroup>
                                </Button>
                            </div>
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
                            <TooltipContent className="flex items-center gap-2">
                                <p>Filters & More</p>
                                {/* <KbdGroup>
                                    <Kbd className="bg-popover text-foreground">Ctrl + ,</Kbd>
                                </KbdGroup> */}
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="min-w-[32px] p-2 rounded-full">
                            {/* <div className="w-full h-[1px] bg-foreground/10 my-1"></div> */}
                            {/* Different types of filters */}
                            <div className="flex items-center gap-2 p-2">
                                <Toggle aria-label="Ascending" size="sm" variant="outline" className="flex items-center gap-1 px-2 hover:bg-sidebar-border" onClick={() => setSortOrder("asc")} pressed={sortOrder === "asc"}>
                                    <AArrowUp className="group-data-[state=on]/toggle:fill-foreground" />
                                    <p>Ascending</p>
                                </Toggle>
                                <Toggle aria-label="Descending" size="sm" variant="outline" className="flex items-center gap-1 px-2 hover:bg-sidebar-border" onClick={() => setSortOrder("desc")} pressed={sortOrder === "desc"}>
                                    <AArrowDown className="group-data-[state=on]/toggle:fill-foreground" />
                                    <p>Descending</p>
                                </Toggle>
                            </div>
                        </DropdownMenuContent>

                    </DropdownMenu>
                </div>}
            </div>

            {/* ------------------ Bottom Part ----------------- */}
            <div className="bg-card text-foreground h-[92vh] w-[calc(100%-0.5rem)] rounded-lg absolute bottom-2 p-4 border border-sidebar-border">

                {/* ---------------------------- FOLDERS ---------------------------- */}
                {activeTab === 0 ? ((folders.length > 0 || notes.length > 0) ? (
                    <ContextMenu>
                        <ContextMenuTrigger className="w-full h-full block">
                            {/* ALL FOLDERS AND NOTES INSIDE THE CONTEXT MENU TRIGGER */}
                            <ScrollArea className="h-full w-full pb-10">
                                {/* HERE WE WILL LOAD ALL THE FOLDERS AND NOTES IN THE CURRENT PATH */}
                                <div className="flex flex-wrap gap-4 p-4 content-start">
                                    {folders.slice().sort((a, b) => sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)).map(folder => (
                                        <ContextMenu key={folder.id}>
                                            <ContextMenuTrigger>
                                                <div
                                                    className="group flex flex-col items-center gap-2 p-4 hover:bg-muted/50 rounded-xl cursor-pointer w-32 h-28 justify-center transition-all duration-200 border border-transparent hover:border-sidebar-border"
                                                    onClick={() => navigateToFolder(folder.name)}
                                                >
                                                    <FolderIcon className="w-12 h-12 text-primary fill-primary group-hover:scale-110 transition-transform duration-200" />
                                                    <p className="text-xs font-medium text-center truncate w-full px-1">{folder.name}</p>
                                                </div>
                                            </ContextMenuTrigger>
                                            <ContextMenuContent >
                                                <p className="text-foreground text-md px-2 mt-1">{folder.name}</p>
                                                <p className="text-muted-foreground text-xs px-2 mb-1">{`Last updated: ${dateConvert(folder.updatedAt.toString())}`}</p>
                                                <ContextMenuItem className="cursor-pointer group">
                                                    <FolderPen size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">Rename</p>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group">
                                                    <Palette size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">Change Color</p>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group">
                                                    <Move size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">Move to...</p>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group">
                                                    <FolderEdit size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">New Folder</p>
                                                    <KbdGroup>
                                                        <Kbd className="bg-popover text-muted-foreground">Ctrl + Shift + N</Kbd>
                                                    </KbdGroup>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group">
                                                    <FileEdit size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">New Note</p>
                                                    <KbdGroup>
                                                        <Kbd className="bg-popover text-muted-foreground">Ctrl + N</Kbd>
                                                    </KbdGroup>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group text-destructive focus:text-destructive focus:bg-destructive/10">
                                                    <Trash size={16} className="text-destructive" />
                                                    <p className="text-destructive">Delete</p>
                                                </ContextMenuItem>
                                            </ContextMenuContent>
                                        </ContextMenu>
                                    ))}
                                    {notes.slice().sort((a, b) => sortOrder === "asc" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)).map(note => (
                                        <ContextMenu key={note.id}>
                                            <ContextMenuTrigger>
                                                <div
                                                    className="group flex flex-col items-center gap-2 p-4 hover:bg-muted/50 rounded-xl cursor-pointer w-32 h-28 justify-center transition-all duration-200 border border-transparent hover:border-sidebar-border"
                                                >
                                                    <FileText className="w-10 h-10 text-foreground/50 group-hover:text-foreground group-hover:scale-110 transition-all duration-200" />
                                                    <p className="text-xs font-medium text-center truncate w-full px-1 mt-1">{note.title}</p>
                                                </div>
                                            </ContextMenuTrigger>
                                            <ContextMenuContent >
                                                <p className="text-foreground text-md px-2 mt-1">{note.title}</p>
                                                <p className="text-muted-foreground text-xs px-2">{note.description}</p>
                                                <p className="text-muted-foreground text-xs px-2 mb-1">{`Last updated: ${dateConvert(note.updatedAt.toString())}`}</p>
                                                <ContextMenuItem className="cursor-pointer group">
                                                    <FolderPen size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">Rename</p>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group">
                                                    <Palette size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">Change Color</p>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group">
                                                    <Move size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">Move to...</p>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group">
                                                    <FolderEdit size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">New Folder</p>
                                                    <KbdGroup>
                                                        <Kbd className="bg-popover text-muted-foreground">Ctrl + Shift + N</Kbd>
                                                    </KbdGroup>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group">
                                                    <FileEdit size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">New Note</p>
                                                    <KbdGroup>
                                                        <Kbd className="bg-popover text-muted-foreground">Ctrl + N</Kbd>
                                                    </KbdGroup>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group text-destructive focus:text-destructive focus:bg-destructive/10">
                                                    <Trash size={16} className="text-destructive" />
                                                    <p className="text-destructive">Delete</p>
                                                </ContextMenuItem>
                                            </ContextMenuContent>
                                        </ContextMenu>
                                    ))}
                                    {folders.length === 0 && notes.length === 0 && (
                                        <div className="w-full flex flex-col items-center justify-center text-muted-foreground mt-20 gap-2">
                                            <FolderIcon size={64} className="text-muted-foreground/30" />
                                            <p className="text-center w-1/4 text-lg">This folder is empty or has not yet been created</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>

                            {/* Path Input */}
                            <div className="w-full bg-card absolute bottom-2 left-0 right-0 px-4 flex justify-center pointer-events-none">
                                <InputGroup className="w-full max-w-[40%] bg-popover dark:bg-popover shadow-lg cursor-pointer px-2 pointer-events-auto"
                                    onClick={() => { }}>
                                    <InputGroupAddon align="inline-end" className="cursor-pointer">
                                        <InputGroupText className="bg-transparent cursor-pointer">
                                        </InputGroupText>
                                    </InputGroupAddon>
                                    <InputGroupInput
                                        placeholder="No path selected..."
                                        className="cursor-pointer"
                                        // if path is none default to "/"
                                        onChange={(e) => { setPath(e.target.value === "" ? "/" : e.target.value) }}
                                        value={path}
                                    />
                                </InputGroup>
                            </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent >
                            <p className="text-foreground/50 text-xs px-2 my-1">Actions</p>
                            <ContextMenuItem className="cursor-pointer group">
                                <FolderEdit size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                <p className="text-foreground group-hover:text-accent-foreground">New Folder</p>
                                <KbdGroup>
                                    <Kbd className="bg-popover text-muted-foreground">Ctrl + Shift + N</Kbd>
                                </KbdGroup>
                            </ContextMenuItem>
                            <ContextMenuItem className="cursor-pointer group">
                                <FileEdit size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                <p className="text-foreground group-hover:text-accent-foreground">New Note</p>
                                <KbdGroup>
                                    <Kbd className="bg-popover text-muted-foreground">Ctrl + N</Kbd>
                                </KbdGroup>
                            </ContextMenuItem>
                        </ContextMenuContent>
                    </ContextMenu>

                ) : !(foldersLoaded && notesLoaded) ? (
                    <div className="flex flex-wrap gap-4 p-4 content-start relative h-full">
                        <Skeleton className="w-32 h-28" />
                        <Skeleton className="w-32 h-28" />
                        <Skeleton className="w-32 h-28" />
                        <Skeleton className="w-32 h-28" />
                        <Skeleton className="w-32 h-28" />
                        <div className="w-full bg-card absolute bottom-2 left-0 right-0 px-4 flex justify-center pointer-events-none">
                            <InputGroup className="w-full max-w-[40%] bg-popover dark:bg-popover shadow-lg cursor-pointer px-2 pointer-events-auto"
                                onClick={() => { }}>
                                <InputGroupAddon align="inline-end" className="cursor-pointer">
                                    <InputGroupText className="bg-transparent cursor-pointer">
                                    </InputGroupText>
                                </InputGroupAddon>
                                <InputGroupInput
                                    placeholder="No path selected..."
                                    className="cursor-pointer"
                                    // if path is none default to "/"
                                    onChange={(e) => { setPath(e.target.value === "" ? "/" : e.target.value) }}
                                    value={path}
                                />
                            </InputGroup>
                        </div>
                    </div>) : (
                    <div className="flex flex-col items-center justify-center h-full relative">
                        <Haze size={64} className="text-muted-foreground/30" />
                        <p className="text-muted-foreground/30 text-center text-lg mt-2">No folders or notes yet!</p>
                        <div className="w-full bg-card absolute bottom-2 left-0 right-0 px-4 flex justify-center pointer-events-none">
                            <InputGroup className="w-full max-w-[40%] bg-popover dark:bg-popover shadow-lg cursor-pointer px-2 pointer-events-auto"
                                onClick={() => { }}>
                                <InputGroupAddon align="inline-end" className="cursor-pointer">
                                    <InputGroupText className="bg-transparent cursor-pointer">
                                    </InputGroupText>
                                </InputGroupAddon>
                                <InputGroupInput
                                    placeholder="No path selected..."
                                    className="cursor-pointer"
                                    // if path is none default to "/"
                                    onChange={(e) => { setPath(e.target.value === "" ? "/" : e.target.value) }}
                                    value={path}
                                />
                            </InputGroup>
                        </div>
                    </div>

                )
                ) : activeTab === 1 ? (
                    <div>
                        <p>Notes</p>
                    </div>
                ) : (
                    <div>
                        <p>Chats</p>
                    </div>
                )}

            </div>
            <Dialog open={createNoteDialogOpen}>
                <DialogContent showCloseButton={false} className="w-[50%] h-[50%]">
                    <DialogHeader>
                        <DialogTitle>Create Note</DialogTitle>
                        <DialogDescription>
                            Create a new note
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex items-center justify-end gap-2 absolute bottom-4 left-1/2 -translate-x-1/2">
                        <DialogClose asChild>
                            <Button variant="default" className="hover:bg-primary/70" onClick={() => setCreateNoteDialogOpen(false)}>
                                Create
                                <Plus size={16} />
                            </Button>
                        </DialogClose>

                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SidebarInset>
    );
}