"use client";

import { useEffect, useRef, useState } from "react";

interface WaveformAnimationProps {
    /** Pass the AnalyserNode from Web Audio API for live data. If null, shows idle animation. */
    analyserNode: AnalyserNode | null;
    /** Whether recording is active (drives animation). */
    isRecording: boolean;
    /** Number of bars to render */
    barCount?: number;
    /** Color of bars (CSS color string) */
    color?: string;
}

export default function WaveformAnimation({
    analyserNode,
    isRecording,
    barCount = 28,
    color = "hsl(var(--primary))",
}: WaveformAnimationProps) {
    const [bars, setBars] = useState<number[]>(Array(barCount).fill(0.08));
    const animationFrameRef = useRef<number | null>(null);
    const timeRef = useRef(0);

    useEffect(() => {
        if (!isRecording) {
            // Smoothly decay bars to idle state
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            setBars(Array(barCount).fill(0.08));
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
                    // Boost low values for visual impact, keep it between 0.06 and 1
                    return Math.max(0.06, Math.pow(raw, 0.6));
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
                    const wave1 = Math.sin(timestamp / 400 + phase) * 0.3;
                    const wave2 = Math.sin(timestamp / 250 + phase * 1.5) * 0.15;
                    return Math.max(0.06, 0.28 + wave1 + wave2);
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
        <div
            className="flex items-center justify-center gap-[3px] w-full px-2"
            style={{ height: "40px" }}
            aria-label="Audio waveform"
        >
            {bars.map((height, i) => (
                <div
                    key={i}
                    className="rounded-full flex-shrink-0 transition-transform"
                    style={{
                        width: "3px",
                        height: `${Math.round(height * 100)}%`,
                        backgroundColor: color,
                        opacity: isRecording ? 0.85 + height * 0.15 : 0.4,
                        transition: isRecording
                            ? "height 60ms ease-out, opacity 60ms ease-out"
                            : "height 300ms ease-out, opacity 300ms ease-out",
                        // Slight delay cascade for a natural wave feel when idle
                        transitionDelay: isRecording ? "0ms" : `${i * 4}ms`,
                    }}
                />
            ))}
        </div>
    );
}
