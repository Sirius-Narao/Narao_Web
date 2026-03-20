'use client'

import { createContext, useContext, useState } from 'react';
import { Editor } from '@tiptap/react';

interface EditorContextValue {
    editor: Editor | null;
    setEditor: (editor: Editor | null) => void;
}

const EditorContext = createContext<EditorContextValue>({
    editor: null,
    setEditor: () => {},
});

export function EditorProvider({ children }: { children: React.ReactNode }) {
    const [editor, setEditor] = useState<Editor | null>(null);
    return (
        <EditorContext.Provider value={{ editor, setEditor }}>
            {children}
        </EditorContext.Provider>
    );
}

export const useEditorInstance = () => useContext(EditorContext);
