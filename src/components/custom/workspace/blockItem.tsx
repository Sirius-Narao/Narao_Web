'use client'

import { useState, useRef, useEffect, useCallback } from "react";
import { BlockType, EditorBlock } from "@/types/folderStructureTypes";
import {
    Heading1, Heading2, Heading3, List, Quote, Text as TextIcon
} from "lucide-react";
import { createPortal } from "react-dom";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BlockItemProps {
    block: EditorBlock;
    index: number;
    isActive: boolean;
    onUpdate: (id: string, html: string) => void;
    onTypeChange: (id: string, newType: BlockType) => void;
    onFocus: () => void;
    onInsertBelow: (atIndex: number, type: BlockType, html: string) => void;
    onMergeWithPrev: (atIndex: number, currentHtml: string) => void;
    onNavigatePrev: (atIndex: number, col: number) => void;
    onNavigateNext: (atIndex: number, col: number) => void;
}

interface MenuPos { top: number; left: number; }

// ── Markdown prefix → block type ─────────────────────────────────────────────

const SHORTCUTS: { prefix: string; type: BlockType }[] = [
    { prefix: "# ", type: "h1" },
    { prefix: "## ", type: "h2" },
    { prefix: "### ", type: "h3" },
    { prefix: "- ", type: "list_bullet" },
    { prefix: "> ", type: "quote" },
];

const SLASH_ITEMS: { label: string; type: BlockType; icon: React.ReactNode }[] = [
    { label: "Text", type: "paragraph", icon: <TextIcon size={15} /> },
    { label: "Heading 1", type: "h1", icon: <Heading1 size={15} /> },
    { label: "Heading 2", type: "h2", icon: <Heading2 size={15} /> },
    { label: "Heading 3", type: "h3", icon: <Heading3 size={15} /> },
    { label: "Bullet list", type: "list_bullet", icon: <List size={15} /> },
    { label: "Quote", type: "quote", icon: <Quote size={15} /> },
];


// ── Block styling ─────────────────────────────────────────────────────────────

function blockClasses(type: BlockType): string {
    const base = "w-full min-h-[1.5em] bg-transparent focus:outline-none break-words";
    switch (type) {
        case "h1": return `${base} text-4xl font-bold pt-3 pb-1 leading-tight`;
        case "h2": return `${base} text-3xl font-semibold pt-2 pb-1 leading-tight`;
        case "h3": return `${base} text-2xl font-medium pt-2 pb-1 leading-tight`;
        case "quote": return `${base} py-1 leading-loose italic text-muted-foreground`;
        case "list_bullet": return `${base} py-0.5 leading-loose text-base`;
        default: return `${base} py-1 leading-loose tracking-wide text-base`;
    }
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

/** Returns the plain-text offset of the caret within `el`. */
function getCaretOffset(el: HTMLElement): number {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
}

/** Checks if caret is on the first line of `el` (no newline before caret). */
function caretOnFirstLine(el: HTMLElement): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return true;
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return !pre.toString().includes('\n');
}

/** Checks if caret is on the last line of `el`. */
function caretOnLastLine(el: HTMLElement): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return true;
    const range = sel.getRangeAt(0);
    const post = range.cloneRange();
    post.selectNodeContents(el);
    post.setStart(range.endContainer, range.endOffset);
    return !post.toString().includes('\n');
}

/** Checks if caret is collapsed and at the start of `el`. */
function caretAtStart(el: HTMLElement): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length === 0;
}

/** Returns current column (chars since last \n, or since start). */
function caretColumn(el: HTMLElement): number {
    const offset = getCaretOffset(el);
    const text = el.textContent || '';
    const lastNl = text.lastIndexOf('\n', offset - 1);
    return lastNl === -1 ? offset : offset - lastNl - 1;
}

