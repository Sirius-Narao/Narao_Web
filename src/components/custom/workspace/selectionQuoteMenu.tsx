import { useEffect, useState } from "react";
import { MessageSquareQuote, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTabs } from "@/context/tabsContext";
import { useChatMessages } from "@/context/chatMessagesContext";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useSettings } from "@/context/settingsContext";

export function SelectionQuoteMenu() {
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [selectedText, setSelectedText] = useState("");
    const [sourceName, setSourceName] = useState("");
    const { openTab, activeTab, activeTabId } = useTabs();
    const { setTabState } = useChatMessages();
    const { settings } = useSettings()

    useEffect(() => {
        const handleMouseUp = () => {
            setTimeout(() => {
                const selection = window.getSelection();
                if (!selection || selection.isCollapsed || selection.toString().trim() === "") {
                    setPosition(null);
                    return;
                }

                // Use commonAncestorContainer to find the closest container
                let node = selection.getRangeAt(0).commonAncestorContainer;
                if (node.nodeType === Node.TEXT_NODE) {
                    node = node.parentNode as Node;
                }
                const element = node as Element;
                const container = element?.closest('[data-quote-source]');

                if (!container) {
                    setPosition(null);
                    return;
                }

                const text = selection.toString().trim();
                const source = container.getAttribute('data-quote-source') || "Unknown";

                setSelectedText(text);
                setSourceName(source);

                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                // Show floating menu above the selection
                setPosition({
                    top: rect.top - 10,
                    left: rect.left + rect.width / 2,
                });
            }, 10);
        };

        const handleMouseDown = (e: MouseEvent) => {
            // Hide on click down unless clicking on the menu itself
            const target = e.target as HTMLElement;
            if (!target.closest('.quote-menu-container')) {
                setPosition(null);
            }
        };

        // Clear selection on keydown
        const handleKeyDown = () => {
            setPosition(null);
        };

        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("mousedown", handleMouseDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    if (!position) return null;

    const handleQuoteCurrent = () => {
        if (activeTabId) {
            setTabState(activeTabId, { quote: { text: selectedText, sourceName: sourceName } });
        }
        window.getSelection()?.removeAllRanges();
        setPosition(null);
    };

    const handleQuoteNew = () => {
        // Create new chat tab
        const tabId = openTab({ type: "chat", title: "New Chat" });
        setTabState(tabId, { quote: { text: selectedText, sourceName: sourceName } });
        window.getSelection()?.removeAllRanges();
        setPosition(null);
    };

    const isChatActive = activeTab?.type === "chat";

    return (
        <TooltipProvider>
            <div
                className="quote-menu-container fixed z-100 transform -translate-x-1/2 -translate-y-full flex items-center p-0.5 shadow-lg bg-popover/80 backdrop-blur-md border border-border rounded-lg animate-in fade-in zoom-in-95 duration-200"
                style={{ top: position.top, left: position.left }}
            >
                {isChatActive ? (
                    <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex items-center gap-1.5 h-8 px-2.5 rounded-md hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
                                    onClick={handleQuoteCurrent}
                                >
                                    <Quote size={14} />
                                    <span className="font-medium text-xs">Quote in Chat</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Insert quote into this chat</p>
                            </TooltipContent>
                        </Tooltip>


                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex items-center gap-1.5 h-8 px-2.5 rounded-md hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
                                    onClick={handleQuoteNew}
                                >
                                    <MessageSquareQuote size={14} />
                                    <span className="font-medium text-xs">Ask {settings.aiName}</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Create a new chat with this quote</p>
                            </TooltipContent>
                        </Tooltip>
                    </>
                ) : (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-2 h-8 px-3 rounded-md hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
                                onClick={handleQuoteNew}
                            >
                                <Quote size={14} />
                                <span className="font-medium text-xs">Ask {settings.aiName}</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Create a new chat with this quote</p>
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </TooltipProvider>
    );
}
