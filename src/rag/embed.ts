import { embed, embedMany } from 'ai';
import { getEmbeddingModel } from '../llm/client.js';

export async function embedText(text: string): Promise<Float32Array> {
  const { embedding } = await embed({ model: getEmbeddingModel(), value: text });
  return new Float32Array(embedding);
}

export async function embedBatch(texts: string[]): Promise<{ embeddings: Float32Array[]; tokens: number }> {
  if (texts.length === 0) return { embeddings: [], tokens: 0 };
  const { embeddings, usage } = await embedMany({ model: getEmbeddingModel(), values: texts });
  return { embeddings: embeddings.map(e => new Float32Array(e)), tokens: usage?.tokens ?? 0 };
}

export function serializeVector(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer);
}

export function deserializeVector(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}
