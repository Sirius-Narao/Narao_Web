"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"
import { useSettings } from "@/context/settingsContext";

/** Syncs settings.theme → next-themes whenever it changes. */
function ThemeSync() {
    const { settings } = useSettings();
    const { setTheme } = useTheme();

    React.useEffect(() => {
        setTheme(settings.theme);
    }, [settings.theme, setTheme]);

    return null;
}

export function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
    return (
        <NextThemesProvider {...props} attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <ThemeSync />
            {children}
        </NextThemesProvider>
    );
}
