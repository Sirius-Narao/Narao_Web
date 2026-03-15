import { cn } from "@/lib/utils";
import { FolderIcon, NotebookIcon } from "lucide-react";
import { useState } from "react";

interface TabCardProps {
    title: string;
    type: "folder" | "note" | "chat";
    active: boolean;
}

export default function TabCard({ title, type, active }: TabCardProps) {

    return (
        <div className={cn("bg-card border border-border rounded-lg px-4 py-2 flex items-center justify-center", active && "bg-primary text-primary-foreground")}>
            {type === "folder" && <FolderIcon />}
            {type === "note" && <NotebookIcon />}
            {type === "chat" && <ChatIcon />}
            <p>{title}</p>
        </div>
    );
}