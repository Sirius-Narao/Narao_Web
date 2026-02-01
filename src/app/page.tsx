// Page for the landing page of the application
'use client'
import Navbar from "@/components/custom/navbar";
import Image from "next/image";
import heroBg from "@/gradients/gradient_1.jpg";

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground min-h-[2000px] w-full flex flex-col items-center relative">
      <Navbar />
      <div className="w-full">
        <div className="w-full h-screen flex flex-col items-center justify-center relative overflow-hidden">
          <Image
            src={heroBg}
            alt="Hero Background"
            fill
            className="object-cover opacity-30"
          />
          <div className="w-[70%] min-w-[600px] h-screen flex flex-col items-center justify-center relative overflow-hidden">
            <h1 className="text-8xl font-extrabold tracking-tighter mb-4 z-10 text-left">A note-taking app powered by AI</h1>
            <p className="text-xl text-muted-foreground max-w-2xl text-center z-10">
              The next generation of intelligent tools for your workflow.
              Smooth, fast, and powerful.
            </p>
          </div>
          {/* Fade out the background image */}
          <div className="w-full h-124 z-10 bg-gradient-to-b from-transparent to-background absolute bottom-0 left-0"></div>
        </div>

        {/* Placeholder content to enable scrolling */}
        <div className="h-screen w-full flex items-center justify-center bg-muted/30">
          <h2 className="text-4xl font-bold">Scroll to see the magic</h2>
        </div>
      </div>
    </div>
  );
}
