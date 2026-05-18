import { getVecDb } from '../db/vecClient.js';
import { embedBatch, serializeVector } from './embed.js';
import { getConfigValue } from '../db/client.js';

const CHUNK_SIZE = 2000; // characters (~500 tokens)
const CHUNK_OVERLAP = 200; // characters (~50 tokens)
const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? '10', 10);
const ALLOWED_CONTENT_TYPES = ['application/pdf', 'text/markdown', 'text/plain'];
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

export function sanitizeFilename(name: string): string {
  return name
    .replace(/.*[/\\]/, '') // strip path components
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 255);
}

export function validateUpload(filename: string, contentType: string, size: number, buffer: Buffer): void {
  const maxBytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
  if (size > maxBytes) {
    throw new Error(`File too large. Maximum size is ${MAX_UPLOAD_SIZE_MB}MB.`);
  }
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error(`Unsupported file type: ${contentType}. Allowed: PDF, Markdown, plain text.`);
  }
  if (contentType === 'application/pdf') {
    if (buffer.length < 4 || !buffer.slice(0, 4).equals(PDF_MAGIC)) {
      throw new Error('File does not appear to be a valid PDF.');
    }
  }
}

function stripImageReferences(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')   // ![alt](url)
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, '')   // ![alt][ref]
    .replace(/<img\b[^>]*>/gi, '')           // <img ...>
    .replace(/[ \t]+\n/g, '\n')             // trailing whitespace left by removals
    .replace(/\n{3,}/g, '\n\n');            // collapse extra blank lines
}

async function parseFile(contentType: string, buffer: Buffer): Promise<string> {
  if (contentType === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return stripImageReferences(data.text);
  }
  return stripImageReferences(buffer.toString('utf-8'));
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  // Split on paragraph boundaries first
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0);

  let current = '';
  for (const para of paragraphs) {
    if (current.length + para.length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim());
      // Carry over overlap from end of previous chunk
      current = current.slice(-CHUNK_OVERLAP) + '\n\n' + para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  // Split any chunks still over the limit (e.g. a single giant paragraph)
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= CHUNK_SIZE) {
      result.push(chunk);
    } else {
      for (let i = 0; i < chunk.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        result.push(chunk.slice(i, i + CHUNK_SIZE));
      }
    }
  }
  return result;
}

export async function ingestText(
  agentId: string,
  filename: string,
  contentType: string,
  text: string,
  sourceUrl?: string,
): Promise<void> {
  const chunks = chunkText(stripImageReferences(text));

  if (chunks.length === 0) {
    throw new Error('No text content found.');
  }

  const { embeddings, tokens: embeddingTokens } = await embedBatch(chunks);
  const embeddingCostPer1m = parseFloat(getConfigValue('cost_embedding_per_1m', '0'));
  const embeddingCostUsd = embeddingCostPer1m > 0
    ? (embeddingTokens * embeddingCostPer1m) / 1_000_000
    : null;

  const vecDb = await getVecDb();

  vecDb.transaction(() => {
    const docId: string = (vecDb.prepare(
      `INSERT INTO documents (agent_id, filename, content_type, source_url, char_count, embedding_cost_usd)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
    ).get(agentId, filename, contentType, sourceUrl ?? null, text.length, embeddingCostUsd) as { id: string }).id;

    for (let i = 0; i < chunks.length; i++) {
      const chunkRow = vecDb.prepare(
        'INSERT INTO chunks (document_id, content) VALUES (?, ?) RETURNING id'
      ).get(docId, chunks[i]) as { id: string };

      vecDb.prepare('INSERT INTO vec_chunks (chunk_id, embedding) VALUES (?, ?)').run(
        chunkRow.id,
        serializeVector(embeddings[i])
      );
    }
  })();
}

export async function ingestFile(
  agentId: string,
  filename: string,
  contentType: string,
  buffer: Buffer
): Promise<void> {
  const text = await parseFile(contentType, buffer);
  await ingestText(agentId, sanitizeFilename(filename), contentType, text);
}

export async function deleteDocument(documentId: string): Promise<void> {
  const vecDb = await getVecDb();
  const chunkIds = (vecDb.prepare('SELECT id FROM chunks WHERE document_id = ?').all(documentId) as { id: string }[]).map(r => r.id);

  vecDb.transaction(() => {
    for (const id of chunkIds) {
      vecDb.prepare('DELETE FROM vec_chunks WHERE chunk_id = ?').run(id);
    }
    vecDb.prepare('DELETE FROM documents WHERE id = ?').run(documentId);
  })();
}
