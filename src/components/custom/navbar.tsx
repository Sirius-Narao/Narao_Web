// Navbar component for the application
'use client'
import Image from "next/image";
import { Button } from "../ui/button";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";

export default function Navbar() {
    const { scrollY } = useScroll();
    const [isScrolled, setIsScrolled] = useState(false);

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
                <Button variant="ghost" size="sm" className="rounded-full px-4 font-medium transition-all hover:bg-accent/50 mr-2">Login</Button>
                <Button size="sm" className="rounded-full px-6 font-semibold shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95 bg-primary text-primary-foreground">
                    Sign Up
                </Button>
            </div>
        </motion.nav>
    );
}
