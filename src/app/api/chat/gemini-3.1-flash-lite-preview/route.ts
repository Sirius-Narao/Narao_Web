import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! });

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

function is503(error: any): boolean {
    return (
        error?.status === 503 ||
        error?.code === 503 ||
        error?.message?.includes("503") ||
        error?.message?.includes("UNAVAILABLE") ||
        error?.message?.includes("high demand")
    );
}

async function generateWithRetry(params: any, retries = MAX_RETRIES): Promise<any> {
    try {
        return await ai.models.generateContentStream(params);
    } catch (error: any) {
        if (is503(error) && retries > 0) {
            const delay = RETRY_DELAY_MS * (MAX_RETRIES - retries + 1);
            console.warn(`Gemini 3.1 Flash-Lite 503, retrying in ${delay}ms... (${retries} left)`);
            await new Promise(res => setTimeout(res, delay));
            return generateWithRetry(params, retries - 1);
        }
        throw error;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { history, userInput, attachments, isThinking, systemPrompt, tools } = await req.json();

        // Helper: fetch a file from a public URL and return base64
        const urlToBase64 = async (url: string): Promise<string> => {
            const res = await fetch(url);
            const buffer = await res.arrayBuffer();
            return Buffer.from(buffer).toString("base64");
        };

        // Build history, re-fetching past attachments from their stored Supabase URLs
        const contents = await Promise.all(
            history.slice(0, -1).map(async (msg: any) => {
                const parts: any[] = [{ text: msg.content }];
                if (msg.role === "user" && msg.attachments?.length > 0) {
                    await Promise.all(msg.attachments.map(async (att: any) => {
                        try {
                            const data = await urlToBase64(att.file_url);
                            parts.push({ inlineData: { data, mimeType: att.mime_type } });
                        } catch (e) {
                            console.warn(`Could not re-fetch attachment ${att.file_name}:`, e);
                        }
                    }));
                }
                return { role: msg.role === "user" ? "user" : "model", parts };
            })
        );

        const currentParts: any[] = [{ text: userInput }];
        if (attachments && attachments.length > 0) {
            attachments.forEach((att: any) => {
                currentParts.push({ inlineData: { data: att.data, mimeType: att.type } });
            });
        }

        contents.push({
            role: "user",
            parts: currentParts
        });


        const result = await generateWithRetry({
            model: "gemini-3.1-flash-lite-preview",
            contents,
            tools: tools ? [{ functionDeclarations: tools }] : undefined,
            config: {
                ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
                ...(isThinking ? {
                    thinkingConfig: {
                        includeThoughts: true,
                        thinkingLevel: "HIGH"
                    }
                } : {})
            } as any
        });

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of result) {
                        const candidate = chunk.candidates?.[0];
                        if (candidate?.content?.parts) {
                            for (const part of candidate.content.parts) {
                                // @ts-ignore - The new SDK might use 'thought' property for thinking models
                                if (part.thought) {
                                    const data = JSON.stringify({ type: "thought", content: part.text });
                                    controller.enqueue(encoder.encode(data + "\n"));
                                } else if (part.text) {
                                    const data = JSON.stringify({ type: "answer", content: part.text });
                                    controller.enqueue(encoder.encode(data + "\n"));
                                } else if (part.functionCall) {
                                    const data = JSON.stringify({ type: "functionCall", content: part.functionCall });
                                    controller.enqueue(encoder.encode(data + "\n"));
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error("Stream error:", error);
                    controller.error(error);
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });

    } catch (error: any) {
        console.error("API error for Gemini 3.1 Flash-Lite:", error);
        const overloaded = is503(error);
        return new Response(JSON.stringify({
            error: overloaded ? "model_overloaded" : "generation_failed",
            message: overloaded
                ? "Gemini 3.1 Flash-Lite is experiencing high demand. Please try again in a moment."
                : error.message,
        }), {
            status: overloaded ? 503 : 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