/** Sets caret at a text offset within `el`. */
function setCaretAtOffset(el: HTMLElement, offset: number) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node: Node | null;
    while ((node = walker.nextNode())) {
        const len = (node.textContent || '').length;
        if (remaining <= len) {
            const range = document.createRange();
            range.setStart(node, remaining);
            range.collapse(true);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            return;
        }
        remaining -= len;
    }
    // fallback: end of element
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
}

/** Extracts HTML content before and after the current selection. */
function getSplitHtml(el: HTMLElement): { before: string; after: string } {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { before: el.innerHTML, after: '' };
    const range = sel.getRangeAt(0).cloneRange();

    const beforeRange = document.createRange();
    beforeRange.selectNodeContents(el);
    beforeRange.setEnd(range.startContainer, range.startOffset);

    const afterRange = document.createRange();
    afterRange.selectNodeContents(el);
    afterRange.setStart(range.endContainer, range.endOffset);

    const wrapHtml = (r: Range) => {
        const d = document.createElement('div');
        d.appendChild(r.cloneContents());
        return d.innerHTML;
    };
    return { before: wrapHtml(beforeRange), after: wrapHtml(afterRange) };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BlockItem({
    block, index, isActive,
    onUpdate, onTypeChange, onFocus,
    onInsertBelow, onMergeWithPrev,
    onNavigatePrev, onNavigateNext,
}: BlockItemProps) {
    const editableRef = useRef<HTMLDivElement>(null);

    const [isFocused, setIsFocused] = useState(false);
    const [slashOpen, setSlashOpen] = useState(false);
    const [slashPos, setSlashPos] = useState<MenuPos>({ top: 0, left: 0 });

    // Initialise content when block ID changes (new block mounted)
    useEffect(() => {
        if (editableRef.current) {
            editableRef.current.innerHTML = block.content || '';
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [block.id]);

    // Sync content changes from outside (e.g. merge) when not focused
    useEffect(() => {
        if (editableRef.current && !isFocused) {
            editableRef.current.innerHTML = block.content || '';
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [block.content]);

    // Focus when parent activates this block
    useEffect(() => {
        if (isActive && editableRef.current && document.activeElement !== editableRef.current) {
            const el = editableRef.current;
            el.focus();
            // If parent set a target column via data attribute, use it
            const colStr = el.dataset.targetCol;
            if (colStr !== undefined) {
                delete el.dataset.targetCol;
                const col = parseInt(colStr, 10);
                const text = el.textContent || '';
                const targetOffset = Math.min(col, text.length);
                setTimeout(() => setCaretAtOffset(el, targetOffset), 0);
            }
        }
    }, [isActive]);

    // ── Focus / blur ──────────────────────────────────────────────────────────

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        onFocus();
    }, [onFocus]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
        const related = e.relatedTarget as Node | null;
        if (document.getElementById('slash-menu')?.contains(related)) return;
        setIsFocused(false);
        setSlashOpen(false);
        // Persist content on blur
        if (editableRef.current) {
            onUpdate(block.id, editableRef.current.innerHTML);
        }
    }, [block.id, onUpdate]);

    // ── Input ─────────────────────────────────────────────────────────────────

    const handleInput = useCallback(() => {
        const el = editableRef.current;
        if (!el) return;

        const html = el.innerHTML;
        const text = el.textContent || '';

        onUpdate(block.id, html);

        // Slash command
        if (text === '/') {
            const rect = el.getBoundingClientRect();
            setSlashPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
            setSlashOpen(true);
            return;
        }

        // Markdown type shortcuts
        const match = SHORTCUTS.find(sh => text.startsWith(sh.prefix));
        if (match) {
            onTypeChange(block.id, match.type);
            el.innerHTML = '';
            onUpdate(block.id, '');
        } else {
            setSlashOpen(false);
        }
    }, [block.id, onUpdate, onTypeChange]);

    // ── Keyboard ──────────────────────────────────────────────────────────────

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        const el = editableRef.current!;

        // Slash menu: close on Escape or Backspace if only "/"
        if (slashOpen) {
            if (e.key === 'Escape') { e.preventDefault(); setSlashOpen(false); }
            if (e.key === 'Backspace' && el.textContent === '/') { e.preventDefault(); setSlashOpen(false); el.innerHTML = ''; onUpdate(block.id, ''); }
            return;
        }

        // Enter → split block (Shift+Enter = native <br>)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const { before, after } = getSplitHtml(el);
            onUpdate(block.id, before);
            el.innerHTML = before;
            const nextType = block.type === 'list_bullet'
                ? (el.textContent?.trim() ? 'list_bullet' : 'paragraph')
                : 'paragraph';
            onInsertBelow(index, nextType as BlockType, after);
            return;
        }

        // Backspace at start of block
        if (e.key === 'Backspace' && caretAtStart(el)) {
            if (block.type !== 'paragraph') {
                // Reset type first
                e.preventDefault();
                onTypeChange(block.id, 'paragraph');
                return;
            }
            // Merge with previous block
            e.preventDefault();
            onMergeWithPrev(index, el.innerHTML);
            return;
        }

        // Arrow navigation between blocks
        if (e.key === 'ArrowUp' && caretOnFirstLine(el)) {
            if (index > 0) {
                e.preventDefault();
                onNavigatePrev(index, caretColumn(el));
            }
            return;
        }
        if (e.key === 'ArrowDown' && caretOnLastLine(el)) {
            if (true) { // parent checks bounds
                e.preventDefault();
                onNavigateNext(index, caretColumn(el));
            }
            return;
        }
    }, [slashOpen, block, index, onUpdate, onTypeChange, onInsertBelow, onMergeWithPrev, onNavigatePrev, onNavigateNext]);

    // ── Slash menu ────────────────────────────────────────────────────────────

    const handleTypeSelect = useCallback((type: BlockType) => {
        if (editableRef.current) editableRef.current.innerHTML = '';
        onTypeChange(block.id, type);
        onUpdate(block.id, '');
        setSlashOpen(false);
        setTimeout(() => editableRef.current?.focus(), 0);
    }, [block.id, onTypeChange, onUpdate]);

    // ── Rendering ─────────────────────────────────────────────────────────────

    const bullet = block.type === 'list_bullet' && (
        <span className="select-none text-muted-foreground mt-[7px] pr-2 shrink-0">•</span>
    );
    const quoteBar = block.type === 'quote' && (
        <div className="w-1 rounded-full bg-primary shrink-0 mr-3 self-stretch" />
    );

    const isEmpty = !block.content || block.content === '<br>' || block.content === '';

    return (
        <div className={`group relative flex w-full items-start ${block.type === 'list_bullet' ? 'my-0' : 'my-0.5'}`}>
            {quoteBar}
            {bullet}

            <div
                ref={editableRef}
                id={`block-${block.id}`}
                contentEditable
                suppressContentEditableWarning
                data-placeholder={
                    index === 0 && isEmpty ? "Start writing or type '/' for commands…"
                        : isFocused && isEmpty ? "Type '/' for commands…"
                            : ''
                }
                data-block-id={block.id}
                className={`${blockClasses(block.type)} ${isEmpty ? 'empty-block' : ''}`}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
            />

            {/* Slash command menu */}
            {slashOpen && createPortal(
                <div
                    id="slash-menu"
                    tabIndex={-1}
                    style={{ position: 'absolute', top: slashPos.top, left: slashPos.left }}
                    className="z-50 w-56 rounded-md border border-border bg-popover p-1 shadow-lg"
                >
                    <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Turn into</p>
                    {SLASH_ITEMS.map(item => (
                        <button
                            key={item.type}
                            onMouseDown={(e) => { e.preventDefault(); handleTypeSelect(item.type); }}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                        >
                            {item.icon} {item.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}

        </div>
    );
}
