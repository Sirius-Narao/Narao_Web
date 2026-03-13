export type ContentType = string;
export type FetchedFolders = Folder[];
export type FetchedNotes = Note[];



export type Note = {
    id: string;
    user_id?: string;
    title: string;
    content: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
    folder_id?: string;
}

export type Folder = {
    id: string;
    user_id?: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    parent_id?: string;
    color?: FolderColor;
}

export type FolderColor = "folder-red" | "folder-blue" | "folder-green" | "folder-yellow" | "folder-purple" | "folder-orange" | "folder-pink" | "folder-cyan" | "folder-lime" | "folder-teal" | "folder-indigo" | "folder-rose" | "folder-amber" | "folder-brown" | "folder-slate" | "folder-gray" | "folder-black" | "folder-white";
