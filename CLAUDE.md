# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run lint       # Run ESLint
npm run start      # Start production server
```

## Running Tests

No test scripts are defined in package.json. Tests (if added later) can be run with:
```bash
npm test           # Run all tests
npm test -- <pattern>   # Run single test file
```

## Project Architecture

This is a **Next.js 16** application with App Router (`src/app/`) implementing **Narao**, an AI-powered note-taking application.

### Key Technologies
- **Framework**: Next.js 16 with App Router
- **UI**: Tailwind CSS v4, Radix UI primitives, Mantine components
- **Rich Text Editor**: Tiptap with custom extensions
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **AI Integration**: Direct API calls to Gemini models via `/api/chat/**` routes

### Application Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes for AI chat, spellcheck, reviews
│   ├── workspace/                # Main workspace page
│   └── ... (other routes)
├── components/
│   ├── custom/                   # Custom workspace components
│   │   └── workspace/            # Main workspace UI (tabs, editor, sidebar)
│   └── ui/                       # Reusable UI components (shadcn-based)
├── context/                      # React context providers
│   ├── contentContext           # Note content state
│   ├── editorContext            # Tiptap editor instance
│   ├── settingsContext          # User settings state
│   ├── userAuthContext          # Supabase auth state
│   ├── fetchedFoldersContext    # Folder data from Supabase
│   ├── fetchedNotesContext      # Notes data from Supabase
│   ├── chatMessagesContext      # Chat history per session
│   └── reviewContext            # AI review items (inbox)
├── lib/                          # Utilities and Supabase client
├── types/                        # TypeScript type definitions
└── hooks/                        # Custom React hooks
```

### Workspace Tab System

The workspace uses a tab-based interface with four tab types:

- **Home Tab**: Landing view, shows announcements
- **Folders Tab**: File browser for folder/note navigation
- **Notes Tab**: Editor view using Tiptap with rich features (math, tables, task lists)
- **Chats Tab**: AI chat interface with Gemini models

Main area component (`src/components/custom/workspace/mainArea.tsx`) orchestrates:
- Fetches user data from Supabase on mount
- Manages tabs via `tabsContext`
- Renders active tab content based on `activeTab.type`
- Handles global keyboard shortcuts

### Editor Features

The editor (`src/components/custom/workspace/editor.tsx`) implements:
- Custom Tiptap extensions (spellcheck, markdown arrows, math handling)
- Math support via KaTeX (inline `$$...$$` and `$$...$$` block math)
- Custom table component with resize support
- Markdown-to-HTML conversion with tiptap-markdown
- Content preparation/sanitization for math/inline syntax compatibility

### Data Model

**Supabase tables**:
- `profiles` (id, username, credits_left, settings, workspace_memory)
- `folders` (id, user_id, name, parent_id, color, is_reviewed)
- `notes` (id, user_id, folder_id, title, content, description, tags[], is_reviewed)
- `announces` (id, title, description, link)
- `review_items` (id, user_id, chat_id, title, query, importance, type, location)

### AI Review System

The inbox feature (`src/components/custom/workspace/sidebar.tsx`) auto-generates AI reviews:
1. Scans for unread notes/folders
2. Calls `/api/chat/review-gemini-3.1-flash-lite-preview` endpoint
3. Parses structured JSON response into review items
4. Displays priority-sorted reviews in sidebar inbox
5. Marks items as reviewed after user action

### Keyboard Shortcuts

- `Ctrl + B` - Toggle sidebar
- `Ctrl + ,` - Open settings
- `Ctrl + Shift + U` - Open Folders tab
- `Ctrl + Shift + I` - Create new note
- `Ctrl + Shift + O` - Create new chat
- `Ctrl + Shift + N` - Close current tab
- `Ctrl + Shift + ArrowLeft/Right` - Navigate tabs

### Key Files to Understand

- `src/components/custom/workspace/sidebar.tsx` - Main layout shell, settings, inbox logic
- `src/components/custom/workspace/mainArea.tsx` - Tab management and routing
- `src/components/custom/workspace/editor.tsx` - Tiptap editor with custom extensions
- `src/context/*` - All state management via React Context
- `src/lib/supabaseClient.ts` - Supabase client initialization
