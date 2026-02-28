import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowUp, Lightbulb, Mic, Plus } from "lucide-react"
import { useState, useRef, useEffect } from "react"


export default function ChatMessageInput() {
    const [content, setContent] = useState("")
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
        }
    }, [content])

    return (
        <div className="absolute flex w-[60%] bg-popover bottom-0 left-[20%] right-[20%] rounded-[30px] border border-border shadow-lg px-2 py-1 items-end justify-center gap-2 mb-0">
            {/* Divided in 3 parts: input for the user's message, Modes, Send Button */}
            {/* Modes */}
            <div className="flex items-center pb-1 gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-full"><Plus /></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Attach</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full"><Lightbulb /></Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Think Deeper</p>
                        <p className="text-xs text-muted-foreground">Costs 2x more credits</p>
                    </TooltipContent>
                </Tooltip>
            </div>
            {/* Input */}
            <textarea
                ref={textareaRef}
                className="w-full resize-none bg-transparent py-3 focus:outline-none outline-none scrollbar-no-bg max-h-[156px] overflow-y-auto"
                placeholder="Ask anything"
                maxLength={100000}
                rows={1}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        // Handle send logic here if needed
                    }
                }}
            />
            {/* Send Button */}
            <div className="flex items-center pb-1 gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full"><Mic /></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Dictate</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="default" size="icon" disabled={content.length === 0} className="h-10 w-10 rounded-full p-0 flex items-center justify-center">
                            <ArrowUp size={20} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Send</p></TooltipContent>
                </Tooltip>
            </div>
        </div>
    )

}