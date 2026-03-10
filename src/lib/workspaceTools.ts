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
    const clean = localisation.replace(/^\//, "");
    const segments = clean.split("/");
    const noteName = segments[segments.length - 1];
    const folderSegments = segments.slice(0, -1);

    if (folderSegments.length === 0) {
        // Root note
        const childNoteIds = new Set(fetchedFolders.flatMap(f => f.notesIds || []));
        return fetchedNotes.find(
            n => !childNoteIds.has(n.id) && n.title.toLowerCase() === noteName.toLowerCase()
        );
    }

    // Walk the folder tree
    const rootFolderIds = new Set(fetchedFolders.flatMap(f => f.foldersIds || []));
    let currentLevel = fetchedFolders.filter(f => !rootFolderIds.has(f.id));

    let currentFolder: Folder | undefined;
    for (const seg of folderSegments) {
        currentFolder = currentLevel.find(f => f.name.toLowerCase() === seg.toLowerCase());
        if (!currentFolder) return undefined;
        currentFolder = fetchedFolders.find(f => f.id === currentFolder!.id);
        currentLevel = (currentFolder?.foldersIds || [])
            .map(id => fetchedFolders.find(f => f.id === id))
            .filter((f): f is Folder => !!f);
    }

    if (!currentFolder) return undefined;
    return (currentFolder.notesIds || [])
        .map(id => fetchedNotes.find(n => n.id === id))
        .find((n): n is Note => !!n && n.title.toLowerCase() === noteName.toLowerCase());
}

