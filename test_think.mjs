import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY });
async function test() {
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [{ role: 'user', parts: [{ text: 'Solve x^2 - 4 = 0 step by step' }] }],
            config: {
                thinkingConfig: {
                    includeThoughts: true,
                    thinkingBudget: 1024,
                }
            }
        });
        console.log('With Budget:', JSON.stringify(result.candidates?.[0].content.parts, null, 2));
    } catch (e) { console.error('Budget error:', e.message) }

    try {
        const result2 = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-preview',
            contents: [{ role: 'user', parts: [{ text: 'Solve x^2 - 4 = 0 step by step' }] }],
            config: {
                thinkingConfig: {
                    includeThoughts: true,
                    thinkingLevel: 'HIGH',
                }
            }
        });
        console.log('With Level:', JSON.stringify(result2.candidates?.[0].content.parts, null, 2));
    } catch (e) { console.error('Level error:', e.message) }
}
test();
