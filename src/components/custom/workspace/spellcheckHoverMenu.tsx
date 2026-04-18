import React, { useEffect, useState, useRef } from 'react';
import { Editor } from '@tiptap/react';

interface SpellcheckHoverMenuProps {
    editor: Editor | null;
}

export const SpellcheckHoverMenu: React.FC<SpellcheckHoverMenuProps> = ({ editor }) => {
    const [hoverData, setHoverData] = useState<{
        visible: boolean;
        x: number;
        y: number;
        message: string;
        replacements: string[];
        from: number;
        to: number;
        target: HTMLElement | null;
    }>({
        visible: false,
        x: 0,
        y: 0,
        message: '',
        replacements: [],
        from: 0,
        to: 0,
        target: null,
    });

    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!editor || !editor.view.dom) return;

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target && target.classList.contains('spellcheck-error')) {
                if (hideTimeoutRef.current) {
                    clearTimeout(hideTimeoutRef.current);
                }

                const rect = target.getBoundingClientRect();
                const from = parseInt(target.getAttribute('data-from') || '0', 10);
                const to = parseInt(target.getAttribute('data-to') || '0', 10);
                const message = target.getAttribute('data-message') || '';
                let replacements: string[] = [];
                try {
                    replacements = JSON.parse(target.getAttribute('data-replacements') || '[]');
                } catch (e) {}

                setHoverData({
                    visible: true,
                    x: rect.left,
                    y: rect.bottom,
                    message,
                    replacements,
                    from,
                    to,
                    target,
                });
            }
        };

        const handleMouseOut = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target && target.classList.contains('spellcheck-error')) {
                hideTimeoutRef.current = setTimeout(() => {
                    setHoverData(prev => ({ ...prev, visible: false }));
                }, 300); // give time to move mouse to the menu
            }
        };

        const dom = editor.view.dom;
        dom.addEventListener('mouseover', handleMouseOver);
        dom.addEventListener('mouseout', handleMouseOut);

        return () => {
            dom.removeEventListener('mouseover', handleMouseOver);
            dom.removeEventListener('mouseout', handleMouseOut);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, [editor]);

    const handleMenuMouseEnter = () => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
    };

    const handleMenuMouseLeave = () => {
        hideTimeoutRef.current = setTimeout(() => {
            setHoverData(prev => ({ ...prev, visible: false }));
        }, 300);
    };

    const replaceWord = (replacement: string) => {
        if (!editor) return;
        
        // Use tiptap commands to replace the word using the from/to offsets we saved
        editor.commands.insertContentAt({ from: hoverData.from, to: hoverData.to }, replacement);
        
        // Hide tooltip immediately
        setHoverData(prev => ({ ...prev, visible: false }));
    };

    if (!hoverData.visible) return null;

    return (
        <div
            ref={menuRef}
            onMouseEnter={handleMenuMouseEnter}
            onMouseLeave={handleMenuMouseLeave}
            className="fixed z-50 bg-card border border-popover text-foreground rounded-md px-3 py-2 text-sm shadow-lg flex flex-col gap-2 max-w-[250px] animate-in fade-in-0 zoom-in-95"
            style={{
                top: hoverData.y + 4, // A little padding below the word
                left: hoverData.x,
            }}
        >
            <div className="font-medium text-xs text-muted-foreground mb-1 leading-snug">
                {hoverData.message}
            </div>
            {hoverData.replacements && hoverData.replacements.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {hoverData.replacements.map((r, i) => (
                        <button
                            key={i}
                            onClick={() => replaceWord(r)}
                            className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-2 py-1 rounded transition-colors text-xs"
                        >
                            {r}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