/** Resolve a /path/like/this to the Folder, or null for root. */
function resolveFolderPath(
    localisation: string,
    fetchedFolders: Folder[]
): Folder | null | undefined {
    const clean = localisation.replace(/^\//, "");
    if (!clean || clean === "/") return null; // root

    const segments = clean.split("/");
    const rootFolderIds = new Set(fetchedFolders.flatMap(f => f.foldersIds || []));
    let currentLevel = fetchedFolders.filter(f => !rootFolderIds.has(f.id));
    let folder: Folder | undefined;

    for (const seg of segments) {
        folder = currentLevel.find(f => f.name.toLowerCase() === seg.toLowerCase());
        if (!folder) return undefined; // not found
        currentLevel = (folder.foldersIds || [])
            .map(id => fetchedFolders.find(f => f.id === id))
            .filter((f): f is Folder => !!f);
    }
    return folder;
}

/** Build a human-readable workspace index for the search tool. */
function buildWorkspaceIndex(notes: Note[], folders: Folder[]): string {
    const childNoteIds = new Set(folders.flatMap(f => f.notesIds || []));
    const childFolderIds = new Set(folders.flatMap(f => f.foldersIds || []));
    const rootFolders = folders.filter(f => !childFolderIds.has(f.id));

    function getFolderPath(folderId: string, current: Folder[], base = ""): string {
        for (const f of current) {
            const p = base ? `${base}/${f.name}` : `/${f.name}`;
            if (f.id === folderId) return p;
            const children = (f.foldersIds || []).map(id => folders.find(x => x.id === id)).filter((x): x is Folder => !!x);
            const found = getFolderPath(folderId, children, p);
            if (found) return found;
        }
        return "";
    }

    const noteLines = notes.map(n => {
        const parentFolder = folders.find(f => (f.notesIds || []).includes(n.id));
        const loc = parentFolder ? `${getFolderPath(parentFolder.id, rootFolders)}/${n.title}` : `/${n.title}`;
        return `note_name: "${n.title}" | path: ${loc} | description: ${n.description || "none"}`;
    });

    const folderLines = folders.map(f => {
        const path = getFolderPath(f.id, rootFolders) || `/${f.name}`;
        return `folder_name: "${f.name}" | path: ${path}`;
    });

    return [...folderLines, ...noteLines].join("\n");
}

// ─── Declarations ─────────────────────────────────────────────────────────────

export const WORKSPACE_TOOL_DECLARATIONS = [
    {
        name: "search_files_and_folders",
        description: "Searches all notes and folders in the workspace. Returns a list of matching notes (with path and description) and folders (with path). Use this to discover what exists before reading or modifying.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: {
                    type: Type.STRING,
                    description: "Keywords to search for (e.g. 'math test functions ai'). Max 30 keywords."
                }
            },
            required: ["query"]
        }
    },
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
                    description: "Title of the new note."
                },
                folder_path: {
                    type: Type.STRING,
                    description: "Absolute path of the parent folder (e.g. '/maths'). Leave empty or '/' to create at root."
                },
                initial_content: {
                    type: Type.STRING,
                    description: "Optional initial markdown content for the note."
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
                    description: "Absolute path of the parent folder (e.g. '/projects'). Leave empty or '/' to create at root."
                }
            },
            required: ["name"]
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
    }
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

        // ── search_files_and_folders ───────────────────────────────────────────
        case "search_files_and_folders": {
            const query: string = args.query || "";
            const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
            const index = buildWorkspaceIndex(fetchedNotes, fetchedFolders);

            const matched = index.split("\n").filter(line =>
                keywords.some(kw => line.toLowerCase().includes(kw))
            );

            if (matched.length === 0) return "No matching notes or folders found.";
            return matched.join("\n");
        }

        // ── read_note ─────────────────────────────────────────────────────────
        case "read_note": {
            const note = resolveNotePath(args.localisation, fetchedNotes, fetchedFolders);
            if (!note) return `Note not found at path: ${args.localisation}`;

            return note.content || "(Note is empty)";
        }

        // ── modify_note ───────────────────────────────────────────────────────
        case "modify_note": {
            const note = resolveNotePath(args.localisation, fetchedNotes, fetchedFolders);
            if (!note) return `Note not found at path: ${args.localisation}`;

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
            const folderPath = args.folder_path || "/";

            const { data: noteData, error: noteError } = await supabase
                .from("notes")
                .insert([{
                    user_id: userId,
                    title: args.title,
                    description: "",
                    content: args.initial_content || "",
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
                    const newNotesIds = [...(parentFolder.notesIds || []), newNote.id];
                    await supabase
                        .from("folders")
                        .update({ notes_ids: newNotesIds })
                        .eq("id", parentFolder.id);

                    setFetchedFolders(prev =>
                        prev.map(f => f.id === parentFolder.id ? { ...f, notesIds: newNotesIds } : f)
                    );
                    return `Created note "${args.title}" in folder "${folderPath}".`;
                }
            }

            return `Created note "${args.title}" in root.`;
        }

        // ── create_folder ─────────────────────────────────────────────────────
        case "create_folder": {
            const parentPath = args.parent_path || "/";

            const { data: folderData, error: folderError } = await supabase
                .from("folders")
                .insert([{
                    name: args.name,
                    user_id: userId,
                    folders_ids: [],
                    notes_ids: [],
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
                foldersIds: [],
                notesIds: [],
                color: folderData.color,
                createdAt: new Date(folderData.created_at),
                updatedAt: new Date(folderData.updated_at)
            };

            setFetchedFolders(prev => [...prev, newFolder]);

            // Link to parent folder
            if (parentPath && parentPath !== "/" && parentPath !== "") {
                const parentFolder = resolveFolderPath(parentPath, fetchedFolders);
                if (parentFolder) {
                    const newFoldersIds = [...(parentFolder.foldersIds || []), newFolder.id];
                    await supabase
                        .from("folders")
                        .update({ folders_ids: newFoldersIds })
                        .eq("id", parentFolder.id);

                    setFetchedFolders(prev =>
                        prev.map(f => f.id === parentFolder.id ? { ...f, foldersIds: newFoldersIds } : f)
                    );
                    return `Created folder "${args.name}" inside "${parentPath}".`;
                }
            }

            return `Created folder "${args.name}" in root.`;
        }

        // ── delete_note ───────────────────────────────────────────────────────
        case "delete_note": {
            const note = resolveNotePath(args.localisation, fetchedNotes, fetchedFolders);
            if (!note) return `Note not found at path: ${args.localisation}`;

            const { error } = await supabase
                .from("notes")
                .delete()
                .eq("id", note.id);

            if (error) return `Failed to delete note: ${error.message}`;

            setFetchedNotes(prev => prev.filter(n => n.id !== note.id));
            // Remove from any parent folder's notesIds locally
            setFetchedFolders(prev =>
                prev.map(f => f.notesIds?.includes(note.id)
                    ? { ...f, notesIds: f.notesIds.filter(id => id !== note.id) }
                    : f
                )
            );

            return `Note "${note.title}" deleted successfully.`;
        }

        // ── delete_folder ─────────────────────────────────────────────────────
        case "delete_folder": {
            const folder = resolveFolderPath(args.localisation, fetchedFolders);
            if (!folder) return `Folder not found at path: ${args.localisation}`;

            const { error } = await supabase
                .from("folders")
                .delete()
                .eq("id", folder.id);

            if (error) return `Failed to delete folder: ${error.message}`;

            setFetchedFolders(prev => prev.filter(f => f.id !== folder.id));

            return `Folder "${folder.name}" deleted successfully.`;
        }

        default:
            return `Unknown tool: ${name}`;
    }
}
