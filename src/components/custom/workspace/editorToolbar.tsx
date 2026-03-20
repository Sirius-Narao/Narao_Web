'use client'

import { useEditorInstance } from "@/context/editorContext";
import { EDITOR_COLORS } from "@/constants/editorColors";
import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import {
    Bold,
    Italic,
    Strikethrough,
    Code,
    RemoveFormatting,
    Palette,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function EditorToolbar() {
    const { editor } = useEditorInstance();
    const [, setUpdate] = useState(0);

    // Force re-render on every editor transaction (selection change, formatting change, etc.)
    useEffect(() => {
        if (!editor) return;

        const handler = () => {
            setUpdate(v => v + 1);
        };

        editor.on('transaction', handler);
        return () => {
            editor.off('transaction', handler);
        };
    }, [editor]);

    if (!editor) return null;

    const formatButtons = [
        {
            label: "Bold",
            icon: <Bold size={14} />,
            isActive: editor.isActive("bold"),
            action: () => editor.chain().focus().toggleBold().run(),
            shortcut: "Ctrl+Shift+B",
        },
        {
            label: "Italic",
            icon: <Italic size={14} />,
            isActive: editor.isActive("italic"),
            action: () => editor.chain().focus().toggleItalic().run(),
            shortcut: "Ctrl+I",
        },
        {
            label: "Strikethrough",
            icon: <Strikethrough size={14} />,
            isActive: editor.isActive("strike"),
            action: () => editor.chain().focus().toggleStrike().run(),
            shortcut: "Ctrl+Shift+S",
        },
        {
            label: "Inline Code",
            icon: <Code size={14} />,
            isActive: editor.isActive("code"),
            action: () => editor.chain().focus().toggleCode().run(),
            shortcut: "Ctrl+E",
        },
    ];

    const activeColor = EDITOR_COLORS.find(c =>
        editor.isActive("textStyle", { color: c.value })
    );

    return (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-3xl border border-border bg-popover">
            {/* Format Toggles */}
            {formatButtons.map((btn) => (
                <Tooltip key={btn.label}>
                    <TooltipTrigger asChild>
                        <Toggle
                            size="sm"
                            pressed={btn.isActive}
                            onPressedChange={btn.action}
                            aria-label={btn.label}
                            className={cn(
                                "w-7 h-7 p-0 rounded-full transition-all cursor-pointer",
                                "data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
                            )}
                        >
                            {btn.icon}
                        </Toggle>
                    </TooltipTrigger>
                    <TooltipContent className="flex items-center gap-2 text-xs">
                        <span>{btn.label}</span>
                        <kbd className="bg-card text-muted-foreground px-1.5 py-0.5 rounded text-[10px] border border-border">{btn.shortcut}</kbd>
                    </TooltipContent>
                </Tooltip>
            ))}

            {/* Divider */}
            <div className="w-px h-4 bg-border mx-0.5 shrink-0 bg-input" />

            {/* Remove Formatting */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Toggle
                        size="sm"
                        pressed={false}
                        onPressedChange={() => editor.chain().focus().unsetAllMarks().run()}
                        aria-label="Remove formatting"
                        className="w-7 h-7 p-0 rounded-full cursor-pointer"
                    >
                        <RemoveFormatting size={14} />
                    </Toggle>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Clear formatting</TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className="w-px h-4 bg-border mx-0.5 shrink-0 bg-input" />

            {/* Color Swatches */}
            <div className="flex items-center gap-1 flex-wrap max-w-[144px]">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-7 h-7 p-0 rounded-full cursor-pointer">
                            <Palette size={14} />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="flex items-center gap-1 flex-wrap max-w-[164px] p-2" align="start">
                        {/* "No color" / reset button */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    aria-label="Default color"
                                    onClick={() => editor.chain().focus().unsetColor().setTextSelection(editor.state.selection.to).run()}
                                    className={cn(
                                        "w-4 h-4 rounded-full border-2 transition-all hover:scale-125 shrink-0",
                                        "bg-gradient-to-br from-foreground/30 to-transparent",
                                        !activeColor
                                            ? "border-primary ring-1 ring-primary/50 scale-110"
                                            : "border-border"
                                    )}
                                />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">Default color</TooltipContent>
                        </Tooltip>

                        {EDITOR_COLORS.map((color) => {
                            const isActive = editor.isActive("textStyle", { color: color.value });
                            return (
                                <Tooltip key={color.label}>
                                    <TooltipTrigger asChild>
                                        <button
                                            aria-label={color.label}
                                            onClick={() => editor.chain().focus().setColor(color.value).setTextSelection(editor.state.selection.to).run()}
                                            className={cn(
                                                "w-4 h-4 rounded-full border-2 transition-all hover:scale-125 shrink-0",
                                                isActive
                                                    ? "border-primary ring-1 ring-primary/50 scale-110"
                                                    : "border-transparent"
                                            )}
                                            style={{ backgroundColor: color.value }}
                                        />
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs capitalize">{color.label}</TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
