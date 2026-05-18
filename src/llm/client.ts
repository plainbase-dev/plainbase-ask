import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createMistral } from "@ai-sdk/mistral";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel, EmbeddingModel } from "ai";

function getProvider(): string {
	return process.env.AI_PROVIDER ?? "openai";
}

export function getLLMModel(): LanguageModel {
	const provider = getProvider();
	const apiKey = process.env.AI_API_KEY;
	const model = process.env.AI_MODEL ?? "gpt-4o";

	if (provider === "anthropic") {
		return createAnthropic({ apiKey })(model);
	}
	if (provider === "mistral") {
		return createMistral({ apiKey })(model);
	}
	if (provider === "google") {
		return createGoogleGenerativeAI({ apiKey })(model);
	}
	return createOpenAI({ apiKey })(model);
}

export function getEmbeddingModel(): EmbeddingModel<string> {
	const provider = process.env.EMBEDDING_PROVIDER ?? getProvider();
	const apiKey = process.env.EMBEDDING_API_KEY ?? process.env.AI_API_KEY;
	const model = process.env.EMBEDDING_MODEL ?? defaultEmbeddingModel(provider);

	if (provider === "mistral") {
		return createMistral({ apiKey }).textEmbeddingModel(model);
	}
	if (provider === "google") {
		return createGoogleGenerativeAI({ apiKey }).textEmbeddingModel(model);
	}
	if (provider === "openai") {
		return createOpenAI({ apiKey }).textEmbeddingModel(model);
	}
	throw new Error(
		`Provider "${provider}" has no embedding support. Set EMBEDDING_PROVIDER to "openai", "mistral", or "google" and provide EMBEDDING_API_KEY.`
	);
}

function defaultEmbeddingModel(provider: string): string {
	if (provider === "mistral") return "mistral-embed";
	if (provider === "google") return "text-embedding-004";
	return "text-embedding-3-small";
}
