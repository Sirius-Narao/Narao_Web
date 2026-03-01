"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage, ChatAttachment } from "@/types/chatType";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

/**
 * Server action to generate assistant responses using Gemini 3.1 Pro Preview.
 */
export async function generateGeminiResponse(
    history: ChatMessage[],
    userInput: string,
    attachments: { name: string; type: string; data: string }[], // Base64 data from client
    isThinking: boolean
) {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        throw new Error("Missing Gemini API Key");
    }

    // Using Gemini 3.1 Pro Preview as requested for early 2026
    const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview"
    });

    // 1. Convert Base64 attachments into Gemini parts
    const attachmentParts = attachments.map((att) => ({
        inlineData: {
            data: att.data,
            mimeType: att.type.includes("pdf") ? "application/pdf" : att.type
        }
    }));

    // 2. Filter history to roles Gemini understands (user/model)
    // We only take the last 20 messages for context window management, 
    // though Gemini 3.1 Pro supports much more.
    const chatHistory = history.slice(-20).map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
    }));

    // 3. Start Chat session
    const chat = model.startChat({
        history: chatHistory,
    });

    // 4. Combine text and media in the message
    // Note: Gemini 3.1 Pro Preview supports 'thinking_level' parameter
    const result = await chat.sendMessage([
        { text: userInput },
        ...attachmentParts
    ], {
        // @ts-ignore - Preview feature parameter
        thinking_level: isThinking ? "high" : "low"
    });

    const response = await result.response;
    return response.text();
}
