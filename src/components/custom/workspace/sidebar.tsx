'use client'

import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import Image from "next/image";
import { User, Settings as SettingsIcon, X, Sun, Bot, Tags, ArrowUpLeft } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Language, Settings, Theme } from "@/types/settingsType";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/context/settingsContext";

export default function SidebarArea() {
    const [userAuth, setUserAuth] = useState<any>(null);
    const [user, setUser] = useState<ProfileType | null>(null);
    const [announce, setAnnounce] = useState<AnnounceType | null>(null);
    const [announceFetched, setAnnounceFetched] = useState(false);
    const [showAnnounce, setShowAnnounce] = useState(true);
    const { state } = useSidebar();
    const [settingsTab, setSettingsTab] = useState(0);
    const { settingsOpen, setSettingsOpen } = useSettingsOpen();

    // settings state
    const { settings, setSettings } = useSettings();
    const [tempSettings, setTempSettings] = useState<Settings>(settings);

    const [tempPseudo, setTempPseudo] = useState("");

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
            setTempPseudo(profiles?.[0].username || "");
            setSettings(profiles?.[0].settings || {
                theme: "system",
                language: "en",
                customInstructions: {
                    aboutUser: "",
                    customPrompt: "",
                },
                plan: "free",
                aiName: "Narao AI",
            });
            setTempSettings(profiles?.[0].settings || {
                theme: "system",
                language: "en",
                customInstructions: {
                    aboutUser: "",
                    customPrompt: "",
                },
                plan: "free",
                aiName: "Narao AI",
            });
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

    // update settings
    const updateSettings = async () => {
        if (!user) return;
        const { error } = await supabase
            .from('profiles')
            .update({ settings: tempSettings })
            .eq('id', user.id);

        if (error) {
            console.error(error);
        }
        setSettings(tempSettings);
    };


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
                                    <SettingsIcon size={24} className="group-data-[state=collapsed]:hidden w-full transition-all duration-200" />
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
                                <Sun size={16} />
                                <p className="text-sm font-medium">Preferences</p>
                            </div>
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start ", settingsTab === 1 && "bg-card hover:bg-card")}
                                onClick={() => { setSettingsTab(1) }}>
                                <User size={16} />
                                <p className="text-sm font-medium">Account</p>
                            </div>
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start ", settingsTab === 2 && "bg-card hover:bg-card")}
                                onClick={() => { setSettingsTab(2) }}>
                                <Bot size={16} />
                                <p className="text-sm font-medium">AI Settings</p>
                            </div>
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start ", settingsTab === 3 && "bg-card hover:bg-card")}
                                onClick={() => { setSettingsTab(3) }}>
                                <Tags size={16} />
                                <p className="text-sm font-medium">Categories</p>
                            </div>
                            <div className={cn("flex items-center justify-center w-full gap-2 p-4 py-2 rounded-lg border bg-card border-sidebar-border hover:bg-card/50 cursor-pointer transition-all duration-200 text-left justify-start absolute bottom-0 left-0 right-0 ")}
                                // We want it to link to the about page
                                onClick={() => { }}>
                                <ArrowUpLeft size={16} />
                                <p className="text-sm font-medium">About</p>
                            </div>
                        </div>
                        <div className="col-span-4 flex flex-col h-full relative px-4">
                            <DialogHeader>
                                <DialogTitle>{settingsTab === 0 ? "Preferences" : settingsTab === 1 ? "Account" : settingsTab === 2 ? "AI Settings" : "Categories"}</DialogTitle>
                                <DialogDescription>
                                    {settingsTab === 0 ? "Manage your workspace preferences." : settingsTab === 1 ? "Manage your workspace account." : settingsTab === 2 ? "Manage your workspace AI settings." : "Manage your workspace categories."}
                                </DialogDescription>
                            </DialogHeader>

                            {settingsTab === 0 && (
                                <div className="flex flex-col py-6">
                                    <div className="flex gap-2 justify-between items-center border-t border-b border-border py-4">
                                        <p className="text-sm font-medium">Appearance</p>
                                        <Select
                                            value={tempSettings.theme}
                                            onValueChange={(value: string) => {
                                                setTempSettings({
                                                    ...tempSettings,
                                                    theme: value as Theme,
                                                });
                                            }}

                                        >
                                            <SelectTrigger className="bg-transparent! border-none hover:bg-card!">
                                                <SelectValue placeholder="Theme" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="light">Light</SelectItem>
                                                <SelectItem value="dark">Dark</SelectItem>
                                                <SelectItem value="system">System</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex gap-2 justify-between items-center py-4">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium">Default Language</p>
                                            <p className="text-xs text-muted-foreground">Check this setting for more relevant responses from the AI.</p>
                                        </div>
                                        <Select
                                            value={tempSettings.language}
                                            onValueChange={(value: string) => {
                                                setTempSettings({
                                                    ...tempSettings,
                                                    language: value as Language,
                                                });
                                            }}
                                        >
                                            <SelectTrigger className="bg-transparent! border-none hover:bg-card!">
                                                <SelectValue placeholder="Language" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="en">English</SelectItem>
                                                <SelectItem value="es">Español</SelectItem>
                                                <SelectItem value="fr">Français</SelectItem>
                                                <SelectItem value="de">Deutsch</SelectItem>
                                                <SelectItem value="it">Italiano</SelectItem>
                                                <SelectItem value="pt">Português</SelectItem>
                                                <SelectItem value="ru">Русский</SelectItem>
                                                <SelectItem value="zh">中文</SelectItem>
                                                <SelectItem value="ja">日本語</SelectItem>
                                                <SelectItem value="ko">한국어</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}
                            {settingsTab === 1 && (
                                <div className="flex flex-col py-6">
                                    <div className="flex flex-col gap-2 border-t border-b border-border py-4">
                                        <p className="text-sm font-medium">Username</p>
                                        <Input
                                            className="w-full focus-visible:border-primary focus-visible:ring-none focus-visible:ring-[0px]!"
                                            value={tempPseudo}
                                            onChange={(e) => {
                                                setTempPseudo(e.target.value);
                                            }}
                                            onBlur={() => { if (!tempPseudo) setTempPseudo(user?.username || "") }}
                                        />
                                    </div>
                                    <div className="flex gap-2 py-4 justify-between items-center">
                                        <p className="text-sm font-medium">Email</p>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" className="text-sm font-medium text-muted-foreground">
                                                    <ArrowUpLeft size={16} />
                                                    {userAuth?.email}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">
                                                <p>Change email</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                </div>
                            )}
                            {settingsTab === 2 && (
                                <div className="flex flex-col py-6">
                                    <div className="flex flex-col gap-2 border-t border-b border-border py-4">
                                        <p className="text-sm font-medium">AI name</p>
                                        <Input
                                            className="w-full focus-visible:border-primary focus-visible:ring-none focus-visible:ring-[0px]! selection:bg-primary"
                                            value={tempSettings.aiName}
                                            onChange={(e) => {
                                                setTempSettings({ ...tempSettings, aiName: e.target.value });
                                            }}
                                            onBlur={() => { if (!tempSettings.aiName) setTempSettings({ ...tempSettings, aiName: "OrthanAI" }) }}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2 border-b border-border py-4">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium">Custom Instructions</p>
                                            <p className="text-xs text-muted-foreground">Give the AI instructions on how to respond to you.</p>
                                        </div>
                                        <Textarea
                                            maxLength={500}
                                            className="w-full focus-visible:border-primary focus-visible:ring-none focus-visible:ring-[0px]! resize-none h-24 scrollbar-hide selection:bg-primary/50"
                                            value={tempSettings.customInstructions.customPrompt}
                                            onChange={(e) => {
                                                setTempSettings({ ...tempSettings, customInstructions: { ...tempSettings.customInstructions, customPrompt: e.target.value } });
                                            }}
                                            onBlur={() => { if (!tempSettings.customInstructions.customPrompt) setTempSettings({ ...tempSettings, customInstructions: { ...tempSettings.customInstructions, customPrompt: "" } }) }}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2 py-4">
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium">About you</p>
                                            <p className="text-xs text-muted-foreground">Tell the AI about yourself to get answers tailored to you.</p>
                                        </div>
                                        <Textarea
                                            maxLength={500}
                                            className="w-full focus-visible:border-primary focus-visible:ring-none focus-visible:ring-[0px]! resize-none h-24 scrollbar-hide selection:bg-primary/50"
                                            value={tempSettings.customInstructions.aboutUser}
                                            onChange={(e) => {
                                                setTempSettings({ ...tempSettings, customInstructions: { ...tempSettings.customInstructions, aboutUser: e.target.value } });
                                            }}
                                            onBlur={() => { if (!tempSettings.customInstructions.aboutUser) setTempSettings({ ...tempSettings, customInstructions: { ...tempSettings.customInstructions, aboutUser: "" } }) }}
                                        />
                                        <p className="text-xs text-muted-foreground">*Max 500 characters.</p>
                                    </div>
                                </div>
                            )}

                            {/* For spacing */}
                            <div className="h-24"></div>

                            <DialogFooter className="flex items-center justify-end gap-2 p-2 absolute bottom-0 left-1/2 -translate-x-1/2 bg-card/50 backdrop-blur-sm w-fit rounded-full border">
                                <DialogClose asChild>
                                    <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Close</Button>
                                </DialogClose>
                                <Button variant="default" onClick={() => { updateSettings(); setSettingsOpen(false); }}>Save Changes</Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>
            </SidebarFooter>
        </Sidebar>
    );
}   