import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

if (process.env.API_KEY) {
  aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const getAICommentary = async (
  event: 'start' | 'kill_streak' | 'low_health' | 'game_over' | 'level_up',
  context: { score: number; wave: number; enemiesKilled?: number }
): Promise<string> => {
  if (!aiClient) return "Simulated AI: System Ready.";

  // Determine model based on task simplicity/speed requirements
  const modelId = 'gemini-2.5-flash';

  let prompt = `You are a hype-man cybernetic arena announcer for a futuristic gladiator game called "Neon Nexus". 
  Keep it short (max 15 words). Be witty, slightly edgy, and exciting.
  Current Game State: Score: ${context.score}, Wave: ${context.wave}.
  Event Trigger: ${event}.
  `;

  if (event === 'start') {
    prompt += "Player just started. Hype them up.";
  } else if (event === 'kill_streak') {
    prompt += "Player just killed many enemies quickly. Praise their skill!";
  } else if (event === 'low_health') {
    prompt += "Player is about to die. Warn them or mock them lightly.";
  } else if (event === 'game_over') {
    prompt += `Player died. Final Score: ${context.score}. Roast them or offer condolences based on if score is high (>1000 is high).`;
  } else if (event === 'level_up') {
    prompt += "Player leveled up. Encourage them.";
  }

  try {
    const response = await aiClient.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        maxOutputTokens: 40,
        temperature: 1.2, // High creativity
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("AI Error", error);
    return "";
  }
};