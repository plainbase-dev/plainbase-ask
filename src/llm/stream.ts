import { streamText, tool } from 'ai';
import { z } from 'zod';
import { getLLMModel } from './client.js';
import { retrieveContext } from '../rag/retrieve.js';
import { getConfigValue } from '../db/client.js';
import type { CoreMessage } from 'ai';

// Pricing per 1M tokens in USD (approximate, update as needed)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'claude-opus-4-5': { input: 15.00, output: 75.00 },
  'claude-sonnet-4-5': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'mistral-large-latest': { input: 2.00, output: 6.00 },
  'mistral-small-latest': { input: 0.20, output: 0.60 },
  'open-mistral-nemo': { input: 0.15, output: 0.15 },
  'mistral-medium-latest': { input: 0.40, output: 1.20 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number | null {
  const configInput = parseFloat(getConfigValue('cost_input_per_1m', '0'));
  const configOutput = parseFloat(getConfigValue('cost_output_per_1m', '0'));

  if (configInput > 0 || configOutput > 0) {
    return (inputTokens * configInput + outputTokens * configOutput) / 1_000_000;
  }

  const p = MODEL_PRICING[model];
  if (!p) return null;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export interface StreamLogData {
  model: string;
  responseText: string;
  steps: unknown[];
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  costUsd: number | null;
}

export async function streamChatResponse(opts: {
  agentId: string;
  messages: CoreMessage[];
  systemPrompt: string;
  onTicketTrigger: () => void;
  onLog?: (data: StreamLogData) => void;
}): Promise<Response> {
  const maxTokens = parseInt(getConfigValue('max_response_tokens', '1000'), 10);
  const ticketEnabled = getConfigValue('ticket_enabled', '1') !== '0';
  const modelName = process.env.AI_MODEL ?? 'gpt-4o';

  const baseTools = {
    search_knowledge_base: tool({
      description: 'Search the uploaded knowledge base for relevant content to answer a support question.',
      parameters: z.object({
        query: z.string().describe('The search query'),
      }),
      execute: async ({ query }) => {
        const context = await retrieveContext(opts.agentId, query);
        return context || 'No relevant results found in the knowledge base.';
      },
    }),
  };

  const offerTicketTool = tool({
    description: 'Surface a "Create a ticket" button to the user so they can contact a human support agent.',
    parameters: z.object({}),
    execute: async () => {
      opts.onTicketTrigger();
      return 'The ticket button has been shown to the user. Give a brief confirmation and do not call any more tools.';
    },
  });

  const tools = ticketEnabled
    ? { ...baseTools, offer_ticket: offerTicketTool }
    : baseTools;

  const result = streamText({
    model: getLLMModel(),
    system: opts.systemPrompt,
    messages: opts.messages,
    maxTokens,
    maxSteps: 3,
    tools,
    onFinish: ({ text, usage, steps }) => {
      if (!opts.onLog) return;
      const stepSummaries = steps.map(s => ({
        text: s.text,
        toolCalls: s.toolCalls?.map(tc => ({ toolName: tc.toolName, args: tc.args })),
        toolResults: s.toolResults?.map((tr: { toolName: string; result: unknown }) => ({
          toolName: tr.toolName,
          result: tr.result,
        })),
        usage: s.usage,
      }));
      opts.onLog({
        model: modelName,
        responseText: text,
        steps: stepSummaries,
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        thinkingTokens: 0,
        costUsd: estimateCost(modelName, usage.promptTokens, usage.completionTokens),
      });
    },
  });

  return result.toDataStreamResponse();
}
