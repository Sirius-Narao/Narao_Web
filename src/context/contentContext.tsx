"use client";
import { useState, createContext, Dispatch, SetStateAction, useContext, ReactNode } from "react";
import { ContentType } from "@/types/folderStructureTypes";

interface ContentContextType {
    content: ContentType;
    setContent: Dispatch<SetStateAction<ContentType>>;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

function ContentProvider({ children }: { children: ReactNode }) {
    const [content, setContent] = useState<ContentType>({ blocks: [] });

    return (
        <ContentContext.Provider value={{ content, setContent }}>
            {children}
        </ContentContext.Provider>
    );
}

function useContent() {
    const context = useContext(ContentContext);
    if (context === undefined) {
        throw new Error("useContent must be used within a ContentProvider");
    }
    return context;
}

export { ContentProvider, useContent };
