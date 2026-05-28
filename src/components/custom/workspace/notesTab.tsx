import { Button } from "@/components/ui/button";
import Editor from "./editor";
import { EditorToolbar } from "./editorToolbar";
import { MobileEditorToolbar } from "./mobileEditorToolbar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Note } from "@/types/folderStructureTypes";
import { useUser } from "@/context/userContext";
import { useContent } from "@/context/contentContext";
import { useTabs } from "@/context/tabsContext";
import { useSettings } from "@/context/settingsContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowBigDown, ChevronDown, MoreVertical, Pen, Plus, Trash2 } from "lucide-react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { useFetchedNotes } from "@/context/fetchedNotesContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useFetchedFolders } from "@/context/fetchedFoldersContext";
import { EditorProvider } from "@/context/editorContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BackgroundColor } from "@tiptap/extension-text-style";
import { cn } from "@/lib/utils";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";

interface NotesTabProps {
    accessedNote: Note | null;
    setAccessedNote: (note: Note | null) => void;
    initialNoteId?: string;
}

export default function NotesTab({ accessedNote, setAccessedNote, initialNoteId }: NotesTabProps) {
    const { user } = useUser();
    const { content, setContent } = useContent();
    const [isSavedComplete, setIsSavedComplete] = useState(true);
    // Tracks the last content string that is confirmed saved (in tiptap-serialized form).
    // Using a ref avoids re-renders and prevents the false-dirty state caused by tiptap
    // normalizing the string (e.g. trailing newline) on first render.
    const savedContentRef = useRef<string | null>(null);
    const { activeTabId, updateTabTitle, closeTab, updateTabIsSavedComplete } = useTabs();
    const { setFetchedNotes, fetchedNotes } = useFetchedNotes();
    const { fetchedFolders } = useFetchedFolders();
    const { settings, setSettings } = useSettings();

    // dialog state
    const [createNoteDialogOpen, setCreateNoteDialogOpen] = useState(false);

    // create note state
    const [noteName, setNoteName] = useState("");
    const [noteDescription, setNoteDescription] = useState("");
    const [noteFolder, setNoteFolder] = useState("/");

    // rename note state
    const [isRenamingNote, setIsRenamingNote] = useState(false);
    const [, setRenamingNoteId] = useState<string | null>(null);
    const [tempNoteName, setTempNoteName] = useState(accessedNote?.title || "");

    const [isTagsExpanded, setIsTagsExpanded] = useState(false);
    const [isTagsDialogOpen, setIsTagsDialogOpen] = useState(false);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#3b82f6"); // Default blue

    // Sync tab title with note title
    useEffect(() => {
        if (!activeTabId) return;

        const timer = setTimeout(() => {
            updateTabTitle(activeTabId, accessedNote?.title || "Notes");

            if (!accessedNote && !initialNoteId) {
                setCreateNoteDialogOpen(true);
            }
        }, 0);

        return () => clearTimeout(timer);
    }, [accessedNote?.title, activeTabId, updateTabTitle, initialNoteId]);

    // Sync saved status with tab context
    useEffect(() => {
        if (!activeTabId || !accessedNote) {
            // If no note is accessed, consider it saved (or handle accordingly)
            const timer = setTimeout(() => {
                updateTabIsSavedComplete(activeTabId!, true);
            }, 0);
            return () => clearTimeout(timer);
        }

        // On the very first content update after a note is loaded, tiptap normalizes
        // the string (e.g. adds a trailing newline). We capture that as the saved baseline
        // so it isn't treated as a dirty change.
        if (savedContentRef.current === null) {
            savedContentRef.current = content ?? "";
        }

        // Compare against the savedContentRef baseline, not the raw DB string
        const isActuallySaved = content === savedContentRef.current && isSavedComplete;
        const timer = setTimeout(() => {
            updateTabIsSavedComplete(activeTabId, isActuallySaved);
        }, 0);
        return () => clearTimeout(timer);
    }, [content, accessedNote?.content, activeTabId, isSavedComplete, updateTabIsSavedComplete]);

    // Restore note from initialNoteId on mount
    useEffect(() => {
        if (!initialNoteId || accessedNote?.id === initialNoteId) return;
        const loadNote = async () => {
            const { data, error } = await supabase.from("notes").select("*").eq("id", initialNoteId).single();
            if (data) {
                const mappedNote: Note = {
                    id: String(data.id),
                    title: data.title,
                    description: data.description || "",
                    content: data.content || null,
                    tags: data.tags || [],
                    folder_id: data.folder_id ? String(data.folder_id) : undefined,
                    createdAt: new Date(data.created_at),
                    updatedAt: new Date(data.updated_at)
                };
                // Reset savedContentRef so the first tiptap onUpdate after load
                // is treated as the baseline (not a dirty change).
                savedContentRef.current = null;
                setAccessedNote(mappedNote);
                setContent(mappedNote.content || "");
            }
        };
        loadNote();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialNoteId]);

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
        setFetchedNotes(prev => [...prev, newNote]);
        toast.info(`Created ${newNote.title}`, { position: 'bottom-right' });
        setCreateNoteDialogOpen(false);
    };

    const saveNote = async () => {
        if (!user || !accessedNote) return;
        // Use savedContentRef as the baseline; if null fall back to accessedNote.content
        const baseline = savedContentRef.current ?? accessedNote.content;
        if (content === baseline) return;

        setIsSavedComplete(false);
        const { data, error } = await supabase
            .from("notes")
            .update({ content: content || "" })
            .eq("id", accessedNote.id)
            .select()
            .single();

        if (data) {
            const updatedNote: Note = {
                id: String(data.id),
                title: data.title,
                description: data.description || "",
                content: data.content || "",
                tags: data.tags || [],
                folder_id: data.folder_id ? String(data.folder_id) : undefined,
                createdAt: new Date(data.created_at),
                updatedAt: new Date(data.updated_at)
            };
            toast.info(`Saved ${updatedNote.title} successfully`, { position: 'bottom-right', duration: 1000 });
            // Update the saved baseline to the content we just persisted
            savedContentRef.current = content ?? "";
            setAccessedNote(updatedNote);
        }
        setIsSavedComplete(true);
        if (error) console.error("Error saving note:", error);
    };

    const renameNote = async () => {
        if (!user || !accessedNote) return;
        if (tempNoteName === accessedNote.title) return;

        const { data, error } = await supabase
            .from("notes")
            .update({ title: tempNoteName })
            .eq("id", accessedNote.id)
            .select()
            .single();

        if (data) {
            const updatedNote: Note = {
                id: String(data.id),
                title: data.title,
                description: data.description || "",
                content: data.content || "",
                tags: data.tags || [],
                folder_id: data.folder_id ? String(data.folder_id) : undefined,
                createdAt: new Date(data.created_at),
                updatedAt: new Date(data.updated_at)
            };
            toast.info(`Renamed ${updatedNote.title} successfully`, { position: 'bottom-right' });
            setAccessedNote(updatedNote);
        }
        setIsRenamingNote(false);
        if (error) console.error("Error renaming note:", error);
    };

    const deleteNote = async () => {
        if (!user || !accessedNote) return;
        const { error } = await supabase
            .from("notes")
            .delete()
            .eq("id", accessedNote.id);

        if (error) {
            toast.error(`Error deleting ${accessedNote.title}`, { position: 'bottom-right', duration: 1000 });
            console.error("Error deleting note:", error);
            return;
        }

        toast.info(`Deleted ${accessedNote.title} successfully`, { position: 'bottom-right', duration: 1000 });
        setAccessedNote(null);
        setContent("");
        setFetchedNotes(prev => prev.filter(n => n.id !== accessedNote.id));
        closeTab(activeTabId!);
    };


    // Get all existing tags from settings
    const getAllExistingTags = useCallback(() => {
        // Return tags from settings, or empty array if none
        return (settings.tags || []).sort((a, b) => a.name.localeCompare(b.name));
    }, [settings.tags]);

    // Get available tags (excluding ones already added to current note)
    const getAvailableTags = useCallback(() => {
        const currentTagNames = (accessedNote?.tags || []).map(t => t.name.toLowerCase());
        return getAllExistingTags().filter(tag => 
            !currentTagNames.includes(tag.name.toLowerCase())
        );
    }, [getAllExistingTags, accessedNote?.tags]);


    const handleAddTag = async () => {
        if (!user || !accessedNote || !newTagName || !newTagName.trim()) return;

        const tagName = newTagName.trim();
        const currentTags = accessedNote.tags || [];
        
        if (currentTags.some(t => t.name.toLowerCase() === tagName.toLowerCase())) {
            toast.error("Tag already added", { position: 'bottom-right' });
            return;
        }

        // Check if tag exists in settings
        const existingTagInSettings = (settings.tags || []).find(t => t.name.toLowerCase() === tagName.toLowerCase());
        
        // If tag doesn't exist in settings, add it
        if (!existingTagInSettings) {
            const updatedSettings = {
                ...settings,
                tags: [...(settings.tags || []), { name: tagName, color: newTagColor }]
            };
            setSettings(updatedSettings);
            
            // Save to Supabase
            await supabase
                .from('profiles')
                .update({ settings: updatedSettings })
                .eq('id', user.id);
        }

        const updatedTags = [...currentTags, { name: tagName, color: existingTagInSettings ? existingTagInSettings.color : newTagColor }];

        const { data, error } = await supabase
            .from("notes")
            .update({ tags: updatedTags })
            .eq("id", accessedNote.id)
            .select()
            .single();

        if (data) {
            const updatedNote: Note = {
                ...accessedNote,
                tags: data.tags,
                updatedAt: new Date(data.updated_at)
            };
            setAccessedNote(updatedNote);
            setFetchedNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
            setNewTagName("");
            setNewTagColor("#3b82f6");
            toast.info(`Added tag ${tagName}`, { position: 'bottom-right' });
        }
        if (error) console.error("Error adding tag:", error);
    };

    const handleRemoveTag = async (tagName: string) => {
        if (!user || !accessedNote) return;

        const updatedTags = (accessedNote.tags || []).filter(t => t.name !== tagName);

        const { data, error } = await supabase
            .from("notes")
            .update({ tags: updatedTags })
            .eq("id", accessedNote.id)
            .select()
            .single();

        if (data) {
            const updatedNote: Note = {
                ...accessedNote,
                tags: data.tags,
                updatedAt: new Date(data.updated_at)
            };
            setAccessedNote(updatedNote);
            setFetchedNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
            toast.info(`Removed tag ${tagName}`, { position: 'bottom-right' });
        }
        if (error) console.error("Error removing tag:", error);
    };

    const handleTextTagColor = (color: string) => {
        const hex = color.replace("#", "");
        const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16) || 0;

        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128 ? "text-foreground" : "text-background";
    }

    // useEffect to update accessedNote when fetchedNotes or fetchedFolders changes
    useEffect(() => {
        if (accessedNote) {
            const updatedNote = fetchedNotes.find(n => n.id === accessedNote.id);
            if (updatedNote) {
                setAccessedNote(updatedNote);
            }
        }
    }, [fetchedNotes]);

    // useEffect to saveNote every 10 seconds if there are unsaved changes
    useEffect(() => {
        if (!accessedNote) return;
        const interval = setInterval(() => {
            const baseline = savedContentRef.current ?? accessedNote.content;
            if (content !== baseline) {
                saveNote();
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [saveNote, accessedNote, content]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === "s" && accessedNote) {
                e.preventDefault();
                saveNote();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [accessedNote, saveNote]);

    return (
        <EditorProvider>
            <div className="flex flex-col relative h-full">
                <div className="flex items-center justify-between w-full relative p-1 sticky top-0 z-10">
                    {/* Title pill */}
                    <div className="w-fit h-fit flex items-center justify-center bg-popover rounded-3xl border border-border p-1 shrink-0">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                {isRenamingNote ? <Input
                                    value={tempNoteName}
                                    onChange={(e) => setTempNoteName(e.target.value)}
                                    onBlur={() => setIsRenamingNote(false)}
                                    autoFocus
                                    maxLength={40}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") { setIsRenamingNote(false); renameNote(); }
                                        if (e.key === "Escape") setIsRenamingNote(false);
                                    }}
                                    className="text-center border-none shadow-none text-base! md:text-lg! font-medium focus-visible:ring-0 w-full bg-transparent! w-[364px]"
                                /> :
                                    <Button variant="ghost" className="max-w-96 text-foreground text-base md:text-lg truncate" onClick={() => { setRenamingNoteId(accessedNote?.id || null), setIsRenamingNote(true) }}>
                                        {accessedNote?.title || "New Note"}
                                    </Button>}
                            </TooltipTrigger>
                            <TooltipContent><p>Note Title</p></TooltipContent>
                        </Tooltip>
                    </div>

                    {/* Formatting toolbar — centered between title and save (hidden on mobile) */}
                    <div className="hidden md:flex flex-1 justify-center">
                        <EditorToolbar />
                    </div>

                    {/* Save button pill */}
                    <div className="w-fit h-fit flex items-center justify-center bg-popover rounded-3xl border border-border p-1 shrink-0 gap-1">
                        {isSavedComplete ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" className="w-9 h-9 p-0 rounded-full disabled:opacity-50 disabled:text-muted-foreground text-primary" onClick={saveNote} disabled={content === (savedContentRef.current ?? accessedNote?.content)}>
                                        <ArrowBigDown size={14} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="flex items-center gap-2">
                                    <p>Save</p>
                                    <KbdGroup className="hidden sm:inline-flex"><Kbd>Ctrl + S</Kbd></KbdGroup>
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <div className="w-10 h-10 flex items-center justify-center"><Spinner /></div>
                        )}
                        <DropdownMenu>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="w-9 h-9 p-0 rounded-full text-foreground">
                                            <MoreVertical size={14} />
                                        </Button>
                                    </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Note Settings</p>
                                </TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent align="end" className="w-fit h-fit rounded-lg max-w-40">
                                <div className="flex flex-col p-2 bg-card rounded-lg border border-border group-dropdown hover:bg-card/70 cursor-pointer transition-all duration-100 relative" onClick={() => setIsTagsExpanded(!isTagsExpanded)}>
                                    <p className="px-1 text-muted-foreground text-sm">Tags:</p>
                                    <ChevronDown className={cn("absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-transform duration-200", isTagsExpanded && "rotate-180")} />
                                    <AnimatePresence>
                                        {isTagsExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                                className="overflow-hidden mt-1"
                                            >
                                                <div className="flex flex-wrap gap-1 max-h-64 overflow-hidden relative " onClick={(e) => e.stopPropagation()}>
                                                    {fetchedNotes.find(f => f.id === accessedNote?.id)?.tags?.map((tag, i) => (
                                                        <Tooltip key={i + 'tag'} delayDuration={200}>
                                                            
                                                                <motion.div
                                                                    key={i}
                                                                    initial="initial"
                                                                    whileHover="hover"
                                                                    className="rounded-full flex items-center px-3 py-1 hover:opacity-90 transition-all group overflow-hidden h-6 relative hover:pr-7 cursor-default"
                                                                    style={{ backgroundColor: tag.color }}
                                                                >
                                                                    <span className={cn("text-xs font-medium whitespace-nowrap", handleTextTagColor(tag.color))}>
                                                                        {tag.name}
                                                                    </span>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            onClick={() => handleRemoveTag(tag.name)}
                                                                            className="absolute right-0 w-6 h-6 p-0 rounded-full opacity-0 group-hover:opacity-100 dark:hover:bg-card/60 hover:bg-secondary transition-all duration-100 scale-90 cursor-pointer"
                                                                        >
                                                                            <Trash2 />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{`Remove ${tag.name}`}</p>
                                                                    </TooltipContent>
                                                                </motion.div>
                                                            
                                                        </Tooltip>
                                                    ))}
                                                </div>
                                                <div className="rounded-lg flex items-center px-3 py-1 hover:bg-muted cursor-pointer text-xs bg-popover transition-all duration-100 w-full items-center justify-center gap-1 mt-4" onClick={() => setIsTagsDialogOpen(true)}> Add <Plus size={14} /></div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                {/* <Button variant="ghost" className="rounded-lg w-full px-2 py-1 justify-start" onClick={() => { setRenamingNoteId(accessedNote?.id || null), setIsRenamingNote(true) }}>
                                    <Pen size={16} />Rename
                                </Button> */}
                                <Button variant="ghost" className="rounded-lg w-full px-2 py-1 justify-start" onClick={() => { setRenamingNoteId(accessedNote?.id || null), setIsRenamingNote(true) }}>
                                    <Pen size={16} />Rename
                                </Button>
                                <Button variant="ghost" className="rounded-lg text-destructive w-full hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/10 px-2 py-1 justify-start" onClick={deleteNote}>
                                    <Trash2 size={16} />Delete
                                </Button>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                {/* Mobile toolbar that appears above keypad */}
                <MobileEditorToolbar />
                <div 
                    className="flex-1 overflow-hidden" 
                    data-quote-source={accessedNote?.title || "New Note"}
                    data-quote-type="note"
                >
                    <Editor />
                </div>
                {/* Create Note Dialog */}
                <Dialog open={createNoteDialogOpen} onOpenChange={(open) => {
                    setCreateNoteDialogOpen(open);
                    if (!open && !accessedNote && activeTabId) {
                        closeTab(activeTabId);
                    }
                }}>
                    <DialogContent showCloseButton={false} className="w-[40%]">
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
                            <Button variant="ghost" onClick={() => { setCreateNoteDialogOpen(false), closeTab(activeTabId!) }}>Cancel</Button>
                            <Button onClick={createNote} disabled={!noteName.trim()}>Create Note</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Dialog for adding tags */}
                <Dialog open={isTagsDialogOpen} onOpenChange={setIsTagsDialogOpen}>
                    <DialogContent showCloseButton={false} className="min-w-[400px] w-[40%]">
                        <DialogHeader>
                            <DialogTitle>Manage Tags</DialogTitle>
                            <DialogDescription>Add or delete tags for this note.</DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-col gap-4 py-4">
                            <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-lg border border-border bg-muted/30">
                                {accessedNote?.tags?.length === 0 && <p className="text-sm text-muted-foreground italic text-center w-full">No tags added yet.</p>}
                                {accessedNote?.tags?.map((tag, i) => (
                                    <motion.div
                                        key={i}
                                        initial="initial"
                                        whileHover="hover"
                                        className="rounded-full flex items-center px-3 py-1 hover:opacity-90 transition-all group cursor-pointer overflow-hidden h-6 relative hover:pr-7"
                                        style={{ backgroundColor: tag.color }}
                                        onClick={() => handleRemoveTag(tag.name)}
                                    >
                                        <span className={cn("text-xs font-medium whitespace-nowrap", handleTextTagColor(tag.color))}>
                                            {tag.name}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            onClick={() => handleRemoveTag(tag.name)}
                                            className="absolute right-0 w-6 h-6 p-0 rounded-full opacity-0 group-hover:opacity-100 dark:hover:bg-card/60 hover:bg-secondary transition-all duration-100 scale-90 cursor-pointer"
                                        >
                                            <Trash2 />
                                        </Button>
                                    </motion.div>
                                ))}
                            </div>

                            <div className="flex flex-col gap-3">
                                <Field className="gap-1.5">
                                    <FieldLabel>Tag Name</FieldLabel>
                                    <Combobox
                                        value={newTagName || ""}
                                        onValueChange={(value) => {
                                            if (value === null || value === undefined) return;
                                            setNewTagName(value);
                                            // If selecting an existing tag, also set its color
                                            const existingTag = getAllExistingTags().find(t => t.name === value);
                                            if (existingTag) {
                                                setNewTagColor(existingTag.color);
                                            }
                                        }}
                                    >
                                        <ComboboxInput
                                            placeholder="Enter or select tag name..."
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddTag();
                                                }
                                            }}
                                            maxLength={20}
                                        />
                                        <ComboboxContent>
                                            {getAvailableTags().length === 0 ? (
                                                <ComboboxEmpty>No available tags</ComboboxEmpty>
                                            ) : (
                                                <ComboboxList>
                                                    {getAvailableTags().map((tag) => (
                                                        <ComboboxItem key={tag.name} value={tag.name}>
                                                            <div className="flex items-center gap-2">
                                                                <div 
                                                                    className="w-3 h-3 rounded-full"
                                                                    style={{ backgroundColor: tag.color }}
                                                                />
                                                                {tag.name}
                                                            </div>
                                                        </ComboboxItem>
                                                    ))}
                                                </ComboboxList>
                                            )}
                                        </ComboboxContent>
                                    </Combobox>
                                </Field>

                                <Field className="gap-1.5">
                                    <FieldLabel>Color</FieldLabel>
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-wrap gap-1.5 flex-1">
                                            {["#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#71717a"].map((color) => (
                                                <button
                                                    key={color}
                                                    className={cn(
                                                        "w-6 h-6 rounded-full border-2 transition-all cursor-pointer",
                                                        newTagColor === color ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                                                    )}
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => setNewTagColor(color)}
                                                />
                                            ))}
                                        </div>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="relative w-10 h-10 rounded-full border border-border overflow-hidden shrink-0 cursor-pointer">
                                                    <input
                                                        type="color"
                                                        value={newTagColor}
                                                        onChange={(e) => setNewTagColor(e.target.value)}
                                                        className="absolute -inset-2 w-[200%] h-[200%] cursor-pointer"
                                                    />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Select custom color
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                </Field>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <Button variant="ghost" onClick={() => setIsTagsDialogOpen(false)}>Close</Button>
                            <Button onClick={handleAddTag} disabled={!newTagName.trim()} style={{ backgroundColor: newTagColor }} className={cn("hover:opacity-80", handleTextTagColor(newTagColor))}>
                                <Plus size={16} className="mr-1" /> Add Tag
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </EditorProvider>
    );
}
