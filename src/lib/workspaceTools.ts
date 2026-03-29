import React from "react";
import { Type } from "@google/genai";
import { supabase } from "@/lib/supabaseClient";
import { Note, Folder } from "@/types/folderStructureTypes";

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
function resolveNotePath(
    localisation: string,
    fetchedNotes: Note[],
    fetchedFolders: Folder[]
): Note | undefined {
    if (typeof localisation !== "string") return undefined;
    const clean = localisation.replace(/^\//, "");
    const segments = clean.split("/");
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
function resolveFolderPath(
    localisation: string,
    fetchedFolders: Folder[]
): Folder | null | undefined {
    if (typeof localisation !== "string") return undefined;
    const clean = localisation.replace(/^\//, "");
    if (!clean || clean === "/") return null; // root

    const segments = clean.split("/");
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
    // {
    //     name: "get_all_notes_and_folders",
    //     description: "Returns a list of all notes and folders in the workspace. Use this to discover what exists before reading or modifying.",
    //     parameters: {
    //         type: Type.OBJECT,
    //         properties: {},
    //         required: []
    //     }
    // },
    {
        name: "read_note",
        description: "Returns the full markdown content of a note given its absolute path.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                localisation: {
                    type: Type.STRING,
                    description: "Absolute path to the note (e.g. '/maths/introduction'). Use search_files_and_folders first if unsure of the path."
                }
            },
            required: ["localisation"]
        }
    },
    {
        name: "modify_note",
        description: "Replaces the entire content of a note with new markdown text. Make sure to read the note first, then write the full new content (not just the changes).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                localisation: {
                    type: Type.STRING,
                    description: "Absolute path to the note (e.g. '/maths/introduction')."
                },
                content: {
                    type: Type.STRING,
                    description: "The new full markdown content of the note."
                }
            },
            required: ["localisation", "content"]
        }
    },
    {
        name: "create_note",
        description: "Creates a new empty note with the given title, optionally inside a folder.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                title: {
                    type: Type.STRING,
                    description: "Title of the new note (max 50 characters)."
                },
                description: {
                    type: Type.STRING,
                    description: "Optional description of the new note."
                },
                folder_path: {
                    type: Type.STRING,
                    description: "Absolute path of the parent folder (e.g. '/maths'). Leave empty or '/' to create at root. Alias: 'folder'."
                },
                initial_content: {
                    type: Type.STRING,
                    description: "Optional initial markdown content for the note. Alias: 'content'."
                }
            },
            required: ["title"]
        }
    },
    {
        name: "create_folder",
        description: "Creates a new folder, optionally inside a parent folder.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                name: {
                    type: Type.STRING,
                    description: "Name of the new folder."
                },
                parent_path: {
                    type: Type.STRING,
                    description: "Absolute path of the parent folder (e.g. '/projects'). Write '/' to create at root."
                }
            },
            required: ["name", "parent_path"]
        }
    },
    {
        name: "rename_folder",
        description: "Rename a folder.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                localisation: {
                    type: Type.STRING,
                    description: "Absolute path to the folder (e.g. '/maths')."
                },
                title: {
                    type: Type.STRING,
                    description: "The new title of the folder (max 50 characters)."
                },
            },
            required: ["localisation", "title"]
        }
    },
    {
        name: "delete_note",
        description: "Permanently deletes a note. This cannot be undone.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                localisation: {
                    type: Type.STRING,
                    description: "Absolute path to the note to delete (e.g. '/maths/introduction')."
                }
            },
            required: ["localisation"]
        }
    },
    {
        name: "delete_folder",
        description: "Permanently deletes a folder. This cannot be undone. Does not delete child notes or folders — they become orphaned.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                localisation: {
                    type: Type.STRING,
                    description: "Absolute path to the folder to delete (e.g. '/maths')."
                }
            },
            required: ["localisation"]
        }
    },
    {
        name: "rename_note",
        description: "Rename a note.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                localisation: {
                    type: Type.STRING,
                    description: "Absolute path to the note (e.g. '/maths/introduction')."
                },
                title: {
                    type: Type.STRING,
                    description: "The new title of the note."
                },
            },
            required: ["localisation", "title"]
        }
    },
    {
        name: "move_note",
        description: "Move a note to a different folder.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                localisation: {
                    type: Type.STRING,
                    description: "Absolute path to the note (e.g. '/maths/introduction')."
                },
                new_folder_path: {
                    type: Type.STRING,
                    description: "Absolute path to the new folder (e.g. '/maths')."
                },
            },
            required: ["localisation", "new_folder_path"]
        }
    },
    {
        name: "move_folder",
        description: "Move a folder to a different parent folder.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                localisation: {
                    type: Type.STRING,
                    description: "Absolute path to the folder (e.g. '/maths')."
                },
                new_parent_path: {
                    type: Type.STRING,
                    description: "Absolute path to the new parent folder (e.g. '/projects')."
                },
            },
            required: ["localisation", "new_parent_path"]
        }
    },
    {
        name: "change_color_folder",
        description: "Change the color of a folder.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                localisation: {
                    type: Type.STRING,
                    description: "Absolute path to the folder (e.g. '/maths')."
                },
                color: {
                    type: Type.STRING,
                    enum: ["folder-red", "folder-blue", "folder-green", "folder-yellow", "folder-purple", "folder-orange", "folder-pink", "folder-cyan", "folder-lime", "folder-teal", "folder-indigo", "folder-rose", "folder-amber", "folder-brown", "folder-slate", "folder-gray", "folder-black", "folder-white"],
                    description: "The new color of the folder (e.g. 'folder-red')."
                },
            },
            required: ["localisation", "color"]
        }
    },
    // {
    //     name: "change_color_note",
    //     description: "Change the color of a note.",
    //     parameters: {
    //         type: Type.OBJECT,
    //         properties: {
    //             localisation: {
    //                 type: Type.STRING,
    //                 description: "Absolute path to the note (e.g. '/maths/introduction')."
    //             },
    //             color: {
    //                 type: Type.STRING,
    //                 description: "The new color of the note (e.g. 'red')."
    //             },
    //         },
    //         required: ["localisation", "color"]
    //     }
    // },
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

        // ── get_all_notes_and_folders ───────────────────────────────────────────
        // case "get_all_notes_and_folders": {
        //     const index = buildWorkspaceIndex(fetchedNotes, fetchedFolders);
        //     return index;
        // }

        // ── read_note ─────────────────────────────────────────────────────────
        case "read_note": {
            const targetPath = args.localisation || args.path;
            const note = resolveNotePath(targetPath, fetchedNotes, fetchedFolders);
            if (!note) return `Note not found at path: ${targetPath}`;

            return note.content || "(Note is empty)";
        }

        // ── modify_note ───────────────────────────────────────────────────────
        case "modify_note": {
            const targetPath = args.localisation || args.path;
            const note = resolveNotePath(targetPath, fetchedNotes, fetchedFolders);
            if (!note) return `Note not found at path: ${targetPath}`;

            const { error } = await supabase
                .from("notes")
                .update({ content: args.content, updated_at: new Date() })
                .eq("id", note.id);

            if (error) return `Failed to modify note: ${error.message}`;

            setFetchedNotes(prev =>
                prev.map(n => n.id === note.id ? { ...n, content: args.content, updatedAt: new Date() } : n)
            );
            return `Note "${note.title}" updated successfully.`;
        }

        // ── create_note ───────────────────────────────────────────────────────
        case "create_note": {
            const folderPath = args.folder_path || args.folder || "/";
            const initialContent = args.initial_content || args.content || "";
            const description = args.description || "";

            const { data: noteData, error: noteError } = await supabase
                .from("notes")
                .insert([{
                    user_id: userId,
                    title: args.title,
                    description: description,
                    content: initialContent,
                    tags: []
                }])
                .select()
                .single();

            if (noteError || !noteData) return `Failed to create note: ${noteError?.message}`;

            const newNote: Note = {
                id: String(noteData.id),
                title: noteData.title,
                description: noteData.description || "",
                content: noteData.content || "",
                tags: noteData.tags || [],
                createdAt: new Date(noteData.created_at),
                updatedAt: new Date(noteData.updated_at)
            };

            setFetchedNotes(prev => [...prev, newNote]);

            // Link to parent folder if specified
            if (folderPath && folderPath !== "/" && folderPath !== "") {
                const parentFolder = resolveFolderPath(folderPath, fetchedFolders);
                if (parentFolder) {
                    await supabase
                        .from("notes")
                        .update({ folder_id: parentFolder.id })
                        .eq("id", newNote.id);

                    newNote.folder_id = String(parentFolder.id);

                    setFetchedNotes(prev =>
                        prev.map(n => n.id === newNote.id ? newNote : n)
                    );
                    return `Created note "${args.title}" in folder "${folderPath}".`;
                } else {
                    return `Note "${args.title}" created, but folder "${folderPath}" was not found. Note is in root.`;
                }
            }

            return `Created note "${args.title}" in root.`;
        }

        // ── create_folder ─────────────────────────────────────────────────────
        case "create_folder": {
            const parentPath = args.parent_path || "/";

            // Link to parent folder
            let parentId: string | undefined = undefined;
            if (parentPath && parentPath !== "/" && parentPath !== "") {
                const parentFolder = resolveFolderPath(parentPath, fetchedFolders);
                if (parentFolder) {
                    parentId = String(parentFolder.id);
                } else {
                    return `Failed to create folder: parent folder "${parentPath}" not found.`;
                }
            }

            const { data: folderData, error: folderError } = await supabase
                .from("folders")
                .insert([{
                    name: args.name,
                    user_id: userId,
                    parent_id: parentId,
                    color: "folder-blue",
                    created_at: new Date(),
                    updated_at: new Date()
                }])
                .select()
                .single();

            if (folderError || !folderData) return `Failed to create folder: ${folderError?.message}`;

            const newFolder: Folder = {
                id: String(folderData.id),
                name: folderData.name,
                user_id: String(folderData.user_id),
                parent_id: folderData.parent_id ? String(folderData.parent_id) : undefined,
                color: folderData.color,
                createdAt: new Date(folderData.created_at),
                updatedAt: new Date(folderData.updated_at)
            };

            setFetchedFolders(prev => [...prev, newFolder]);

            if (parentId) {
                return `Created folder "${args.name}" inside "${parentPath}".`;
            }

            return `Created folder "${args.name}" in root.`;
        }

        // ── delete_note ───────────────────────────────────────────────────────
        case "delete_note": {
            const targetPath = args.localisation || args.path;
            const note = resolveNotePath(targetPath, fetchedNotes, fetchedFolders);
            if (!note) return `Note not found at path: ${targetPath}`;

            const { error } = await supabase
                .from("notes")
                .delete()
                .eq("id", note.id);

            if (error) return `Failed to delete note: ${error.message}`;

            setFetchedNotes(prev => prev.filter(n => n.id !== note.id));

            return `Note "${note.title}" deleted successfully.`;
        }

        // ── delete_folder ─────────────────────────────────────────────────────
        case "delete_folder": {
            const targetPath = args.localisation || args.path;
            const folder = resolveFolderPath(targetPath, fetchedFolders);
            if (!folder) return `Folder not found at path: ${targetPath}`;

            const { error } = await supabase
                .from("folders")
                .delete()
                .eq("id", folder.id);

            if (error) return `Failed to delete folder: ${error.message}`;

            setFetchedFolders(prev => prev.filter(f => f.id !== folder.id));

            return `Folder "${folder.name}" deleted successfully.`;
        }

        // ── rename_folder ─────────────────────────────────────────────────────
        case "rename_folder": {
            const targetPath = args.localisation || args.path;
            const folder = resolveFolderPath(targetPath, fetchedFolders);
            if (!folder) return `Folder not found at path: ${targetPath}`;

            const { error } = await supabase
                .from("folders")
                .update({ name: args.title })
                .eq("id", folder.id);

            if (error) return `Failed to rename folder: ${error.message}`;

            setFetchedFolders(prev =>
                prev.map(f => f.id === folder.id ? { ...f, name: args.title } : f)
            );

            return `Folder "${folder.name}" renamed to "${args.title}" successfully.`;
        }

        // ── rename_note ───────────────────────────────────────────────────────
        case "rename_note": {
            const targetPath = args.localisation || args.path;
            const note = resolveNotePath(targetPath, fetchedNotes, fetchedFolders);
            if (!note) return `Note not found at path: ${targetPath}`;

            const { error } = await supabase
                .from("notes")
                .update({ title: args.title })
                .eq("id", note.id);

            if (error) return `Failed to rename note: ${error.message}`;

            setFetchedNotes(prev =>
                prev.map(n => n.id === note.id ? { ...n, title: args.title } : n)
            );

            return `Note "${note.title}" renamed to "${args.title}" successfully.`;
        }

        // ── move_folder ───────────────────────────────────────────────────────
        case "move_folder": {
            const targetPath = args.localisation || args.path;
            const folder = resolveFolderPath(targetPath, fetchedFolders);
            if (!folder) return `Folder not found at path: ${targetPath}`;

            let newParentId: string | null = null;
            if (args.new_parent_path && args.new_parent_path !== "/") {
                const parentFolder = resolveFolderPath(args.new_parent_path, fetchedFolders);
                if (!parentFolder) return `New parent folder not found at path: ${args.new_parent_path}`;
                newParentId = parentFolder.id;
            }

            const { error } = await supabase
                .from("folders")
                .update({ parent_id: newParentId })
                .eq("id", folder.id);

            if (error) return `Failed to move folder: ${error.message}`;

            setFetchedFolders(prev =>
                prev.map(f => f.id === folder.id ? { ...f, parent_id: newParentId || undefined } : f)
            );

            return `Folder "${folder.name}" moved to "${args.new_parent_path}" successfully.`;
        }

        // ── move_note ───────────────────────────────────────────────────────
        case "move_note": {
            const targetPath = args.localisation || args.path;
            const note = resolveNotePath(targetPath, fetchedNotes, fetchedFolders);
            if (!note) return `Note not found at path: ${targetPath}`;

            let newFolderId: string | null = null;
            if (args.new_folder_path && args.new_folder_path !== "/") {
                const targetFolder = resolveFolderPath(args.new_folder_path, fetchedFolders);
                if (!targetFolder) return `New folder not found at path: ${args.new_folder_path}`;
                newFolderId = targetFolder.id;
            }

            const { error } = await supabase
                .from("notes")
                .update({ folder_id: newFolderId })
                .eq("id", note.id);

            if (error) return `Failed to move note: ${error.message}`;

            setFetchedNotes(prev =>
                prev.map(n => n.id === note.id ? { ...n, folder_id: newFolderId || undefined } : n)
            );

            return `Note "${note.title}" moved to "${args.new_folder_path}" successfully.`;
        }

        case "change_color_folder": {
            const targetPath = args.localisation || args.path;
            const folder = resolveFolderPath(targetPath, fetchedFolders);
            if (!folder) return `Folder not found at path: ${targetPath}`;

            const { error } = await supabase
                .from("folders")
                .update({ color: args.color })
                .eq("id", folder.id);

            if (error) return `Failed to change folder color: ${error.message}`;

            setFetchedFolders(prev =>
                prev.map(f => f.id === folder.id ? { ...f, color: args.color } : f)
            );

            return `Folder "${folder.name}" color changed from "${folder.color}" to "${args.color}" successfully.`;
        }

        default:
            return `Unknown tool: ${name}`;
    }
}
