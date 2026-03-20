'use client'

import { useContent } from "@/context/contentContext";
import { useEditorInstance } from "@/context/editorContext";
import { useEffect, useState } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import "katex/dist/katex.min.css";
import Placeholder from '@tiptap/extension-placeholder';

import { MathAwareCodeBlock } from './mathAwareCodeBlock';
import { MathAwareInlineNode } from '../../../lib/mathAwareInlineNode';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';

export default function Editor() {
    const { content, setContent } = useContent();
    const { setEditor } = useEditorInstance();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Transform $$ blocks to ```math blocks for tiptap-markdown parser
    // Also transform inline $math$ to <span data-type="inlineMath" ...></span> for HTML parsing
    const encodeLatex = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    let parsedContent = content.replace(/\$\$\n([\s\S]*?)\n\$\$/g, '```math\n$1\n```');
    parsedContent = parsedContent.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (match, latex) => {
        return `<span data-type="inlineMath" data-latex="${encodeLatex(latex)}" data-evaluate="no" data-display="no"></span>`;
    });

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false,
            }),
            TextStyle,
            Color,
            MathAwareCodeBlock,
            MathAwareInlineNode,
            Table.configure({ resizable: false }),
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
            })
        ],
        content: parsedContent,
        editorProps: {
            attributes: {
                class: "w-full min-h-[50vh] bg-transparent border-none outline-none resize-none text-foreground text-lg leading-relaxed font-sans focus:outline-none",
            },
        },
        onUpdate: ({ editor }) => {
            let md = (editor.storage as any).markdown.getMarkdown();
            // Transform ```math blocks back to $$ blocks for database storage
            md = md.replace(/```math\n([\s\S]*?)\n```/g, '$$\n$1\n$$');
            setContent(md);
        },
        immediatelyRender: false,
    });

    // Register editor instance into shared context so toolbar can consume it
    useEffect(() => {
        setEditor(editor ?? null);
        return () => setEditor(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor]);

    useEffect(() => {
        if (editor && content && !editor.isFocused) {
            const currentMd = (editor.storage as any).markdown.getMarkdown().replace(/```math\n([\s\S]*?)\n```/g, '$$\n$1\n$$');
            if (content !== currentMd) {
                let newParsed = content.replace(/\$\$\n([\s\S]*?)\n\$\$/g, '```math\n$1\n```');
                newParsed = newParsed.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (match, latex) => {
                    return `<span data-type="inlineMath" data-latex="${encodeLatex(latex)}" data-evaluate="no" data-display="no"></span>`;
                });
                editor.commands.setContent(newParsed);
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
        </div>
    );
}