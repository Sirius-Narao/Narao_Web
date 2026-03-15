import { Button } from "@/components/ui/button";
import Editor from "./editor";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Note } from "@/types/folderStructureTypes";
import { useUser } from "@/context/userContext";
import { useContent } from "@/context/contentContext";
import { useTabs } from "@/context/tabsContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { ArrowBigDown } from "lucide-react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";

interface NotesTabProps {
    accessedNote: Note | null;
    setAccessedNote: (note: Note | null) => void;
    initialNoteId?: string;
}

export default function NotesTab({ accessedNote, setAccessedNote, initialNoteId }: NotesTabProps) {
    const { user } = useUser();
    const { content, setContent } = useContent();
    const [isSavedComplete, setIsSavedComplete] = useState(true);
    const { activeTabId, updateTabTitle } = useTabs();

    // Sync tab title with note title
    useEffect(() => {
        if (!activeTabId) return;
        updateTabTitle(activeTabId, accessedNote?.title || "Notes");
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

        <div className="flex flex-col relative h-full">
            <div className="flex items-center gap-2 items-center w-full justify-left relative absolute top-0 bg- p-1">
                <div className="w-fit h-fit flex items-center justify-center bg-popover rounded-3xl border border-border p-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" className="max-w-96 text-foreground text-lg truncate">
                                {accessedNote?.title || "New Note"}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Note Title</p></TooltipContent>
                    </Tooltip>
                </div>
                <div className="w-fit h-fit flex items-center justify-center bg-popover rounded-3xl border border-border p-1 absolute right-4">
                    {isSavedComplete ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" className="w-10 h-10 p-0 rounded-full" onClick={saveNote} disabled={content === accessedNote?.content}>
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
        </div>
    );
}
