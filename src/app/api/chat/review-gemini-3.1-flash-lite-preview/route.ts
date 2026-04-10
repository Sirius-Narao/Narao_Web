import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! });

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

async function generateWithRetry(params: any, retries = MAX_RETRIES): Promise<any> {
    try {
        // Using generateContent for non-streaming raw content
        return await ai.models.generateContent(params);
    } catch (error: any) {
        if (error.status === 503 && retries > 0) {
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
        const body = await req.json();
        const { systemPrompt, _rawContents, tools, responseMimeType, userInput } = body;

        let contents = _rawContents;

        if (!contents && userInput) {
            contents = [{ role: "user", parts: [{ text: userInput }] }];
        }

        if (!contents) {
            return new Response(
                JSON.stringify({ error: "No contents provided" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const result = await generateWithRetry({
            model: "gemini-3.1-flash-lite-preview",
            contents: contents,
            config: {
                ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
                responseMimeType: "application/json",
                responseJsonSchema: {
                    type: "object",
                    properties: {
                        reviews: {
                            type: "array",
                            description: "A list of review items found in the document.",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string", description: "A short, concise title for the review item. Max 5 words." },
                                    query: { type: "string", description: "What you will ask the user to do, e.g. 'Correct the typo in the first sentence'." },
                                    importance: { type: "integer", description: "Priority level of this item: 1 (high/critical), 2 (medium), or 3 (low)." },
                                    type: { type: "string", enum: ["typo", "suggestion", "question"], description: "The category of the review." },
                                    location: { type: "string", description: "Brief description of where the issue is found, e.g., '/Math/Math Note'." }
                                },
                                required: ["title", "query", "importance", "type", "location"]
                            }
                        }
                    },
                }
            } as any
        });

        // Return the raw text content without streaming
        return new Response(JSON.stringify({ content: result.text }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });

    } catch (error: any) {
        console.error("API error for Gemini 3.1 Flash-Lite Review:", error);
        return new Response(
            JSON.stringify({
                error: "generation_failed",
                message: error.message,
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }
}
