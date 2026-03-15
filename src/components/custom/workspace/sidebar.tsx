'use client'

import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import Image from "next/image";
import { User, Settings, X, Sun, Bot, Tags, ArrowUpLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { useEffect, useState } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { supabase } from "@/lib/supabaseClient";
import ProfileType from "@/types/profileType";
import { Skeleton } from "@/components/ui/skeleton";
import AnnounceType from "@/types/announceType";
import { useSettingsOpen } from "@/context/settingOpenContext";

export default function SidebarArea() {
    const [userAuth, setUserAuth] = useState<any>(null);
    const [user, setUser] = useState<ProfileType | null>(null);
    const [announce, setAnnounce] = useState<AnnounceType | null>(null);
    const [announceFetched, setAnnounceFetched] = useState(false);
    const [showAnnounce, setShowAnnounce] = useState(true);
    const { state } = useSidebar();
    const [settingsTab, setSettingsTab] = useState(0);
    const { settingsOpen, setSettingsOpen } = useSettingsOpen();

    // auth fetch
    useEffect(() => {
        const fetchUserAuth = async () => {
            const { data } = await supabase.auth.getUser();
            setUserAuth(data.user);
        }
        fetchUserAuth();
    }, [])
    // Fetch user data
    useEffect(() => {
        if (!userAuth) return;

        const fetchUsers = async () => {
            const { data: profiles, error } = await supabase
                .from('profiles')         // your table name
                .select('*')          // select all columns
                .eq('id', userAuth.id) // select only the user's profile

            if (error) {
                console.error(error);
            }
            setUser(profiles?.[0]);
        };
        fetchUsers();
    }, [userAuth]);
    // Fetch announces data
    useEffect(() => {
        const fetchAnnounces = async () => {
            const { data: announces, error } = await supabase
                .from('announces')         // your table name
                .select('*')          // select all columns
                .limit(1);            // select only the 1rst user

            if (error) {
                console.error(error);
            }
            setAnnounce(announces?.[0]);
            setAnnounceFetched(true);
        };
        fetchAnnounces();
    }, []);


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
                {/* Tab navigation moved to mainArea tab bar */}
            </SidebarContent>


            {/* --------------------------- Footer --------------------------- */}
            <SidebarFooter className="bg-background p-0 group-data-[state=collapsed]:pl-1 transition-all duration-200">
                <AnimatePresence>
                    {announceFetched ? announce && showAnnounce && (
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
                                    <CardTitle className="text-sm font-semibold">{announce?.title}</CardTitle>
                                    <CardDescription className="text-xs">{announce?.description}</CardDescription>
                                </CardHeader>
                                <CardFooter className="p-0 flex items-center justify-between mt-2">
                                    <Button variant="link" className="w-fit h-fit p-0 text-xs" onClick={() => window.open(announce?.link, "_blank")}>Read More...</Button>
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
                    ) : (
                        <div className="group-data-[state=collapsed]:hidden">
                            <Skeleton className="w-full h-36 rounded-xl" />
                        </div>
                    )}
                </AnimatePresence>
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <Tooltip>
                        <TooltipTrigger asChild>

                            <Button variant="ghost" className={cn(
                                "flex items-center justify-center z-30 gap-2 w-full h-10 border border-sidebar-border rounded-full px-2 bg-card shadow-lg overflow-hidden",
                                "group-data-[state=collapsed]:w-10 group-data-[state=collapsed]:h-10 group-data-[state=collapsed]:items-center group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:gap-0"
                            )}
                                onClick={() => setSettingsOpen(true)}
                            >
                                <User size={24} className="w-24 h-24" />
                                {user ? <span className="text-lg font-bold transition-all duration-200 group-data-[state=collapsed]:hidden truncate w-full text-left pl-2">
                                    {user?.username}
                                </span> : <Skeleton className="w-full h-full rounded-full" />}
                                <div className="flex items-center justify-end w-24">
                                    <Settings size={24} className="group-data-[state=collapsed]:hidden w-full transition-all duration-200" />
                                </div>
                            </Button>
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
                                    <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Close</Button>
                                </DialogClose>
                                <Button variant="default" onClick={() => setSettingsOpen(false)}>Save Changes</Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>
            </SidebarFooter>
        </Sidebar>
    );
}   