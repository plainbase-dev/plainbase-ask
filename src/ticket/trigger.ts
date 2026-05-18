import { generateText } from 'ai';
import { getLLMModel } from '../llm/client.js';

export function checkKeywordTrigger(message: string, phrases: string[]): boolean {
  if (phrases.length === 0) return false;
  const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
  return phrases.some(phrase => normalized.includes(phrase.toLowerCase().trim()));
}

async function checkSemanticTrigger(message: string): Promise<boolean> {
  const { text } = await generateText({
    model: getLLMModel(),
    maxTokens: 5,
    prompt: `Does this message express intent to reach a human support agent or escalate beyond automated support? Answer only YES or NO.\n\nMessage: "${message}"`,
  });
  return text.trim().toUpperCase().startsWith('YES');
}

export async function detectTicketIntent(message: string, phrases: string[]): Promise<boolean> {
  if (checkKeywordTrigger(message, phrases)) return true;
  return checkSemanticTrigger(message);
}
