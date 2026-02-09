'use client'

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SidebarInset } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileEdit, FolderEdit, MoreVertical, MoveLeft, MoveRight, Search, Folder as FolderIcon, FileText, FolderPen, Move, Trash2, Trash, Palette, CircleSlash, CircleOff } from "lucide-react";
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

export default function MainArea() {
    // Path State
    const [path, setPath] = useState("/");
    const [pathHistory, setPathHistory] = useState<string[]>(["/"])
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        setPathHistory([...pathHistory, path])
    }, [path])

    // EXAMPLE DATA
    const FOLDERS_EXAMPLE: Folder[] = [
        {
            name: "Personal",
            id: "1",
            createdAt: new Date("2026-01-15T10:00:00+01:00"),
            updatedAt: new Date("2026-02-01T14:30:00+01:00"),
            foldersIds: ["3"],
            notesIds: ["1", "2"],
        },
        {
            name: "Work",
            id: "2",
            createdAt: new Date("2026-01-20T09:00:00+01:00"),
            updatedAt: new Date("2026-02-04T08:15:00+01:00"),
            foldersIds: ["4"],
            notesIds: ["3"],
        },
        {
            name: "Travel Plans",
            id: "3",
            createdAt: new Date("2026-02-02T16:45:00+01:00"),
            updatedAt: new Date("2026-02-03T11:20:00+01:00"),
            foldersIds: [],
            notesIds: ["4", "5"],
        },
        {
            name: "Active Projects",
            id: "4",
            createdAt: new Date("2026-01-25T13:00:00+01:00"),
            updatedAt: new Date("2026-02-04T10:00:00+01:00"),
            foldersIds: [],
            notesIds: ["6"],
        },
    ];
    const NOTES_EXAMPLE: Note[] = [
        {
            id: "1",
            title: "Shopping List",
            content: "Milk, eggs, bread, coffee",
            description: "Weekly groceries for February",
            createdAt: new Date("2026-02-01T09:00:00+01:00"),
            updatedAt: new Date("2026-02-03T18:30:00+01:00"),
            tags: ["personal", "todo"],
        },
        {
            id: "2",
            title: "Journal 2026",
            content: "Today was a productive day...",
            description: "Daily reflections and thoughts",
            createdAt: new Date("2026-01-01T00:00:00+01:00"),
            updatedAt: new Date("2026-02-04T22:00:00+01:00"),
            tags: ["personal", "journal"],
        },
        {
            id: "3",
            title: "Meeting Minutes",
            content: "Discussed the new UI architecture...",
            description: "Sync with the design team",
            createdAt: new Date("2026-02-04T10:00:00+01:00"),
            updatedAt: new Date("2026-02-04T11:00:00+01:00"),
            tags: ["work", "meeting"],
        },
        {
            id: "4",
            title: "Paris Trip Ideas",
            content: "Visit the Louvre, dinner at Le Jules Verne",
            description: "Places to see and things to do",
            createdAt: new Date("2026-02-02T17:00:00+01:00"),
            updatedAt: new Date("2026-02-03T09:45:00+01:00"),
            tags: ["travel", "ideas"],
        },
        {
            id: "5",
            title: "Packing List",
            content: "Passport, camera, comfortable shoes",
            description: "Essentials for the trip",
            createdAt: new Date("2026-02-03T10:00:00+01:00"),
            updatedAt: new Date("2026-02-03T12:00:00+01:00"),
            tags: ["travel", "todo"],
        },
        {
            id: "6",
            title: "Narao Design",
            content: "Focus on glassmorphism and smooth animations",
            description: "Core principles of the new app",
            createdAt: new Date("2026-01-25T14:00:00+01:00"),
            updatedAt: new Date("2026-02-04T15:30:00+01:00"),
            tags: ["work", "design"],
        },
        {
            id: "7",
            title: "Quick Thoughts",
            content: "AI is moving so fast!",
            description: "Random brain dump",
            createdAt: new Date("2026-02-04T22:15:00+01:00"),
            updatedAt: new Date("2026-02-04T22:15:00+01:00"),
            tags: ["random"],
        },
    ];

    // Helper functions
    const getFolderById = (id: string) => FOLDERS_EXAMPLE.find(f => f.id === id);
    const getNoteById = (id: string) => NOTES_EXAMPLE.find(n => n.id === id);

    const allChildFolderIds = new Set(FOLDERS_EXAMPLE.flatMap(f => f.foldersIds || []));
    const allChildNoteIds = new Set(FOLDERS_EXAMPLE.flatMap(f => f.notesIds || []));

    const rootFolders = FOLDERS_EXAMPLE.filter(f => !allChildFolderIds.has(f.id));
    const rootNotes = NOTES_EXAMPLE.filter(n => !allChildNoteIds.has(n.id));

    const getContent = () => {
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

            currentLevel = (currentFolder.foldersIds || [])
                .map(id => getFolderById(id))
                .filter((f): f is Folder => !!f);
        }

        if (currentFolder) {
            const f = (currentFolder.foldersIds || [])
                .map(id => getFolderById(id))
                .filter((f): f is Folder => !!f);
            const n = (currentFolder.notesIds || [])
                .map(id => getNoteById(id))
                .filter((n): n is Note => !!n);
            return { folders: f, notes: n };
        }

        return { folders: [], notes: [] };
    }

    const { folders, notes } = getContent();

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

    const getNotePath = (noteId: string): string => {
        const folder = FOLDERS_EXAMPLE.find(f => f.notesIds?.includes(noteId));
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
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [goBack, goForward]);

    // The thing is that we at first load the folders and notes in the folders. Then we load the notes in the root since they are the one that are not in any folder.
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
                <div className="w-full flex justify-center">
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
                                    const filteredFolders = FOLDERS_EXAMPLE.filter((folder) => folder.name.toLowerCase().includes(searchQuery.toLowerCase()));
                                    const filteredNotes = NOTES_EXAMPLE.filter((note) => note.title.toLowerCase().includes(searchQuery.toLowerCase()));

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
                </div>

                {/* Right Side */}
                <div className="absolute right-2">
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
                        <DropdownMenuContent align="end" className="w-[264px] p-2">
                            <DropdownMenuLabel>Filters & More</DropdownMenuLabel>
                            <div className="w-full h-[1px] bg-foreground/10 my-1"></div>
                            {/* Different types of filters */}
                            <div className="flex items-center gap-2 p-2">
                                <p>Sort by</p>
                                <p>Group by</p>
                                <p>Filter by</p>
                            </div>
                        </DropdownMenuContent>

                    </DropdownMenu>
                </div>
            </div>

            {/* ------------------ Bottom Part ----------------- */}
            <div className="bg-card text-foreground h-[92vh] w-[calc(100%-0.5rem)] rounded-lg absolute bottom-2 p-4 border border-sidebar-border">
                <ContextMenu>
                    <ContextMenuTrigger className="w-full h-full block">
                        {/* ALL FOLDERS AND NOTES INSIDE THE CONTEXT MENU TRIGGER */}
                        <ScrollArea className="h-full w-full pb-10">
                            {/* HERE WE WILL LOAD ALL THE FOLDERS AND NOTES IN THE CURRENT PATH */}
                            <div className="flex flex-wrap gap-4 p-4 content-start">
                                {folders.map(folder => (
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
                                {notes.map(note => (
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
            </div>
        </SidebarInset>
    );
}