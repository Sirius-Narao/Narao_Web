import React from "react";
import { Type } from "@google/genai";
import { supabase } from "@/lib/supabaseClient";
import { Note, Folder, FolderColor } from "@/types/folderStructureTypes";
import { folderColorClasses } from "@/constants/folderColors";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToolExecutionContext {
    userId: string;
    fetchedNotes: Note[];
    fetchedFolders: Folder[];
    setFetchedNotes: React.Dispatch<React.SetStateAction<Note[]>>;
    setFetchedFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve a /path/like/this string to the Note id, using the folder tree. */
export function resolveNotePath(
    localisation: string,
    fetchedNotes: Note[],
    fetchedFolders: Folder[]
): Note | undefined {
    if (typeof localisation !== "string") return undefined;
    // Handle optional @ prefix
    const clean = localisation.trim().replace(/^@/, "").replace(/^\//, "").replace(/\/$/, "");
    if (!clean) return undefined;

    const segments = clean.split("/").map(s => s.trim());
    const noteName = segments[segments.length - 1];
    const folderSegments = segments.slice(0, -1);

    if (folderSegments.length === 0) {
        // Root note (no folder_id)
        return fetchedNotes.find(n => !n.folder_id && n.title.toLowerCase() === noteName.toLowerCase());
    }

    // Walk the folder tree
    let currentFolder: Folder | undefined = undefined;

    for (let i = 0; i < folderSegments.length; i++) {
        const seg = folderSegments[i];
        const isRoot = i === 0;

        currentFolder = fetchedFolders.find(f =>
            f.name.toLowerCase() === seg.toLowerCase() &&
            (isRoot ? !f.parent_id : f.parent_id === currentFolder?.id)
        );

        if (!currentFolder) return undefined;
    }

    if (!currentFolder) return undefined;

    return fetchedNotes.find(
        n => n.folder_id === currentFolder!.id && n.title.toLowerCase() === noteName.toLowerCase()
    );
}

/** Resolve a /path/like/this to the Folder, or null for root. */
export function resolveFolderPath(
    localisation: string,
    fetchedFolders: Folder[]
): Folder | null | undefined {
    if (typeof localisation !== "string") return undefined;
    // Handle optional @ prefix
    const clean = localisation.trim().replace(/^@/, "").replace(/^\//, "").replace(/\/$/, "");
    if (!clean || clean === "/") return null; // root

    const segments = clean.split("/").map(s => s.trim());
    let folder: Folder | undefined;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const isRoot = i === 0;

        folder = fetchedFolders.find(f =>
            f.name.toLowerCase() === seg.toLowerCase() &&
            (isRoot ? !f.parent_id : f.parent_id === folder?.id)
        );

        if (!folder) return undefined; // not found
    }

    return folder;
}

/** Build a human-readable workspace index for the search tool. */
export function buildWorkspaceIndex(notes: Note[], folders: Folder[]): string {
    function getFolderPath(folderId: string): string {
        const folder = folders.find(f => f.id === folderId);
        if (!folder) return "";
        if (!folder.parent_id) return `/${folder.name}`;
        return `${getFolderPath(folder.parent_id)}/${folder.name}`;
    }

    const noteLines = notes.map(n => {
        const loc = n.folder_id ? `${getFolderPath(n.folder_id)}/${n.title}` : `/${n.title}`;
        return `note_name: "${n.title}" | path: ${loc} | description: ${n.description || "none"}`;
    });

    const folderLines = folders.map(f => {
        const path = getFolderPath(f.id);
        return `folder_name: "${f.name}" | path: ${path}`;
    });

    return [...folderLines, ...noteLines].join("\n");
}

// ─── Declarations ─────────────────────────────────────────────────────────────

export const WORKSPACE_TOOL_DECLARATIONS = [
    {
        name: "read_note",
        description: "Returns the full markdown content of one or more notes given their absolute paths. Alias: 'path' instead of 'localisation'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            localisation: {
                                type: Type.STRING,
                                description: "Absolute path to the note (e.g. '/maths/introduction')."
                            }
                        },
                        required: ["localisation"]
                    }
                }
            },
            required: ["items"]
        }
    },
    {
        name: "modify_note",
        description: "Replaces the entire content of one or more notes. Make sure to read them first. Alias: 'path' instead of 'localisation'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            localisation: {
                                type: Type.STRING,
                                description: "Absolute path to the note (e.g. '/maths/introduction')."
                            },
                            content: {
                                type: Type.STRING,
                                description: "The new full markdown content."
                            }
                        },
                        required: ["localisation", "content"]
                    }
                }
            },
            required: ["items"]
        }
    },
    {
        name: "create_note",
        description: "Creates one or more new notes. Alias: 'folder' for 'folder_path', 'content' for 'initial_content'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: {
                                type: Type.STRING,
                                description: "Title of the new note (max 50 characters)."
                            },
                            description: {
                                type: Type.STRING,
                                description: "Optional description."
                            },
                            folder_path: {
                                type: Type.STRING,
                                description: "Absolute path of the parent folder (e.g. '/maths'). Leave empty or '/' for root."
                            },
                            initial_content: {
                                type: Type.STRING,
                                description: "Optional initial markdown content."
                            }
                        },
                        required: ["title"]
                    }
                }
            },
            required: ["items"]
        }
    },
    {
        name: "create_folder",
        description: "Creates one or more new folders. Alias: 'parent' for 'parent_path'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: {
                                type: Type.STRING,
                                description: "Name of the new folder."
                            },
                            parent_path: {
                                type: Type.STRING,
                                description: "Absolute path of the parent folder (e.g. '/projects'). Use '/' for root."
                            },
                            color: {
                                type: Type.STRING,
                                enum: Object.keys(folderColorClasses),
                                description: "The color of the folder (e.g. 'folder-red')."
                            }
                        },
                        required: ["name", "parent_path"]
                    }
                }
            },
            required: ["items"]
        }
    },
    {
        name: "rename_folder",
        description: "Rename one or more folders. Alias: 'path' for 'localisation'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            localisation: {
                                type: Type.STRING,
                                description: "Absolute path to the folder."
                            },
                            title: {
                                type: Type.STRING,
                                description: "The new title (max 50 characters)."
                            },
                        },
                        required: ["localisation", "title"]
                    }
                }
            },
            required: ["items"]
        }
    },
    {
        name: "delete_note",
        description: "Permanently deletes one or more notes. Alias: 'path' for 'localisation'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            localisation: {
                                type: Type.STRING,
                                description: "Absolute path to the note."
                            }
                        },
                        required: ["localisation"]
                    }
                }
            },
            required: ["items"]
        }
    },
    {
        name: "delete_folder",
        description: "Permanently deletes one or more folders. Alias: 'path' for 'localisation'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            localisation: {
                                type: Type.STRING,
                                description: "Absolute path to the folder."
                            }
                        },
                        required: ["localisation"]
                    }
                }
            },
            required: ["items"]
        }
    },
    {
        name: "rename_note",
        description: "Rename one or more notes. Alias: 'path' for 'localisation'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            localisation: {
                                type: Type.STRING,
                                description: "Absolute path to the note."
                            },
                            title: {
                                type: Type.STRING,
                                description: "The new title."
                            },
                        },
                        required: ["localisation", "title"]
                    }
                }
            },
            required: ["items"]
        }
    },
    {
        name: "move_note",
        description: "Move one or more notes to different folders. Alias: 'path' for 'localisation', 'folder' for 'new_folder_path'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            localisation: {
                                type: Type.STRING,
                                description: "Absolute path to the note."
                            },
                            new_folder_path: {
                                type: Type.STRING,
                                description: "Absolute path to the new folder."
                            },
                        },
                        required: ["localisation", "new_folder_path"]
                    }
                }
            },
            required: ["items"]
        }
    },
    {
        name: "move_folder",
        description: "Move one or more folders to different parents. Alias: 'path' for 'localisation', 'parent' for 'new_parent_path'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            localisation: {
                                type: Type.STRING,
                                description: "Absolute path to the folder."
                            },
                            new_parent_path: {
                                type: Type.STRING,
                                description: "Absolute path to the new parent folder."
                            },
                        },
                        required: ["localisation", "new_parent_path"]
                    }
                }
            },
            required: ["items"]
        }
    },
    {
        name: "change_color_folder",
        description: "Change the color of one or more folders. Alias: 'path' for 'localisation'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            localisation: {
                                type: Type.STRING,
                                description: "Absolute path to the folder."
                            },
                            color: {
                                type: Type.STRING,
                                enum: ["folder-red", "folder-blue", "folder-green", "folder-yellow", "folder-purple", "folder-orange", "folder-pink", "folder-cyan", "folder-lime", "folder-teal", "folder-indigo", "folder-rose", "folder-amber", "folder-brown", "folder-slate", "folder-gray", "folder-black", "folder-white"],
                                description: "The new color of the folder."
                            },
                        },
                        required: ["localisation", "color"]
                    }
                }
            },
            required: ["items"]
        }
    },
];


