import type { Metadata } from "next";
import { Alan_Sans, Fira_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const alanSans = Alan_Sans({
  variable: "--font-alan-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const firaMono = Fira_Mono({
  variable: "--font-fira-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Narao",
  description: "Narao, the AI note-taking application that truly works along with you.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Narao",
    description: "Narao, the AI note-taking application that truly works along with you.",
    images: [
      {
        url: "/favicon.ico",
        width: 1200,
        height: 630,
        alt: "Narao",
      },
    ],
  },
  // -----> We'll see that later
  // twitter: {
  //   card: "summary_large_image",
  //   title: "Narao",
  //   description: "Narao, the AI note-taking application that truly works along with you.",
  //   images: ["/favicon.ico"],
  // },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${alanSans.variable} ${firaMono.variable} antialiased `}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
