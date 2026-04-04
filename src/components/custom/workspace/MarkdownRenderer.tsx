import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"
import rehypeRaw from "rehype-raw"
import { ComponentPropsWithoutRef, CSSProperties, ReactNode, isValidElement } from "react"
import katex from "katex"

const extractText = (node: ReactNode): string => {
    if (node == null) return '';
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (isValidElement(node)) return extractText((node as any).props.children);
    return '';
};

import "katex/dist/katex.min.css"
import "highlight.js/styles/github-dark.css"
import { cn } from "@/lib/utils"
import { Code, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface MarkdownRendererProps {
    content: string
    className?: string
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
    /**
     * Pre-process the markdown string so that remark-math can reliably pick up
     * all LaTeX delimiters regardless of how the AI wrote them.
     *
     * Steps (each applied outside fenced code spans):
     *  1. Convert ```math ... ``` fences → $$ ... $$ blocks
     *     (notes store math this way after being read by the AI tool)
     *  2. Unescape double backslashes (\\) → single (\) so KaTeX sees proper LaTeX
     *  3. Convert \[ ... \] → $$ ... $$ (display math)
     *  4. Convert \( ... \) → $ ... $ (inline math)
     *  5. Promote same-line $$ ... $$ to block display math for remark-math
     */
    const processContent = (raw: string): string => {
        // Helper: split on fenced code spans and only transform even-indexed (non-code) parts
        const outsideCode = (str: string, fn: (s: string) => string): string => {
            const parts = str.split(/(```[\s\S]*?```|`[^`]*`)/g);
            return parts.map((part, i) => (i % 2 === 0 ? fn(part) : part)).join('');
        };

        // Step 1 — Convert ```math ... ``` fences to $$ ... $$ BEFORE splitting
        // (we do this globally because the fence IS the code span boundary)
        let result = raw.replace(/```math\r?\n([\s\S]*?)\r?\n```/g, '\n$$\n$1\n$$\n');

        // Step 2 — Unescape double backslashes outside code blocks
        result = outsideCode(result, s => s.replace(/\\\\/g, '\\'));

        // Step 3 — \[ ... \] → $$ ... $$ (display math)
        result = outsideCode(result, s =>
            s.replace(/\\\[/g, '\n$$\n').replace(/\\\]/g, '\n$$\n')
        );

        // Step 4 — \( ... \) → $ ... $ (inline math)
        result = outsideCode(result, s =>
            s.replace(/\\\(/g, '$').replace(/\\\)/g, '$')
        );

        // Step 5 — Same-line $$ ... $$ (both delimiters on one line, no newline inside)
        // → promote to proper block display math that remark-math understands
        result = outsideCode(result, s =>
            s.replace(/\$\$([^$\n]+?)\$\$/g, '\n\n$$\n$1\n$$\n\n')
        );

        return result;
    };

    const processedContent = processContent(content);

    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[
                    rehypeRaw,
                    [rehypeKatex, { strict: false, throwOnError: false }],
                    [rehypeHighlight, { detect: true, ignoreMissing: true }]
                ]}
                components={{
                    pre({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
                        // Extract the language from the nested <code> className
                        const codeChild = Array.isArray(children) ? children[0] : children;
                        const codeClassName = isValidElement(codeChild)
                            ? (codeChild.props as any)?.className ?? ''
                            : '';
                        const match = /language-(\w+)/.exec(codeClassName || '');
                        const textContent = extractText(children);

                        return (
                            <div className="relative group w-full max-w-full overflow-hidden">
                                <pre className="my-4 rounded-xl bg-popover p-4 overflow-x-auto border border-border/50 w-full" {...props}>
                                    {match && (
                                        <div className="flex items-center justify-between gap-2 pb-2 px-2 border-b border-foreground/10">
                                            <div className="flex flex-row items-center gap-2">
                                                <Code className="w-4 h-4" />
                                                <p className="text-lg">
                                                    {match[1].toUpperCase()}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(textContent);
                                                    toast.success(`Copied to clipboard`, {
                                                        position: 'bottom-right'
                                                    })
                                                }}
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                    {children}
                                </pre>
                            </div>
                        );
                    },
                    code({ className, children, ...props }: ComponentPropsWithoutRef<'code'> & { inline?: boolean }) {
                        const isBlock = !!className;
                        const isMath = className === 'language-math';

                        // Render ```math ... ``` fences that slipped through (e.g. from note
                        // content echoed by the AI) directly with KaTeX instead of as a code block.
                        if (isMath) {
                            const latex = extractText(children).trim();
                            let html = '';
                            try {
                                html = katex.renderToString(latex, {
                                    displayMode: true,
                                    throwOnError: false,
                                    strict: false,
                                });
                            } catch {
                                html = `<span class="text-destructive font-mono">${latex}</span>`;
                            }
                            return (
                                <div
                                    className="my-4 overflow-x-auto text-center"
                                    dangerouslySetInnerHTML={{ __html: html }}
                                />
                            );
                        }

                        if (isBlock) {
                            return (
                                <code className={cn(className, "rounded-lg bg-popover! whitespace-pre-wrap break-words")} {...props}>
                                    {children}
                                </code>
                            );
                        }
                        return (
                            <code className="inline-code px-1.5 py-0.5 rounded bg-secondary/80 text-primary font-mono text-sm font-medium" {...props}>
                                {children}
                            </code>
                        );
                    },
                    table({ children }) {
                        return (
                            <div className="my-4 overflow-x-auto rounded-lg border border-border shadow-sm max-w-full">
                                <table className="w-full border-collapse text-sm">
                                    {children}
                                </table>
                            </div>
                        )
                    },
                    thead({ children }) {
                        return <thead className="bg-secondary/70 ">{children}</thead>
                    },
                    th({ children }) {
                        return <th className="border-b border-secondary/70 px-4 py-3 text-left font-bold text-foreground/80 ">{children}</th>
                    },
                    td({ children }) {
                        return <td className="border-b border-secondary/70 px-4 py-2.5 text-foreground/70">{children}</td>
                    },
                    blockquote({ children }) {
                        return (
                            <blockquote className="my-4 pl-4 py-1 italic text-muted-foreground bg-transparent border-l-2 border-primary flex items-start">
                                <div className="flex-1">{children}</div>
                            </blockquote>
                        )
                    },
                    ul({ children }) {
                        return <ul className="my-4 ml-6 list-disc space-y-2 text-foreground/90">{children}</ul>
                    },
                    ol({ children }) {
                        return <ol className="my-4 ml-6 list-decimal space-y-2 text-foreground/90">{children}</ol>
                    },
                    li({ children }) {
                        return <li className="leading-relaxed pl-1">{children}</li>
                    },
                    h1({ children }) {
                        return <h1 className="my-6 text-2xl font-bold text-foreground/90 tracking-tight whitespace-pre-wrap">{children}</h1>
                    },
                    h2({ children }) {
                        return <h2 className="my-5 text-xl font-semibold text-foreground/90 tracking-tight whitespace-pre-wrap">{children}</h2>
                    },
                    h3({ children }) {
                        return <h3 className="my-4 text-lg font-semibold text-foreground/80 tracking-tight whitespace-pre-wrap">{children}</h3>
                    },
                    a({ children, href }) {
                        return (
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary font-medium hover:underline transition-all underline-offset-4 decoration-primary/30"
                            >
                                {children}
                            </a>
                        )
                    },
                    p({ children }) {
                        return <p className="mb-4 last:mb-0 leading-relaxed text-foreground/95 whitespace-pre-line break-words">{children}</p>
                    },
                    hr() {
                        return <hr className="h-px bg-foreground/10 my-6" />
                    },
                    span({ style, children, ...props }: ComponentPropsWithoutRef<'span'>) {
                        // Pass through ALL props and styles so that:
                        //   • KaTeX-generated spans (with class / aria- / data- attributes) render correctly
                        //   • Colored <span style="color: …"> from the AI render correctly
                        // We only restrict style to the `color` property for security on
                        // user-visible coloured text spans; KaTeX spans that come from
                        // rehype-katex don't carry a `style` prop at all (they use className).
                        const safeStyle: CSSProperties | undefined = style
                            ? { color: (style as CSSProperties).color }
                            : undefined;
                        return <span style={safeStyle} {...props}>{children}</span>;
                    }
                }}
            >
                {processedContent}
            </ReactMarkdown>
        </div>
    )
}