// ─── Executor ─────────────────────────────────────────────────────────────────

/** Returns a plain string result to be sent back to Gemini as a functionResponse. */
export async function executeToolCall(
    name: string,
    args: Record<string, any>,
    ctx: ToolExecutionContext
): Promise<string> {
    const { userId, fetchedNotes, fetchedFolders, setFetchedNotes, setFetchedFolders } = ctx;

    switch (name) {
        // ── read_note ─────────────────────────────────────────────────────────
        case "read_note": {
            let result = "";
            for (const item of args.items) {
                const targetPath = item.localisation || item.path;
                const note = resolveNotePath(targetPath, fetchedNotes, fetchedFolders);
                if (!note) {
                    result += `\n# Error\nNote not found at path: ${targetPath}\n\n`;
                    continue;
                }

                const content = note.content && note.content.trim() !== "" 
                    ? note.content 
                    : "--- This note is currently empty ---";
                
                result += `\n# ${note.title}\n${content}\n\n`;
                console.log("Note read successfully:", note.title);
            }
            return result;
        }

        // ── modify_note ───────────────────────────────────────────────────────
        case "modify_note": {
            const results: string[] = [];
            const notesToUpdate: { id: string; content: string }[] = [];

            for (const item of args.items) {
                const targetPath = item.localisation || item.path;
                const note = resolveNotePath(targetPath, fetchedNotes, fetchedFolders);
                if (!note) {
                    results.push(`Note not found at path: ${targetPath}`);
                    continue;
                }

                const { error } = await supabase
                    .from("notes")
                    .update({ content: item.content, updated_at: new Date() })
                    .eq("id", note.id);

                if (error) {
                    results.push(`Failed to modify note "${note.title}": ${error.message}`);
                } else {
                    notesToUpdate.push({ id: note.id, content: item.content });
                    results.push(`Note "${note.title}" updated successfully.`);
                }
            }

            if (notesToUpdate.length > 0) {
                setFetchedNotes(prev =>
                    prev.map(n => {
                        const update = notesToUpdate.find(u => u.id === n.id);
                        return update ? { ...n, content: update.content, updatedAt: new Date() } : n;
                    })
                );
            }
            return results.join("\n");
        }

        // ── create_note ───────────────────────────────────────────────────────
        case "create_note": {
            const results: string[] = [];
            const newNotes: Note[] = [];

            for (const item of args.items) {
                const folderPath = item.folder_path || item.folder || "/";
                const initialContent = item.initial_content || item.content || "";
                const description = item.description || "";

                const { data: noteData, error: noteError } = await supabase
                    .from("notes")
                    .insert([{
                        user_id: userId,
                        title: item.title,
                        description: description,
                        content: initialContent,
                        tags: []
                    }])
                    .select()
                    .single();

                if (noteError || !noteData) {
                    results.push(`Failed to create note "${item.title}": ${noteError?.message}`);
                    continue;
                }

                let currentNote: Note = {
                    id: String(noteData.id),
                    title: noteData.title,
                    description: noteData.description || "",
                    content: noteData.content || "",
                    tags: noteData.tags || [],
                    createdAt: new Date(noteData.created_at),
                    updatedAt: new Date(noteData.updated_at)
                };

                // Link to parent folder if specified
                if (folderPath && folderPath !== "/" && folderPath !== "") {
                    const parentFolder = resolveFolderPath(folderPath, fetchedFolders);
                    if (parentFolder) {
                        await supabase
                            .from("notes")
                            .update({ folder_id: parentFolder.id })
                            .eq("id", currentNote.id);

                        currentNote.folder_id = String(parentFolder.id);
                        results.push(`Created note "${item.title}" in folder "${folderPath}".`);
                    } else {
                        results.push(`Note "${item.title}" created, but folder "${folderPath}" was not found. Note is in root.`);
                    }
                } else {
                    results.push(`Created note "${item.title}" in root.`);
                }
                newNotes.push(currentNote);
            }

            if (newNotes.length > 0) {
                setFetchedNotes(prev => [...prev, ...newNotes]);
            }
            return results.join("\n");
        }

        // ── create_folder ─────────────────────────────────────────────────────
        case "create_folder": {
            const results: string[] = [];
            const newFolders: Folder[] = [];

            for (const item of args.items) {
                const parentPath = item.parent_path || "/";

                // Link to parent folder
                let parentId: string | undefined = undefined;
                if (parentPath && parentPath !== "/" && parentPath !== "") {
                    const parentFolder = resolveFolderPath(parentPath, fetchedFolders);
                    if (parentFolder) {
                        parentId = String(parentFolder.id);
                    } else {
                        results.push(`Failed to create folder "${item.name}": parent folder "${parentPath}" not found.`);
                        continue;
                    }
                }

                const { data: folderData, error: folderError } = await supabase
                    .from("folders")
                    .insert([{
                        name: item.name,
                        user_id: userId,
                        parent_id: parentId,
                        color: item.color || "folder-blue",
                        created_at: new Date(),
                        updated_at: new Date()
                    }])
                    .select()
                    .single();

                if (folderError || !folderData) {
                    results.push(`Failed to create folder "${item.name}": ${folderError?.message}`);
                    continue;
                }

                const newFolder: Folder = {
                    id: String(folderData.id),
                    name: folderData.name,
                    user_id: String(folderData.user_id),
                    parent_id: folderData.parent_id ? String(folderData.parent_id) : undefined,
                    color: folderData.color as FolderColor,
                    createdAt: new Date(folderData.created_at),
                    updatedAt: new Date(folderData.updated_at)
                };

                newFolders.push(newFolder);
                if (parentId) {
                    results.push(`Created folder "${item.name}" inside "${parentPath}".`);
                } else {
                    results.push(`Created folder "${item.name}" in root.`);
                }
            }

            if (newFolders.length > 0) {
                setFetchedFolders(prev => [...prev, ...newFolders]);
            }
            return results.join("\n");
        }

        // ── delete_note ───────────────────────────────────────────────────────
        case "delete_note": {
            const results: string[] = [];
            const deletedNoteIds: string[] = [];

            for (const item of args.items) {
                const targetPath = item.localisation || item.path;
                const note = resolveNotePath(targetPath, fetchedNotes, fetchedFolders);
                if (!note) {
                    results.push(`Note not found at path: ${targetPath}`);
                    continue;
                }

                const { error } = await supabase
                    .from("notes")
                    .delete()
                    .eq("id", note.id);

                if (error) {
                    results.push(`Failed to delete note "${note.title}": ${error.message}`);
                } else {
                    deletedNoteIds.push(note.id);
                    results.push(`Note "${note.title}" deleted successfully.`);
                }
            }

            if (deletedNoteIds.length > 0) {
                setFetchedNotes(prev => prev.filter(n => !deletedNoteIds.includes(n.id)));
            }
            return results.join("\n");
        }

        // ── delete_folder ─────────────────────────────────────────────────────
        case "delete_folder": {
            const results: string[] = [];
            const deletedFolderIds: string[] = [];

            for (const item of args.items) {
                const targetPath = item.localisation || item.path;
                const folder = resolveFolderPath(targetPath, fetchedFolders);
                if (!folder) {
                    results.push(`Folder not found at path: ${targetPath}`);
                    continue;
                }

                const { error } = await supabase
                    .from("folders")
                    .delete()
                    .eq("id", folder.id);

                if (error) {
                    results.push(`Failed to delete folder "${folder.name}": ${error.message}`);
                } else {
                    deletedFolderIds.push(folder.id);
                    results.push(`Folder "${folder.name}" deleted successfully.`);
                }
            }

            if (deletedFolderIds.length > 0) {
                setFetchedFolders(prev => prev.filter(f => !deletedFolderIds.includes(f.id)));
            }
            return results.join("\n");
        }

        // ── rename_folder ─────────────────────────────────────────────────────
        case "rename_folder": {
            const results: string[] = [];
            const folderRenames: { id: string; newName: string }[] = [];

            for (const item of args.items) {
                const targetPath = item.localisation || item.path;
                const folder = resolveFolderPath(targetPath, fetchedFolders);
                if (!folder) {
                    results.push(`Folder not found at path: ${targetPath}`);
                    continue;
                }

                const { error } = await supabase
                    .from("folders")
                    .update({ name: item.title })
                    .eq("id", folder.id);

                if (error) {
                    results.push(`Failed to rename folder "${folder.name}": ${error.message}`);
                } else {
                    folderRenames.push({ id: folder.id, newName: item.title });
                    results.push(`Folder "${folder.name}" renamed to "${item.title}" successfully.`);
                }
            }

            if (folderRenames.length > 0) {
                setFetchedFolders(prev =>
                    prev.map(f => {
                        const rename = folderRenames.find(r => r.id === f.id);
                        return rename ? { ...f, name: rename.newName } : f;
                    })
                );
            }
            return results.join("\n");
        }

        // ── rename_note ───────────────────────────────────────────────────────
        case "rename_note": {
            const results: string[] = [];
            const noteRenames: { id: string; newTitle: string }[] = [];

            for (const item of args.items) {
                const targetPath = item.localisation || item.path;
                const note = resolveNotePath(targetPath, fetchedNotes, fetchedFolders);
                if (!note) {
                    results.push(`Note not found at path: ${targetPath}`);
                    continue;
                }

                const { error } = await supabase
                    .from("notes")
                    .update({ title: item.title })
                    .eq("id", note.id);

                if (error) {
                    results.push(`Failed to rename note "${note.title}": ${error.message}`);
                } else {
                    noteRenames.push({ id: note.id, newTitle: item.title });
                    results.push(`Note "${note.title}" renamed to "${item.title}" successfully.`);
                }
            }

            if (noteRenames.length > 0) {
                setFetchedNotes(prev =>
                    prev.map(n => {
                        const rename = noteRenames.find(r => r.id === n.id);
                        return rename ? { ...n, title: rename.newTitle } : n;
                    })
                );
            }
            return results.join("\n");
        }

        // ── move_folder ───────────────────────────────────────────────────────
        case "move_folder": {
            const results: string[] = [];
            const folderMoves: { id: string; newParentId: string | undefined }[] = [];

            for (const item of args.items) {
                const targetPath = item.localisation || item.path;
                const folder = resolveFolderPath(targetPath, fetchedFolders);
                if (!folder) {
                    results.push(`Folder not found at path: ${targetPath}`);
                    continue;
                }

                let newParentId: string | null = null;
                if (item.new_parent_path && item.new_parent_path !== "/") {
                    const parentFolder = resolveFolderPath(item.new_parent_path, fetchedFolders);
                    if (!parentFolder) {
                        results.push(`New parent folder not found at path: ${item.new_parent_path}`);
                        continue;
                    }
                    newParentId = parentFolder.id;
                }

                const { error } = await supabase
                    .from("folders")
                    .update({ parent_id: newParentId })
                    .eq("id", folder.id);

                if (error) {
                    results.push(`Failed to move folder "${folder.name}": ${error.message}`);
                } else {
                    folderMoves.push({ id: folder.id, newParentId: newParentId || undefined });
                    results.push(`Folder "${folder.name}" moved to "${item.new_parent_path}" successfully.`);
                }
            }

            if (folderMoves.length > 0) {
                setFetchedFolders(prev =>
                    prev.map(f => {
                        const move = folderMoves.find(m => m.id === f.id);
                        return move ? { ...f, parent_id: move.newParentId } : f;
                    })
                );
            }
            return results.join("\n");
        }

        // ── move_note ───────────────────────────────────────────────────────
        case "move_note": {
            const results: string[] = [];
            const noteMoves: { id: string; newFolderId: string | undefined }[] = [];

            for (const item of args.items) {
                const targetPath = item.localisation || item.path;
                const note = resolveNotePath(targetPath, fetchedNotes, fetchedFolders);
                if (!note) {
                    results.push(`Note not found at path: ${targetPath}`);
                    continue;
                }

                let newFolderId: string | null = null;
                if (item.new_folder_path && item.new_folder_path !== "/") {
                    const targetFolder = resolveFolderPath(item.new_folder_path, fetchedFolders);
                    if (!targetFolder) {
                        results.push(`New folder not found at path: ${item.new_folder_path}`);
                        continue;
                    }
                    newFolderId = targetFolder.id;
                }

                const { error } = await supabase
                    .from("notes")
                    .update({ folder_id: newFolderId })
                    .eq("id", note.id);

                if (error) {
                    results.push(`Failed to move note "${note.title}": ${error.message}`);
                } else {
                    noteMoves.push({ id: note.id, newFolderId: newFolderId || undefined });
                    results.push(`Note "${note.title}" moved to "${item.new_folder_path}" successfully.`);
                }
            }

            if (noteMoves.length > 0) {
                setFetchedNotes(prev =>
                    prev.map(n => {
                        const move = noteMoves.find(m => m.id === n.id);
                        return move ? { ...n, folder_id: move.newFolderId } : n;
                    })
                );
            }
            return results.join("\n");
        }

        case "change_color_folder": {
            const results: string[] = [];
            const folderColorChanges: { id: string; newColor: FolderColor }[] = [];

            for (const item of args.items) {
                const targetPath = item.localisation || item.path;
                const folder = resolveFolderPath(targetPath, fetchedFolders);
                if (!folder) {
                    results.push(`Folder not found at path: ${targetPath}`);
                    continue;
                }

                const { error } = await supabase
                    .from("folders")
                    .update({ color: item.color })
                    .eq("id", folder.id);

                if (error) {
                    results.push(`Failed to change folder color for "${folder.name}": ${error.message}`);
                } else {
                    folderColorChanges.push({ id: folder.id, newColor: item.color });
                    results.push(`Folder "${folder.name}" color changed to "${item.color}" successfully.`);
                }
            }

            if (folderColorChanges.length > 0) {
                setFetchedFolders(prev =>
                    prev.map(f => {
                        const change = folderColorChanges.find(c => c.id === f.id);
                        return change ? { ...f, color: change.newColor } : f;
                    })
                );
            }
            return results.join("\n");
        }

        default:
            return `Unknown tool: ${name}`;
    }
}
