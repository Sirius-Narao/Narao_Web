'use client'

import { useEditorInstance } from "@/context/editorContext";
import { EDITOR_COLORS } from "@/constants/editorColors";
import { useEditorState } from "@tiptap/react";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import {
    Bold,
    Italic,
    Strikethrough,
    Code,
    RemoveFormatting,
    Palette,
    Heading1,
    Heading2,
    Heading3,
    Quote,
    Code2,
    List,
    ListOrdered,
    Table,
    ChevronDown,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function EditorToolbar() {
    const { editor } = useEditorInstance();

    // useEditorState re-runs the selector on every transaction (selection, content, mark changes)
    // This is the correct Tiptap v3 API for reactive toolbar state
    const editorState = useEditorState({
        editor,
        selector: (ctx) => {
            const e = ctx.editor;
            if (!e) return null;
            return {
                isBold:        e.isActive("bold"),
                isItalic:      e.isActive("italic"),
                isStrike:      e.isActive("strike"),
                isCode:        e.isActive("code"),
                isBlockquote:  e.isActive("blockquote"),
                isCodeBlock:   e.isActive("codeBlock"),
                isBulletList:  e.isActive("bulletList"),
                isOrderedList: e.isActive("orderedList"),
                isTable:       e.isActive("table"),
                isH1:          e.isActive("heading", { level: 1 }),
                isH2:          e.isActive("heading", { level: 2 }),
                isH3:          e.isActive("heading", { level: 3 }),
                activeColor:   EDITOR_COLORS.find(c => e.isActive("textStyle", { color: c.value })) ?? null,
            };
        },
    });

    if (!editor || !editorState) return null;

    // ── Inline format buttons ────────────────────────────────────────────────
    const formatButtons = [
        {
            label: "Bold",
            icon: <Bold size={14} />,
            isActive: editorState.isBold,
            action: () => editor.chain().focus().toggleBold().run(),
            shortcut: "Ctrl+Shift+B",
        },
        {
            label: "Italic",
            icon: <Italic size={14} />,
            isActive: editorState.isItalic,
            action: () => editor.chain().focus().toggleItalic().run(),
            shortcut: "Ctrl+I",
        },
        {
            label: "Strikethrough",
            icon: <Strikethrough size={14} />,
            isActive: editorState.isStrike,
            action: () => editor.chain().focus().toggleStrike().run(),
            shortcut: "Ctrl+Shift+S",
        },
        {
            label: "Inline Code",
            icon: <Code size={14} />,
            isActive: editorState.isCode,
            action: () => editor.chain().focus().toggleCode().run(),
            shortcut: "Ctrl+E",
        },
    ];

    // ── Block format buttons ──────────────────────────────────────────────────
    const blockButtons = [
        {
            label: "Blockquote",
            icon: <Quote size={14} />,
            isActive: editorState.isBlockquote,
            action: () => editor.chain().focus().toggleBlockquote().run(),
            shortcut: "Ctrl+Shift+B",
        },
        {
            label: "Code Block",
            icon: <Code2 size={14} />,
            isActive: editorState.isCodeBlock,
            action: () => editor.chain().focus().toggleCodeBlock().run(),
            shortcut: "Ctrl+Alt+C",
        },
        {
            label: "Bullet List",
            icon: <List size={14} />,
            isActive: editorState.isBulletList,
            action: () => editor.chain().focus().toggleBulletList().run(),
            shortcut: "Ctrl+Shift+8",
        },
        {
            label: "Numbered List",
            icon: <ListOrdered size={14} />,
            isActive: editorState.isOrderedList,
            action: () => editor.chain().focus().toggleOrderedList().run(),
            shortcut: "Ctrl+Shift+7",
        },
    ];

    // ── Heading levels ────────────────────────────────────────────────────────
    const headingLevels = [
        { level: 1 as const, label: "Heading 1", icon: <Heading1 size={14} />, shortcut: "Ctrl+Alt+1", isActive: editorState.isH1 },
        { level: 2 as const, label: "Heading 2", icon: <Heading2 size={14} />, shortcut: "Ctrl+Alt+2", isActive: editorState.isH2 },
        { level: 3 as const, label: "Heading 3", icon: <Heading3 size={14} />, shortcut: "Ctrl+Alt+3", isActive: editorState.isH3 },
    ];

    const activeHeading = headingLevels.find(h => h.isActive);
    const activeHeadingIcon = activeHeading
        ? activeHeading.icon
        : <span className="text-[11px] font-medium leading-none">¶</span>;

    // ── Color ─────────────────────────────────────────────────────────────────
    const activeColor = editorState.activeColor;

    const Divider = () => <div className="w-px h-4 mx-0.5 shrink-0 bg-input" />;

    const toggleClass = cn(
        "rounded-full transition-all cursor-pointer p-2",
        "hover:bg-primary/10 hover:text-primary"
    );

    return (
        <div className="flex items-center gap-1 p-1 rounded-3xl border border-border bg-popover">

            {/* ── Heading Dropdown ── */}
            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "rounded-full gap-1 cursor-pointer dark:hover:bg-primary/10 hover:bg-primary/10 hover:text-primary transition-all"
                                )}
                            >
                                {activeHeadingIcon}
                                <ChevronDown size={14} className="opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Heading</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="min-w-[180px]">
                    <DropdownMenuItem
                        onClick={() => editor.chain().focus().setParagraph().run()}
                        className={cn("gap-2 text-xs cursor-pointer", !activeHeading && "bg-primary/10 text-primary")}
                    >
                        <span className="text-[11px] font-medium w-4">¶</span>
                        <span>Paragraph</span>
                        <kbd className="ml-auto bg-card text-muted-foreground px-1.5 py-0.5 rounded text-[10px] border border-border">Ctrl+Alt+0</kbd>
                    </DropdownMenuItem>
                    {headingLevels.map(h => (
                        <DropdownMenuItem
                            key={h.level}
                            onClick={() => editor.chain().focus().toggleHeading({ level: h.level }).run()}
                            className={cn("gap-2 text-xs cursor-pointer", h.isActive && "bg-primary/10 text-primary")}
                        >
                            <span className="w-4 flex items-center justify-center">{h.icon}</span>
                            <span>{h.label}</span>
                            <kbd className="ml-auto bg-card text-muted-foreground px-1.5 py-0.5 rounded text-[10px] border border-border">{h.shortcut}</kbd>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <Divider />

            {/* ── Inline Format Toggles ── */}
            {formatButtons.map((btn) => (
                <Tooltip key={btn.label}>
                    <TooltipTrigger asChild>
                        <Toggle
                            pressed={btn.isActive}
                            onPressedChange={btn.action}
                            aria-label={btn.label}
                            className={cn(toggleClass, btn.isActive && "bg-primary/20 text-primary")}
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

            <Divider />

            {/* ── Block Format Toggles ── */}
            {blockButtons.map((btn) => (
                <Tooltip key={btn.label}>
                    <TooltipTrigger asChild>
                        <Toggle
                            pressed={btn.isActive}
                            onPressedChange={btn.action}
                            aria-label={btn.label}
                            className={cn(toggleClass, btn.isActive && "bg-primary/20 text-primary")}
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

            {/* ── Insert Table ── */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Toggle
                        pressed={editorState.isTable}
                        onPressedChange={() =>
                            editorState.isTable
                                ? editor.chain().focus().deleteTable().run()
                                : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                        }
                        aria-label="Insert Table"
                        className={cn(toggleClass, editorState.isTable && "bg-primary/20 text-primary")}

                    >
                        <Table size={14} />
                    </Toggle>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                    {editorState.isTable ? "Delete Table" : "Insert Table (3×3)"}
                </TooltipContent>
            </Tooltip>

            <Divider />

            {/* ── Remove Formatting ── */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Toggle
                        pressed={false}
                        onPressedChange={() => editor.chain().focus().unsetAllMarks().run()}
                        aria-label="Remove formatting"
                        className="rounded-full cursor-pointer hover:bg-primary/10 hover:text-primary"
                    >
                        <RemoveFormatting size={14} />
                    </Toggle>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Clear formatting</TooltipContent>
            </Tooltip>

            <Divider />

            {/* ── Color Picker ── */}
            <div className="flex items-center gap-1 flex-wrap max-w-[144px]">
                <Popover>
                    <Tooltip>
                        <PopoverTrigger asChild>

                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-full cursor-pointer dark:hover:bg-primary/10 hover:bg-primary/10 hover:text-primary">
                                    <Palette size={14} />
                                </Button>
                            </TooltipTrigger>


                        </PopoverTrigger>
                        <TooltipContent className="text-xs">Color</TooltipContent>
                    </Tooltip>
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
                            const isActive = activeColor?.value === color.value;
                            return (
                                <Tooltip key={color.label} delayDuration={1000}>
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
                                    <TooltipContent className="text-xs capitalize" >{color.label}</TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
