'use client'

import { Sidebar, SidebarContent, SidebarHeader, SidebarTrigger, SidebarFooter } from "@/components/ui/sidebar";
import Image from "next/image";
import { User, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

export default function SidebarArea() {
    const USERNAME_EXAMPLE = "Bruce Wayne";
    const ANNOUNCES_EXAMPLE = { title: "Announce Example", description: "Announce's description here, text should be short, but it should be visible" };
    return (
        <Sidebar variant="inset" className="bg-background">
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
            <SidebarTrigger className="absolute top-4 right-2.5" />
            <SidebarContent className="bg-background">
            </SidebarContent>
            <SidebarFooter className="bg-background">
                {/* Card for Announces */}
                <Card className="p-4 pt-6 shadow-lg gap-2 transition-all duration-200 group-data-[state=collapsed]:hidden">
                    <CardHeader className="p-0 m-0">
                        <CardTitle>{ANNOUNCES_EXAMPLE.title}</CardTitle>
                        <CardDescription>{ANNOUNCES_EXAMPLE.description}</CardDescription>
                    </CardHeader>
                    <CardFooter className="p-0 flex items-center justify-between">
                        <Button variant="link" className="w-fit h-fit p-0">Read More...</Button>
                        <Button variant="ghost" className="w-10 h-10 p-0 rounded-full">
                            <X />
                        </Button>
                    </CardFooter>
                </Card>
                <Button variant="ghost" className={cn(
                    "flex items-center justify-center gap-2 w-full h-10 border border-sidebar-border rounded-full px-2 bg-card shadow-lg",
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
            </SidebarFooter>
        </Sidebar>
    );
}   