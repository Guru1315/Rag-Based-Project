import "server-only";

// Server-only settings. Never import this file from a client component.

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const serverConfig = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  chatModel: process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash",
  embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
  /** Must match vector(768) in the SQL migration. */
  embeddingDimensions: 768,
  maxDocumentsPerUser: num(process.env.MAX_DOCUMENTS_PER_USER, 200),
  chatLimitPerMinute: num(process.env.CHAT_LIMIT_PER_MINUTE, 10),
  ragTopK: num(process.env.RAG_TOP_K, 8),
  ragMinSimilarity: (() => {
    const n = Number(process.env.RAG_MIN_SIMILARITY);
    return Number.isFinite(n) && n >= 0 && n < 1 ? n : 0.5;
  })(),
  /** Versioned chunking settings; bump `version` after changing them, then re-index. */
  chunk: { version: "v1", maxChars: 1800, overlapChars: 250 },
  /** Safety cap on extracted text per document (protects memory and API usage). */
  maxExtractedChars: 2_000_000,
  /** A job stuck in a working state for longer than this can be picked up again. */
  staleJobMs: 5 * 60 * 1000,
} as const;
