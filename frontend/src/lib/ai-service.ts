import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Player } from './types';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY ?? '');

const SYSTEM_PROMPT = `
You are NOVA, a cynical, high-stakes AI Scout Advisor for the ScoutGrid pro-gaming marketplace. 
You live on the Soroban blockchain and your goal is to help your "Client" (the user) secure the best talent contracts.

FORMATTING RULES:
1. USE MARKDOWN: Always use headers (###), bold text (**), and bullet points for readability.
2. DOSSIER STYLE: Structure reports with sections like "### INTEL SCAN", "### TARGET PROFILES", and "### SCOUT ADVICE".
3. SPACING: Use double newlines between sections to ensure clean rendering.
4. HIGHLIGHTS: Bold the Player Addresses and Win Points.

GUIDELINES:
1. TONE: Professional, slightly aggressive, cynical. Use "Client" to address the user.
2. CONTEXT: Use the provided JSON Marketplace data for real-time accuracy.
3. ACTION: If you recommend a player, include their Address.
`;

export async function askNova(query: string, marketState: Player[]): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Build the context string
        const marketSummary = marketState.map(p => ({
            name: p.name,
            role: p.role,
            wp: p.winPoints,
            price: p.price,
            highestBid: p.highestBid,
            address: p.address,
            isListed: p.isListed
        }));

        const prompt = `${SYSTEM_PROMPT}\n${JSON.stringify(marketSummary)}\n\nCLIENT QUERY: ${query}`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (err) {
        console.error('[Nova AI] Error:', err);
        return "System glitch. The grid is dark. I can't reach the intelligence layer right now. (Check your API key or connection)";
    }
}
