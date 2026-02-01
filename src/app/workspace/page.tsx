// Page for the workspace of the application
'use client'
import Image from "next/image";
import SidebarArea from "@/components/custom/workspace/sidebar";
import MainArea from "@/components/custom/workspace/mainArea";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function Workspace() {
    return (
        <div className="bg-background h-screen w-screen">
            <SidebarProvider className="bg-background">
                <SidebarArea />
                <MainArea />
            </SidebarProvider>
        </div>
    );
}
