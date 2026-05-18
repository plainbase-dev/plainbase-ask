import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

const VEC_DB_PATH = process.env.VEC_DATABASE_PATH ?? './data/vec.sqlite';

let _vecDb: Database.Database | null = null;

export async function getVecDb(): Promise<Database.Database> {
  if (_vecDb) return _vecDb;

  const provider = process.env.AI_PROVIDER ?? 'openai';
  const model = process.env.EMBEDDING_MODEL ?? defaultEmbeddingModel(provider);

  const db = new Database(VEC_DB_PATH);
  sqliteVec.load(db);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`CREATE TABLE IF NOT EXISTS vec_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);

  const storedModel = (db.prepare('SELECT value FROM vec_config WHERE key = ?').get('embedding_model') as { value: string } | undefined)?.value;

  if (storedModel) {
    if (storedModel !== model) {
      db.close();
      throw new Error(
        `Embedding model changed from "${storedModel}" to "${model}". ` +
        `Delete ${VEC_DB_PATH} and re-ingest all documents to use the new model.`
      );
    }
    // Idempotent schema evolution for existing databases
    for (const stmt of [
      'ALTER TABLE documents ADD COLUMN source_url TEXT',
      'ALTER TABLE documents ADD COLUMN last_crawled_at INTEGER',
      'ALTER TABLE documents ADD COLUMN char_count INTEGER',
      'ALTER TABLE documents ADD COLUMN embedding_cost_usd REAL',
    ]) {
      try { db.exec(stmt); } catch { /* column already exists */ }
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_source_url
             ON documents(agent_id, source_url) WHERE source_url IS NOT NULL`);
    _vecDb = db;
    return _vecDb;
  }

  // First-ever init: make one API call to detect the embedding dimensions.
  const { embed } = await import('ai');
  const { getEmbeddingModel } = await import('../llm/client.js');
  const { embedding } = await embed({ model: getEmbeddingModel(), value: 'test' });
  const dims = embedding.length;

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      agent_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL DEFAULT (unixepoch()),
      source_url TEXT,
      last_crawled_at INTEGER,
      char_count INTEGER,
      embedding_cost_usd REAL
    );
    CREATE INDEX IF NOT EXISTS idx_documents_source_url
      ON documents(agent_id, source_url) WHERE source_url IS NOT NULL;
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      content TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
      chunk_id TEXT partition key,
      embedding float[${dims}]
    );
  `);

  db.prepare('INSERT INTO vec_config (key, value) VALUES (?, ?)').run('embedding_model', model);
  db.prepare('INSERT INTO vec_config (key, value) VALUES (?, ?)').run('embedding_dims', String(dims));
  console.log(`[vec] initialized with model "${model}", ${dims} dimensions`);

  _vecDb = db;
  return _vecDb;
}

function defaultEmbeddingModel(provider: string): string {
  if (provider === 'mistral') return 'mistral-embed';
  return 'text-embedding-3-small';
}
