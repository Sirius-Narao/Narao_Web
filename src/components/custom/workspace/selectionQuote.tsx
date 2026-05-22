import { cn } from "@/lib/utils";
import { CornerDownRight } from "lucide-react";
import React from "react";

export interface SelectionQuoteProps {
    text: string;
    sourceName: string;
    pendingEdit: boolean;
}

export function SelectionQuote({ text, sourceName, pendingEdit }: SelectionQuoteProps) {
    const lines = text.split(/\r?\n/);
    return (
        <div className={cn("my-2 border border-border rounded-xl shadow-sm overflow-hidden relative", pendingEdit ? "bg-[#32353b] border-primary/20" : "bg-card/80")}>
            <div className="p-4 pb-3 max-h-32 relative overflow-hidden text-sm text-muted-foreground italic leading-relaxed flex items-start">
                <CornerDownRight size={14} className="mt-1" />
                "{lines.map((line, idx) => (
                    <React.Fragment key={idx}>
                        {line}
                        {idx < lines.length - 1 && <br />}
                    </React.Fragment>
                ))}"
                <div className={cn("absolute bottom-0 w-290 left-0 h-10 bg-gradient-to-t to-transparent pointer-events-none", pendingEdit ? "from-primary/10" : "from-card/80")}></div>
            </div>
            <div className="px-4 py-2 bg-muted/40 border-t border-border/50 text-xs not-italic text-muted-foreground/80 flex items-center gap-1.5">
                — From <span className="mention-token" contentEditable={false} suppressContentEditableWarning>@{sourceName}</span>
            </div>
        </div>
    );
}

export function getSelectionQuoteHtml(text: string, sourceName: string): string {
    const lines = text.split(/\r?\n/).map(line => line.trim());
    return `<div class="my-3 bg-card border border-border rounded-xl shadow-sm overflow-hidden" contenteditable="false">
    <div class="p-4 pb-3 max-h-32 relative overflow-hidden text-sm text-muted-foreground italic leading-relaxed">
        ${lines.join('<br>')}
        <!-- Fade from bottom to top -->
        <div class="absolute bottom-0 left-0 w-full h-10 bg-gradient-to-t from-card to-transparent pointer-events-none"></div>
    </div>
    <div class="px-4 py-2 bg-muted/40 border-t border-border/50 text-xs not-italic text-muted-foreground/80 flex items-center gap-1.5">
        — From <span class="mention-token" contenteditable="false">@${sourceName}</span>
    </div>
</div><br>`;
}

export function getSelectionQuoteMarkdown(text: string, sourceName: string): string {
    const lines = text.split(/\r?\n/).map(line => `> ${line.trim()}`);
    return `${lines.join("\n")}\n> — From @${sourceName}\n\n`;
}

export function parseMessageQuote(content: string): { quoteText: string; sourceName: string; remainingContent: string } | null {
    if (!content) return null;

    // 1. Try parsing the old HTML format
    if (content.includes('class="my-3 bg-card') || content.includes("class='my-3 bg-card") || content.includes('my-3 bg-card')) {
        const textMatch = content.match(/<div class="p-4 pb-3 max-h-32[^>]*>([\s\S]*?)<!-- Fade/);
        const sourceMatch = content.match(/— From <span[^>]*>@([^<]+)<\/span>/);
        if (textMatch && sourceMatch) {
            const rawText = textMatch[1].replace(/<br\s*\/?>/gi, '\n').trim();
            const sourceName = sourceMatch[1].trim();
            const htmlEndIdx = content.indexOf('</div><br>');
            let remainingContent = "";
            if (htmlEndIdx !== -1) {
                remainingContent = content.substring(htmlEndIdx + '</div><br>'.length).trim();
            } else {
                remainingContent = content.replace(/<div[\s\S]*?<\/div><br>/, '').trim();
            }
            return {
                quoteText: rawText,
                sourceName,
                remainingContent
            };
        }
    }

    // 2. Try parsing the new raw text/markdown format
    const lines = content.split('\n');
    const quoteLines: string[] = [];
    let sourceName = "";
    let splitIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('>')) {
            const cleanLine = line.substring(1).trim();
            if (cleanLine.startsWith('— From @')) {
                sourceName = cleanLine.replace('— From @', '').trim();
                splitIndex = i;
                break;
            } else {
                quoteLines.push(cleanLine);
            }
        } else {
            break;
        }
    }

    if (sourceName && splitIndex !== -1) {
        let startIdx = splitIndex + 1;
        while (startIdx < lines.length && lines[startIdx].trim() === '') {
            startIdx++;
        }
        const remainingContent = lines.slice(startIdx).join('\n');
        return {
            quoteText: quoteLines.join('\n'),
            sourceName,
            remainingContent
        };
    }

    return null;
}

