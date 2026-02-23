'use client'

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SidebarInset } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileEdit, FolderEdit, MoreVertical, MoveLeft, MoveRight, Search, Folder as FolderIcon, FileText, FolderPen, Move, Trash, Palette, CircleSlash, AArrowUp, AArrowDown, Haze, Plus, X, Check, ArrowBigDown, } from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSub,
    ContextMenuSubTrigger,
    ContextMenuSubContent,
} from "@/components/ui/context-menu"
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Folder, FolderColor, Note } from "@/types/folderStructureTypes";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import dateConvert from "@/lib/dateConvert";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { useActiveTabs } from "@/context/activeTabsContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import UserType from "@/types/userType";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettingsOpen } from "@/context/settingOpenContext";
import { useCreateNoteDialogOpen } from "@/context/createNoteDialogOpenContext";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";

// colors for folders — full class names so Tailwind can detect them
const folderColors: { value: FolderColor; label: string; bgClass: string }[] = [
    { value: "folder-red", label: "Red", bgClass: "bg-folder-red" },
    { value: "folder-blue", label: "Blue", bgClass: "bg-folder-blue" },
    { value: "folder-green", label: "Green", bgClass: "bg-folder-green" },
    { value: "folder-yellow", label: "Yellow", bgClass: "bg-folder-yellow" },
    { value: "folder-purple", label: "Purple", bgClass: "bg-folder-purple" },
    { value: "folder-orange", label: "Orange", bgClass: "bg-folder-orange" },
    { value: "folder-pink", label: "Pink", bgClass: "bg-folder-pink" },
    { value: "folder-cyan", label: "Cyan", bgClass: "bg-folder-cyan" },
    { value: "folder-lime", label: "Lime", bgClass: "bg-folder-lime" },
    { value: "folder-teal", label: "Teal", bgClass: "bg-folder-teal" },
    { value: "folder-indigo", label: "Indigo", bgClass: "bg-folder-indigo" },
    { value: "folder-rose", label: "Rose", bgClass: "bg-folder-rose" },
    { value: "folder-amber", label: "Amber", bgClass: "bg-folder-amber" },
    { value: "folder-brown", label: "Brown", bgClass: "bg-folder-brown" },
    { value: "folder-slate", label: "Slate", bgClass: "bg-folder-slate" },
    { value: "folder-gray", label: "Gray", bgClass: "bg-folder-gray" },
    { value: "folder-black", label: "Black", bgClass: "bg-folder-black" },
    { value: "folder-white", label: "White", bgClass: "bg-folder-white" },
];

