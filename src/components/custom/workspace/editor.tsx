'use client'

import { useContent } from "@/context/contentContext";
import { BlockType } from "@/types/folderStructureTypes";
import { useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { createPortal } from "react-dom";
import { Bold, Italic, Strikethrough, Code, Eraser } from "lucide-react";
import BlockItem from "./blockItem";

const COLORS = [
    { label: "Red", value: "#ef4444" },
    { label: "Orange", value: "#f97316" },
    { label: "Yellow", value: "#eab308" },
    { label: "Green", value: "#22c55e" },
    { label: "Blue", value: "#3b82f6" },
    { label: "Purple", value: "#a855f7" },
    { label: "Gray", value: "#6b7280" },
];

function Fbtn({ title, onDown, children }: { title: string; onDown: () => void; children: React.ReactNode }) {
    return (
        <button title={title} onMouseDown={(e) => { e.preventDefault(); onDown(); }} className="rounded p-1 hover:bg-accent">
            {children}
        </button>
    );
}

export default function Editor() {
    const { content, setContent } = useContent();
    const [activeBlockId, setActiveBlockId] = useState<string | null>(content.blocks?.[0]?.id || null);

    const containerRef = useRef<HTMLDivElement>(null);
    const [fmtOpen, setFmtOpen] = useState(false);
    const [fmtPos, setFmtPos] = useState({ top: 0, left: 0 });

    // ── Block state utilities ─────────────────────────────────────────────────

    const updateBlock = (id: string, newContent: string) =>
        setContent(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => b.id === id ? { ...b, content: newContent } : b)
        }));

    const updateBlockType = (id: string, newType: BlockType) =>
        setContent(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => b.id === id ? { ...b, type: newType } : b)
        }));

    const deleteBlock = (index: number) => {
        if (content.blocks.length <= 1) return;
        setContent(prev => ({
            ...prev,
            blocks: prev.blocks.filter((_, i) => i !== index)
        }));
    };

    // ── Callbacks for BlockItem ───────────────────────────────────────────────

    /** Called when a block is split (Enter key). */
    const handleInsertBelow = (atIndex: number, type: BlockType, html: string) => {
        const newId = uuidv4();
        setContent(prev => {
            const newBlocks = [...prev.blocks];
            newBlocks.splice(atIndex + 1, 0, { id: newId, type, content: html });
            return { ...prev, blocks: newBlocks };
        });
        setTimeout(() => {
            setActiveBlockId(newId);
            const el = document.getElementById(`block-${newId}`);
            if (el) {
                el.focus();
                // Place caret at the very start of the new block
                const range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(true);
                window.getSelection()?.removeAllRanges();
                window.getSelection()?.addRange(range);
            }
        }, 0);
    };

    /** Called when Backspace is pressed at the start of a paragraph block → merge with previous. */
    const handleMergeWithPrev = (atIndex: number, currentHtml: string) => {
        if (atIndex === 0) return;
        const prevBlock = content.blocks[atIndex - 1];

        // Compute character length of prev block's text (for cursor placement)
        const tmp = document.createElement('div');
        tmp.innerHTML = prevBlock.content;
        const prevTextLen = (tmp.textContent || '').length;

        updateBlock(prevBlock.id, prevBlock.content + currentHtml);
        deleteBlock(atIndex);

        setTimeout(() => {
            setActiveBlockId(prevBlock.id);
            const el = document.getElementById(`block-${prevBlock.id}`) as HTMLElement | null;
            if (el) {
                el.dataset.targetCol = String(prevTextLen);
                el.focus();
            }
        }, 0);
    };

    /** Called when ArrowUp navigates from the first line of a block. */
    const handleNavigatePrev = (atIndex: number, col: number) => {
        if (atIndex === 0) return;
        const prevId = content.blocks[atIndex - 1].id;
        setActiveBlockId(prevId);
        setTimeout(() => {
            const el = document.getElementById(`block-${prevId}`) as HTMLElement | null;
            if (el) {
                // Compute position on the last line of the previous block
                const tmp = document.createElement('div');
                tmp.innerHTML = content.blocks[atIndex - 1].content;
                const prevText = tmp.textContent || '';
                const lastNl = prevText.lastIndexOf('\n');
                const lastLineStart = lastNl === -1 ? 0 : lastNl + 1;
                const targetOffset = lastLineStart + Math.min(col, prevText.length - lastLineStart);
                el.dataset.targetCol = String(targetOffset);
                el.focus();
            }
        }, 0);
    };

    /** Called when ArrowDown navigates from the last line of a block. */
    const handleNavigateNext = (atIndex: number, col: number) => {
        if (atIndex >= content.blocks.length - 1) return;
        const nextId = content.blocks[atIndex + 1].id;
        setActiveBlockId(nextId);
        setTimeout(() => {
            const el = document.getElementById(`block-${nextId}`) as HTMLElement | null;
            if (el) {
                // Compute position on the first line of the next block
                const tmp = document.createElement('div');
                tmp.innerHTML = content.blocks[atIndex + 1].content;
                const nextText = tmp.textContent || '';
                const firstNl = nextText.indexOf('\n');
                const firstLineLen = firstNl === -1 ? nextText.length : firstNl;
                const targetOffset = Math.min(col, firstLineLen);
                el.dataset.targetCol = String(targetOffset);
                el.focus();
            }
        }, 0);
    };

    // ── Global Formatting (Multi-Block Support) ───────────────────────────────

    const handleMouseUp = useCallback(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
            setFmtOpen(false);
            return;
        }

        // Ensure selection is inside the editor
        if (containerRef.current && !containerRef.current.contains(sel.anchorNode)) {
            setFmtOpen(false);
            return;
        }

        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (!rect.width) return;
        setFmtPos({
            top: rect.top + window.scrollY - 48,
            left: rect.left + window.scrollX + rect.width / 2,
        });
        setFmtOpen(true);
    }, []);

    const fmt = useCallback((command: string, value?: string) => {
        if (!containerRef.current) return;

        // Apply formatting directly (container makes execCommand span blocks cleanly)
        document.execCommand(command, false, value);

        // After applying globally, read all blocks and update React state
        const blockEls = containerRef.current.querySelectorAll<HTMLDivElement>('[data-block-id]');
        const updates: Record<string, string> = {};
        blockEls.forEach((el) => {
            const id = el.getAttribute('data-block-id');
            if (id) updates[id] = el.innerHTML;
        });

        setContent(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => (
                updates[b.id] !== undefined ? { ...b, content: updates[b.id] } : b
            ))
        }));

        setFmtOpen(false);
    }, [setContent]);

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="bg-transparent w-full h-full relative" onMouseUp={handleMouseUp}>
            <div className="absolute top-0 w-full h-12 bg-gradient-to-b from-card to-transparent pointer-events-none z-0" />
            <div className="absolute bottom-0 w-full h-12 bg-gradient-to-t from-card to-transparent pointer-events-none z-0" />

            <div className="w-full h-full px-[12%] py-12 overflow-y-auto scrollbar-no-bg pb-[50vh]">
                <div
                    className="max-w-4xl mx-auto flex flex-col gap-1 outline-none"
                    ref={containerRef}
                    contentEditable
                    suppressContentEditableWarning
                >
                    {content.blocks?.map((block, i) => (
                        <BlockItem
                            key={block.id}
                            block={block}
                            index={i}
                            isActive={activeBlockId === block.id}
                            onUpdate={updateBlock}
                            onTypeChange={updateBlockType}
                            onFocus={() => setActiveBlockId(block.id)}
                            onInsertBelow={handleInsertBelow}
                            onMergeWithPrev={handleMergeWithPrev}
                            onNavigatePrev={handleNavigatePrev}
                            onNavigateNext={handleNavigateNext}
                        />
                    ))}
                </div>
            </div>

            {/* Global Formatting toolbar */}
            {fmtOpen && createPortal(
                <div
                    id="fmt-menu"
                    tabIndex={-1}
                    style={{ position: 'absolute', top: fmtPos.top, left: fmtPos.left, transform: 'translateX(-50%)' }}
                    className="z-50 flex items-center gap-0.5 rounded-md border border-border bg-popover px-1 py-1 shadow-lg"
                >
                    <Fbtn title="Bold" onDown={() => fmt('bold')}><Bold size={14} /></Fbtn>
                    <Fbtn title="Italic" onDown={() => fmt('italic')}><Italic size={14} /></Fbtn>
                    <Fbtn title="Strikethrough" onDown={() => fmt('strikeThrough')}><Strikethrough size={14} /></Fbtn>
                    <Fbtn title="Code" onDown={() => fmt('insertHTML', `<code>${window.getSelection()?.toString()}</code>`)}><Code size={14} /></Fbtn>
                    <div className="mx-1 h-4 w-px bg-border" />
                    <span className="px-1 text-xs text-muted-foreground">Color</span>
                    {COLORS.map(c => (
                        <button
                            key={c.value}
                            title={c.label}
                            onMouseDown={(e) => { e.preventDefault(); fmt('foreColor', c.value); }}
                            className="h-4 w-4 rounded-sm border border-border transition-transform hover:scale-110"
                            style={{ backgroundColor: c.value }}
                        />
                    ))}
                    <Fbtn title="Remove formatting" onDown={() => fmt('removeFormat')}><Eraser size={12} /></Fbtn>
                </div>,
                document.body
            )}
        </div>
    );
}