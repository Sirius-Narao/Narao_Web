import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"
import { ComponentPropsWithoutRef } from "react"

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
    // Normalize LaTeX-style delimiters \[ \] and \( \) to $$ and $
    // We use a function to avoid replacing delimiters inside code blocks if they are already strings
    const processedContent = content
        .replace(/\\\[/g, '$$$$')
        .replace(/\\\]/g, '$$$$')
        .replace(/\\\(/g, '$')
        .replace(/\\\)/g, '$');

    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
                components={{
                    code({ className, children, ...props }: ComponentPropsWithoutRef<'code'> & { inline?: boolean }) {
                        const match = /language-(\w+)/.exec(className || '')
                        const isInline = !match && !children?.toString().includes('\n');

                        return !isInline ? (
                            <div className="relative group w-full max-w-full overflow-hidden">
                                <pre className="my-4 rounded-xl bg-popover p-4 overflow-x-auto border border-border/50">
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
                                                    navigator.clipboard.writeText(children?.toString() || '');
                                                    toast.success(`Copied to clipboard`, {
                                                        position: 'bottom-right'
                                                    })
                                                }}
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>

                                        </div>
                                    )}
                                    <code className={cn(className, "rounded-lg bg-popover!")} {...props}>
                                        {children}
                                    </code>
                                </pre>
                            </div>
                        ) : (
                            <code className="inline-code px-1.5 py-0.5 rounded bg-secondary/80 text-primary font-mono text-sm font-medium" {...props}>
                                {children}
                            </code>
                        )
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
                        return <thead className="bg-secondary/50">{children}</thead>
                    },
                    th({ children }) {
                        return <th className="border-b border-border px-4 py-3 text-left font-bold text-foreground/80">{children}</th>
                    },
                    td({ children }) {
                        return <td className="border-b border-border px-4 py-2.5 text-foreground/70">{children}</td>
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
                        return <h1 className="my-6 text-2xl font-bold border-b border-border pb-2 text-foreground tracking-tight">{children}</h1>
                    },
                    h2({ children }) {
                        return <h2 className="my-5 text-xl font-semibold text-foreground/90 tracking-tight">{children}</h2>
                    },
                    h3({ children }) {
                        return <h3 className="my-4 text-lg font-semibold text-foreground/80 tracking-tight">{children}</h3>
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
                        return <p className="mb-4 last:mb-0 leading-relaxed text-foreground/95">{children}</p>
                    },
                    hr() {
                        return <hr className="h-px bg-border my-6" />
                    }
                }}
            >
                {processedContent}
            </ReactMarkdown>
        </div>
    )
}
