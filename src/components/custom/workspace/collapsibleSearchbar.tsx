'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';

interface CollapsibleSearchbarProps {
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    searchOpen: boolean;
    setSearchOpen: (value: boolean) => void;
    searchInputRef: React.RefObject<HTMLInputElement>;
    filteredFolders: any[];
    filteredNotes: any[];
    onFolderClick: (path: string) => void;
    onNoteClick: (path: string) => void;
}

export function CollapsibleSearchbar({
    searchQuery,
    setSearchQuery,
    searchOpen,
    setSearchOpen,
    searchInputRef,
    filteredFolders,
    filteredNotes,
    onFolderClick,
    onNoteClick
}: CollapsibleSearchbarProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="md:hidden w-full">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-8 w-8 p-0 rounded-full mb-2"
            >
                {isExpanded ? <ChevronUp size={14} /> : <Search size={14} />}
            </Button>
            <div
                className={cn(
                    'overflow-hidden transition-all duration-300 ease-in-out',
                    isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                )}
            >
                <div className="p-2 bg-popover rounded-lg border border-border">
                    <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                        <PopoverAnchor asChild className="w-full">
                            <InputGroup className="w-full cursor-pointer px-2 bg-transparent! border-none! shadow-none!">
                                <InputGroupAddon align="inline-end" className="cursor-pointer">
                                    <InputGroupText className="cursor-pointer">
                                        <KbdGroup className="hidden sm:inline-flex">
                                            <Kbd className="bg-card text-muted-foreground text-xs">Ctrl + Alt + K</Kbd>
                                        </KbdGroup>
                                        <Search size={16} />
                                    </InputGroupText>
                                </InputGroupAddon>
                                <InputGroupInput
                                    ref={searchInputRef}
                                    placeholder="Search..."
                                    className="cursor-pointer text-sm"
                                    onChange={(e) => { setSearchOpen(true); setSearchQuery(e.target.value) }}
                                    value={searchQuery}
                                />
                            </InputGroup>
                        </PopoverAnchor>
                        <PopoverContent className="w-[200px] py-4 border border-border bg-card/80 backdrop-blur-md shadow-lg scrollbar-no-bg!" onOpenAutoFocus={(e) => e.preventDefault()}>
                            {searchQuery.length > 0 ? (
                                (() => {
                                    if (filteredFolders.length === 0 && filteredNotes.length === 0) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-4 gap-2 text-foreground/50">
                                                <p className="text-sm">No matches found</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="max-h-[200px] overflow-y-auto">
                                            {filteredFolders.length > 0 && (
                                                <div className="mb-3">
                                                    <p className="text-xs text-muted-foreground mb-1 px-2">Folders</p>
                                                    {filteredFolders.map((folder: any) => (
                                                        <div key={folder.id} className="cursor-pointer hover:bg-foreground/10 p-2 px-2 flex items-center gap-2 rounded-lg transition-colors" onClick={() => onFolderClick(folder.path)}>
                                                            <p className="text-sm">{folder.name}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {filteredNotes.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-1 px-2">Notes</p>
                                                    {filteredNotes.map((note: any) => (
                                                        <div key={note.id} className="cursor-pointer hover:bg-foreground/10 p-2 px-2 flex items-center gap-2 rounded-lg transition-colors" onClick={() => onNoteClick(note.path)}>
                                                            <p className="text-sm">{note.title}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="flex items-center justify-center py-4 gap-2 text-foreground/50">
                                    <p className="text-sm">Search folders & notes</p>
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    );
}
