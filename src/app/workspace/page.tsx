// Page for the workspace of the application
'use client'
import SidebarArea from "@/components/custom/workspace/sidebar";
import MainArea from "@/components/custom/workspace/mainArea";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TabsProvider } from "@/context/tabsContext";
import { SettingsOpenProvider } from "@/context/settingOpenContext";
import { ContentProvider } from "@/context/contentContext";
import { ChatMessagesProvider } from "@/context/chatMessagesContext";
import { UserAuthProvider, useUserAuth } from "@/context/userAuthContext";
import { UserProvider } from "@/context/userContext";
import { FetchedFoldersProvider } from "@/context/fetchedFoldersContext";
import { FetchedNotesProvider } from "@/context/fetchedNotesContext";
import { IsLoadingProvider } from "@/context/isLoadingContext";
import { ReviewProvider } from "@/context/reviewContext";
import { redirect } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Spinner } from "@/components/ui/spinner";

export default function Workspace() {
    const { userAuth, setUserAuth } = useUserAuth();
    const [isAuthLoading, setIsAuthLoading] = useState(true);

    // auth fetch
    useEffect(() => {
        const fetchUserAuth = async () => {
            const { data } = await supabase.auth.getUser();
            setUserAuth(data.user);
            setIsAuthLoading(false);
        }
        fetchUserAuth();
    }, [])

    if (isAuthLoading) {
        return <div className="flex items-center justify-center w-screen h-screen bg-black"><Spinner /></div>; // Or a loading spinner if preferred
    }

    if (!userAuth) {
        return redirect("/login");
    }

    return (
        <Suspense fallback={<div className="flex items-center justify-center w-screen h-screen bg-black"><Spinner /></div>}>
            <div className="bg-background h-dvh w-screen relative selection:bg-primary/50">
                <SidebarProvider>
                    <TabsProvider>
                        <SettingsOpenProvider>
                            <ContentProvider>
                                <ChatMessagesProvider>
                                    <UserProvider>
                                        <FetchedFoldersProvider>
                                            <FetchedNotesProvider>
                                                <IsLoadingProvider>
                                                    <ReviewProvider>
                                                        <SidebarArea />
                                                        <MainArea />
                                                    </ReviewProvider>
                                                </IsLoadingProvider>
                                            </FetchedNotesProvider>
                                        </FetchedFoldersProvider>
                                    </UserProvider>
                                </ChatMessagesProvider>
                            </ContentProvider>
                        </SettingsOpenProvider>
                    </TabsProvider>
                </SidebarProvider>
            </div>
        </Suspense>
    );
}
