// Navbar component for the application
'use client'
import Image from "next/image";
import { Button } from "../ui/button";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import ProfileType from "@/types/profileType";
import { UserIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { Skeleton } from "../ui/skeleton";

export default function Navbar({ user }: { user: User | undefined }) {
    const { scrollY } = useScroll();
    const [isScrolled, setIsScrolled] = useState(false);
    const [userProfile, setUserProfile] = useState<ProfileType | null>(null);
    const [userLoaded, setUserLoaded] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchUsers = async () => {
            if (!user?.id) return;

            const { data: profiles, error } = await supabase
                .from('profiles')         // your table name
                .select('*')          // select all columns
                .eq('id', user.id);            // select only the 1rst user

            if (error) {
                console.error(error);
            }
            setUserProfile(profiles?.[0]);
            setUserLoaded(true);
        };
        fetchUsers();
    }, [user]);

    // Update state based on scroll position
    useMotionValueEvent(scrollY, "change", (latest) => {
        if (latest > 250 && !isScrolled) {
            setIsScrolled(true);
        } else if (latest <= 250 && isScrolled) {
            setIsScrolled(false);
        }
    });

    return (
        <motion.nav
            initial={false}
            animate={{
                width: isScrolled ? "70%" : "95%",
                y: isScrolled ? 15 : 0,
                backgroundColor: isScrolled ? "var(--card)" : "transparent",
                borderColor: isScrolled ? "var(--border)" : "transparent",
                backdropFilter: isScrolled ? "blur(12px)" : "blur(0px)",
                paddingLeft: isScrolled ? "2.5rem" : "2rem",
                paddingRight: isScrolled ? "2.5rem" : "2rem",
                boxShadow: isScrolled
                    ? "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)"
                    : "0 0 rgba(0,0,0,0)",
            }}
            transition={{
                type: "spring",
                stiffness: 400,
                damping: 32,
                mass: 1
            }}
            className="fixed top-2 left-1/2 -translate-x-1/2 z-50 h-16 min-w-[600px] flex items-center justify-between rounded-full border border-solid"
        >
            <div className="flex items-center gap-2">
                <div className="relative w-8 h-8 group cursor-pointer">
                    <Image
                        src="/favicon.ico"
                        alt="Narao Logo"
                        fill
                        className="rounded-full transition-transform group-hover:scale-110"
                    />
                </div>
                <span className="text-xl font-bold">
                    Narao
                </span>
            </div>

            <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="rounded-full px-4 font-medium transition-all hover:bg-accent/50">Features</Button>
                <Button variant="ghost" size="sm" className="rounded-full px-4 font-medium transition-all hover:bg-accent/50">Pricing</Button>
                {user ? <>
                    {userProfile ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="lg" className="rounded-full font-medium transition-all hover:bg-accent/50 cursor-pointer bg-card ml-2">
                                    <Link href="/workspace" className="flex gap-2 items-center px-2">
                                        {userProfile.username}
                                        <UserIcon className="" size={30} />
                                    </Link>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Go to Workspace</p>
                            </TooltipContent>
                        </Tooltip>
                    ) : (<>
                        <Skeleton className="w-32 h-10 rounded-full" />
                    </>)}
                </> : <>
                    <Link href="/login">
                        <Button variant="ghost" size="sm" className="rounded-full px-4 font-medium transition-all hover:bg-accent/50 mr-2">Login</Button>
                    </Link>
                    <Link href="/signup">
                        <Button size="sm" className="rounded-full px-6 font-semibold shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95 bg-primary text-primary-foreground">
                            Sign Up
                        </Button>
                    </Link>
                </>}
            </div>
        </motion.nav>
    );
}
