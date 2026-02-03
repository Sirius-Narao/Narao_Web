'use client'

import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import Image from "next/image";
import { User, Settings, X, Icon, Folder, NotebookPen, MessageCircle, MessageCirclePlus, Search, MoreHorizontal, MoreVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { useState } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAreaLocation } from "@/context/areaContextLocation";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SidebarArea() {
    // EXAMPLE DATA
    const USERNAME_EXAMPLE: string = "Bruce Wayne";
    const ANNOUNCES_EXAMPLE: { title: string, description: string } = { title: "Announce Example", description: "Announce's description here, text should be short, but it should be visible" };
    const CHAT_LIST_EXAMPLE: { title: string, description: string, date: string }[] = [
        { title: "Chat 1", description: "Chat 1 description here, text should be short, but it should be visible", date: "2026-02-03" },
        { title: "Chat 2", description: "Chat 2 description here, text should be short, but it should be visible", date: "2026-02-02" },
        { title: "Chat 3", description: "Chat 3 description here, text should be short, but it should be visible", date: "2026-02-01" },
        { title: "Chat 4", description: "Chat 4 description here, text should be short, but it should be visible", date: "2026-02-01" },
        { title: "Chat 5", description: "Chat 5 description here, text should be short, but it should be visible", date: "2026-02-01" },
        { title: "Chat 6", description: "Chat 6 description here, text should be short, but it should be visible", date: "2026-02-01" },
        { title: "Chat 7", description: "Chat 7 description here, text should be short, but it should be visible", date: "2026-02-01" },
        { title: "Chat 8", description: "Chat 8 description here, text should be short, but it should be visible", date: "2026-02-01" },
        { title: "Chat 9", description: "Chat 9 description here, text should be short, but it should be visible", date: "2026-02-01" },
        { title: "Chat 10", description: "Chat 10 description here, text should be short, but it should be visible", date: "2026-02-01" },
    ]

    // show announce
    const [showAnnounce, setShowAnnounce] = useState(true);
    // active tab
    const [activeTab, setActiveTab] = useState(0);
    // sidebar state
    const { state, setOpen } = useSidebar();
    // area location
    const { areaLocation, setAreaLocation } = useAreaLocation();
    // console.log(areaLocation);

    return (
        <Sidebar variant="inset" className="bg-background">
            {/* --------------------------- Header --------------------------- */}
            <SidebarHeader className="bg-background">
                <header className="flex items-center">
                    {/* Logo and Narao text */}
                    <div className={cn(
                        "flex items-center gap-2 w-fit min-w-10 border border-sidebar-border rounded-full p-1 px-4 bg-card shadow-lg transition-all duration-200",
                        "group-data-[state=collapsed]:w-10 group-data-[state=collapsed]:h-10"
                    )}>
                        <Image src="/favicon.ico" alt="Logo" width={24} height={24} className="group-data-[state=collapsed]:hidden transition-all duration-200" />
                        <span className="text-xl font-bold transition-all duration-200 group-data-[state=collapsed]:hidden">
                            Narao
                        </span>
                    </div>
                </header>
            </SidebarHeader>
            <Tooltip>
                <TooltipTrigger asChild>
                    <SidebarTrigger className="absolute top-4 right-2.5" />
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    <p>{state === "collapsed" ? "Open" : "Close"}</p>
                </TooltipContent>
            </Tooltip>

            {/* --------------------------- Content --------------------------- */}
            <SidebarContent className="bg-background mt-2.5 overflow-y-hidden">
                {/* Slider between tabs */}
                <div className={cn(
                    "bg-card border border-sidebar-border shadow-lg relative flex items-center justify-between transition-all duration-300 ease-in-out",
                    state === "collapsed"
                        ? "w-10 h-10 rounded-full p-0 gap-0 justify-center mx-auto"
                        : "w-full h-16 rounded-lg p-1 px-2 gap-2"
                )}>
                    {Array.from({ length: 3 }).map((_, index) => {
                        const isHidden = state === "collapsed" && activeTab !== index;
                        if (isHidden) return null;

                        return (
                            <div
                                className={cn(
                                    "relative z-20 h-full cursor-pointer flex items-center justify-center transition-all duration-300",
                                    state === "collapsed" ? "w-full py-0" : "w-[calc(100%/3)] py-2"
                                )}
                                key={index}
                                onClick={() => { setActiveTab(index); setAreaLocation(index === 0 ? "folders" : index === 1 ? "notes" : "chats") }}
                            >
                                {activeTab === index && (
                                    <motion.div
                                        layoutId="tab-slider"
                                        className={cn(
                                            "absolute bg-accent-foreground -z-10",
                                            state === "collapsed" ? "inset-0 rounded-full" : "inset-y-2 inset-x-0 rounded-lg"
                                        )}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                    />
                                )}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            className={cn(
                                                "w-full h-full transition-colors duration-200",
                                                state === "collapsed" ? "rounded-full" : "rounded-lg",
                                                activeTab === index ? "text-background hover:bg-transparent" : "text-muted-foreground hover:bg-muted"
                                            )}
                                            variant="ghost"
                                        >
                                            {/* Tabs */}
                                            {index === 0 ? <Folder /> : index === 1 ? <NotebookPen /> : <MessageCirclePlus />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{index === 0 ? "Open Folders" : index === 1 ? "New Note" : "New Chat"}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        )
                    })}
                </div>

                {/* Search Bar & Chat List */}
                <div className="mt-2">
                    <InputGroup className="w-full bg-card shadow-lg transition-all duration-200 ease-in-out group-data-[state=collapsed]:w-10 group-data-[state=collapsed]:h-10 group-data-[state=collapsed]:rounded-full group-data-[state=collapsed]:p-0 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:mx-auto cursor-pointer hover:bg-card/30 "
                        onClick={() => { if (state === "collapsed") { setOpen(true) } }}>
                        <InputGroupAddon align="inline-end" className="group-data-[state=collapsed]:pr-0 group-data-[state=collapsed]:w-full group-data-[state=collapsed]:h-full group-data-[state=collapsed]:justify-center transition-all duration-200 cursor-pointer hover:bg-card/30">
                            <InputGroupText className="bg-transparent group-data-[state=collapsed]:p-0 cursor-pointer hover:bg-card/30">
                                <Search />
                            </InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput placeholder="Look for a chat..." className="bg-card group-data-[state=collapsed]:hidden cursor-pointer hover:bg-card/30" />
                    </InputGroup>
                    <ScrollArea className="min-h-[20rem] max-h-[calc(100vh-20rem)] h-fit rounded-lg border border-sidebar-border mt-2 p-2 shadow-lg gap-2 bg-card group-data-[state=collapsed]:hidden">
                        {CHAT_LIST_EXAMPLE.map((chat, index) => (
                            <div key={index} className="flex items-center justify-between pl-4 pr-2 py-2 border-l border-t border-sidebar-border shadow-lg rounded-md bg-background hover:bg-background/30 cursor-pointer transition-all duration-100 ease-in-out mb-1">
                                <div className="flex flex-row items-center gap-2 w-full">
                                    <p>{chat.title}</p>
                                    <p className="text-xs text-muted-foreground">{chat.description.slice(0, 10) + "..."}</p>
                                </div>
                                <Button variant="ghost" className="p-1 h-6 w-6" asChild>
                                    <MoreVertical size={16} className="text-muted-foreground" />
                                </Button>
                            </div>
                        ))}
                    </ScrollArea>
                </div>
            </SidebarContent>

            {/* --------------------------- Footer --------------------------- */}
            <SidebarFooter className="bg-background">
                <AnimatePresence>
                    {showAnnounce && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{
                                opacity: 0,
                                y: 100,
                                transition: { duration: 0.3, ease: "easeIn" }
                            }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="group-data-[state=collapsed]:hidden"
                        >
                            <Card className="p-4 pt-6 shadow-lg gap-2 border-sidebar-border bg-card">
                                <CardHeader className="p-0 m-0">
                                    <CardTitle className="text-sm font-semibold">{ANNOUNCES_EXAMPLE.title}</CardTitle>
                                    <CardDescription className="text-xs">{ANNOUNCES_EXAMPLE.description}</CardDescription>
                                </CardHeader>
                                <CardFooter className="p-0 flex items-center justify-between mt-2">
                                    <Button variant="link" className="w-fit h-fit p-0 text-xs" onClick={() => { }}>Read More...</Button>
                                    <Tooltip >
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                className="w-8 h-8 p-0 rounded-full hover:bg-muted"
                                                onClick={() => setShowAnnounce(false)}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                            <p>Close</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" className={cn(
                            "flex items-center justify-center z-30 gap-2 w-full h-10 border border-sidebar-border rounded-full px-2 bg-card shadow-lg overflow-hidden",
                            "group-data-[state=collapsed]:w-10 group-data-[state=collapsed]:h-10 group-data-[state=collapsed]:items-center group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:gap-0"
                        )}>
                            <User size={24} className="w-24 h-24" />
                            <span className="text-lg font-bold transition-all duration-200 group-data-[state=collapsed]:hidden">
                                {USERNAME_EXAMPLE}
                            </span>
                            <div className="flex items-center justify-end w-full">
                                <Settings size={24} className="group-data-[state=collapsed]:hidden w-full transition-all duration-200" />
                            </div>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Settings</p>
                    </TooltipContent>
                </Tooltip>
            </SidebarFooter>
        </Sidebar>
    );
}   