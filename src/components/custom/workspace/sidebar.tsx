'use client'

import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import Image from "next/image";
import { User, Settings as SettingsIcon, X, Sun, Bot, Tags, ArrowUpLeft, Coins, InboxIcon, ChevronDown, CircleOff, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { useCallback, useEffect, useState } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { supabase } from "@/lib/supabaseClient";
import ProfileType from "@/types/profileType";
import { Skeleton } from "@/components/ui/skeleton";
import AnnounceType from "@/types/announceType";
import { useSettingsOpen } from "@/context/settingOpenContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Language, Settings, Theme } from "@/types/settingsType";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/context/settingsContext";
import { useUser } from "@/context/userContext";
import ReviewItem from "./reviewItem";
import { ReviewItemType } from "@/types/reviewItemType";
import { useFetchedNotes } from "@/context/fetchedNotesContext";
import { useFetchedFolders } from "@/context/fetchedFoldersContext";
import { Folder, Note } from "@/types/folderStructureTypes";
import { useReviews } from "@/context/reviewContext";
import { LanguageMultiSelect } from "./languageMultiSelect";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function SidebarArea() {
    const [userAuth, setUserAuth] = useState<any>(null);
    const [user, setUser] = useState<ProfileType | null>(null);
    const [announce, setAnnounce] = useState<AnnounceType | null>(null);
    const [announceFetched, setAnnounceFetched] = useState(false);
    const [showAnnounce, setShowAnnounce] = useState(true);
    const { state, setOpen } = useSidebar();
    const [settingsTab, setSettingsTab] = useState(0);
    const { settingsOpen, setSettingsOpen } = useSettingsOpen();

    // settings state
    const { settings, setSettings } = useSettings();
    const [tempSettings, setTempSettings] = useState<Settings>(settings);

    // Global user context — chatMessageInput optimistically updates credits_left here
    // after each message, so we read from it for the credits display.
    const { user: globalUser, setUser: setGlobalUser } = useUser();

    const [tempPseudo, setTempPseudo] = useState("");

    // Inbox expand state
    const [inboxExpanded, setInboxExpanded] = useState(true);

    // reviews state
    const { reviews, setReviews } = useReviews();

    // fetched notes and folders state
    const { fetchedNotes, setFetchedNotes } = useFetchedNotes();
    const { fetchedFolders, setFetchedFolders } = useFetchedFolders();

    // tags management state
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#3b82f6");
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [tagToDelete, setTagToDelete] = useState<{ name: string; color: string } | null>(null);

    // auth fetch
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
            const { data: profiles, error } = await supabase
                .from('profiles')         // your table name
                .select('*')          // select all columns
                .eq('id', userAuth.id) // select only the user's profile

            if (error) {
                console.error(error);
            }
            setUser(profiles?.[0]);
            setTempPseudo(profiles?.[0].username || "");
            const loadedSettings = profiles?.[0].settings || {
                theme: "system",
                language: "en",
                customInstructions: {
                    aboutUser: "",
                    customPrompt: "",
                },
                enableTools: true,
                plan: "free",
                aiName: "Narao AI",
                tags: [],
            };
            setSettings(loadedSettings);
            setTempSettings(loadedSettings);
            // Seed the global user context with the initial credits_left so
            // chatMessageInput can start deducting from the correct baseline.
            setGlobalUser(prev => prev
                ? { ...prev, credits_left: profiles?.[0]?.credits_left ?? prev.credits_left }
                : { id: profiles?.[0]?.id, username: profiles?.[0]?.username, created_at: profiles?.[0]?.created_at, credits_left: profiles?.[0]?.credits_left ?? 0 }
            );
        };
        fetchUsers();
    }, [userAuth]);
    // Fetch announces data
    useEffect(() => {
        const fetchAnnounces = async () => {
            const { data: announces, error } = await supabase
                .from('announces')         // your table name
                .select('*')          // select all columns
                .order('created_at', { ascending: false })
                .limit(1);            // select only the last announce

            if (error) {
                console.error(error);
            }
            setAnnounce(announces?.[0]);
            setAnnounceFetched(true);
        };
        fetchAnnounces();
    }, []);
    // Fetch reviews data
    useEffect(() => {
        let ignore = false;
        const fetchReviews = async () => {
            if (!user?.id) return;

            const { data: reviews, error } = await supabase
                .from('review_items')         // your table name
                .select('*')          // select all columns
                .eq('user_id', user.id);

            if (error) {
                console.error(error);
            }
            // Map snake_case DB columns to camelCase JS properties
            const mapped: ReviewItemType[] = (reviews ?? []).map((r: any) => ({
                id: r.id,
                title: r.title,
                query: r.query,
                createdAt: new Date(r.created_at || r.createdAt || new Date()),
                importance: r.importance,
                type: r.type,
                location: r.location,
                chatId: r.chat_id || r.chatId,
            }));
            if (!ignore) {
                setReviews(mapped);
            }
        };
        fetchReviews();
        return () => {
            ignore = true;
        };
    }, [user]);
    // update settings
    const updateSettings = async () => {
        if (!user) return;
        const { error } = await supabase
            .from('profiles')
            .update({ settings: tempSettings })
            .eq('id', user.id);

        const { error: error2 } = await supabase
            .from('profiles')
            .update({ username: tempPseudo })
            .eq('id', user.id);

        if (error) {
            console.error(error);
        }
        if (error2) {
            console.error(error2);
        }
        setSettings(tempSettings);
        setUser(prev => prev ? { ...prev, username: tempPseudo } : null);
    };

    // helper to format credits_left
    const formatCredits = (credits: number) => {
        if (credits >= 1000) {
            return (credits / 1000).toFixed(1) + "k";
        }
        return credits;
    };

    // ----------------- Helper functions for tag management ----------------- 
    // Get all unique tags from settings with their counts from notes
    const getAllTagsWithCounts = useCallback(() => {
        const tagMap = new Map<string, { name: string; color: string; count: number }>();

        // First, add all tags from settings
        if (settings.tags) {
            settings.tags.forEach(tag => {
                const key = tag.name.toLowerCase();
                if (!tagMap.has(key)) {
                    tagMap.set(key, { name: tag.name, color: tag.color, count: 0 });
                }
            });
        }

        // Then, count how many notes use each tag
        fetchedNotes.forEach(note => {
            if (note.tags) {
                note.tags.forEach(tag => {
                    const key = tag.name.toLowerCase();
                    if (tagMap.has(key)) {
                        tagMap.get(key)!.count += 1;
                    } else {
                        // If a tag exists in notes but not in settings, add it
                        tagMap.set(key, { name: tag.name, color: tag.color, count: 1 });
                    }
                });
            }
        });

        return Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
    }, [fetchedNotes, settings.tags]);

    // Handle text color based on tag background color
    const handleTextTagColor = (color: string) => {
        const hex = color.replace("#", "");
        const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16) || 0;
        const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16) || 0;
        const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16) || 0;
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? "text-black" : "text-white";
    };

    // Create a new tag and save to settings
    const handleCreateTag = async () => {
        if (!user || !newTagName || !newTagName.trim()) return;

        // Check if tag already exists
        const existingTags = getAllTagsWithCounts();
        if (existingTags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
            toast.error("Tag already exists", { position: 'bottom-right' });
            return;
        }

        const newTag = { name: newTagName.trim(), color: newTagColor };

        // Add the new tag to settings
        const updatedSettings = {
            ...settings,
            tags: [...(settings.tags || []), newTag]
        };
        setSettings(updatedSettings);
        setTempSettings(updatedSettings);

        // Save to Supabase
        await supabase
            .from('profiles')
            .update({ settings: updatedSettings })
            .eq('id', user.id);

        setNewTagName("");
        setNewTagColor("#3b82f6");
        toast.info(`Tag ${newTag.name} created. You can now add it to notes.`, { position: 'bottom-right' });
    };

    // Delete a tag from all notes and settings
    const handleDeleteTag = async (tagName: string) => {
        if (!user) return;

        // Find all notes with this tag and remove it
        const notesToUpdate = fetchedNotes.filter(note =>
            note.tags?.some(t => t.name.toLowerCase() === tagName.toLowerCase())
        );

        for (const note of notesToUpdate) {
            const updatedTags = note.tags!.filter(t => t.name.toLowerCase() !== tagName.toLowerCase());
            await supabase
                .from("notes")
                .update({ tags: updatedTags })
                .eq("id", note.id);
        }

        // Update local notes state
        setFetchedNotes(prev => prev.map(note => {
            if (note.tags?.some(t => t.name.toLowerCase() === tagName.toLowerCase())) {
                return {
                    ...note,
                    tags: note.tags.filter(t => t.name.toLowerCase() !== tagName.toLowerCase())
                };
            }
            return note;
        }));

        // Remove from settings
        const updatedSettings = {
            ...settings,
            tags: (settings.tags || []).filter(t => t.name.toLowerCase() !== tagName.toLowerCase())
        };
        setSettings(updatedSettings);
        setTempSettings(updatedSettings);

        // Save to Supabase
        await supabase
            .from('profiles')
            .update({ settings: updatedSettings })
            .eq('id', user.id);

        setIsDeleteConfirmOpen(false);
        setTagToDelete(null);
        toast.info(`Tag ${tagName} deleted from all notes`, { position: 'bottom-right' });
    };


    // ----------------- Helper functions for folder and note paths ----------------- 
    const getFolderPath = useCallback((folderId: string): string => {
        const folder = fetchedFolders.find(f => f.id === folderId);
        if (!folder) return "/";
        if (!folder.parent_id) return `/${folder.name}`;
        return `${getFolderPath(folder.parent_id)}/${folder.name}`;
    }, [fetchedFolders]);
    const getNotePath = (noteId: string): string => {
        const note = fetchedNotes.find(n => n.id === noteId);
        if (!note || !note.folder_id) return "/";
        return getFolderPath(note.folder_id);
    };
    // note json to readable text
    const noteJsonToReadableText = (note: Note) => {
        let text = "Note: ";
        text += note.title + "\n";
        text += "Content: " + note.content + "\n";
        text += "Path: " + getNotePath(note.id);
        return text;
    };
    // folder json to readable text
    const folderJsonToReadableText = (folder: Folder) => {
        let text = "Folder: ";
        text += folder.name + "\n";
        text += "Path: " + getFolderPath(folder.id) + "\n";
        text += "Notes in this folder: " + (fetchedNotes.filter(note => note.folder_id === folder.id).length > 0 ? fetchedNotes.filter(note => note.folder_id === folder.id).map(note => note.title).join(", ") : "None") + "\n";
        text += "Folders in this folder: " + (fetchedFolders.filter(f => f.parent_id === folder.id).length > 0 ? fetchedFolders.filter(f => f.parent_id === folder.id).map(f => f.name).join(", ") : "None") + "\n";
        return text;
    };
    // function to decide randomly which note/folder to review and return it as a string with their content using noteJsonToReadableText and folderJsonToReadableText
    const decideWhichToReview = () => {
        const notes = fetchedNotes.filter(note => !note.is_reviewed);
        const folders = fetchedFolders.filter(folder => !folder.is_reviewed);
        const notesToReview = notes.length;
        const foldersToReview = folders.length;
        const totalToReview = notesToReview + foldersToReview;
        const random = Math.random() * totalToReview;
        if (random < notesToReview) {
            return { note: notes[Math.floor(random)], text: noteJsonToReadableText(notes[Math.floor(random)]) };
        } else {
            return { folder: folders[Math.floor(random - notesToReview)], text: folderJsonToReadableText(folders[Math.floor(random - notesToReview)]) };
        }
    };

    // ----------------- Function for fetching AI reviews using the API ----------------- 
    const fetchAIReviews = async () => {
        if (!user) return;
        if (fetchedNotes.length === 0 && fetchedFolders.length === 0) return;

        const reviewElement = decideWhichToReview();
        if (!reviewElement) return;
        console.log("Fetching AI reviews...");
        console.log(reviewElement);
        // 1. Call the API just like normal
        const response = await fetch("/api/chat/review-gemini-3.1-flash-lite-preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                systemPrompt: "You review workspace notes of plain text and folders. Make your reviews user friendly and easy to understand. Do not consider this workspace as a codespace. Analyze the content to find typos, unclear phrasing, structural issues, and improvement opportunities. Suggest concise, actionable fixes. Ask relevant questions only if they help improve clarity, completeness, or future usefulness. Focus on high-value insights. Avoid obvious or low-impact comments. Be precise, structured, and concise in all outputs. Adapt to the context (note or folder, content type, and path). Use available workspace memory if provided to improve relevance. Output only structured review items. If no meaningful issues, suggestions, or questions are found, return nothing. Aim to continuously refine understanding of the workspace to improve future reviews. Also match the language of the note or folder. Always give an example of how you would improve the note or folder. Do not use the word README.md in your response." + (user.workspace_memory ? "\n\n" + "Workspace memory: " + user.workspace_memory : ""),
                userInput: "Give me a single review for this note: " + reviewElement.text
            }),
        });

        if (!response.ok) {
            console.error("Review generation failed");
            return;
        }

        // 2. Parse the fetch response 
        const data = await response.json();
        // Under the hood, data.content is a raw JSON string that perfectly matches our schema

        // 3. Parse the structured output back into a javascript object
        const structuredData = JSON.parse(data.content);

        if (!structuredData.reviews) {
            console.error("No reviews found in the response");
            return;
        }
        // 4. Use it directly! 
        // structuredData.reviews is guaranteed to be an array formatted perfectly for ReviewItemType
        console.log(`Found ${structuredData.reviews.length} reviews.`);
        structuredData.reviews.forEach((review) => {
            console.log(`[${review.type.toUpperCase()}] ${review.title}`);
            console.log(`Location: ${review.location}\n`);
            console.log(`Importance: ${review.importance}\n`);
            console.log(`Query context: "${review.query}"\n`);
        });

        if (structuredData.reviews.length === 0) {
            return;
        }

        // 5. We skip chat creation here. 
        // It will be created when the user clicks on the review item in reviewItem.tsx

        // 6. We also skip message creation and credit deduction here.
        // These will also happen when the user clicks on the review item.

        // 8. Save the reviews to the database WITHOUT the chat_id for now
        const payload = structuredData.reviews.map((review: ReviewItemType) => ({
            title: review.title,
            query: review.query,
            importance: review.importance,
            type: review.type,
            location: review.location,
            user_id: user.id,
            // chat_id: newChat.id, // Removed
        }));
        const { data: insertedReviews, error } = await supabase
            .from('review_items')
            .insert(payload)
            .select();

        if (error) {
            console.error("Error saving reviews:", error);
            return;
        }

        // 8. Mark the reviewed note/folder as reviewed
        if (reviewElement.note) {
            const { error } = await supabase
                .from('notes')
                .update({ is_reviewed: true })
                .eq('id', reviewElement.note.id);
            if (error) {
                console.error("Error marking note as reviewed:", error);
            }
        } else {
            const { error } = await supabase
                .from('folders')
                .update({ is_reviewed: true })
                .eq('id', reviewElement.folder.id);
            if (error) {
                console.error("Error marking folder as reviewed:", error);
            }
        }

        // 9. Update the local state
        if (reviewElement.note) {
            setFetchedNotes(fetchedNotes.map(note => note.id === reviewElement.note.id ? { ...note, is_reviewed: true } : note));
        } else {
            setFetchedFolders(fetchedFolders.map(folder => folder.id === reviewElement.folder.id ? { ...folder, is_reviewed: true } : folder));
        }

        // 10. Update the local reviews state with proper camelCase mapping
        if (insertedReviews) {
            const mappedInserted: ReviewItemType[] = insertedReviews.map((r: any) => ({
                id: r.id,
                title: r.title,
                query: r.query,
                createdAt: new Date(r.created_at || new Date()),
                importance: r.importance,
                type: r.type,
                location: r.location,
                chatId: r.chat_id || r.chatId || null,
            }));
            setReviews(prev => {
                const existingIds = new Set(prev.map(r => r.id));
                const newReviews = mappedInserted.filter(r => !existingIds.has(r.id));
                return [...prev, ...newReviews];
            });
        }

        return insertedReviews;
    };

    // Fetch AI reviews each 10 minutes when the user is active
    useEffect(() => {
        // Check if there are any notes or folders that are not reviewed
        const unreviewedItems = [...fetchedNotes, ...fetchedFolders].filter(item => !item.is_reviewed);
        if (unreviewedItems.length === 0) return;
        if (!user) return;
        const interval = setInterval(() => {
            fetchAIReviews();
        }, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user, fetchedNotes, fetchedFolders, reviews]);

    return (
        <Sidebar variant="inset" className="bg-transparent">
            {/* --------------------------- Header --------------------------- */}
            <SidebarHeader className="px-0 md:pt-1">
                <header className="flex items-center p-0 group-data-[state=collapsed]:px-1">
                    {/* Logo and Narao text */}
                    <div className={cn(
                        "flex items-center gap-2 w-fit min-w-10 border border-sidebar-border rounded-full p-1 px-4 bg-card",
                        "group-data-[state=collapsed]:h-10 group-data-[state=collapsed]:p-2 group-data-[state=collapsed]:opacity-0"
                    )}>
                        <Image src="/favicon.ico" alt="Logo" width={24} height={24} className="group-data-[state=collapsed]:hidden transition-all duration-200" />
                        <span className="text-xl font-bold font-serif transition-all duration-200 group-data-[state=collapsed]:hidden">
                            Narao
                        </span>
                    </div>
                </header>
            </SidebarHeader>
            <Tooltip>
                <TooltipTrigger asChild>
                    <SidebarTrigger className="absolute top-4 right-3.5 md:top-3" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="flex items-center gap-2">
                    <p>{state === "collapsed" ? "Open" : "Close"}</p>
                    <KbdGroup className="hidden sm:inline-flex">
                        <Kbd className="bg-popover text-foreground">Ctrl + B</Kbd>
                    </KbdGroup>
                </TooltipContent>
            </Tooltip>


            {/* --------------------------- Content --------------------------- */}
            <SidebarContent className="overflow-hidden pt-1.5 relative justify-start">
                {/* New feature: AI reviews */}
                {state === "collapsed" ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="flex items-center justify-center p-3 bg-card rounded-full border border-sidebar-border w-fit h-fit mx-auto transition-all duration-200 relative absolute top-1 left-1"
                                onClick={() => { setOpen(true); setInboxExpanded(true) }}
                            >
                                <InboxIcon className="h-6 w-6" />
                                {reviews.length > 0 && <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="flex items-center gap-2">
                            <p>Open Inbox</p>
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    <div className={cn("flex flex-col items-center justify-center w-full gap-2 p-2 py-2 rounded-lg border border-sidebar-border transition-all duration-200 text-left justify-start bg-card transition-all duration-200", !inboxExpanded && "rounded-xl")}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" className="flex items-center justify-between w-full border border-border p-2 rounded-lg bg-popover gap-2 transition-all duration-200" onClick={() => { setInboxExpanded(!inboxExpanded) }}>
                                    <div className="flex items-center gap-2">
                                        <InboxIcon className="h-6 w-6" />
                                        <p className="text-sm font-medium w-full ">Inbox <span className="text-xs text-primary">Beta</span></p>
                                        <p className="text-xs text-muted-foreground p-2 py-0 rounded-full bg-primary/10 text-primary border border-primary/20">
                                            {reviews.length > 99 ? "99+" : reviews.length}
                                        </p>
                                    </div>
                                    <ChevronDown className={cn("h-6 w-6 transition-all duration-200", inboxExpanded && "rotate-180")} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="flex items-center gap-2">
                                <p>{inboxExpanded ? "Close" : "Open"} Inbox</p>
                            </TooltipContent>
                        </Tooltip>
                        <AnimatePresence>
                            {inboxExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }}
                                    className="w-full overflow-hidden"
                                >
                                    <div className="flex items-center gap-1 flex-col w-full overflow-auto max-h-124 scrollbar-hide! scrollbar-no-bg!">
                                        {reviews.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center w-full h-full p-4 gap-2">
                                                <CircleOff className="h-12 w-12 text-muted-foreground" />
                                                <p className="text-sm text-muted-foreground italic">No reviews yet.</p>
                                            </div>
                                        ) : (
                                            [...reviews].sort((a, b) => a.importance - b.importance).map((review, index) => (
                                                <ReviewItem key={review.id} review={review} index={index} />
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </SidebarContent>


            {/* --------------------------- Footer --------------------------- */}
            <SidebarFooter className=" p-0 group-data-[state=collapsed]:pl-1 transition-all duration-200">
                <AnimatePresence>
                    {announceFetched ? announce && showAnnounce && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.75 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{
                                opacity: 0,
                                y: 20,
                                scale: 0.75,
                                transition: { duration: 0.2, ease: "easeInOut" }
                            }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="group-data-[state=collapsed]:hidden"
                        >
                            <Card className="p-4 pt-6 gap-2 border-sidebar-border bg-card shadow-none">
                                <CardHeader className="p-0 m-0">
                                    <CardTitle className="text-sm font-semibold">{announce?.title}</CardTitle>
                                    <CardDescription className="text-xs">{announce?.description}</CardDescription>
                                </CardHeader>
                                <CardFooter className="p-0 flex items-center justify-between mt-2">
                                    <Button variant="link" className="w-fit h-fit p-0 text-xs" onClick={() => window.open(announce?.link, "_blank")}>Read More...</Button>
                                    <Tooltip >
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                className="w-8 h-8 p-0 rounded-full hover:bg-muted"
                                                onClick={() => setShowAnnounce(false)}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                            <p>Close</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    ) : (
                        <div className="group-data-[state=collapsed]:hidden">
                            <Skeleton className="w-full h-36 rounded-xl" />
                        </div>
                    )}
                </AnimatePresence>
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <Tooltip>
                        <TooltipTrigger asChild>

                            <Button variant="ghost" className={cn(
                                "flex items-center justify-center z-30 gap-2 w-full h-10 border border-sidebar-border rounded-full px-2 bg-card overflow-hidden",
                                "group-data-[state=collapsed]:w-10 group-data-[state=collapsed]:h-10 group-data-[state=collapsed]:items-center group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:gap-0"
                            )}
                                onClick={() => { setSettingsOpen(true), setSettingsTab(0) }}
                            >
                                <User />
                                {user ? <span className="text-lg font-bold transition-all duration-200 group-data-[state=collapsed]:hidden truncate w-full text-left pl-2">
                                    {user?.username}
                                </span> : <Skeleton className="w-full h-full rounded-full" />}
                                <div className="flex items-center justify-end w-24">
                                    <SettingsIcon size={24} className="group-data-[state=collapsed]:hidden w-full transition-all duration-200" />
                                </div>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="flex items-center gap-2">
                            <p>Settings</p>
                            <KbdGroup className="hidden sm:inline-flex">
                                <Kbd className="bg-popover text-foreground">Ctrl + ,</Kbd>
                            </KbdGroup>
                        </TooltipContent>
                    </Tooltip>
                    <DialogContent className="max-w-5xl grid grid-cols-5 " showCloseButton={false}>
                        <div className="col-span-1 h-full flex flex-col gap-2 relative">
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start ", settingsTab === 0 && "bg-card hover:bg-card")}
                                onClick={() => { setSettingsTab(0) }}>
                                <User size={16} />
                                <p className="text-sm font-medium">Account</p>
                            </div>
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start ", settingsTab === 1 && "bg-card hover:bg-card")}
                                onClick={() => { setSettingsTab(1) }}>
                                <Sun size={16} />
                                <p className="text-sm font-medium">Preferences</p>
                            </div>
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start ", settingsTab === 2 && "bg-card hover:bg-card")}
                                onClick={() => { setSettingsTab(2) }}>
                                <Bot size={16} />
                                <p className="text-sm font-medium">AI Settings</p>
                            </div>
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start ", settingsTab === 3 && "bg-card hover:bg-card")}
                                onClick={() => { setSettingsTab(3) }}>
                                <Tags size={16} />
                                <p className="text-sm font-medium">Tags</p>
                            </div>
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border bg-card border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start absolute bottom-0 left-0 right-0 ")}
                                // We want it to link to the about page
                                onClick={() => { }}>
                                <ArrowUpLeft size={16} />
                                <p className="text-sm font-medium">About</p>
                            </div>
                        </div>
                        <div className="col-span-4 flex flex-col h-full relative px-4">
                            <DialogHeader className="border-b border-border pb-4">
                                <DialogTitle>{settingsTab === 0 ? "Account" : settingsTab === 1 ? "Preferences" : settingsTab === 2 ? "AI Settings" : "Tags"}</DialogTitle>
                                <DialogDescription>
                                    {settingsTab === 0 ? "Manage your workspace account." : settingsTab === 1 ? "Manage your workspace preferences." : settingsTab === 2 ? "Manage your workspace AI settings." : "Manage your workspace tags."}
                                </DialogDescription>
                            </DialogHeader>

                            {settingsTab === 0 && (
                                <div className="flex flex-col pb-6 h-[calc(100vh-250px)] sm:h-[calc(100vh-300px)] md:h-[calc(100vh-400px)] lg:h-[calc(100vh-500px)] overflow-y-auto scrollbar-hide">
                                    <div className="flex gap-2 border-b border-border py-4 justify-between items-center">
                                        <p className="text-sm font-medium">Credits Left</p>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <p className="text-sm font-medium px-4 py-2 bg-card rounded-full flex items-center font-mono border border-folder-yellow hover:bg-folder-yellow/10 cursor-pointer transition-all duration-200" onClick={() => { }}>
                                                    <Coins className="w-4 h-4 mr-2 text-folder-yellow" />
                                                    {/* Read credits from global context so optimistic updates from chatMessageInput are reflected instantly */}
                                                    {formatCredits(globalUser?.credits_left ?? user?.credits_left ?? 0)}
                                                </p>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Buy more credits</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    <div className="flex flex-col gap-2 border-b border-border py-4">
                                        <p className="text-sm font-medium">Username</p>
                                        <Input
                                            className="w-full focus-visible:border-primary focus-visible:ring-none focus-visible:ring-[0px]!"
                                            value={tempPseudo}
                                            onChange={(e) => {
                                                setTempPseudo(e.target.value);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && tempPseudo.length > 0) {
                                                    updateSettings();
                                                }
                                            }}
                                            maxLength={20}
                                            onBlur={() => { if (!tempPseudo) setTempPseudo(user?.username || "") }}
                                        />
                                        <p className="text-xs text-muted-foreground">*Max 20 characters</p>
                                    </div>
                                    <div className="flex gap-2 py-4 justify-between items-center">
                                        <p className="text-sm font-medium">Email</p>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" className="text-sm font-medium text-muted-foreground">
                                                    <ArrowUpLeft size={16} />
                                                    {userAuth?.email}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">
                                                <p>Change email</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                </div>
                            )}
                            {settingsTab === 1 && (
                                <div className="flex flex-col pb-6 h-[calc(100vh-250px)] sm:h-[calc(100vh-300px)] md:h-[calc(100vh-400px)] lg:h-[calc(100vh-500px)] overflow-y-auto scrollbar-hide">
                                    <div className="flex gap-2 justify-between items-center border-b border-border py-4">
                                        <p className="text-sm font-medium">Appearance</p>
                                        <Select
                                            value={tempSettings.theme}
                                            onValueChange={(value: string) => {
                                                setTempSettings({
                                                    ...tempSettings,
                                                    theme: value as Theme,
                                                });
                                            }}

                                        >
                                            <SelectTrigger className="bg-transparent! border-none hover:bg-card!">
                                                <SelectValue placeholder="Theme" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="light">Light</SelectItem>
                                                <SelectItem value="dark">Dark</SelectItem>
                                                <SelectItem value="system">System</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex gap-2 justify-between items-center py-4 border-b border-border">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium">Default Language</p>
                                            <p className="text-xs text-muted-foreground">Check this setting for more relevant responses from the AI.</p>
                                        </div>
                                        <Select
                                            value={tempSettings.language}
                                            onValueChange={(value: string) => {
                                                setTempSettings({
                                                    ...tempSettings,
                                                    language: value as Language,
                                                });
                                            }}
                                        >
                                            <SelectTrigger className="bg-transparent! border-none hover:bg-card!">
                                                <SelectValue placeholder="Language" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="auto-detect">Auto-detect</SelectItem>
                                                <SelectItem value="en">English</SelectItem>
                                                <SelectItem value="es">Español</SelectItem>
                                                <SelectItem value="fr">Français</SelectItem>
                                                <SelectItem value="de">Deutsch</SelectItem>
                                                <SelectItem value="it">Italiano</SelectItem>
                                                <SelectItem value="pt">Português</SelectItem>
                                                <SelectItem value="ru">Русский</SelectItem>
                                                <SelectItem value="zh">中文</SelectItem>
                                                <SelectItem value="ja">日本語</SelectItem>
                                                <SelectItem value="ko">한국어</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex gap-2 justify-between items-center py-4">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium">Spellcheck Languages</p>
                                            <p className="text-xs text-muted-foreground">Select multiple languages for checking editor text.</p>
                                        </div>
                                        <div className="w-48 text-right flex justify-end">
                                            <LanguageMultiSelect
                                                selected={tempSettings.spellcheckLanguages || []}
                                                onChange={(val) => setTempSettings({ ...tempSettings, spellcheckLanguages: val })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                            {settingsTab === 2 && (
                                <div className="flex flex-col pb-6 h-[calc(100vh-250px)] sm:h-[calc(100vh-300px)] md:h-[calc(100vh-400px)] lg:h-[calc(100vh-500px)] overflow-y-auto scrollbar-hide pr-12 pb-12">
                                    <div className="flex flex-col gap-2 border-b border-border py-4">
                                        <p className="text-sm font-medium">AI name</p>
                                        <Input
                                            className="w-full"
                                            value={tempSettings.aiName}
                                            onChange={(e) => {
                                                setTempSettings({ ...tempSettings, aiName: e.target.value });
                                            }}
                                            onBlur={() => { if (!tempSettings.aiName) setTempSettings({ ...tempSettings, aiName: settings.aiName || "Narao AI" }) }}
                                        />
                                    </div>

                                    <div className="flex flex-row items-start gap-2 py-4 justify-between border-b border-border">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium">Enable tools</p>
                                            <p className="text-xs text-muted-foreground">Give AI access to your workspace in future chat sessions. If disabled, it will reduce the amount of credits used significantly.</p>
                                        </div>
                                        <Switch
                                            checked={tempSettings.enableTools}
                                            onCheckedChange={(checked) => setTempSettings({ ...tempSettings, enableTools: checked })}
                                        />

                                    </div>

                                    <div className="flex flex-col gap-2 border-b border-border py-4">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium">Custom Instructions</p>
                                            <p className="text-xs text-muted-foreground">Give the AI instructions on how to respond to you.</p>
                                        </div>
                                        <Textarea
                                            maxLength={500}
                                            className="w-full focus-visible:border-primary focus-visible:ring-none focus-visible:ring-[0px]! resize-none h-24 scrollbar-hide selection:bg-primary/50"
                                            value={tempSettings.customInstructions.customPrompt}
                                            onChange={(e) => {
                                                setTempSettings({ ...tempSettings, customInstructions: { ...tempSettings.customInstructions, customPrompt: e.target.value } });
                                            }}
                                            onBlur={() => { if (!tempSettings.customInstructions.customPrompt) setTempSettings({ ...tempSettings, customInstructions: { ...tempSettings.customInstructions, customPrompt: "" } }) }}
                                        />
                                        <p className="text-xs text-muted-foreground">*Max 500 characters.</p>

                                    </div>
                                    <div className="flex flex-col gap-2 py-4">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium">About you</p>
                                            <p className="text-xs text-muted-foreground">Tell the AI about yourself to get answers tailored to you.</p>
                                        </div>
                                        <Textarea
                                            maxLength={500}
                                            className="w-full focus-visible:border-primary focus-visible:ring-none focus-visible:ring-[0px]! resize-none h-24 scrollbar-hide selection:bg-primary/50"
                                            value={tempSettings.customInstructions.aboutUser}
                                            onChange={(e) => {
                                                setTempSettings({ ...tempSettings, customInstructions: { ...tempSettings.customInstructions, aboutUser: e.target.value } });
                                            }}
                                            onBlur={() => { if (!tempSettings.customInstructions.aboutUser) setTempSettings({ ...tempSettings, customInstructions: { ...tempSettings.customInstructions, aboutUser: "" } }) }}
                                        />
                                        <p className="text-xs text-muted-foreground">*Max 500 characters.</p>
                                    </div>

                                </div>
                            )}
                            {settingsTab === 3 && (
                                <div className="flex flex-col pb-6 h-[calc(100vh-250px)] sm:h-[calc(100vh-300px)] md:h-[calc(100vh-400px)] lg:h-[calc(100vh-500px)] overflow-y-auto scrollbar-hide">
                                    <div className="flex flex-col gap-4">
                                        {/* Create new tag section */}
                                        <div className="flex flex-col gap-3 border-b border-border py-4">
                                            <p className="text-sm font-medium">Create New Tag</p>
                                            <div className="flex gap-2 items-center">
                                                <Input
                                                    placeholder="Tag name..."
                                                    value={newTagName}
                                                    onChange={(e) => setNewTagName(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                                                    maxLength={20}
                                                    className="flex-1"
                                                />
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="relative w-9 h-9 rounded-full border border-border overflow-hidden shrink-0 cursor-pointer">

                                                            <input
                                                                type="color"
                                                                value={newTagColor}
                                                                onChange={(e) => setNewTagColor(e.target.value)}
                                                                className="absolute -inset-2 w-[200%] h-[200%] cursor-pointer"
                                                            />

                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Choose color</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                                <Button onClick={handleCreateTag} disabled={!newTagName.trim()} style={{ backgroundColor: newTagColor }} className={cn(handleTextTagColor(newTagColor), "flex items-center gap-2 hover:opacity-80 transition-opacity")}>
                                                    <p>Add</p>
                                                    <Plus size={16} />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Tags list section */}
                                        <div className="flex flex-col gap-3">
                                            <p className="text-sm font-medium">Your Tags</p>
                                            {getAllTagsWithCounts().length === 0 ? (
                                                <p className="text-sm text-muted-foreground italic">No tags created yet.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-2">
                                                    {getAllTagsWithCounts().map((tag) => (
                                                        <div key={tag.name} className="flex items-center justify-between p-2 pl-4 rounded-3xl border border-border hover:bg-muted/50 transition-all">
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className="w-4 h-4 rounded-full"
                                                                    style={{ backgroundColor: tag.color }}
                                                                />
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium">{tag.name}</span>
                                                                    <span className="text-xs text-muted-foreground">{tag.count} note{tag.count !== 1 ? 's' : ''}</span>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    setTagToDelete({ name: tag.name, color: tag.color });
                                                                    setIsDeleteConfirmOpen(true);
                                                                }}
                                                                className="text-muted-foreground hover:text-destructive"
                                                            >
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}


                            <DialogFooter className="flex items-center justify-end gap-2 p-2 absolute bottom-0 left-1/2 -translate-x-1/2 bg-card/50 backdrop-blur-sm w-fit rounded-full border">
                                <DialogClose asChild>
                                    <Button variant="ghost" onClick={() => setSettingsOpen(false)} className="cursor-pointer">Close</Button>
                                </DialogClose>
                                <Button variant="default" onClick={() => { updateSettings(); setSettingsOpen(false); }} className="cursor-pointer hover:bg-primary/70" disabled={JSON.stringify(tempSettings) === JSON.stringify(settings)}>
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>

                    {/* Delete tag confirmation dialog */}
                    <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                        <DialogContent className="w-xl" showCloseButton={false}>
                            <DialogHeader>
                                <DialogTitle>Delete Tag</DialogTitle>
                                <DialogDescription>
                                    Are you sure you want to delete the tag "{tagToDelete?.name}"? This will remove it from all notes.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="ghost" onClick={() => setIsDeleteConfirmOpen(false)}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={() => tagToDelete && handleDeleteTag(tagToDelete.name)}>
                                    Delete
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                </Dialog>
            </SidebarFooter>
        </Sidebar>
    );
}   