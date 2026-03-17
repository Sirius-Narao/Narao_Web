import { Button } from "@/components/ui/button";
import useTypingTextAnimation from "@/lib/typingTextAnimation";
import { BookOpen, FileText, FolderOpen, MessageCircle } from "lucide-react";
import { useTabs } from "@/context/tabsContext";
import { useFetchedNotes } from "@/context/fetchedNotesContext";
import { Note } from "@/types/folderStructureTypes";
import { useUser } from "@/context/userContext";
import { supabase } from "@/lib/supabaseClient";
import { useContent } from "@/context/contentContext";

export default function PlaceholderTab({ setIsNoteOpened, setAccessedNote }: { setIsNoteOpened: (value: boolean) => void, setAccessedNote: (value: Note) => void }) {
    const headingText = useTypingTextAnimation(["Hey, what would you like to do? ", "Anything to learn or create? ", "Or just a simple chat? ", "I'm getting bored... "], 5000);
    const { openTab } = useTabs();
    const { user } = useUser();
    const { setContent } = useContent();

    const { fetchedNotes } = useFetchedNotes();

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

    return (
        <div className="flex items-center justify-center h-full flex-col">
            <div className="flex flex-col items-center gap-8 bg-popover px-24 py-12 rounded-lg border border-input shadow-lg fade-up ">
                <h1 className="text-3xl font-bold whitespace-pre fade-up">
                    {headingText.slice(0, -1)}
                    <span className="text-primary">{headingText.slice(-1)}</span>
                </h1>

                <div className="flex gap-2">
                    <Button variant="outline" className="rounded-full fade-up cursor-pointer text-lg px-10 py-6" style={{ animationDelay: `100ms` }} onClick={() => openTab({ type: "folder", title: "Folders" })}> <FolderOpen className="w-4 h-4 ml-2" /> <p className="mr-2">Open Folder</p></Button>
                    <Button variant="outline" className="rounded-full fade-up cursor-pointer text-lg px-10 py-6" style={{ animationDelay: `200ms` }} onClick={() => openTab({ type: "note", title: "Notes" })}> <BookOpen className="w-4 h-4 ml-2" /> <p className="mr-2">Open Note</p></Button>
                    <Button variant="outline" className="rounded-full fade-up cursor-pointer text-lg px-10 py-6" style={{ animationDelay: `300ms` }} onClick={() => openTab({ type: "chat", title: "New Chat" })}> <MessageCircle className="w-4 h-4 ml-2" /> <p className="mr-2">New Chat</p></Button>
                </div>

            </div>
            <div className="flex flex-col gap-2 fade-up mt-12 mb-2">
                <p className="text-lg font-medium whitespace-pre fade-up text-muted-foreground">
                    Or get back into something you were working on?
                </p>
            </div>
            <div className="flex gap-2 max-w-[60%] flex-wrap items-center justify-center">
                {fetchedNotes.slice(0, 5).map((note, index) => (
                    <div key={note.id} className="flex items-center gap-2 cursor-pointer fade-up bg-muted-foreground/10 hover:bg-muted-foreground/20 rounded-full px-4 py-2 transition-all duration-200" style={{ animationDelay: `${index * 100}ms` }} onClick={() => openNote(note)}>
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <p className="text-lg font-medium whitespace-pre text-muted-foreground">
                            {note.title}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}