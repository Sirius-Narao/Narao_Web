export type Note = {
    id: string;
    title: string;
    content: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
    tags?: string[];
}

export type Folder = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    notesIds?: string[];
    foldersIds?: string[];
}