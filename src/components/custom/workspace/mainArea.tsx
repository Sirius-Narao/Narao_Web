'use client'

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SidebarInset } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MoveLeft, MoveRight, Search } from "lucide-react";

export default function MainArea() {
    return (
        <SidebarInset className="bg-background">

            {/* ------------------ Top Part -------------------- */}
            <div className="bg-background text-foreground h-[calc(100%-94vh)] w-[calc(100%-0.5rem)] rounded-lg absolute top-2 flex items-center justify-between">
                {/* Left Side */}
                <div className="flex items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger>
                            <Button variant="ghost" className="w-10 h-10 p-0 rounded-full">
                                <MoveLeft size={24} color="white" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="flex items-center gap-2">
                            <p>Go Back</p>
                            <KbdGroup>
                                <Kbd className="bg-popover text-foreground">Ctrl + Z</Kbd>
                            </KbdGroup>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger>
                            <Button variant="ghost" className="w-10 h-10 p-0 rounded-full">
                                <MoveRight size={24} color="white" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent className="flex items-center gap-2">
                            <p>Go Forward</p>
                            <KbdGroup>
                                <Kbd className="bg-popover text-foreground">Ctrl + Alt + Z</Kbd>
                            </KbdGroup>
                        </TooltipContent>
                    </Tooltip>
                </div>

                {/* Middle */}
                <div className="">
                    <InputGroup className="w-[40%] bg-card shadow-lg cursor-pointer px-2"
                        onClick={() => { }}>
                        <InputGroupAddon align="inline-end" className="cursor-pointer">
                            <InputGroupText className="bg-transparent cursor-pointer">
                                <KbdGroup className="">
                                    <Kbd className="bg-popover text-muted-foreground">Ctrl + Alt + K</Kbd>
                                </KbdGroup>
                                <Search />
                            </InputGroupText>
                        </InputGroupAddon>
                        <InputGroupInput
                            placeholder="Look for a folder or a note..."
                            className="bg-card cursor-pointer "
                            onChange={(e) => { }}
                        />
                    </InputGroup>
                </div>

                {/* Right Side */}
                <div>

                </div>
            </div>

            {/* ------------------ Bottom Part ----------------- */}
            <div className="bg-card text-foreground h-[92vh] w-[calc(100%-0.5rem)] rounded-lg absolute bottom-2 p-4 border border-sidebar-border">
                <div className="">

                </div>
            </div>
        </SidebarInset>
    );
}