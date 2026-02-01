'use client'

import { SidebarInset } from "@/components/ui/sidebar";

export default function MainArea() {
    return (
        <SidebarInset>
            <div className="bg-red-500 text-foreground h-[95vh] w-full rounded-lg rounded-r-none rounded-b-none absolute bottom-0 right-0">
                <div className="">

                </div>
            </div>
        </SidebarInset>
    );
}