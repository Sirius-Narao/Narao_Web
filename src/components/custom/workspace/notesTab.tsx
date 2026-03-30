import { Button } from "@/components/ui/button";
import Editor from "./editor";
import { EditorToolbar } from "./editorToolbar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Note } from "@/types/folderStructureTypes";
import { useUser } from "@/context/userContext";
import { useContent } from "@/context/contentContext";
import { useTabs } from "@/context/tabsContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowBigDown } from "lucide-react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { useFetchedNotes } from "@/context/fetchedNotesContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { useFetchedFolders } from "@/context/fetchedFoldersContext";
import { EditorProvider } from "@/context/editorContext";

interface NotesTabProps {
    accessedNote: Note | null;
    setAccessedNote: (note: Note | null) => void;
    initialNoteId?: string;
}

export default function NotesTab({ accessedNote, setAccessedNote, initialNoteId }: NotesTabProps) {
    const { user } = useUser();
    const { content, setContent } = useContent();
    const [isSavedComplete, setIsSavedComplete] = useState(true);
    const { activeTabId, updateTabTitle, closeTab } = useTabs();
    const { setFetchedNotes } = useFetchedNotes();
    const { fetchedFolders } = useFetchedFolders();

    // dialog state
    const [createNoteDialogOpen, setCreateNoteDialogOpen] = useState(false);

    // create note state
    const [noteName, setNoteName] = useState("");
    const [noteDescription, setNoteDescription] = useState("");
    const [noteFolder, setNoteFolder] = useState("/");

    // rename note state
    const [isRenamingNote, setIsRenamingNote] = useState(false);
    const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
    const [tempNoteName, setTempNoteName] = useState(accessedNote?.title || "");

    // Sync tab title with note title
    useEffect(() => {
        if (!activeTabId) return;
        updateTabTitle(activeTabId, accessedNote?.title || "Notes");

        if (!accessedNote) {
            setCreateNoteDialogOpen(true);
        }
    }, [accessedNote?.title, activeTabId]);

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
        if (content === accessedNote.content) return;

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
            toast.info(`Saved ${updatedNote.title} successfully`, { position: 'bottom-right' });
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
                <div className="flex items-center gap-2 w-full relative p-1 sticky top-0 z-10">
                    {/* Title pill */}
                    <div className="w-fit h-fit flex items-center justify-center bg-popover rounded-3xl border border-border p-1 shrink-0">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                {isRenamingNote ? <Input
                                    value={tempNoteName}
                                    onChange={(e) => setTempNoteName(e.target.value)}
                                    onBlur={() => setIsRenamingNote(false)}
                                    autoFocus
                                    maxLength={50}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") { setIsRenamingNote(false); renameNote(); }
                                        if (e.key === "Escape") setIsRenamingNote(false);
                                    }}
                                    className="text-center border-none shadow-none text-lg! font-medium focus-visible:ring-0 w-full bg-transparent! w-[364px]"
                                /> :
                                    <Button variant="ghost" className="max-w-96 text-foreground text-lg truncate" onClick={() => { setRenamingNoteId(accessedNote?.id || null), setIsRenamingNote(true) }}>
                                        {accessedNote?.title || "New Note"}
                                    </Button>}
                            </TooltipTrigger>
                            <TooltipContent><p>Note Title</p></TooltipContent>
                        </Tooltip>
                    </div>

                    {/* Formatting toolbar — centered between title and save */}
                    <div className="flex-1 flex justify-center">
                        <EditorToolbar />
                    </div>

                    {/* Save button pill */}
                    <div className="w-fit h-fit flex items-center justify-center bg-popover rounded-3xl border border-border p-1 shrink-0">
                        {isSavedComplete ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" className="w-10 h-10 p-0 rounded-full disabled:opacity-50 disabled:text-muted-foreground text-primary" onClick={saveNote} disabled={content === accessedNote?.content}>
                                        <ArrowBigDown size={24} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="flex items-center gap-2">
                                    <p>Save</p>
                                    <KbdGroup><Kbd>Ctrl + S</Kbd></KbdGroup>
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            <div className="w-10 h-10 flex items-center justify-center"><Spinner /></div>
                        )}
                    </div>
                </div>
                <Editor />
                {/* Create Note Dialog */}
                <Dialog open={createNoteDialogOpen} onOpenChange={(open) => {
                    setCreateNoteDialogOpen(open);
                    if (!open && !accessedNote && activeTabId) {
                        closeTab(activeTabId);
                    }
                }}>
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
                            <Button variant="outline" onClick={() => { setCreateNoteDialogOpen(false), closeTab(activeTabId!) }}>Cancel</Button>
                            <Button onClick={createNote} disabled={!noteName.trim()}>Create Note</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </EditorProvider>
    );
}
