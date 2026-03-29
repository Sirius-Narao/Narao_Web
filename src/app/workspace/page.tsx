// Page for the workspace of the application
'use client'
import SidebarArea from "@/components/custom/workspace/sidebar";
import MainArea from "@/components/custom/workspace/mainArea";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TabsProvider } from "@/context/tabsContext";
import { SettingsOpenProvider } from "@/context/settingOpenContext";
import { ContentProvider } from "@/context/contentContext";
import { ChatMessagesProvider } from "@/context/chatMessagesContext";
import { UserAuthProvider } from "@/context/userAuthContext";
import { UserProvider } from "@/context/userContext";
import { FetchedFoldersProvider } from "@/context/fetchedFoldersContext";
import { FetchedNotesProvider } from "@/context/fetchedNotesContext";
import { IsLoadingProvider } from "@/context/isLoadingContext";

export default function Workspace() {
    return (
        <div className="bg-background h-screen w-screen relative selection:bg-primary/50">

            <SidebarProvider>
                <TabsProvider>
                    <SettingsOpenProvider>
                        <ContentProvider>
                            <ChatMessagesProvider>
                                <UserAuthProvider>
                                    <UserProvider>
                                        <FetchedFoldersProvider>
                                            <FetchedNotesProvider>
                                                <IsLoadingProvider>
                                                    <SidebarArea />
                                                    <MainArea />
                                                </IsLoadingProvider>
                                            </FetchedNotesProvider>
                                        </FetchedFoldersProvider>
                                    </UserProvider>
                                </UserAuthProvider>
                            </ChatMessagesProvider>
                        </ContentProvider>
                    </SettingsOpenProvider>
                </TabsProvider>
            </SidebarProvider>

        </div>
    );
}
