'use client'

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookOpen, FolderIcon, Home, MessageCircle, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTabs, Tab } from "@/context/tabsContext";
import { useChatMessages } from "@/context/chatMessagesContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useIsMobile } from "@/hooks/use-mobile";

interface TabCardProps {
    tab: Tab;
    index: number;
}

export default function TabCard({ tab, index }: TabCardProps) {
    const { activeTabId, setActiveTabId, closeTab, moveTab, tabs } = useTabs();
    const { removeTabState } = useChatMessages();
    const isActive = tab.id === activeTabId;
    const isMobile = useIsMobile();

    // ─── Check Saving Dialog ────────────────────────────────────────────────
    const [openCheckSavingDialog, setOpenCheckSavingDialog] = useState(false);

    // ─── Drag-to-reorder ──────────────────────────────────────────────────────
    const dragOverRef = useRef<boolean>(false);

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData("tabIndex", String(index));
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        dragOverRef.current = true;
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData("tabIndex"), 10);
        if (!isNaN(fromIndex) && fromIndex !== index) {
            moveTab(fromIndex, index);
        }
        dragOverRef.current = false;
    };

    const handleDragLeave = () => {
        dragOverRef.current = false;
    };

    // ─── Close ────────────────────────────────────────────────────────────────
    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (tab.type === "note" && !tab.isSavedComplete) {
            setOpenCheckSavingDialog(true);
        } else {
            closeTab(tab.id);
            removeTabState(tab.id);
        }
    };

    // ─── Title ────────────────────────────────────────────────────────────────
    const displayTitle = tab.title.length > 18 ? tab.title.slice(0, 18).trimEnd() + "…" : tab.title;

    return (
        <>

            <Tooltip delayDuration={1000}>
                <TooltipTrigger asChild>
                    <div
                        draggable
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onDragLeave={handleDragLeave}
                        onClick={() => setActiveTabId(tab.id)}
                        className={cn(
                            "relative bg-card border border-border transition-all duration-100 rounded-3xl h-9 px-4 flex items-center group hover:bg-accent flex-shrink min-w-10 overflow-hidden cursor-pointer select-none fade-up pr-8 lg:pr-4",
                            isActive && "bg-accent text-accent-foreground hover:bg-accent/80"
                        )}
                    >
                        <div className="flex items-center gap-2 min-w-0 w-full group-hover:pr-6 transition-all duration-100">
                            <div className="flex-shrink-0">
                                {tab.type === "folder" && <FolderIcon className="w-4 h-4" />}
                                {tab.type === "note" && <BookOpen className="w-4 h-4" />}
                                {tab.type === "chat" && <MessageCircle className="w-4 h-4" />}
                                {tab.type === "home" && <Home className="w-4 h-4" />}
                            </div>
                            <p className="text-sm truncate select-none">{displayTitle}</p>
                        </div>
                        {activeTabId !== tab.id || !isMobile ? <Button
                            variant="ghost"
                            onClick={handleClose}
                            className="absolute right-1 w-7 h-7 p-0 rounded-full opacity-100 lg:opacity-0 lg:group-hover:opacity-100 dark:hover:bg-card/60 hover:bg-secondary transition-all duration-100 scale-90 cursor-pointer z-50"
                        >
                            <X className="w-4 h-4" />
                        </Button> : <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    onClick={handleClose}
                                    className="absolute right-1 w-7 h-7 p-0 rounded-full opacity-100 lg:opacity-0 lg:group-hover:opacity-100 dark:hover:bg-card/60 hover:bg-secondary transition-all duration-100 scale-90 cursor-pointer z-50"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent className="dark:bg-card bg-card text-muted-foreground p-1">
                                <KbdGroup className="hidden sm:inline-flex">
                                    <Kbd>Ctrl + Shift + W</Kbd>
                                </KbdGroup>
                            </TooltipContent>
                        </Tooltip>}

                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tab.title}</p>
                </TooltipContent>
            </Tooltip>

            <Dialog open={openCheckSavingDialog} onOpenChange={setOpenCheckSavingDialog}>
                <DialogContent className="dark:bg-card bg-card w-132" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Quit {tab.title} without saving?</DialogTitle>
                        <DialogDescription>
                            You have unsaved changes in {tab.title}. If you quit without saving, your changes will be lost.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <DialogClose asChild>
                            <Button variant="ghost">Cancel</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={() => { closeTab(tab.id); removeTabState(tab.id); }} className="dark:hover:bg-destructive/80 hover:bg-destructive/20">Quit without saving</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}