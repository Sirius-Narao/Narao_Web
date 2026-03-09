import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! });

export async function POST(req: NextRequest) {
    try {
        const { history, userInput, attachments, isThinking, systemPrompt, tools, _rawContents } = await req.json();

        // If raw Gemini contents are provided (multi-turn tool calling), use them directly
        if (_rawContents) {
            const result = await ai.models.generateContentStream({
                model: "gemini-2.5-flash",
                contents: _rawContents,
                config: {
                    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
                    ...(isThinking ? { thinkingConfig: { includeThoughts: true, thinkingBudget: -1 } } : {}),
                    tools: tools ? [{ functionDeclarations: tools }] : undefined,
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
                                    if ((part as any).thought) {
                                        controller.enqueue(encoder.encode(JSON.stringify({ type: "thought", content: part.text }) + "\n"));
                                    } else if (part.text) {
                                        controller.enqueue(encoder.encode(JSON.stringify({ type: "answer", content: part.text }) + "\n"));
                                    } else if (part.functionCall) {
                                        controller.enqueue(encoder.encode(JSON.stringify({ type: "functionCall", content: { ...part.functionCall, thoughtSignature: (part as any).thoughtSignature ?? null } }) + "\n"));
                                    }
                                }
                            }
                        }
                    } catch (e) { controller.error(e); } finally { controller.close(); }
                }
            });
            return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
        }

        // Helper: fetch a file from a public URL and return base64
        const urlToBase64 = async (url: string): Promise<string> => {
            const res = await fetch(url);
            const buffer = await res.arrayBuffer();
            return Buffer.from(buffer).toString("base64");
        };

        // Build history, re-fetching past attachments from their stored Supabase URLs
        const contents = await Promise.all(
            history.map(async (msg: any) => {
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


        const result = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents,
            config: {
                ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
                ...(isThinking ? {
                    thinkingConfig: {
                        includeThoughts: true,
                        thinkingBudget: -1
                    }
                } : {}),
                tools: tools ? [{ functionDeclarations: tools }] : undefined,
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
                                    const data = JSON.stringify({
                                        type: "functionCall",
                                        content: {
                                            ...part.functionCall,
                                            thoughtSignature: (part as any).thoughtSignature ?? null
                                        }
                                    });
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
        console.error("API error for Gemini 2.5 Flash:", error);
        return new Response(JSON.stringify({
            error: "Failed to generate content",
            message: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
