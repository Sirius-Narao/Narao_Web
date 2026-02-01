'use client'

import { SidebarInset } from "@/components/ui/sidebar";

export default function MainArea() {
    return (
        <SidebarInset className="bg-background">
            <div className="bg-card text-foreground h-[92vh] w-[calc(100%-0.5rem)] rounded-lg absolute bottom-2 p-4 border border-sidebar-border">
                <div className="">

                </div>
            </div>
        </SidebarInset>
    );
}