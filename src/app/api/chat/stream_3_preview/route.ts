import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! });

export async function POST(req: NextRequest) {
    try {
        const { history, userInput, attachments, isThinking } = await req.json();

        // Prepare contents for Gemini
        const contents = history.map((msg: any) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }]
        }));

        const currentParts: any[] = [{ text: userInput }];
        if (attachments && attachments.length > 0) {
            attachments.forEach((att: any) => {
                currentParts.push({
                    inlineData: {
                        data: att.data,
                        mimeType: att.type
                    }
                });
            });
        }

        contents.push({
            role: "user",
            parts: currentParts
        });

        const result = await ai.models.generateContentStream({
            model: "gemini-3-flash-preview",
            contents,
            config: {
                // @ts-ignore
                thinkingConfig: {
                    includeThoughts: isThinking,
                }
            }
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

    } catch (error) {
        console.error("API error:", error);
        return new Response(JSON.stringify({ error: "Failed to generate content" }), { status: 500 });
    }
}
