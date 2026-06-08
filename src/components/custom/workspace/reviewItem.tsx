'use client'

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTabs } from "@/context/tabsContext";
import { cn } from "@/lib/utils";
import { ReviewItemType } from "@/types/reviewItemType";
import { Trash } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useReviews } from "@/context/reviewContext";

import { useUser } from "@/context/userContext";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ReviewItem({ review, index }: { review: ReviewItemType, index: number }) {
    const { openTab } = useTabs();
    const { reviews, setReviews } = useReviews();
    const { user, setUser } = useUser();
    const [loading, setLoading] = useState(false);
    const isMobile = useIsMobile();

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const { error } = await supabase
            .from('review_items')
            .delete()
            .eq('id', review.id);

        if (error) {
            console.error(error);
        }
        setReviews(reviews.filter((r) => r.id !== review.id));
    }

    const handleClick = async () => {
        if (loading) return;

        // If the chat already exists, just open the tab
        if (review.chatId) {
            openTab({ type: "chat", title: review.title, chatId: review.chatId });
            return;
        }

        // Otherwise, create the chat lazily
        if (!user?.id) return;

        setLoading(true);
        try {
            // 1. Create the chat
            const { data: newChat, error: chatError } = await supabase
                .from('chats')
                .insert({
                    user_id: user.id,
                    title: "Review: " + (review.title || "Untitled"),
                    description: `Review for ${review.location}`,
                })
                .select()
                .single();

            if (chatError) throw chatError;

            // 2. Create the first message
            const { error: messageError } = await supabase
                .from('chat_messages')
                .insert({
                    chat_id: newChat.id,
                    role: "assistant",
                    content: `# ${review.title}\n\n${review.query}. In ${review.location}. \n\n---\n\nDo you want to proceed now?`,
                    credits_used: 20,
                });

            if (messageError) throw messageError;

            // 3. Update the user's credits (deduct 20)
            const { data: updatedUser, error: userError } = await supabase
                .from('profiles')
                .update({ credits_left: user.credits_left - 20 })
                .eq('id', user.id)
                .select()
                .single();

            if (userError) throw userError;

            // Update local user state
            setUser(prev => prev ? { ...prev, credits_left: updatedUser.credits_left } : null);

            // 4. Update the review_item with the new chat_id
            const { error: reviewError } = await supabase
                .from('review_items')
                .update({ chat_id: newChat.id })
                .eq('id', review.id);

            if (reviewError) throw reviewError;

            // 5. Update local reviews state
            setReviews(prev => prev.map(r => r.id === review.id ? { ...r, chatId: newChat.id } : r));

            // 6. Open the tab
            openTab({ type: "chat", title: review.title, chatId: newChat.id });

        } catch (err) {
            console.error("Error creating chat for review:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    className={cn(
                        "flex items-center w-full p-2 rounded-lg hover:bg-popover/70 cursor-pointer fade-up relative hover:[&_button]:opacity-100",
                        loading && "opacity-50 cursor-wait"
                    )}
                    onClick={handleClick}
                    style={{ animationDelay: `${index * 0.05}s` }}
                >
                    <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", review.importance === 1 ? "bg-folder-red" : review.importance === 2 ? "bg-folder-yellow w-2 h-2" : "bg-folder-green")} />
                        <p className="text-sm    font-medium">{review.title.length > 20 ? review.title.slice(0, 20) + "..." : review.title}</p>
                    </div>
                    <Button variant="ghost" className={cn("w-7 h-7 absolute right-1 opacity-0 transition-opacity", isMobile && "opacity-100")} onClick={handleDelete}>
                        <Trash className="text-muted-foreground" size={16} />
                    </Button>
                </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="relative">
                <div className="flex items-center gap-2 w-full relative">
                    <div className={cn("w-2 h-2 rounded-full", review.importance === 1 ? "bg-folder-red" : review.importance === 2 ? "bg-folder-yellow" : "bg-folder-green")} />
                    <p className="text-sm font-medium">{review.title}</p>
                    {/* Enable the user to see the location of the review, if it is too long, only display the last 2 folders, if one element is too long, display only 15 characters */}
                    <p className="text-sm text-muted-foreground italic pl-4 absolute right-0">{review.location.split("/").slice(-2).map((folder: string) => folder.length > 15 ? folder.slice(0, 15) + "..." : folder).join("/")}</p>

                </div>
                <p className="text-sm text-muted-foreground pl-4 max-w-120 break-words">{review.query.length > 100 ? review.query.slice(0, 100).trimEnd() + "..." : review.query}</p>
                <p className="text-xs absolute right-2 bottom-2 px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">{review.type.slice(0, 1).toUpperCase() + review.type.slice(1)}</p>
            </TooltipContent>
        </Tooltip>
    );
}