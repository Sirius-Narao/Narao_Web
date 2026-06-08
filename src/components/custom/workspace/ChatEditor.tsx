import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react"
import { MentionItem } from "./chatMessageInput"

export interface ChatEditorRef {
    getContent: () => string;
    getHTML: () => string;
    setContent: (content: string) => void;
    focus: () => void;
    focusAndSelectText: (textToSelect: string) => void;
}

interface ChatEditorProps {
    onContentChange: (content: string, html: string) => void;
    onMentionQuery: (query: string | null, start: number) => void;
    placeholder: string;
    mentionSuggestions: MentionItem[];
    mentionIndex: number;
    onMentionIndexChange: (index: number) => void;
    onConfirmMention: (item: MentionItem) => void;
    onCloseMention: () => void;
    onSend: () => void;
    onMentionClick: (id: string, type: string, title: string, path?: string) => void;
}

const ChatEditor = forwardRef<ChatEditorRef, ChatEditorProps>(({
    onContentChange,
    onMentionQuery,
    placeholder,
    mentionSuggestions,
    mentionIndex,
    onMentionIndexChange,
    onConfirmMention,
    onCloseMention,
    onSend,
    onMentionClick
}, ref) => {
    const editorRef = useRef<HTMLDivElement>(null)
    const isTypingRef = useRef(false)
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const localRef = useRef<ChatEditorRef>(null)

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => {
        const methods = {
            getContent: () => {
                const el = editorRef.current
                if (!el) return ""
                const walk = (node: Node): string => {
                    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ""
                    if ((node as Element).tagName === "BR") return "\n"
                    if ((node as HTMLElement).classList?.contains("mention-token")) return node.textContent ?? ""
                    return Array.from(node.childNodes).map(walk).join("")
                }
                return walk(el)
            },
            getHTML: () => editorRef.current?.innerHTML || "",
            setContent: (content: string) => {
                if (editorRef.current) {
                    editorRef.current.innerHTML = content
                }
            },
            focus: () => {
                editorRef.current?.focus()
            },
            focusAndSelectText: (textToSelect: string) => {
                if (editorRef.current) {
                    editorRef.current.focus()
                    const text = editorRef.current.innerText || ""
                    const index = text.indexOf(textToSelect)
                    if (index !== -1) {
                        const selection = window.getSelection()
                        if (selection) {
                            const range = document.createRange()
                            const walker = document.createTreeWalker(
                                editorRef.current,
                                NodeFilter.SHOW_TEXT,
                                null
                            )
                            let charCount = 0
                            let startNode: Text | null = null
                            let startOffset = 0
                            let endNode: Text | null = null
                            let endOffset = 0

                            while (walker.nextNode()) {
                                const node = walker.currentNode as Text
                                const nodeLength = node.textContent?.length || 0

                                if (!startNode && charCount + nodeLength > index) {
                                    startNode = node
                                    startOffset = index - charCount
                                }

                                if (!endNode && charCount + nodeLength >= index + textToSelect.length) {
                                    endNode = node
                                    endOffset = index + textToSelect.length - charCount
                                    break
                                }

                                charCount += nodeLength
                            }

                            if (startNode && endNode) {
                                range.setStart(startNode, startOffset)
                                range.setEnd(endNode, endOffset)
                                selection.removeAllRanges()
                                selection.addRange(range)
                            }
                        }
                    }
                }
            }
        }
        localRef.current = methods
        return methods
    }, [])

    const getCaretOffset = useCallback((): number => {
        const el = editorRef.current
        if (!el) return 0
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return 0
        const range = sel.getRangeAt(0).cloneRange()
        range.selectNodeContents(el)
        range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset)
        return range.toString().length
    }, [])

    const confirmMention = useCallback((item: MentionItem) => {
        if (!editorRef.current) return

        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return

        const range = sel.getRangeAt(0)
        const caretOffset = getCaretOffset()

        // Find the @ position
        const text = editorRef.current.innerText || ""
        const beforeCaret = text.slice(0, caretOffset)
        const atMatch = beforeCaret.lastIndexOf("@")
        
        if (atMatch === -1) return

        // Create mention token
        const span = document.createElement("span")
        span.className = "mention-token"
        span.contentEditable = "false"
        span.dataset.mentionId = item.id
        span.dataset.mentionType = item.type
        if (item.path) span.dataset.path = item.path
        span.textContent = `@${item.title}`
        span.style.color = item.color || "#3b82f6"

        // Insert space after
        const space = document.createTextNode("\u00A0")

        // Find and replace the @mention text
        const walker = document.createTreeWalker(
            editorRef.current,
            NodeFilter.SHOW_TEXT,
            null
        )

        let charCount = 0
        let startNode: Text | null = null
        let startOffset = 0

        while (walker.nextNode()) {
            const node = walker.currentNode as Text
            const nodeLength = node.textContent?.length || 0

            if (charCount + nodeLength >= atMatch) {
                startNode = node
                startOffset = atMatch - charCount
                break
            }

            charCount += nodeLength
        }

        if (startNode) {
            const mentionRange = document.createRange()
            mentionRange.setStart(startNode, startOffset)
            mentionRange.setEnd(range.endContainer, range.endOffset)
            mentionRange.deleteContents()
            mentionRange.insertNode(span)
            mentionRange.insertNode(space)

            // Place caret after the space
            const newRange = document.createRange()
            newRange.setStartAfter(space)
            newRange.collapse(true)
            sel.removeAllRanges()
            sel.addRange(newRange)
        }

        onContentChange(localRef.current?.getContent() || "", editorRef.current.innerHTML)
        onCloseMention()
        editorRef.current?.focus()
    }, [getCaretOffset, onContentChange, onCloseMention])

    const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
        const el = e.currentTarget
        const text = localRef.current?.getContent() || ""
        
        // Debounced update to parent
        isTypingRef.current = true
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false
            onContentChange(text, el.innerHTML)
        }, 300)

        // Immediate mention detection
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0).cloneRange()
        range.selectNodeContents(el)
        range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset)
        const caretOffset = range.toString().length

        const slice = text.slice(0, caretOffset)
        const match = slice.match(/@([\w\s.-]*)$/)
        if (match) {
            const atPos = caretOffset - match[0].length
            onMentionQuery(match[1], atPos)
        } else {
            onCloseMention()
        }
    }, [onContentChange, onMentionQuery, onCloseMention])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        // @mention navigation
        if (mentionSuggestions.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault()
                onMentionIndexChange((mentionIndex + 1) % mentionSuggestions.length)
                return
            }
            if (e.key === "ArrowUp") {
                e.preventDefault()
                onMentionIndexChange((mentionIndex - 1 + mentionSuggestions.length) % mentionSuggestions.length)
                return
            }
            if (e.key === "Tab" || e.key === "Enter") {
                e.preventDefault()
                confirmMention(mentionSuggestions[mentionIndex])
                return
            }
            if (e.key === "Escape") {
                e.preventDefault()
                onCloseMention()
                return
            }
        }

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            onSend()
            return
        }
    }, [mentionSuggestions, mentionIndex, onMentionIndexChange, confirmMention, onCloseMention, onSend])

    const handleBlur = useCallback(() => {
        isTypingRef.current = false
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }
        // Final sync on blur
        onContentChange(localRef.current?.getContent() || "", editorRef.current?.innerHTML || "")
        setTimeout(() => onCloseMention(), 150)
    }, [onContentChange, onCloseMention])

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault()
        const text = e.clipboardData.getData("text/plain")
        document.execCommand("insertText", false, text)
    }, [])

    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement
        const chip = target.closest(".mention-token") as HTMLElement
        if (chip) {
            const id = chip.dataset.mentionId
            const type = chip.dataset.mentionType
            const title = chip.textContent?.slice(1) || "Item"
            const path = chip.dataset.path
            if (id && type) {
                onMentionClick(id, type, title, path)
            }
        }
    }, [onMentionClick])

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }
        }
    }, [])

    return (
        <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-label={placeholder}
            data-placeholder={placeholder}
            className="mention-editor w-full focus:outline-none outline-none scrollbar-no-bg"
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onPaste={handlePaste}
            onClick={handleClick}
            suppressContentEditableWarning
        />
    )
})

ChatEditor.displayName = "ChatEditor"

export default ChatEditor
