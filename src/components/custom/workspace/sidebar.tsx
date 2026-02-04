'use client'

import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import Image from "next/image";
import { User, Settings, X, Icon, Folder, NotebookPen, MessageCircle, MessageCirclePlus, Search, MoreHorizontal, MoreVertical, Pencil, Trash2, FolderDown, CircleOff, Sun, Bot, Bell, Tags, Star, MoveUpLeft, ArrowUpLeft } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import ChatType from "@/types/chatType";
import dateConvert from "@/lib/dateConvert";
import quantifyDate from "@/lib/quantifyDate";
import handleSearch from "@/lib/handleSearch";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

export default function SidebarArea() {
    // EXAMPLE DATA
    const USERNAME_EXAMPLE: string = "Bruce Wayne";
    const ANNOUNCES_EXAMPLE: { title: string, description: string } = { title: "Announce Example", description: "Announce's description here, text should be short, but it should be visible" };
    const CHAT_LIST_EXAMPLE: ChatType[] = [
        { title: "Project Phoenix", description: "Discussing the migration strategy for the legacy database.", date: "2024-03-15" },
        { title: "Design Review", description: "Feedback on the new landing page mockups and user flow.", date: "2025-01-10" },
        { title: "Bug: Login Loop", description: "Investigating reports of users getting stuck on the auth redirect.", date: "2024-02-28" },
        { title: "Marketing Sync", description: "Planning the social media rollout for the Q2 product launch.", date: "2026-03-20" },
        { title: "API Documentation", description: "Drafting the endpoints for the new integration service.", date: "2024-01-12" },
        { title: "Customer Support", description: "Resolving the ticket regarding workspace permission issues.", date: "2025-03-05" },
        { title: "Sprint Planning", description: "Defining tasks and estimates for the upcoming development cycle.", date: "2024-03-18" },
        { title: "Security Patch", description: "Implementing fixes for the identified vulnerability in the middleware.", date: "2023-12-20" },
        { title: "Team Lunch", description: "Coordinating the location and time for Friday's social gathering.", date: "2024-03-22" },
        { title: "Performance Audit", description: "Analyzing the bundle size and load times for the mobile app.", date: "2024-02-15" },
    ];

    // show announce
    const [showAnnounce, setShowAnnounce] = useState(true);
    // active tab
    const [activeTab, setActiveTab] = useState(0);
    // sidebar state
    const { state, setOpen } = useSidebar();
    // area location
    const { areaLocation, setAreaLocation } = useAreaLocation();
    // settings tab
    const [settingsTab, setSettingsTab] = useState(0);

    console.table(
        CHAT_LIST_EXAMPLE.map(c => ({
            value: quantifyDate(c.date),
        }))
    );

    // Filtered chats state
    const [filteredChats, setFilteredChats] = useState<ChatType[]>(() =>
        [...CHAT_LIST_EXAMPLE].sort((a, b) => quantifyDate(b.date) - quantifyDate(a.date))
    );

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
                <TooltipContent side="bottom" className="flex items-center gap-2">
                    <p>{state === "collapsed" ? "Open" : "Close"}</p>
                    <KbdGroup>
                        <Kbd className="bg-popover text-foreground">Ctrl + B</Kbd>
                    </KbdGroup>
                </TooltipContent>
            </Tooltip>

            {/* --------------------------- Content --------------------------- */}
            <SidebarContent className="bg-background mt-[9px] overflow-hidden">
                {/* Slider between tabs */}
                <div className={cn(
                    "bg-card border border-sidebar-border shadow-lg relative flex items-center justify-between transition-all duration-300 ease-in-out",
                    state === "collapsed"
                        ? "w-10 h-10 rounded-full p-0 gap-0 justify-center mx-auto"
                        : "w-full h-14 rounded-full px-2 gap-2"
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
                                    <TooltipContent className="flex items-center gap-2">
                                        <p>{index === 0 ? "Open Folders" : index === 1 ? "New Note" : "New Chat"}</p>
                                        <KbdGroup>
                                            <Kbd className="bg-popover text-foreground">Ctrl + {index === 0 ? "O" : index === 1 ? "N" : "C"}</Kbd>
                                        </KbdGroup>
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
                                <KbdGroup className="group-data-[state=collapsed]:hidden">
                                    <Kbd className="bg-popover text-muted-foreground">Ctrl + K</Kbd>
                                </KbdGroup>
                                <Search />
                            </InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                            placeholder="Look for a chat..."
                            className="bg-card group-data-[state=collapsed]:hidden cursor-pointer hover:bg-card/30"
                            onChange={(e) => setFilteredChats(handleSearch(e.target.value, CHAT_LIST_EXAMPLE))}
                        />
                    </InputGroup>
                    <ScrollArea className=" max-h-[calc(100vh-20rem)] h-fit rounded-lg border border-sidebar-border mt-2 pt-1 px-1 shadow-lg bg-card/30s group-data-[state=collapsed]:hidden">
                        {filteredChats.length > 0 ? filteredChats.map((chat, index) => (
                            <div key={index} className="flex items-center justify-between pl-4 pr-2 py-2 rounded-lg hover:bg-card/80 cursor-pointer transition-all duration-100 ease-in-out mb-1">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex flex-row items-center gap-2 w-full">
                                            <p>{chat.title.length > 9 ? chat.title.slice(0, 9).trim() + "..." : chat.title}</p>
                                            <p className="text-xs text-muted-foreground">{chat.description.length > 9 ? chat.description.slice(0, 9).trim() + "..." : chat.description}</p>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        <p>{chat.title}</p>
                                        <p className="text-xs text-muted-foreground">{chat.description}</p>
                                    </TooltipContent>
                                </Tooltip>
                                <DropdownMenu>
                                    <DropdownMenuTrigger>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" className="p-1 h-6 w-6" asChild>
                                                    <MoreVertical size={16} className="text-muted-foreground" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="right">
                                                <p>Options</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-40" align="start">
                                        <DropdownMenuGroup>
                                            <div className="flex flex-col p-2">
                                                <p>{chat.title}</p>
                                                <p className="text-xs text-muted-foreground/50">{dateConvert(chat.date)}</p>
                                                <div className="w-full h-[1px] bg-foreground/10 my-1"></div>
                                                <p className="text-xs text-muted-foreground">{chat.description}</p>
                                            </div>
                                            <DropdownMenuItem className="group cursor-pointer">
                                                <Pencil size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                Rename Chat
                                            </DropdownMenuItem >
                                            <DropdownMenuItem className="group cursor-pointer">
                                                <FolderDown size={16} className="text-muted-foreground group-hover:text-accent-foreground" />
                                                Move To
                                            </DropdownMenuItem >
                                            <DropdownMenuItem className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer">
                                                <Trash2 size={16} className="text-red-500" />
                                                Delete Chat
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-full gap-2 my-5">
                                <CircleOff size={48} className="text-muted-foreground" />
                                <p className="text-muted-foreground">No chats found</p>
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </SidebarContent>

            {/* --------------------------- Footer --------------------------- */}
            <SidebarFooter className="bg-background p-0 group-data-[state=collapsed]:pl-1 transition-all duration-200">
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
                <Dialog>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DialogTrigger asChild>
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
                            </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent className="flex items-center gap-2">
                            <p>Settings</p>
                            <KbdGroup>
                                <Kbd className="bg-popover text-foreground">Ctrl + ,</Kbd>
                            </KbdGroup>
                        </TooltipContent>
                    </Tooltip>
                    <DialogContent className="max-w-5xl grid grid-cols-5 " showCloseButton={false}>
                        <div className="col-span-1 h-full flex flex-col gap-2 relative">
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start ", settingsTab === 0 && "bg-card hover:bg-card")}
                                onClick={() => { setSettingsTab(0) }}>
                                <Sun size={20} />
                                <p className="text-sm font-medium">Preferences</p>
                            </div>
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start ", settingsTab === 1 && "bg-card hover:bg-card")}
                                onClick={() => { setSettingsTab(1) }}>
                                <User size={20} />
                                <p className="text-sm font-medium">Account</p>
                            </div>
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start ", settingsTab === 2 && "bg-card hover:bg-card")}
                                onClick={() => { setSettingsTab(2) }}>
                                <Bot size={20} />
                                <p className="text-sm font-medium">AI Settings</p>
                            </div>
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start ", settingsTab === 3 && "bg-card hover:bg-card")}
                                onClick={() => { setSettingsTab(3) }}>
                                <Tags size={20} />
                                <p className="text-sm font-medium">Categories</p>
                            </div>
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border bg-card border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start absolute bottom-0 left-0 right-0 ")}
                                // We want it to link to the about page
                                onClick={() => { }}>
                                <ArrowUpLeft size={20} />
                                <p className="text-sm font-medium">About</p>
                            </div>
                            {/* <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border bg-primary border-sidebar-border hover:bg-primary/80 cursor-pointer transition-all duration-200 text-left justify-start text-primary-foreground absolute bottom-0 left-0 right-0 ")}>
                                <Star size={20} />
                                <p className="text-sm font-medium">Try Narao Pro!</p>
                            </div> */}
                        </div>
                        <div className="col-span-4 flex flex-col h-full relative px-4">
                            <DialogHeader>
                                <DialogTitle>{settingsTab === 0 ? "Preferences" : settingsTab === 1 ? "Account" : settingsTab === 2 ? "AI Settings" : "Categories"}</DialogTitle>
                                <DialogDescription>
                                    {settingsTab === 0 ? "Manage your workspace preferences." : settingsTab === 1 ? "Manage your workspace account." : settingsTab === 2 ? "Manage your workspace AI settings." : "Manage your workspace categories."}
                                </DialogDescription>
                            </DialogHeader>
                            <p className="text-center text-muted-foreground h-52 flex items-center justify-center">SOON TO COME</p>

                            {/* For spacing */}
                            <div className="h-24"></div>

                            <DialogFooter className="flex items-center justify-end gap-2 p-2 absolute bottom-0 left-1/2 -translate-x-1/2 bg-card/50 backdrop-blur-sm w-fit rounded-full border">
                                <DialogClose asChild>
                                    <Button variant="ghost">Close</Button>
                                </DialogClose>
                                <Button variant="default">Save Changes</Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>
            </SidebarFooter>
        </Sidebar>
    );
}   