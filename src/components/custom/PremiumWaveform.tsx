"use client";

import { useEffect, useRef } from "react";

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

/**
 * PremiumWaveform — canvas-based, zero React re-renders at 60fps.
 *
 * Uses Web Audio API AnalyserNode when available for real audio data,
 * falls back to a smooth sine-wave idle animation when not recording.
 * Bars are pill-shaped (fully rounded), centered vertically, with a
 * subtle smoothingTimeConstant from the analyser for organic movement.
 */
export default function PremiumWaveform({
    analyserNode,
    isRecording,
    barCount = 36,
    color,
}: PremiumWaveformProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number | null>(null);
    const prevHeightsRef = useRef<number[]>(Array(barCount).fill(4));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // ── DPR-aware resize ─────────────────────────────────────────────
        const dpr = window.devicePixelRatio || 1;

        const resize = () => {
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(canvas);

        // ── Resolve bar color from CSS variable if needed ────────────────
        const resolveColor = (): string => {
            if (color) return color;
            // Read --primary from CSS (works with both light/dark themes)
            const raw = getComputedStyle(document.documentElement)
                .getPropertyValue("--primary")
                .trim();
            // Tailwind v3 exposes hsl channels without the hsl() wrapper
            return raw ? `hsl(${raw})` : "#6366f1";
        };

        // ── Bar state (lerp targets for smoothing) ───────────────────────
        const targets = prevHeightsRef.current;
        const current = [...targets];

        // Frequency data buffer — only allocated if analyserNode exists
        // Must be Uint8Array<ArrayBuffer> (not the wider ArrayBufferLike) for
        // getByteFrequencyData(), which is how TS 5.7+ types the Web Audio API.
        let dataArray: Uint8Array<ArrayBuffer> | null = analyserNode
            ? new Uint8Array(analyserNode.frequencyBinCount)
            : null;

        // ── Draw loop ─────────────────────────────────────────────────────
        const draw = (timestamp: number) => {
            rafRef.current = requestAnimationFrame(draw);

            const W = canvas.clientWidth;
            const H = canvas.clientHeight;
            ctx.clearRect(0, 0, W, H);

            const resolvedColor = resolveColor();
            const centerY = H / 2;
            const barW = Math.max(2, Math.min(4, (W / barCount) * 0.55));
            const gap = (W - barW * barCount) / (barCount + 1);

            // ── Update target heights ─────────────────────────────────────
            if (isRecording && analyserNode && dataArray) {
                analyserNode.getByteFrequencyData(dataArray);
                const binPerBar = Math.floor(dataArray.length / barCount);
                for (let i = 0; i < barCount; i++) {
                    const raw = dataArray[i * binPerBar] / 255;
                    // Boost with power curve for visual impact
                    targets[i] = Math.max(3, Math.pow(raw, 0.55) * (H * 0.82));
                }
            } else if (isRecording) {
                // Fallback: sine-wave idle animation while mic permission loading
                for (let i = 0; i < barCount; i++) {
                    const phase = (i / barCount) * Math.PI * 2;
                    const v =
                        Math.sin(timestamp / 200 + phase) * 0.4 +
                        Math.sin(timestamp / 130 + phase * 1.7) * 0.25;
                    targets[i] = Math.max(4, (0.35 + v) * H * 0.7);
                }
            } else {
                // Idle / stopped — decay all bars to minimum
                for (let i = 0; i < barCount; i++) {
                    targets[i] = 3;
                }
            }

            // ── Lerp current → target for organic smoothing ───────────────
            const lerpSpeed = isRecording ? 0.22 : 0.12;
            for (let i = 0; i < barCount; i++) {
                current[i] += (targets[i] - current[i]) * lerpSpeed;
            }

            // ── Render bars ───────────────────────────────────────────────
            for (let i = 0; i < barCount; i++) {
                const h = Math.max(2, current[i]);
                const x = gap + i * (barW + gap);
                const y = centerY - h / 2;
                const radius = barW / 2; // fully rounded pills

                const alpha = isRecording ? 0.75 + (h / (H * 0.82)) * 0.25 : 0.18;
                ctx.globalAlpha = Math.min(1, alpha);
                ctx.fillStyle = resolvedColor;

                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.arcTo(x + barW, y, x + barW, y + h, radius);
                ctx.arcTo(x + barW, y + h, x, y + h, radius);
                ctx.arcTo(x, y + h, x, y, radius);
                ctx.arcTo(x, y, x + barW, y, radius);
                ctx.closePath();
                ctx.fill();
            }

            ctx.globalAlpha = 1;
        };

        rafRef.current = requestAnimationFrame(draw);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            ro.disconnect();
        };
    }, [isRecording, analyserNode, barCount, color]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full"
            aria-label="Audio waveform"
            aria-hidden="true"
        />
    );
}