// Static mapping so Tailwind can detect the full class names at build time
const folderColorClasses: Record<string, { text: string; fill: string }> = {
    "folder-red": { text: "text-folder-red", fill: "fill-folder-red" },
    "folder-blue": { text: "text-folder-blue", fill: "fill-folder-blue" },
    "folder-green": { text: "text-folder-green", fill: "fill-folder-green" },
    "folder-yellow": { text: "text-folder-yellow", fill: "fill-folder-yellow" },
    "folder-purple": { text: "text-folder-purple", fill: "fill-folder-purple" },
    "folder-orange": { text: "text-folder-orange", fill: "fill-folder-orange" },
    "folder-pink": { text: "text-folder-pink", fill: "fill-folder-pink" },
    "folder-cyan": { text: "text-folder-cyan", fill: "fill-folder-cyan" },
    "folder-lime": { text: "text-folder-lime", fill: "fill-folder-lime" },
    "folder-teal": { text: "text-folder-teal", fill: "fill-folder-teal" },
    "folder-indigo": { text: "text-folder-indigo", fill: "fill-folder-indigo" },
    "folder-rose": { text: "text-folder-rose", fill: "fill-folder-rose" },
    "folder-amber": { text: "text-folder-amber", fill: "fill-folder-amber" },
    "folder-brown": { text: "text-folder-brown", fill: "fill-folder-brown" },
    "folder-slate": { text: "text-folder-slate", fill: "fill-folder-slate" },
    "folder-gray": { text: "text-folder-gray", fill: "fill-folder-gray" },
    "folder-black": { text: "text-folder-black", fill: "fill-folder-black" },
    "folder-white": { text: "text-folder-white", fill: "fill-folder-white" },
};

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

    // dropdown create new state
    const [isDropdownCreateNewOpen, setIsDropdownCreateNewOpen] = useState(false)

    // settings open state
    const { settingsOpen, setSettingsOpen } = useSettingsOpen();

    // create note dialog open state
    const { createNoteDialogOpen, setCreateNoteDialogOpen } = useCreateNoteDialogOpen();

    // create note state
    const [noteFolder, setNoteFolder] = useState("/");
    const [noteName, setNoteName] = useState("");
    const [noteDescription, setNoteDescription] = useState("");
    const [noteTags, setNoteTags] = useState<string[]>([]);
    const [pathError, setPathError] = useState(false);

    // Virtual Folder Creation / Rename State
    const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
    const [tempFolderName, setTempFolderName] = useState("");
    const [isRenamingExistingFolder, setIsRenamingExistingFolder] = useState(false);

    // Note Rename State
    const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
    const [tempNoteName, setTempNoteName] = useState("");

    // Drag and drop state
    const [dragItem, setDragItem] = useState<{ type: 'folder' | 'note'; id: string } | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

    // accessed note state
    const [accessedNote, setAccessedNote] = useState<Note | null>(null);
    const [content, setContent] = useState("")

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
                    user_id: String(item.user_id || ""),
                    foldersIds: (item.folders_ids || item.foldersIds || []).map(String),
                    notesIds: (item.notes_ids || item.notesIds || []).map(String),
                    color: item.color || null,
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
                    user_id: String(item.user_id || ""),
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
            return { folders: f, notes: n, currentFolder };
        }

        return { folders: [], notes: [], currentFolder: undefined };
    }
    const { folders, notes, currentFolder } = getContent();

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
    const getFolderPath = useCallback((folderId: string): string => {
        const findPath = (currentFolders: Folder[], currentPath: string): string | null => {
            for (const folder of currentFolders) {
                const folderPath = currentPath === "/" ? `/${folder.name}` : `${currentPath}/${folder.name}`;
                if (folder.id === folderId) return folderPath;

                const children = (folder.foldersIds || [])
                    .map(id => fetchedFolders.find(f => String(f.id) === String(id)))
                    .filter((f): f is Folder => !!f);

                const result = findPath(children, folderPath);
                if (result) return result;
            }
            return null;
        };

        const rootLevel = fetchedFolders.filter(f => !fetchedFolders.some(parent => parent.foldersIds?.includes(f.id)));
        return findPath(rootLevel, "/") || "/";
    }, [fetchedFolders]);

    const allFolderPaths = useMemo(() => {
        const paths = fetchedFolders.map(f => ({
            id: f.id,
            name: f.name,
            path: getFolderPath(f.id)
        })).sort((a, b) => a.path.localeCompare(b.path));

        return [{ id: "root", name: "Root", path: "/" }, ...paths];
    }, [fetchedFolders, getFolderPath]);

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

    // FOLDER FUNCTIONS
    // Create folder function
    const createFolder = useCallback(() => {
        // Check if we are already creating a folder
        if (renamingFolderId) return;

        const newFolder: Folder = {
            id: "temp-creation", // Temporary ID
            name: "",
            user_id: user?.id,
            foldersIds: [],
            notesIds: [],
            color: "folder-blue",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Add to the START of the list or end depending on sort? 
        // Actually rendering order depends on sort, but let's add to fetchedFolders.
        // We need to ensure it appears in the current view.
        // Since `folders` derived from `fetchedFolders` filters by path,
        // we need to make sure this new folder is "linked" to the current path?
        // Wait, current logic: `getContent` finds folders whose ID is in the parent's `foldersIds`.
        // If I just add to `fetchedFolders`, `getContent` won't find it if it's not in parent's list!
        // EXCEPT for root path which filters by "not in any other folder".

        // Handling "Virtual" existence in `getContent`:
        // For non-root paths, we must add it to the parent folder's `foldersIds` locally effectively?
        // Or simpler: Modify `getContent` or the way we display folders to include the "temp" folder if it's supposed to be in current path.

        // Let's modify `newFolder` to be "linked" to current path implicitly.
        // Actually, if we are in a subfolder, we need to find the parent folder and add "temp-creation" to its `foldersIds`.
        // Update: `fetchedFolders` state directly to include the relationship?

        const currentPath = path;

        if (currentPath === "/" || currentPath === "") {
            // Root: Just add it. `rootFolders` filter will pick it up because no one has it in `foldersIds`.
            setFetchedFolders(prev => [...prev, newFolder]);
        } else {
            // Subfolder: Find parent and add to its foldersIds locally
            console.log("Creating folder in subfolder. Path:", currentPath);
            const parentFolder = allFolderPaths.find(p => p.path === currentPath);
            console.log("Found parent folder:", parentFolder);

            if (parentFolder) {
                setFetchedFolders(prev => {
                    const updated = prev.map(f => {
                        if (String(f.id) === String(parentFolder.id)) {
                            console.log("Updating parent folder:", f.name);
                            return { ...f, foldersIds: [...(f.foldersIds || []), newFolder.id] };
                        }
                        return f;
                    });
                    return updated.concat(newFolder);
                });
            } else {
                console.error("Could not find parent folder for path:", currentPath);
                // Fallback to adding to list (will appear in root)
                setFetchedFolders(prev => [...prev, newFolder]);
                return;
            }
        }

        setRenamingFolderId(newFolder.id);
        setTempFolderName("");
    }, [path, allFolderPaths, renamingFolderId, user]);
    const handleFolderSave = async () => {
        if (!renamingFolderId || !user) return;

        const targetName = tempFolderName.trim();

        // Validation: Empty
        if (!targetName) {
            cancelFolderCreation();
            return;
        }

        // Validation: Duplicate in current view
        // `folders` from `getContent()` contains the current view's folders.
        // We should check if any EXISTING folder (excluding the temp one) has the same name.
        const duplicate = folders.some(f => f.id !== renamingFolderId && f.name.toLowerCase() === targetName.toLowerCase());

        if (duplicate) {
            // Keep focus, maybe show error (TODO: Add UI error state?)
            // For now, just return/do nothing, trapping the user.
            // We could maybe shake the input or red border.
            return;
        }

        // Proceed to save
        // 1. Insert into DB
        // 2. Update parent folder in DB if necessary

        // Remove temp folder from local state first to avoid weirdness, or update it?
        // Better: Update the temp folder in place with real ID and Name.

        try {
            // 1. Create new folder
            const { data: newFolderData, error: createError } = await supabase
                .from("folders")
                .insert([{
                    name: targetName,
                    user_id: user.id,
                    folders_ids: [],
                    notes_ids: [],
                    color: "folder-blue",
                    created_at: new Date(),
                    updated_at: new Date(),
                }])
                .select()
                .single();

            if (createError) throw createError;

            const realFolderId = String(newFolderData.id);
            const newFolderObj: Folder = {
                id: realFolderId,
                name: newFolderData.name,
                user_id: String(newFolderData.user_id),
                foldersIds: [],
                notesIds: [],
                color: newFolderData.color,
                createdAt: new Date(newFolderData.created_at),
                updatedAt: new Date(newFolderData.updated_at)
            };

            // 2. If valid parent, update parent's folderIds
            const currentPath = path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;

            if (currentPath !== "/" && currentPath !== "") {
                const parentFolderInfo = allFolderPaths.find(p => p.path === currentPath);
                if (parentFolderInfo) {
                    // We need to fetch the parent folder to get its current folderIds (DB truth) or rely on local?
                    // Relying on local `fetchedFolders` is faster.
                    const parentFolder = fetchedFolders.find(f => f.id === parentFolderInfo.id);
                    if (parentFolder) {
                        // The parent folder currently has "temp-creation" in its list (from createFolder logic).
                        // We need to replace "temp-creation" with `realFolderId`.
                        const newFoldersIds = (parentFolder.foldersIds || []).filter(id => id !== "temp-creation").concat(realFolderId);

                        const { error: updateError } = await supabase
                            .from("folders")
                            .update({ folders_ids: newFoldersIds })
                            .eq("id", parentFolder.id);

                        if (updateError) {
                            console.error("Error linking to parent folder:", updateError);
                            // Fallback?
                        }

                        setFetchedFolders(prev => prev.map(f => {
                            if (f.id === parentFolder.id) {
                                return { ...f, foldersIds: newFoldersIds };
                            }
                            // Replace temp folder object with real one
                            if (f.id === "temp-creation") {
                                return newFolderObj;
                            }
                            return f;
                        }));
                    }
                }
            } else {
                // Root creation
                setFetchedFolders(prev => prev.map(f => {
                    if (f.id === "temp-creation") {
                        return newFolderObj;
                    }
                    return f;
                }));
            }

            setRenamingFolderId(null);
            setTempFolderName("");

        } catch (error) {
            console.error("Error creating folder:", error);
            // Don't cancel, let user try again? Or show toast.
        }
    }
    const cancelFolderCreation = () => {
        // Remove "temp-creation" folder
        // Remove it from fetchedFolders AND from any parent's foldersIds
        setFetchedFolders(prev => {
            // First, find if any parent has it
            return prev.map(f => {
                if (f.foldersIds?.includes("temp-creation")) {
                    return { ...f, foldersIds: f.foldersIds.filter(id => id !== "temp-creation") };
                }
                return f;
            }).filter(f => f.id !== "temp-creation");
        });
        setRenamingFolderId(null);
        setTempFolderName("");
    }
    const deleteFolder = async (folderId: string) => {
        if (!user) return;

        const { error } = await supabase.from("folders").delete().eq("id", folderId);

        if (error) {
            console.error("Error deleting folder:", error);
            return;
            // Don't cancel, let user try again? Or show toast.
        }

        setFetchedFolders(prev => prev.filter(f => f.id !== folderId));
    }
    // Change folder color
    const changeFolderColor = async (folderId: string, folderColor: FolderColor) => {
        const { data, error } = await supabase
            .from("folders")
            .update({ color: folderColor })
            .eq("id", folderId)
            .select();

        if (error) {
            console.error("Error updating folder:", error);
        } else {
            // Update local folders state
            setFetchedFolders(prev => prev.map(f =>
                String(f.id) === String(folderId)
                    ? { ...f, color: folderColor }
                    : f
            ));
        }
    }
    // Folder rename
    const renameFolder = async (folderId: string, newName: string) => {
        if (!user) return;

        const { error } = await supabase
            .from("folders")
            .update({ name: newName, updated_at: new Date() })
            .eq("id", folderId)

        if (error) {
            console.error("Error renaming folder: ", error);
        } else {
            setFetchedFolders(prev => prev.map(f =>
                String(f.id) === String(folderId) ? { ...f, name: newName } : f
            ));
        }
    }
    const startFolderRename = (folderId: string, currentName: string) => {
        setIsRenamingExistingFolder(true);
        setRenamingFolderId(folderId);
        setTempFolderName(currentName);
    }
    const handleFolderRenameSubmit = async () => {
        if (!renamingFolderId) return;
        const targetName = tempFolderName.trim();
        if (!targetName) {
            cancelFolderRename();
            return;
        }
        await renameFolder(renamingFolderId, targetName);
        setRenamingFolderId(null);
        setTempFolderName("");
        setIsRenamingExistingFolder(false);
    }
    const cancelFolderRename = () => {
        setRenamingFolderId(null);
        setTempFolderName("");
        setIsRenamingExistingFolder(false);
    }

    // NOTE FUNCTIONS
    // create note function
    const createNote = async () => {
        if (!user) return;

        const notePayload = {
            user_id: user.id,
            title: noteName,
            description: noteDescription,
            content: "",
            tags: [] // soon to be implemented
        };

        const { data: noteData, error: noteError } = await supabase.from("notes").insert([notePayload]).select().single();

        if (noteError) {
            console.error("Error creating note:", noteError);
            return;
        }
        console.log("Note created:", noteData);

        // Update local notes state
        const newNote: Note = {
            id: String(noteData.id),
            title: noteData.title,
            description: noteData.description || "",
            content: noteData.content || "",
            tags: noteData.tags || [],
            createdAt: new Date(noteData.created_at),
            updatedAt: new Date(noteData.updated_at)
        };
        setAccessedNote(newNote);
        setFetchedNotes(prev => [...prev, newNote]);

        // Add to folder if needed
        let targetFolderId: string | null = null;
        if (noteFolder === "/") {
            // Root folder, no update needed to a parent folder, 
            // but we might need to handle root notes if the system distinguishes them.
            // Based on current logic, root notes are filtered by exclusion, so creating one without parent reference is effectively root.
        } else {
            // Find folder by path
            const targetPathObj = allFolderPaths.find(p => p.path === noteFolder);
            if (targetPathObj) {
                targetFolderId = targetPathObj.id;
            } else {
                console.error("Target folder not found for path:", noteFolder);
            }
        }

        if (targetFolderId) {
            const targetFolder = getFolderById(targetFolderId);
            if (targetFolder) {
                const newNotesIds = [...(targetFolder.notesIds || []), String(noteData.id)];

                const { data: folderData, error: folderError } = await supabase
                    .from("folders")
                    .update({ notes_ids: newNotesIds })
                    .eq("id", targetFolder.id)
                    .select();

                if (folderError) {
                    console.error("Error updating folder:", folderError);
                } else {
                    console.log("Folder updated:", folderData);
                    // Update local folders state
                    setFetchedFolders(prev => prev.map(f =>
                        String(f.id) === String(targetFolder!.id)
                            ? { ...f, notesIds: newNotesIds }
                            : f
                    ));
                }
            }
        }

        setCreateNoteDialogOpen(false);
    }
    const deleteNote = async (noteId: string) => {
        const { error } = await supabase
            .from("notes")
            .delete()
            .eq("id", noteId);

        if (error) {
            console.error("Error deleting note:", error);
            return;
        }

        setFetchedNotes(prev => prev.filter(n => n.id !== noteId));
    }
    const renameNote = async (noteId: string, newTitle: string) => {
        if (!user) return;

        const { error } = await supabase
            .from("notes")
            .update({ title: newTitle, updated_at: new Date() })
            .eq("id", noteId);

        if (error) {
            console.error("Error renaming note: ", error);
        } else {
            setFetchedNotes(prev => prev.map(n =>
                String(n.id) === String(noteId) ? { ...n, title: newTitle } : n
            ));
        }
    }
    const startNoteRename = (noteId: string, currentTitle: string) => {
        setRenamingNoteId(noteId);
        setTempNoteName(currentTitle);
    }
    const handleNoteRenameSubmit = async () => {
        if (!renamingNoteId) return;
        const targetTitle = tempNoteName.trim();
        if (!targetTitle) {
            cancelNoteRename();
            return;
        }
        await renameNote(renamingNoteId, targetTitle);
        setRenamingNoteId(null);
        setTempNoteName("");
    }
    const cancelNoteRename = () => {
        setRenamingNoteId(null);
        setTempNoteName("");
    }
    const saveNote = async () => {
        if (!user) return;

        const { error } = await supabase.from("notes").update({ content: content }).eq("id", accessedNote?.id)

        if (error) {
            console.error(error)
            return;
        }
    }
    const openNote = async (note: Note) => {
        if (!user) return;

        const { data, error } = await supabase.from("notes").select("*").eq("id", note.id).single()

        if (data) {
            setAccessedNote(data)
            setActiveTab(1)
            return;
        } else if (error) {
            console.error(error)
            return;
        }
    }

    // ---- DRAG & DROP ----
    // Move a folder or note into a target folder (or to root if targetFolderId is null)
    const moveItemToFolder = async (itemType: 'folder' | 'note', itemId: string, targetFolderId: string | null) => {
        if (!user) return;

        // Prevent moving a folder into itself
        if (itemType === 'folder' && itemId === targetFolderId) return;

        // Find the current parent folder of the item
        const currentParent = fetchedFolders.find(f =>
            itemType === 'folder'
                ? (f.foldersIds || []).includes(itemId)
                : (f.notesIds || []).includes(itemId)
        );

        // If it's already in the target, do nothing
        if ((currentParent?.id ?? null) === targetFolderId) return;

        try {
            // 1. Remove from old parent (if it had one)
            if (currentParent) {
                if (itemType === 'folder') {
                    const newIds = (currentParent.foldersIds || []).filter(id => id !== itemId);
                    const { error } = await supabase
                        .from('folders')
                        .update({ folders_ids: newIds })
                        .eq('id', currentParent.id);
                    if (error) throw error;
                    setFetchedFolders(prev => prev.map(f =>
                        f.id === currentParent.id ? { ...f, foldersIds: newIds } : f
                    ));
                } else {
                    const newIds = (currentParent.notesIds || []).filter(id => id !== itemId);
                    const { error } = await supabase
                        .from('folders')
                        .update({ notes_ids: newIds })
                        .eq('id', currentParent.id);
                    if (error) throw error;
                    setFetchedFolders(prev => prev.map(f =>
                        f.id === currentParent.id ? { ...f, notesIds: newIds } : f
                    ));
                }
            }

            // 2. Add to new parent (if there is one; null means root)
            if (targetFolderId) {
                const targetFolder = getFolderById(targetFolderId);
                if (targetFolder) {
                    if (itemType === 'folder') {
                        const newIds = [...(targetFolder.foldersIds || []), itemId];
                        const { error } = await supabase
                            .from('folders')
                            .update({ folders_ids: newIds })
                            .eq('id', targetFolderId);
                        if (error) throw error;
                        setFetchedFolders(prev => prev.map(f =>
                            f.id === targetFolderId ? { ...f, foldersIds: newIds } : f
                        ));
                    } else {
                        const newIds = [...(targetFolder.notesIds || []), itemId];
                        const { error } = await supabase
                            .from('folders')
                            .update({ notes_ids: newIds })
                            .eq('id', targetFolderId);
                        if (error) throw error;
                        setFetchedFolders(prev => prev.map(f =>
                            f.id === targetFolderId ? { ...f, notesIds: newIds } : f
                        ));
                    }
                }
            }
        } catch (err) {
            console.error('Error moving item:', err);
        }
    };

    // Determine the parent folder id of the current path (null = root)
    const getParentFolderIdOfCurrentPath = (): string | null => {
        const parentPath = path.split('/').slice(0, -1).join('/') || '/';
        if (parentPath === '/') return null;
        const found = allFolderPaths.find(p => p.path === parentPath);
        return found?.id ?? null;
    };

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
            else if (e.ctrlKey && key === "m" && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                setActiveTab(2);
            }
            else if (e.ctrlKey && key === "n" && e.shiftKey && !e.altKey) {
                e.preventDefault();
                createFolder();
            }
            else if (e.ctrlKey && key === "," && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                setSettingsOpen(true);
            }
            else if (e.ctrlKey && key === "s" && !e.shiftKey && !e.altKey && activeTab === 1 && accessedNote !== null) {
                e.preventDefault();
                saveNote()
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [createFolder, goBack, goForward, setActiveTab, setCreateNoteDialogOpen, setSettingsOpen]);

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
                                <Button variant="ghost" className="w-124 sm:w-64 text-foreground text-lg">{accessedNote?.title ?? (noteName || "New Note")}</Button>
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
                {activeTab === 0 ? <div className="absolute right-2">
                    <DropdownMenu open={isDropdownCreateNewOpen} onOpenChange={() => setIsDropdownCreateNewOpen(false)}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="w-10 h-10 p-0 rounded-full mr-1" onClick={() => setIsDropdownCreateNewOpen(!isDropdownCreateNewOpen)}>
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
                                {/* should blur the dropdown when clicked */}
                                <Button variant="outline" className="p-0 rounded-full group" onClick={() => { setIsDropdownCreateNewOpen(false); createFolder() }}>
                                    <FolderIcon size={24} className="text-foreground group-hover:text-primary transition-all duration-100" />
                                    Create Folder
                                    <KbdGroup>
                                        <Kbd className="bg-popover text-foreground">Ctrl + Shift + N</Kbd>
                                    </KbdGroup>
                                </Button>
                                <Button variant="outline" className="p-0 rounded-full group" onClick={() => { setIsDropdownCreateNewOpen(false); setCreateNoteDialogOpen(true) }}>
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

                    {/* NOTES  */}
                </div> : activeTab === 1 ?
                    <Tooltip>
                        <TooltipTrigger asChild>

                            <Button variant="ghost" className="w-10 h-10 p-0 rounded-full mr-1" onClick={() => saveNote()}>
                                <ArrowBigDown size={24} color="white" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="flex items-center gap-2">
                            <p>Save</p>
                            <KbdGroup>
                                <Kbd className="bg-popover text-foreground">Ctrl + S</Kbd>
                            </KbdGroup>
                        </TooltipContent>
                    </Tooltip>

                    : <>

                    </>
                }
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
                                    {path !== "/" && (
                                        <div
                                            className={cn(
                                                "group flex flex-col items-center gap-2 p-4 hover:bg-muted/50 rounded-xl cursor-pointer w-32 h-28 justify-center transition-all duration-200 border border-transparent hover:border-sidebar-border",
                                                dragItem && dragOverFolderId === '__parent__' && "border-primary/60 bg-primary/10 scale-105"
                                            )}
                                            onClick={() => goBack()}
                                            onDragOver={(e) => { e.preventDefault(); setDragOverFolderId('__parent__'); }}
                                            onDragLeave={() => setDragOverFolderId(null)}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setDragOverFolderId(null);
                                                if (dragItem) {
                                                    const parentId = getParentFolderIdOfCurrentPath();
                                                    moveItemToFolder(dragItem.type, dragItem.id, parentId);
                                                    setDragItem(null);
                                                }
                                            }}
                                        >
                                            <FolderIcon className={cn("w-12 h-12 group-hover:scale-110 transition-transform duration-200", currentFolder?.color && folderColorClasses[currentFolder.color]?.text, currentFolder?.color && folderColorClasses[currentFolder.color]?.fill)} />
                                            <p className="text-xs font-medium text-center truncate w-full px-1">...</p>
                                        </div>
                                    )}
                                    {folders.slice().sort((a, b) => sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)).map(folder => (
                                        <ContextMenu key={folder.id}>
                                            <ContextMenuTrigger>
                                                {renamingFolderId === folder.id ? (
                                                    <div
                                                        className="group flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-xl cursor-default w-32 h-28 justify-center border border-primary/50"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <FolderIcon className={cn("w-12 h-12", folder.color && folderColorClasses[folder.color]?.text)} />
                                                        <Input
                                                            value={tempFolderName}
                                                            onChange={(e) => setTempFolderName(e.target.value)}
                                                            autoFocus
                                                            maxLength={24}
                                                            className="h-6 w-full text-xs text-center px-2 bg-transparent border-none focus-visible:border-transparent focus-visible:ring-transparent focus-visible:ring-[3px]"
                                                            placeholder="Name"
                                                            onBlur={() => {
                                                                if (isRenamingExistingFolder) {
                                                                    handleFolderRenameSubmit();
                                                                } else {
                                                                    handleFolderSave();
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    if (isRenamingExistingFolder) {
                                                                        handleFolderRenameSubmit();
                                                                    } else {
                                                                        handleFolderSave();
                                                                    }
                                                                } else if (e.key === "Escape") {
                                                                    if (isRenamingExistingFolder) {
                                                                        cancelFolderRename();
                                                                    } else {
                                                                        cancelFolderCreation();
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={cn(
                                                            "group flex flex-col items-center gap-2 p-4 hover:bg-muted/50 rounded-xl cursor-pointer w-32 h-28 justify-center transition-all duration-200 border border-transparent hover:border-sidebar-border overflow-hidden",
                                                            dragItem && dragOverFolderId === folder.id && dragItem.id !== folder.id && "border-primary/60 bg-transparent scale-105"
                                                        )}
                                                        draggable
                                                        onDragStart={(e) => {
                                                            e.dataTransfer.effectAllowed = 'move';
                                                            setDragItem({ type: 'folder', id: folder.id });
                                                        }}
                                                        onDragEnd={() => { setDragItem(null); setDragOverFolderId(null); }}
                                                        onDragOver={(e) => { e.preventDefault(); if (dragItem?.id !== folder.id) setDragOverFolderId(folder.id); }}
                                                        onDragLeave={() => setDragOverFolderId(null)}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            setDragOverFolderId(null);
                                                            if (dragItem && dragItem.id !== folder.id) {
                                                                moveItemToFolder(dragItem.type, dragItem.id, folder.id);
                                                                setDragItem(null);
                                                            }
                                                        }}
                                                        onDoubleClick={() => startFolderRename(folder.id, folder.name)}
                                                        onClick={() => navigateToFolder(folder.name)}
                                                    >
                                                        <FolderIcon className={cn("w-12 h-12 group-hover:scale-110 transition-transform duration-200", folder.color && folderColorClasses[folder.color]?.text, folder.color && folderColorClasses[folder.color]?.fill)} />
                                                        <p className="text-xs font-medium text-center truncate w-full px-1">{folder.name}</p>
                                                    </div>
                                                )}
                                            </ContextMenuTrigger>
                                            <ContextMenuContent >
                                                <p className="text-foreground text-md px-2 mt-1">{folder.name}</p>
                                                <p className="text-muted-foreground text-xs px-2 mb-1">{`Last updated: ${dateConvert(folder.updatedAt.toString())}`}</p>
                                                <ContextMenuItem className="cursor-pointer group" onClick={() => startFolderRename(folder.id, folder.name)}>
                                                    <FolderPen size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">Rename</p>
                                                </ContextMenuItem>
                                                {/* Color submenu */}
                                                <ContextMenuSub>
                                                    <ContextMenuSubTrigger className="cursor-pointer group gap-2">
                                                        <Palette size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                        <p className="text-foreground group-hover:text-accent-foreground">Change Color</p>
                                                    </ContextMenuSubTrigger>
                                                    <ContextMenuSubContent>
                                                        {folderColors.map((color) => (
                                                            <ContextMenuItem
                                                                key={color.value}
                                                                className="cursor-pointer group gap-2"
                                                                onClick={() => changeFolderColor(folder.id, color.value)}
                                                            >
                                                                <div className={`w-3 h-3 rounded-full ${color.bgClass}`} />
                                                                <p className="text-foreground group-hover:text-accent-foreground">
                                                                    {color.label}
                                                                </p>
                                                                {folder.color === color.value && (
                                                                    <Check size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                                )}
                                                            </ContextMenuItem>
                                                        ))}
                                                    </ContextMenuSubContent>
                                                </ContextMenuSub>
                                                <ContextMenuItem className="cursor-pointer group">
                                                    <Move size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">Move to...</p>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group" onClick={createFolder}>
                                                    <FolderEdit size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">New Folder</p>
                                                    <KbdGroup>
                                                        <Kbd className="bg-popover text-muted-foreground">Ctrl + Shift + N</Kbd>
                                                    </KbdGroup>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group" onClick={() => setCreateNoteDialogOpen(true)}>
                                                    <FileEdit size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">New Note</p>
                                                    <KbdGroup>
                                                        <Kbd className="bg-popover text-muted-foreground">Ctrl + N</Kbd>
                                                    </KbdGroup>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => deleteFolder(folder.id)}>
                                                    <Trash size={16} className="text-destructive" />
                                                    <p className="text-destructive">Delete</p>
                                                </ContextMenuItem>
                                            </ContextMenuContent>
                                        </ContextMenu>
                                    ))}
                                    {notes.slice().sort((a, b) => sortOrder === "asc" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)).map(note => (
                                        <ContextMenu key={note.id}>
                                            <ContextMenuTrigger>
                                                {renamingNoteId === note.id ? (
                                                    <div
                                                        className="group flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-xl cursor-default w-32 h-28 justify-center border border-primary/50"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <FileText className="w-10 h-10 text-foreground/50" />
                                                        <Input
                                                            value={tempNoteName}
                                                            onChange={(e) => setTempNoteName(e.target.value)}
                                                            autoFocus
                                                            maxLength={48}
                                                            className="h-6 w-full text-xs text-center px-2 bg-transparent border-none focus-visible:border-transparent focus-visible:ring-transparent focus-visible:ring-[3px]"
                                                            placeholder="Title"
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
                                                        onDragStart={(e) => {
                                                            e.dataTransfer.effectAllowed = 'move';
                                                            setDragItem({ type: 'note', id: note.id });
                                                        }}
                                                        onDragEnd={() => { setDragItem(null); setDragOverFolderId(null); }}
                                                        onDoubleClick={() => startNoteRename(note.id, note.title)}
                                                        onClick={() => openNote(note)}
                                                    >
                                                        <FileText className="w-10 h-10 text-foreground/50 group-hover:text-foreground group-hover:scale-110 transition-all duration-200" />
                                                        <p className="text-xs font-medium text-center truncate w-full px-1 mt-1">{note.title}</p>
                                                    </div>
                                                )}
                                            </ContextMenuTrigger>
                                            <ContextMenuContent >
                                                <p className="text-foreground text-md px-2 mt-1">{note.title}</p>
                                                <p className="text-muted-foreground text-xs px-2">{note.description}</p>
                                                <p className="text-muted-foreground text-xs px-2 mb-1">{`Last updated: ${dateConvert(note.updatedAt.toString())}`}</p>
                                                <ContextMenuItem className="cursor-pointer group" onClick={() => startNoteRename(note.id, note.title)}>
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
                                                <ContextMenuItem className="cursor-pointer group" onClick={createFolder}>
                                                    <FolderEdit size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">New Folder</p>
                                                    <KbdGroup>
                                                        <Kbd className="bg-popover text-muted-foreground">Ctrl + Shift + N</Kbd>
                                                    </KbdGroup>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group" onClick={() => setCreateNoteDialogOpen(true)}>
                                                    <FileEdit size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                    <p className="text-foreground group-hover:text-accent-foreground">New Note</p>
                                                    <KbdGroup>
                                                        <Kbd className="bg-popover text-muted-foreground">Ctrl + N</Kbd>
                                                    </KbdGroup>
                                                </ContextMenuItem>
                                                <ContextMenuItem className="cursor-pointer group text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => deleteNote(note.id)}>
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
                            <div className="w-full absolute bottom-2 left-0 right-0 px-4 flex justify-center pointer-events-none">
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
                            <ContextMenuItem className="cursor-pointer group" onClick={createFolder}>
                                <FolderEdit size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                <p className="text-foreground group-hover:text-accent-foreground">New Folder</p>
                                <KbdGroup>
                                    <Kbd className="bg-popover text-muted-foreground">Ctrl + Shift + N</Kbd>
                                </KbdGroup>
                            </ContextMenuItem>
                            <ContextMenuItem className="cursor-pointer group" onClick={() => setCreateNoteDialogOpen(true)}>
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
                        <div className="w-full absolute bottom-2 left-0 right-0 px-4 flex justify-center pointer-events-none">
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
                    <div className="flex flex-col items-center justify-center h-full relative w-full">
                        <Haze size={64} className="text-muted-foreground/30" />
                        <p className="text-muted-foreground/30 text-center text-lg mt-2">No folders or notes yet!</p>
                        <div className="w-full absolute bottom-[-0.5rem] left-0 right-0 px-4 flex justify-center pointer-events-none">
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
                    <div className="bg-transparent w-full h-full">
                        <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-full px-24 py-12 focus:outline-none scrollbar-no-bg"></textarea>
                    </div>
                ) : (
                    <div>
                        <p>Chats</p>
                    </div>
                )}

            </div>
            {/* Create Note Dialog */}
            <Dialog open={createNoteDialogOpen}>
                <DialogContent showCloseButton={false} className="w-[40%] pb-24">
                    <DialogHeader>
                        <DialogTitle>Create Note</DialogTitle>
                        <DialogDescription>
                            Create a new note
                        </DialogDescription>
                    </DialogHeader>

                    <Field className="gap-1">
                        <FieldLabel className="mb-1">Name</FieldLabel>
                        <Input value={noteName} onChange={(e) => setNoteName(e.target.value)} placeholder="Note Name" maxLength={24}></Input>
                        <FieldDescription>
                            *Max length is 24 characters
                        </FieldDescription>
                    </Field>
                    <Field className="gap-1 w-full">
                        <FieldLabel className="mb-1">Description</FieldLabel>
                        {/* Multiline input for better visibility */}
                        <Textarea value={noteDescription} onChange={(e) => setNoteDescription(e.target.value)} maxLength={160} placeholder="Note Description" className="resize-none w-full min-h-[80px]" aria-multiline></Textarea>
                        <FieldDescription>
                            Description helps AI to better understand your note.
                            <br />
                            *Max length is 160 characters
                        </FieldDescription>
                    </Field>
                    <Field className="gap-1">
                        <FieldLabel className="mb-1">Path</FieldLabel>
                        <Combobox
                            items={allFolderPaths}
                            onValueChange={(val) => val && setNoteFolder(String(val))}
                        >
                            <ComboboxInput
                                value={noteFolder}
                                onChange={(e) => {
                                    setNoteFolder(e.target.value);
                                    if (pathError) setPathError(false);
                                }}
                                placeholder="/"
                                className={cn(pathError && "ring-2 ring-destructive animate-shake")}
                            />
                            <ComboboxContent>
                                <ComboboxEmpty>No items found.</ComboboxEmpty>
                                <ComboboxList>
                                    {(item) => {
                                        const folderColor = fetchedFolders.find((f) => String(f.id) === String(item.id))?.color;
                                        return (
                                            <div className="flex gap-2 px-4 py-1 items-center" key={item.id}>
                                                <FolderIcon
                                                    size={24}
                                                    className={cn(
                                                        folderColor && folderColorClasses[folderColor]?.text,
                                                        folderColor && folderColorClasses[folderColor]?.fill
                                                    )}
                                                />
                                                <ComboboxItem value={item.path}>
                                                    {item.path}
                                                </ComboboxItem>
                                            </div>
                                        );
                                    }}
                                </ComboboxList>
                            </ComboboxContent>
                        </Combobox>
                    </Field>
                    <Field className="gap-1">
                        <FieldLabel>Tags</FieldLabel>
                        SOON TO COME
                    </Field>

                    <DialogFooter className="flex items-center justify-end gap-2 absolute bottom-4 left-1/2 -translate-x-1/2">
                        <Button variant="outline" className="hover:bg-primary/70" onClick={() => {
                            setCreateNoteDialogOpen(false);
                            setActiveTab(0)
                        }}>
                            Cancel
                        </Button>
                        {noteName.length > 0 ? <Button variant="default" className="hover:bg-primary/70" onClick={() => {
                            const isValidPath = allFolderPaths.some(p => p.path === noteFolder);

                            if (!isValidPath) {
                                setPathError(true);
                                setTimeout(() => setPathError(false), 500); // Reset animation state after duration
                                return;
                            }

                            createNote();
                            setCreateNoteDialogOpen(false);
                        }}>
                            Create
                            <Plus size={16} />
                        </Button> : <Button variant="default" className="hover:bg-primary/70" disabled>
                            Create
                            <Plus size={16} />
                        </Button>}

                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SidebarInset>
    );
}