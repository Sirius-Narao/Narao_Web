"use client";

import { useEffect, useRef } from "react";

interface PremiumWaveformProps {
    /** Pass the AnalyserNode from Web Audio API for live data. */
    analyserNode: AnalyserNode | null;

    /** Whether recording is active (drives animation). */
    isRecording: boolean;

    /** Optional explicit CSS color. If omitted, reads --primary from the document. */
    color?: string;

    /** Deprecated: no longer used, as barCount is dynamically calculated to fill width */
    barCount?: number;
}

/**
 * PremiumWaveform
 *
 * Renders a real-time audio waveform visualiser using an HTML canvas.
 * No React state mutations at 60 fps — all animation is pure canvas drawing.
 *
 * Visual style: a horizontal dotted baseline with vertical pill-bars whose
 * height is modulated by live frequency data from the Web Audio AnalyserNode.
 * It dynamically calculates how many bars fit in the container so it always
 * takes the whole remaining space on its right.
 */
export default function PremiumWaveform({
    analyserNode,
    isRecording,
    color,
}: PremiumWaveformProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rafRef = useRef<number | null>(null);
    const smoothRef = useRef<number[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // ── Resolve the bar colour ────────────────────────────────────────
        const resolveColor = (): string => {
            if (color) return color;

            const val = getComputedStyle(document.documentElement)
                .getPropertyValue("--primary")
                .trim();

            if (!val) return "#818cf8";

            // If it's already a full function (oklch/hsl/rgb) use as-is
            if (/^(oklch|hsl|rgb|hwb|lch|lab)\s*\(/.test(val)) return val;

            // Tailwind-style raw channels → wrap properly
            return `hsl(${val})`;
        };

        // ── DPR-aware resize ──────────────────────────────────────────────
        let W = 0,
            H = 0;
        const dpr = window.devicePixelRatio || 1;

        const resize = () => {
            W = canvas.clientWidth;
            H = canvas.clientHeight;

            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);

            ctx.scale(dpr, dpr);
        };

        resize();

        const ro = new ResizeObserver(() => {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            resize();
        });

        ro.observe(canvas);

        // ── Frequency data buffer ─────────────────────────────────────────
        let dataArray = analyserNode
            ? new Uint8Array(new ArrayBuffer(analyserNode.frequencyBinCount))
            : null;

        const smooth = smoothRef.current;

        // ── Draw loop ─────────────────────────────────────────────────────
        const draw = (ts: number) => {
            rafRef.current = requestAnimationFrame(draw);

            if (!W || !H) return;

            const idealBarW = 3;
            const idealGap = 3;

            const maxBarsForWidth = Math.floor(W / (idealBarW + idealGap));
            const maxAvailableBins = dataArray ? dataArray.length : 128;

            const actualBarCount = Math.max(
                10,
                Math.min(maxBarsForWidth, maxAvailableBins)
            );

            const barW = idealBarW;
            const gap = (W - barW * actualBarCount) / (actualBarCount + 1);

            while (smooth.length < actualBarCount) smooth.push(0);

            // ── Compute raw bar heights (0–1) ─────────────────────────────
            const raw = new Array<number>(actualBarCount);

            if (isRecording && analyserNode && dataArray) {
                analyserNode.getByteFrequencyData(dataArray);

                const sampleRate = analyserNode.context.sampleRate;
                const fftSize = analyserNode.fftSize;

                const minFreq = 20;
                const maxFreq = 7500;

                const minBin = Math.floor((minFreq * fftSize) / sampleRate);
                const maxBin = Math.floor((maxFreq * fftSize) / sampleRate);

                for (let i = 0; i < actualBarCount; i++) {
                    const t0 = i / actualBarCount;
                    const t1 = (i + 1) / actualBarCount;

                    const freq0 = minFreq * Math.pow(maxFreq / minFreq, t0);
                    const freq1 = minFreq * Math.pow(maxFreq / minFreq, t1);

                    const startBin = Math.max(
                        minBin,
                        Math.floor((freq0 * fftSize) / sampleRate)
                    );

                    const endBin = Math.min(
                        maxBin,
                        Math.floor((freq1 * fftSize) / sampleRate)
                    );

                    let sum = 0;
                    let count = 0;

                    for (
                        let j = startBin;
                        j <= endBin && j < dataArray.length;
                        j++
                    ) {
                        sum += dataArray[j];
                        count++;
                    }

                    const value =
                        count > 0 ? (sum / count * 0.5) / 255 : 0;

                    raw[i] = Math.pow(value, 0.35);
                }
            } else if (isRecording) {
                // fallback animation
                for (let i = 0; i < actualBarCount; i++) {
                    const p = (i / actualBarCount) * Math.PI * 2;
                    raw[i] =
                        0.25 +
                        Math.sin(ts / 200 + p) * 0.2 +
                        Math.sin(ts / 130 + p * 1.7) * 0.12;
                }
            } else {
                raw.fill(0);
            }

            // ── Smooth interpolation ───────────────────────────────────────
            const lerpK = isRecording ? 0.3 : 0.08;

            for (let i = 0; i < actualBarCount; i++) {
                smooth[i] += (raw[i] - smooth[i]) * lerpK;
            }

            // ── Layout ─────────────────────────────────────────────────────
            const maxBarH = H * 0.85;
            const minBarH = barW;
            const baselineY = H / 2;
            const dotR = barW / 2;

            const col = resolveColor();

            ctx.clearRect(0, 0, W, H);

            // ── Dotted baseline ────────────────────────────────────────────
            ctx.globalAlpha = isRecording ? 0.2 : 0.12;
            ctx.fillStyle = col;

            for (let i = 0; i < actualBarCount; i++) {
                const cx = gap + i * (barW + gap) + barW / 2;

                ctx.beginPath();
                ctx.arc(cx, baselineY, dotR, 0, Math.PI * 2);
                ctx.fill();
            }

            // ── Bars ───────────────────────────────────────────────────────
            for (let i = 0; i < actualBarCount; i++) {
                const v = smooth[i];
                const bh = Math.max(minBarH, v * maxBarH);

                const x = gap + i * (barW + gap);
                const y = baselineY - bh / 2;
                const r = barW / 2;

                const alpha = isRecording ? 0.45 + v * 0.55 : 0.15;

                ctx.globalAlpha = Math.min(1, alpha);
                ctx.fillStyle = col;

                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.arcTo(x + barW, y, x + barW, y + bh, r);
                ctx.arcTo(x + barW, y + bh, x, y + bh, r);
                ctx.arcTo(x, y + bh, x, y, r);
                ctx.arcTo(x, y, x + barW, y, r);
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
    }, [isRecording, analyserNode, color]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-full block"
            aria-label="Audio waveform visualiser"
            aria-hidden="true"
        />
    );
}