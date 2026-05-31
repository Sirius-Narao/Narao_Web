"use client";

import { useEffect, useRef, useState } from "react";

interface PremiumWaveformProps {
    /** Pass the AnalyserNode from Web Audio API for live data. */
    analyserNode: AnalyserNode | null;
    /** Whether recording is active (drives animation). */
    isRecording: boolean;
    /** Number of bars to render */
    barCount?: number;
    /** Color of bars (CSS color string) */
    color?: string;
}

export default function PremiumWaveform({
    analyserNode,
    isRecording,
    barCount = 40,
    color = "hsl(var(--primary))",
}: PremiumWaveformProps) {
    const [bars, setBars] = useState<number[]>(Array(barCount).fill(4));
    const animationFrameRef = useRef<number | null>(null);
    const timeRef = useRef(0);

    useEffect(() => {
        if (!isRecording) {
            // Smoothly decay bars to idle state
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            setBars(Array(barCount).fill(4));
            return;
        }

        if (analyserNode) {
            // Real-time audio data from microphone
            const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

            const animate = () => {
                analyserNode.getByteFrequencyData(dataArray);
                const step = Math.floor(dataArray.length / barCount);
                const newBars = Array.from({ length: barCount }, (_, i) => {
                    const raw = dataArray[i * step] / 255;
                    // Map to height range (4px to 32px)
                    const height = Math.max(4, Math.floor(raw * 28 + 4));
                    return height;
                });
                setBars(newBars);
                animationFrameRef.current = requestAnimationFrame(animate);
            };
            animationFrameRef.current = requestAnimationFrame(animate);
        } else {
            // Idle animation when no analyser (fallback)
            const animate = (timestamp: number) => {
                timeRef.current = timestamp;
                const newBars = Array.from({ length: barCount }, (_, i) => {
                    const phase = (i / barCount) * Math.PI * 2;
                    const wave1 = Math.sin(timestamp / 200 + phase) * 0.5;
                    const wave2 = Math.sin(timestamp / 150 + phase * 1.5) * 0.3;
                    const height = Math.max(4, Math.floor(8 + wave1 * 10 + wave2 * 6));
                    return height;
                });
                setBars(newBars);
                animationFrameRef.current = requestAnimationFrame(animate);
            };
            animationFrameRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [isRecording, analyserNode, barCount]);

    return (
        <div className="flex items-center gap-[2px] h-full">
            {bars.map((height, i) => (
                <div
                    key={i}
                    className="rounded-full transition-all duration-75 ease-out"
                    style={{
                        width: '2px',
                        height: `${height}px`,
                        backgroundColor: color,
                        opacity: isRecording ? 0.8 : 0.2,
                    }}
                />
            ))}
        </div>
    );
}
