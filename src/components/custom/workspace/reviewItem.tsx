'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTabs } from "@/context/tabsContext";
import { cn } from "@/lib/utils";
import { ReviewItemType } from "@/types/reviewItemType";

export default function ReviewItem({ review }: { review: ReviewItemType }) {
    const { openTab } = useTabs();
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    className="flex items-center w-full p-2 rounded-lg hover:bg-popover/70 cursor-pointer fade-up"
                    onClick={() => {
                        openTab({ type: "chat", title: review.title, chatId: review.chatId });
                        console.log(review);
                    }}
                >
                    <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", review.importance === 1 ? "bg-folder-red" : review.importance === 2 ? "bg-folder-yellow w-2 h-2" : "bg-folder-green")} />
                        <p className="text-sm font-medium">{review.title.length > 20 ? review.title.slice(0, 20) + "..." : review.title}</p>
                    </div>
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