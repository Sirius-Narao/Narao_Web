import { cn } from "@/lib/utils";
import { useState } from "react";

const AVAILABLE_LANGUAGES = [
    { id: 'en-US', label: 'English (US)' },
    { id: 'en-GB', label: 'English (UK)' },
    { id: 'fr', label: 'French' },
    { id: 'es', label: 'Spanish' },
    { id: 'de', label: 'German' },
];

export interface LanguageMultiSelectProps {
    selected: string[];
    onChange: (languages: string[]) => void;
}

export function LanguageMultiSelect({ selected = [], onChange }: LanguageMultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleLanguage = (id: string) => {
        if (selected.includes(id)) {
            onChange(selected.filter(l => l !== id));
        } else {
            onChange([...selected, id]);
        }
    };

    return (
        <div className="relative inline-block w-full max-w-sm">
            <div
                className="min-h-[40px] p-2 border border-border rounded-lg bg-card cursor-pointer flex flex-wrap gap-2 items-center transition-colors hover:bg-popover"
                onClick={() => setIsOpen(!isOpen)}
            >
                {selected.length === 0 && <span className="text-muted-foreground text-sm">Select languages...</span>}
                {selected.map(langId => (
                    <span key={langId} className="bg-primary/20 text-primary px-2 py-0.5 rounded text-sm shadow-sm ring-1 ring-primary/20">
                        {AVAILABLE_LANGUAGES.find(l => l.id === langId)?.label || langId}
                    </span>
                ))}
            </div>

            {isOpen && (
                <div className="absolute top-full mt-2 w-full bg-card border border-border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto p-1 ">
                    {AVAILABLE_LANGUAGES.map(lang => (
                        <div
                            key={lang.id}
                            onClick={() => toggleLanguage(lang.id)}
                            className={cn("p-2 hover:bg-popover cursor-pointer rounded-lg flex items-center justify-between text-sm transition-colors", selected.includes(lang.id) && "hover:bg-primary/10 text-primary")}
                        >
                            <span>{lang.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
