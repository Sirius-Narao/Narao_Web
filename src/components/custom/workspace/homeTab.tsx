import { Button } from "@/components/ui/button";
import useTypingTextAnimation from "@/lib/typingTextAnimation";
import { ArrowUp, BookOpen, FileText, FolderOpen, MessageCircle } from "lucide-react";
import { useTabs } from "@/context/tabsContext";
import { useFetchedNotes } from "@/context/fetchedNotesContext";
import { Note } from "@/types/folderStructureTypes";
import { useUser } from "@/context/userContext";
import { supabase } from "@/lib/supabaseClient";
import { useContent } from "@/context/contentContext";
import { Skeleton } from "@/components/ui/skeleton";
import HomeChatMessageInput from "./homeChatMessageInput";

export default function HomeTab({ setIsNoteOpened, setAccessedNote }: { setIsNoteOpened: (value: boolean) => void, setAccessedNote: (value: Note) => void }) {
    const { openTab, closeTab, activeTabId } = useTabs();
    const { user } = useUser();
    const { setContent } = useContent();

    const { fetchedNotes, loading: notesLoading } = useFetchedNotes();

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
            closeTab(activeTabId!)
            openTab({ type: "note", title: mappedNote.title, noteId: mappedNote.id });
        } else if (error) {
            console.error("Error opening note:", error);
        }
    };

    const mostRecentNotes = () => {
        if (!notesLoading) return null;
        if (fetchedNotes.length === 0) return <p className="text-lg font-medium whitespace-pre text-muted-foreground">No notes found</p>;
        const notes = [...fetchedNotes].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5);
        return notes.map((note, index) => (
            <div key={note.id} className="flex items-center gap-2 cursor-pointer fade-up bg-muted-foreground/10 hover:bg-muted-foreground/20 rounded-full px-4 py-1 transition-all duration-200 md:px-4 md:py-2" style={{ animationDelay: `${index * 100}ms` }} onClick={() => openNote(note)}>
                <FileText className="w-4 h-4 text-muted-foreground" />
                <p className="text-md font-medium whitespace-pre text-muted-foreground md:hidden block">
                    {note.title.length > 15 ? note.title.substring(0, 15).trim() + "..." : note.title}
                </p>
                <p className="text-md font-medium whitespace-pre text-muted-foreground md:block hidden">
                    {note.title}
                </p>
            </div>
        ));
    };

    return (
        <div className="flex items-center justify-center h-full flex-col">
            <div className="flex flex-col items-center md:max-w-2xl w-full py-2 mt-32">


                <div className="relative flex items-center justify-center w-full pt-1 px-1 group">
                    {/* Animated AI Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-folder-blue via-folder-purple to-folder-indigo opacity-25 blur-lg rounded-2xl animate-gradient"></div>

                    {/* Input Container */}
                    <div className="relative z-10 w-full">
                        <HomeChatMessageInput />
                    </div>
                </div>

                {/* <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="default"
                            size="icon"
                            className="h-10 w-10 rounded-full p-0 flex items-center justify-center absolute bottom-4 right-4"
                        >
                            <ArrowUp size={20} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Send Message</p></TooltipContent>
                </Tooltip> */}
            </div>
            <div className="flex flex-col gap-2 fade-up mt-12 mb-2">
                <p className="text-lg break-words font-medium fade-up text-muted-foreground text-center">
                    Or get back into something you were working on?
                </p>
            </div>
            {
                mostRecentNotes() ? <div className="flex gap-2 md:max-w-[60%] max-w-[100%] w-full flex-wrap items-center justify-center mt-2 md:mt-0">
                    {mostRecentNotes()}
                </div> : <div className="flex gap-2 md:max-w-[60%] max-w-[100%] w-full flex-wrap items-center justify-center">
                    <Skeleton className="w-[40%] h-10 rounded-full" />
                    <Skeleton className="w-[30%] h-10 rounded-full" />
                    <Skeleton className="w-[40%] h-10 rounded-full" />
                    <Skeleton className="w-[40%] h-10 rounded-full" />
                    <Skeleton className="w-[40%] h-10 rounded-full" />
                </div>
            }
        </div >
    );
}