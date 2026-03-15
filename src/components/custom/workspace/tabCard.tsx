'use client'

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookOpen, FolderIcon, MessageCircle, X } from "lucide-react";
import { useRef } from "react";
import { useTabs, Tab } from "@/context/tabsContext";

interface TabCardProps {
    tab: Tab;
    index: number;
}

export default function TabCard({ tab, index }: TabCardProps) {
    const { activeTabId, setActiveTabId, closeTab, moveTab, tabs } = useTabs();
    const isActive = tab.id === activeTabId;

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
        closeTab(tab.id);
    };

    // ─── Title ────────────────────────────────────────────────────────────────
    const displayTitle = tab.title.length > 18 ? tab.title.slice(0, 18).trimEnd() + "…" : tab.title;

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={handleDragLeave}
            onClick={() => setActiveTabId(tab.id)}
            className={cn(
                "relative bg-card border border-border transition-all duration-100 rounded-3xl h-9 px-4 flex items-center group hover:bg-accent flex-shrink min-w-10 overflow-hidden cursor-pointer select-none",
                isActive && "bg-accent text-accent-foreground hover:bg-accent/80"
            )}
        >
            <div className="flex items-center gap-2 min-w-0 w-full group-hover:pr-6 transition-all duration-100">
                <div className="flex-shrink-0">
                    {tab.type === "folder" && <FolderIcon className="w-4 h-4" />}
                    {tab.type === "note" && <BookOpen className="w-4 h-4" />}
                    {tab.type === "chat" && <MessageCircle className="w-4 h-4" />}
                </div>
                <p className="text-sm truncate select-none">{displayTitle}</p>
            </div>
            {/* Only show close button if there are multiple tabs */}
            {tabs.length > 1 && (
                <Button
                    variant="ghost"
                    onClick={handleClose}
                    className="absolute right-1 w-7 h-7 p-0 rounded-full opacity-0 group-hover:opacity-100 dark:hover:bg-card/60 transition-all duration-100 scale-90"
                >
                    <X className="w-4 h-4" />
                </Button>
            )}
        </div>
    );
}