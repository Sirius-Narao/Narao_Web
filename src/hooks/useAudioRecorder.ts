import { useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";

export type RecordingState = "idle" | "recording" | "uploading";

interface UseAudioRecorderReturn {
    recordingState: RecordingState;
    audioURL: string | null;
    audioBlob: Blob | null;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    uploadRecording: (userId: string) => Promise<{ publicUrl: string; filePath: string } | null>;
    reset: () => void;
    analyserNode: AnalyserNode | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
    const [recordingState, setRecordingState] = useState<RecordingState>("idle");
    const [audioURL, setAudioURL] = useState<string | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Set up Web Audio API for waveform analysis
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            setAnalyserNode(analyser);

            // Determine supported MIME type
            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/webm")
                ? "audio/webm"
                : "audio/mp4";

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: mimeType });
                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioURL(url);

                // Cleanup audio context
                audioContext.close();
                setAnalyserNode(null);

                // Stop tracks
                stream.getTracks().forEach((t) => t.stop());
            };

            mediaRecorder.start(100); // collect chunks every 100ms for smooth analysis
            setRecordingState("recording");
        } catch (err) {
            console.error("Failed to start recording:", err);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        setRecordingState("idle");
    }, []);

    const uploadRecording = useCallback(
        async (userId: string): Promise<{ publicUrl: string; filePath: string } | null> => {
            if (!audioBlob) return null;
            setRecordingState("uploading");
            try {
                const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
                const filePath = `${userId}/voice-${uuidv4()}.${ext}`;

                const { error } = await supabase.storage
                    .from("chat-attachments")
                    .upload(filePath, audioBlob, { contentType: audioBlob.type });

                if (error) throw new Error(error.message);

                const { data: urlData } = supabase.storage
                    .from("chat-attachments")
                    .getPublicUrl(filePath);

                return { publicUrl: urlData.publicUrl, filePath };
            } catch (err) {
                console.error("Failed to upload audio:", err);
                return null;
            } finally {
                setRecordingState("idle");
            }
        },
        [audioBlob]
    );

    const reset = useCallback(() => {
        if (audioURL) URL.revokeObjectURL(audioURL);
        setAudioURL(null);
        setAudioBlob(null);
        setRecordingState("idle");
        audioChunksRef.current = [];

        // If still recording, stop
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setAnalyserNode(null);
    }, [audioURL]);

    return {
        recordingState,
        audioURL,
        audioBlob,
        startRecording,
        stopRecording,
        uploadRecording,
        reset,
        analyserNode,
    };
}
