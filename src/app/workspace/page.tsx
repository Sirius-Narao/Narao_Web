// Page for the workspace of the application
'use client'
import Image from "next/image";
import SidebarArea from "@/components/custom/workspace/sidebar";
import MainArea from "@/components/custom/workspace/mainArea";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ActiveTabsProvider } from "@/context/activeTabsContext";
import { SettingsOpenProvider } from "@/context/settingOpenContext";
import { CreateNoteDialogOpenProvider } from "@/context/createNoteDialogOpenContext";

export default function Workspace() {
    return (
        <div className="bg-background h-screen w-screen">
            <SidebarProvider>
                <ActiveTabsProvider>
                    <SettingsOpenProvider>
                        <CreateNoteDialogOpenProvider>
                            <SidebarArea />
                            <MainArea />
                        </CreateNoteDialogOpenProvider>
                    </SettingsOpenProvider>
                </ActiveTabsProvider>
            </SidebarProvider>
        </div>
    );
}
