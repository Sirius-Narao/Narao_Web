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
        const { userInput, attachments, language } = body;

        const currentParts: any[] = [];
        if (userInput) {
            currentParts.push({ text: userInput });
        }
        if (attachments && attachments.length > 0) {
            attachments.forEach((att: any) => {
                if (att.kind === "text") {
                    currentParts.push({ text: att.text });
                } else if (att.kind === "inline") {
                    currentParts.push({ inlineData: { data: att.data, mimeType: att.type } });
                }
            });
        }

        if (currentParts.length === 0) {
            return new Response(
                JSON.stringify({ error: "No contents provided" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const contents = [{ role: "user", parts: currentParts }];

        const languagePrompt = language === "auto-detect" 
            ? "Detect the language of the user message/content and use it. Make it simple." 
            : `Use the language ${language} if you cannot detect the language of the query.`;

        const systemPrompt = `You are a helpful assistant. Your task is to generate a chat title and description based on the first user message or attachments.
The title should be MAX 3-5 words, as descriptive as possible.
The description should be MAX 10-15 words.
${languagePrompt}`;

        const result = await generateWithRetry({
            model: "gemini-3.1-flash-lite-preview",
            contents: contents,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseJsonSchema: {
                    type: "object",
                    properties: {
                        title: { type: "string", description: "A short, concise title for the chat. Max 3-5 words." },
                        description: { type: "string", description: "A short description of the chat. Max 10-15 words." }
                    },
                    required: ["title", "description"]
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
        console.error("API error for Gemini 3.1 Flash-Lite Metadata:", error);
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
