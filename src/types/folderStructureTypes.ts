export type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'list_bullet' | 'quote';

export interface EditorBlock {
    id: string; // Unique UUID for React keys and focus management
    type: BlockType;
    content: string; // The markdown/text content
    styles?: Record<string, string>; // e.g. { color: 'red' }
}

export type ContentType = {
    blocks: EditorBlock[];
}

export type Note = {
    id: string;
    user_id?: string;
    title: string;
    content: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
}

export type Folder = {
    id: string;
    user_id?: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    notesIds?: string[];
    foldersIds?: string[];
    color?: FolderColor;
}

export type FolderColor = "folder-red" | "folder-blue" | "folder-green" | "folder-yellow" | "folder-purple" | "folder-orange" | "folder-pink" | "folder-cyan" | "folder-lime" | "folder-teal" | "folder-indigo" | "folder-rose" | "folder-amber" | "folder-brown" | "folder-slate" | "folder-gray" | "folder-black" | "folder-white";
