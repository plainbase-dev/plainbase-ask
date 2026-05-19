import { getVecDb } from '../db/vecClient.js';
import { embedText, serializeVector } from './embed.js';

export async function retrieveContext(agentId: string, query: string, topK = 5): Promise<string> {
  const queryVec = await embedText(query);
  const vecBlob = serializeVector(queryVec);
  const vecDb = await getVecDb();

  const rows = vecDb.prepare(`
    SELECT c.content, d.source_url, v.distance
    FROM vec_chunks v
    JOIN chunks c ON c.id = v.chunk_id
    JOIN documents d ON d.id = c.document_id
    WHERE d.agent_id = ?
      AND v.embedding MATCH ?
      AND k = ?
    ORDER BY v.distance
  `).all(agentId, vecBlob, topK) as { content: string; source_url: string | null; distance: number }[];

  if (rows.length === 0) return '';

  return rows
    .map((r, i) => {
      const label = r.source_url
        ? `[Source ${i + 1}] (${r.source_url})`
        : `[Source ${i + 1}] (uploaded document, no URL)`;
      return `${label}\n${r.content}`;
    })
    .join('\n\n---\n\n');
}
