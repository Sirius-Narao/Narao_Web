'use client'

import { useContent } from "@/context/contentContext";
import { useEditorInstance } from "@/context/editorContext";
import { useSettings } from "@/context/settingsContext";
import { SpellcheckExtension } from "@/lib/spellcheckExtension";
import { useEffect, useState } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import "katex/dist/katex.min.css";
import Placeholder from '@tiptap/extension-placeholder';

import { SpellcheckHoverMenu } from './spellcheckHoverMenu';
import { MathAwareCodeBlock } from './mathAwareCodeBlock';
import { MathAwareInlineNode } from '../../../lib/mathAwareInlineNode';
import { CustomTable } from './customTable';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';

/** Decode HTML entities in a string (e.g. &lt; → <, &gt; → >, &amp; → &) */
const decodeHtmlEntities = (s: string) =>
    s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

/** Encode a LaTeX string so it is safe to place inside an HTML attribute value. */
const encodeLatex = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Heal a markdown string that may contain `<span data-type="inlineMath" data-latex="L">` tags
 * (produced by a broken previous serialiser) by converting them back to `$L$`.
 * Also converts `<span data-type="inlineMath" data-latex="L"></span>` (self-closing style).
 */
const healInlineMathSpans = (str: string): string =>
    str.replace(
        /<span[^>]*data-type="inlineMath"[^>]*data-latex="([^"]*)"[^>]*>(?:<\/span>)?/g,
        (_, latex) => `$${decodeHtmlEntities(latex)}$`
    );

/**
 * Convert the markdown/DB content into the format that tiptap-markdown + our
 * custom extensions expect:
 *   $$\n…\n$$  →  ```math\n…\n```   (for MathAwareCodeBlock)
 *   $…$        →  <span data-type="inlineMath" …>  (for MathAwareInlineNode)
 *
 * Inline-HTML spans are NOT used for $…$ here because tiptap-markdown's
 * marked.js tokeniser does not parse inline <span> as ProseMirror nodes.
 * Instead we rely on tiptap-markdown's ability to call each extension's
 * parseHTML rules when the content goes through ProseMirror's DOMParser.
 *
 * To keep things consistent:
 *  - heal any pre-existing <span data-type="inlineMath"> back to $…$ first
 *  - then let tiptap-markdown / ProseMirror parse the clean markdown
 */
const prepareContent = (raw: string): string => {
    // Step 0 – heal old DB content that has HTML-encoded inline math spans
    let result = healInlineMathSpans(raw);

    // Step 1 – block math $$\n…\n$$ → ```math\n…\n```
    // Handle both LF and CRLF line endings
    result = result.replace(/\$\$\s*\r?\n([\s\S]*?)\r?\n\s*\$\$/g, '```math\n$1\n```');

    // Step 2 – inline math $…$ → <span data-type="inlineMath" …>
    // Only transform text that is NOT inside an HTML tag (e.g. don't touch
    // style="color: …" attributes that may contain $ signs).
    result = result
        .split(/(<[^>]*>)/g)          // split, keeping HTML tags as odd tokens
        .map((part, i) => {
            if (i % 2 !== 0) return part;   // HTML tag → leave untouched
            return part.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_, latex) =>
                `<span data-type="inlineMath" data-latex="${encodeLatex(latex)}" data-evaluate="no" data-display="no"></span>`
            );
        })
        .join('');

    return result;
};

/**
 * Sanitise the markdown produced by getMarkdown():
 *  - convert ```math back to $$
 *  - heal any <span data-type="inlineMath"> that the serialiser failed to
 *    convert to $…$ (fallback, keeps DB clean)
 */
const sanitiseMarkdown = (md: string): string => {
    let result = md.replace(/```math\r?\n([\s\S]*?)\r?\n```/g, '$$\n$1\n$$');
    result = healInlineMathSpans(result);
    return result;
};

export default function Editor() {
    const { content, setContent } = useContent();
    const { setEditor } = useEditorInstance();
    const { settings } = useSettings();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false,
            }),
            TextStyle,
            Color,
            MathAwareCodeBlock,
            MathAwareInlineNode,
            CustomTable.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            Markdown.configure({
                html: true,
                transformPastedText: true,
                transformCopiedText: true,
            }),
            Placeholder.configure({
                placeholder: 'Start typing your note here...',
            }),
            SpellcheckExtension.configure({
                getLanguages: () => settings.spellcheckLanguages || ['en-US'],
            })
        ],
        content: prepareContent(content),
        editorProps: {
            attributes: {
                class: "w-full min-h-[50vh] bg-transparent border-none outline-none resize-none text-foreground text-lg leading-relaxed font-sans focus:outline-none",
            },
        },
        onUpdate: ({ editor }) => {
            const raw = (editor.storage as any).markdown.getMarkdown();
            setContent(sanitiseMarkdown(raw));
        },
        immediatelyRender: false,
    });

    // Register editor instance into shared context so toolbar can consume it
    useEffect(() => {
        const timer = setTimeout(() => {
            setEditor(editor ?? null);
        }, 0);
        return () => {
            clearTimeout(timer);
            setEditor(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor]);

    // Sync external content changes (e.g. AI tool writes the note) into the editor
    useEffect(() => {
        if (editor && content && !editor.isFocused) {
            const normalize = (s: string | null | undefined) => (s || "").trim();
            const currentMd = sanitiseMarkdown((editor.storage as any).markdown.getMarkdown());
            if (normalize(content) !== normalize(currentMd)) {
                const timer = setTimeout(() => {
                    if (editor && !editor.isDestroyed) {
                        editor.commands.setContent(prepareContent(content));
                    }
                }, 0);
                return () => clearTimeout(timer);
            }
        }
    }, [content, editor]);

    if (!isMounted) {
        return null;
    }

    return (
        <div className="bg-transparent w-full h-full relative">
            <div className="absolute top-0 w-[calc(100%-2rem)] h-12 bg-gradient-to-b from-card to-transparent pointer-events-none z-50" />
            <div className="absolute bottom-0 w-[calc(100%-2rem)] h-12 bg-gradient-to-t from-card to-transparent pointer-events-none z-50" />

            <div className="w-full h-full px-[12%] py-12 overflow-y-auto scrollbar-no-bg! pb-[50vh]">
                <div className="max-w-4xl mx-auto flex flex-col gap-1 outline-none tiptap-wrapper ">
                    <EditorContent
                        editor={editor}
                        className="w-full flex-grow max-w-none "
                    />
                </div>
            </div>

            <SpellcheckHoverMenu editor={editor} />
        </div>
    );
}