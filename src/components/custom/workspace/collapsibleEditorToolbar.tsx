'use client'

import { useState } from 'react';
import { EditorToolbar } from './editorToolbar';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleEditorToolbarProps {
    noteTitle?: string;
}

export function CollapsibleEditorToolbar({ noteTitle }: CollapsibleEditorToolbarProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="md:hidden w-full">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0 rounded-full mb-2"
            >
                {isExpanded ? <ChevronUp size={14} /> : <Settings2 size={14} />}
            </Button>
            <div
                className={cn(
                    'overflow-x-auto transition-all duration-300 ease-in-out',
                    isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                )}
            >
                <div className="p-2 bg-popover rounded-lg border border-border min-w-max inline-block">
                    <EditorToolbar />
                </div>
            </div>
        </div>
    );
}
