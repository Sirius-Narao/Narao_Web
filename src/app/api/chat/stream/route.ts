import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

export async function POST(req: NextRequest) {
    try {
        const { history, userInput, attachments, isThinking } = await req.json();

        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            return new Response("Missing Gemini API Key", { status: 500 });
        }

        // Use the model the user selected (Gemini 3 Flash Preview)
        const model = genAI.getGenerativeModel({
            model: "gemini-3-flash-preview"
        });

        // 1. Process attachments
        const attachmentParts = attachments.map((att: any) => ({
            inlineData: {
                data: att.data,
                mimeType: att.type.includes("pdf") ? "application/pdf" : att.type
            }
        }));

        // 2. Prepare chat history
        const chatHistory = history.map((msg: any) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({
            history: chatHistory,
        });

        // 3. Request a stream
        const result = await chat.sendMessageStream([
            { text: userInput },
            ...attachmentParts
        ], {
            // @ts-ignore - Preview feature parameter
            thinking_level: isThinking ? "high" : "low"
        });

        // 4. Create a ReadableStream to pipe back to the client
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        controller.enqueue(encoder.encode(chunkText));
                    }
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Transfer-Encoding": "chunked",
            },
        });

    } catch (error: any) {
        console.error("Streaming error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
