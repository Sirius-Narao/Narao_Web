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
    ListTodo,
    Table,
    ChevronDown,
    Sigma,
    Variable,
    Rows,
    Columns,
    Combine,
    Split,
    Trash2,
    Plus,
    Image as ImageIcon,
} from "lucide-react";
import { useRef } from "react";
import { useUser } from "@/context/userContext";
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
    const { user } = useUser();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', user.id);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to upload image');
            }

            const data = await response.json();
            
            // Insert the image into the editor
            editor?.chain().focus().setImage({ src: data.url }).run();
        } catch (error) {
            console.error('Error uploading image:', error);
        } finally {
            // Reset the file input
            event.target.value = '';
        }
    };

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    // useEditorState re-runs the selector on every transaction (selection, content, mark changes)
    // This is the correct Tiptap v3 API for reactive toolbar state
    const editorState = useEditorState({
        editor,
        selector: (ctx) => {
            const e = ctx.editor;
            if (!e) return null;
            return {
                isBold: e.isActive("bold"),
                isItalic: e.isActive("italic"),
                isStrike: e.isActive("strike"),
                isCode: e.isActive("code"),
                isBlockquote: e.isActive("blockquote"),
                isCodeBlock: e.isActive("codeBlock"),
                isBulletList: e.isActive("bulletList"),
                isOrderedList: e.isActive("orderedList"),
                isTaskList: e.isActive("taskList"),
                isTable: e.isActive("table"),
                isH1: e.isActive("heading", { level: 1 }),
                isH2: e.isActive("heading", { level: 2 }),
                isH3: e.isActive("heading", { level: 3 }),
                isInlineMath: e.isActive("inlineMath"),
                isMathBlock: e.isActive("codeBlock", { language: "math" }),
                activeColor: EDITOR_COLORS.find(c => e.isActive("textStyle", { color: c.value })) ?? null,
            };
        },
    });

    // ── Inline format buttons ────────────────────────────────────────────────
    const formatButtons = [
        {
            label: "Bold",
            icon: <Bold size={14} />,
            isActive: editorState?.isBold,
            action: () => editor?.chain().focus().toggleBold().run(),
            shortcut: "Ctrl+Shift+B",
        },
        {
            label: "Italic",
            icon: <Italic size={14} />,
            isActive: editorState?.isItalic,
            action: () => editor?.chain().focus().toggleItalic().run(),
            shortcut: "Ctrl+I",
        },
        {
            label: "Strikethrough",
            icon: <Strikethrough size={14} />,
            isActive: editorState?.isStrike,
            action: () => editor?.chain().focus().toggleStrike().run(),
            shortcut: "Ctrl+Shift+S",
        },
        {
            label: "Inline Code",
            icon: <Code size={14} />,
            isActive: editorState?.isCode,
            action: () => editor?.chain().focus().toggleCode().run(),
            shortcut: "Ctrl+E",
        },
        {
            label: "Inline Math",
            icon: <Variable size={14} />,
            isActive: editorState?.isInlineMath,
            action: () => {
                if (!editor) return;
                const { from, to } = editor.state.selection;
                const latex = editor.state.doc.textBetween(from, to);
                editor.chain().focus().insertContent({
                    type: 'inlineMath',
                    attrs: { latex }
                }).run();
            },
            shortcut: "Alt+M",
        },
    ];

    // ── Block format buttons ──────────────────────────────────────────────────
    const blockButtons = [
        {
            label: "Blockquote",
            icon: <Quote size={14} />,
            isActive: editorState?.isBlockquote,
            action: () => editor?.chain().focus().toggleBlockquote().run(),
            shortcut: "Ctrl+Shift+B",
        },
        {
            label: "Code Block",
            icon: <Code2 size={14} />,
            isActive: editorState?.isCodeBlock && !editorState?.isMathBlock,
            action: () => editor?.chain().focus().toggleCodeBlock().run(),
            shortcut: "Ctrl+Alt+C",
        },
        {
            label: "Math Block",
            icon: <Sigma size={14} />,
            isActive: editorState?.isMathBlock,
            action: () => editor?.chain().focus().toggleCodeBlock({ language: 'math' }).run(),
            shortcut: "Ctrl+Alt+M",
        },
        {
            label: "Bullet List",
            icon: <List size={14} />,
            isActive: editorState?.isBulletList,
            action: () => editor?.chain().focus().toggleBulletList().run(),
            shortcut: "Ctrl+Shift+8",
        },
        {
            label: "Numbered List",
            icon: <ListOrdered size={14} />,
            isActive: editorState?.isOrderedList,
            action: () => editor?.chain().focus().toggleOrderedList().run(),
            shortcut: "Ctrl+Shift+7",
        },
        {
            label: "Task List",
            icon: <ListTodo size={14} />,
            isActive: editorState?.isTaskList,
            action: () => editor?.chain().focus().toggleTaskList().run(),
            shortcut: "Ctrl+Shift+9",
        },
    ];

    // ── Heading levels ────────────────────────────────────────────────────────
    const headingLevels = [
        { level: 1 as const, label: "Heading 1", icon: <Heading1 size={14} />, shortcut: "Ctrl+Alt+1", isActive: editorState?.isH1 },
        { level: 2 as const, label: "Heading 2", icon: <Heading2 size={14} />, shortcut: "Ctrl+Alt+2", isActive: editorState?.isH2 },
        { level: 3 as const, label: "Heading 3", icon: <Heading3 size={14} />, shortcut: "Ctrl+Alt+3", isActive: editorState?.isH3 },
    ];

    const activeHeading = headingLevels.find(h => h.isActive);
    const activeHeadingIcon = activeHeading
        ? activeHeading.icon
        : <span className="text-[11px] font-medium leading-none">¶</span>;

    // ── Color ─────────────────────────────────────────────────────────────────
    const activeColor = editorState?.activeColor;

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
                        onClick={() => editor?.chain().focus().setParagraph().run()}
                        className={cn("gap-2 text-xs cursor-pointer", !activeHeading && "bg-primary/10 text-primary")}
                    >
                        <span className="text-[11px] font-medium w-4">¶</span>
                        <span>Paragraph</span>
                        <kbd className="ml-auto bg-card text-muted-foreground px-1.5 py-0.5 rounded text-[10px] border border-border hidden sm:inline-block">Ctrl+Alt+0</kbd>
                    </DropdownMenuItem>
                    {headingLevels.map(h => (
                        <DropdownMenuItem
                            key={h.level}
                            onClick={() => editor?.chain().focus().toggleHeading({ level: h.level }).run()}
                            className={cn("gap-2 text-xs cursor-pointer", h.isActive && "bg-primary/10 text-primary")}
                        >
                            <span className="w-4 flex items-center justify-center">{h.icon}</span>
                            <span>{h.label}</span>
                            <kbd className="ml-auto bg-card text-muted-foreground px-1.5 py-0.5 rounded text-[10px] border border-border hidden sm:inline-block">{h.shortcut}</kbd>
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
                        <kbd className="bg-card text-muted-foreground px-1.5 py-0.5 rounded text-[10px] border border-border hidden sm:inline-block">{btn.shortcut}</kbd>
                    </TooltipContent>
                </Tooltip>
            ))}

            {/* ── Image Upload ── */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        onClick={handleImageClick}
                        className={cn(
                            "rounded-full cursor-pointer dark:hover:bg-primary/10 hover:bg-primary/10 hover:text-primary transition-all"
                        )}
                        aria-label="Insert image"
                    >
                        <ImageIcon size={14} />
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Insert image</TooltipContent>
            </Tooltip>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handleImageUpload}
                className="hidden"
            />

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
                        <kbd className="bg-card text-muted-foreground px-1.5 py-0.5 rounded text-[10px] border border-border hidden sm:inline-block">{btn.shortcut}</kbd>
                    </TooltipContent>
                </Tooltip>
            ))}

            {/* ── Table Actions Dropdown ── */}
            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className={cn(
                                    "rounded-full gap-1 cursor-pointer transition-all",
                                    editorState?.isTable && "bg-primary/20 text-primary"
                                )}
                            >
                                <Table size={14} />
                                <ChevronDown size={14} className="opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Table Actions</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="min-w-[200px] rounded-lg p-1.5">
                    {!editorState?.isTable ? (
                        <DropdownMenuItem
                            onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                            className="gap-2 text-xs cursor-pointer rounded-xl"
                        >
                            <Plus size={14} />
                            <span>Insert Table (3×3)</span>
                        </DropdownMenuItem>
                    ) : (
                        <>
                            <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider group/row-handles">Rows</div>
                            <DropdownMenuItem
                                onClick={() => editor?.chain().focus().addRowBefore().run()}
                                className="gap-2 text-xs cursor-pointer rounded-xl"
                            >
                                <Rows size={14} className="rotate-180 hover:text-primary" />
                                <span>Add Row Above</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => editor?.chain().focus().addRowAfter().run()}
                                className="gap-2 text-xs cursor-pointer rounded-xl"
                            >
                                <Rows size={14} className="hover:text-primary" />
                                <span>Add Row Below</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => editor?.chain().focus().deleteRow().run()}
                                className="gap-2 text-xs cursor-pointer rounded-xl text-destructive focus:text-destructive dark:hover:bg-destructive/10 hover:bg-destructive/10!"
                            >
                                <Trash2 size={14} className="text-destructive" />
                                <span>Delete Row</span>
                            </DropdownMenuItem>

                            <div className="h-px bg-border my-1" />
                            <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Columns</div>
                            <DropdownMenuItem
                                onClick={() => editor?.chain().focus().addColumnBefore().run()}
                                className="gap-2 text-xs cursor-pointer rounded-xl"
                            >
                                <Columns size={14} className="rotate-180 hover:text-primary" />
                                <span>Add Column Left</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => editor?.chain().focus().addColumnAfter().run()}
                                className="gap-2 text-xs cursor-pointer rounded-xl"
                            >
                                <Columns size={14} className="hover:text-primary" />
                                <span>Add Column Right</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => editor?.chain().focus().deleteColumn().run()}
                                className="gap-2 text-xs cursor-pointer rounded-xl text-destructive focus:text-destructive dark:hover:bg-destructive/10 hover:bg-destructive/10!"
                            >
                                <Trash2 size={14} className="text-destructive" />
                                <span>Delete Column</span>
                            </DropdownMenuItem>

                            <div className="h-px bg-border my-1" />
                            <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cells</div>
                            <DropdownMenuItem
                                onClick={() => editor?.chain().focus().mergeCells().run()}
                                className="gap-2 text-xs cursor-pointer rounded-xl"
                            >
                                <Combine size={14} className="hover:text-primary" />
                                <span>Merge Cells</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => editor?.chain().focus().splitCell().run()}
                                className="gap-2 text-xs cursor-pointer rounded-xl"
                            >
                                <Split size={14} className="hover:text-primary" />
                                <span>Split Cell</span>
                            </DropdownMenuItem>

                            <div className="h-px bg-border my-1" />
                            <DropdownMenuItem
                                onClick={() => editor?.chain().focus().deleteTable().run()}
                                className="gap-2 text-xs cursor-pointer rounded-xl text-destructive focus:text-destructive dark:hover:bg-destructive/10 hover:bg-destructive/10!"
                            >
                                <Trash2 size={14} className="text-destructive" />
                                <span>Delete Table</span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <Divider />

            {/* ── Remove Formatting ── */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Toggle
                        pressed={false}
                        onPressedChange={() => editor?.chain().focus().unsetAllMarks().run()}
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
                                    onClick={() => editor?.chain().focus().unsetColor().setTextSelection(editor.state.selection.to).run()}
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
                                            onClick={() => editor?.chain().focus().setColor(color.value).setTextSelection(editor.state.selection.to).run()}
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
