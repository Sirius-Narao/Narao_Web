'use client'

import { useEditorInstance } from "@/context/editorContext";
import { useEditorState } from "@tiptap/react";
import { cn } from "@/lib/utils";
import {
    Bold,
    Italic,
    Strikethrough,
    Code,
    List,
    ListOrdered,
    ListTodo,
    Quote,
    Image as ImageIcon,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useUser } from "@/context/userContext";

export function MobileEditorToolbar() {
    const { editor } = useEditorInstance();
    const { user } = useUser();
    const [isVisible, setIsVisible] = useState(false);
    const [viewportHeight, setViewportHeight] = useState(0);
    const toolbarRef = useRef<HTMLDivElement>(null);
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
                isBulletList: e.isActive("bulletList"),
                isOrderedList: e.isActive("orderedList"),
                isTaskList: e.isActive("taskList"),
            };
        },
    });

    // Use Visual Viewport API to track keyboard and adjust position
    useEffect(() => {
        const visualViewport = window.visualViewport;
        
        if (visualViewport) {
            const handleViewportChange = () => {
                setViewportHeight(visualViewport.height);
            };

            visualViewport.addEventListener('resize', handleViewportChange);
            visualViewport.addEventListener('scroll', handleViewportChange);
            
            // Initial call
            handleViewportChange();

            return () => {
                visualViewport.removeEventListener('resize', handleViewportChange);
                visualViewport.removeEventListener('scroll', handleViewportChange);
            };
        } else {
            // Fallback for browsers without Visual Viewport API
            setViewportHeight(window.innerHeight);
            const handleResize = () => setViewportHeight(window.innerHeight);
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, []);

    // Handle editor focus/blur
    useEffect(() => {
        if (!editor) return;

        const handleFocus = () => setIsVisible(true);
        const handleBlur = () => {
            // Delay hiding to allow toolbar interactions
            setTimeout(() => setIsVisible(false), 300);
        };

        editor.on('focus', handleFocus);
        editor.on('blur', handleBlur);

        return () => {
            editor.off('focus', handleFocus);
            editor.off('blur', handleBlur);
        };
    }, [editor]);

    const formatButtons = [
        {
            icon: <Bold size={18} />,
            isActive: editorState?.isBold,
            action: () => editor?.chain().focus().toggleBold().run(),
        },
        {
            icon: <Italic size={18} />,
            isActive: editorState?.isItalic,
            action: () => editor?.chain().focus().toggleItalic().run(),
        },
        {
            icon: <Strikethrough size={18} />,
            isActive: editorState?.isStrike,
            action: () => editor?.chain().focus().toggleStrike().run(),
        },
        {
            icon: <Code size={18} />,
            isActive: editorState?.isCode,
            action: () => editor?.chain().focus().toggleCode().run(),
        },
        {
            icon: <Quote size={18} />,
            isActive: editorState?.isBlockquote,
            action: () => editor?.chain().focus().toggleBlockquote().run(),
        },
        {
            icon: <List size={18} />,
            isActive: editorState?.isBulletList,
            action: () => editor?.chain().focus().toggleBulletList().run(),
        },
        {
            icon: <ListOrdered size={18} />,
            isActive: editorState?.isOrderedList,
            action: () => editor?.chain().focus().toggleOrderedList().run(),
        },
        {
            icon: <ListTodo size={18} />,
            isActive: editorState?.isTaskList,
            action: () => editor?.chain().focus().toggleTaskList().run(),
        },
        {
            icon: <ImageIcon size={18} />,
            isActive: false,
            action: handleImageClick,
        },
    ];

    if (!isVisible || viewportHeight === 0) return null;

    // Calculate position based on visual viewport to sit above keyboard
    const toolbarStyle = {
        position: 'fixed' as const,
        bottom: `${Math.max(0, window.innerHeight - viewportHeight)}px`,
        left: '0',
        right: '0',
        zIndex: 50,
    };

    return (
        <div 
            ref={toolbarRef}
            style={toolbarStyle}
            className="md:hidden"
        >
            {/* Handle bar */}
            <div className="flex justify-center py-2 bg-popover/95 backdrop-blur-sm border-t border-border">
                <div 
                    className="w-10 h-1 bg-muted-foreground/30 rounded-full cursor-pointer"
                    onClick={() => setIsVisible(false)}
                />
            </div>
            
            {/* Toolbar */}
            <div className="bg-popover/95 backdrop-blur-sm border-t border-border px-2 py-3">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                    {formatButtons.map((btn, index) => (
                        <button
                            key={index}
                            onClick={btn.action}
                            className={cn(
                                "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                                "hover:bg-primary/10",
                                btn.isActive ? "bg-primary/20 text-primary" : "text-foreground"
                            )}
                        >
                            {btn.icon}
                        </button>
                    ))}
                </div>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handleImageUpload}
                className="hidden"
            />
        </div>
    );
}
