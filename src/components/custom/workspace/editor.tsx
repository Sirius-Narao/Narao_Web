'use client'

import { useContent } from "@/context/contentContext";
import { useRef, useEffect } from "react";

export default function Editor() {
    const { content, setContent } = useContent();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea to fit content
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [content]);

    return (
        <div className="bg-transparent w-full h-full relative">
            <div className="absolute top-0 w-full h-12 bg-gradient-to-b from-card to-transparent pointer-events-none z-0" />
            <div className="absolute bottom-0 w-full h-12 bg-gradient-to-t from-card to-transparent pointer-events-none z-0" />

            <div className="w-full h-full px-[12%] py-12 overflow-y-auto scrollbar-no-bg pb-[50vh]">
                <div className="max-w-4xl mx-auto flex flex-col gap-1 outline-none">
                    <textarea
                        ref={textareaRef}
                        className="w-full bg-transparent border-none outline-none resize-none text-foreground text-lg leading-relaxed placeholder:text-muted-foreground/30 font-sans"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Start typing your note here..."
                        spellCheck={false}
                    />
                </div>
            </div>
        </div>
    );
}