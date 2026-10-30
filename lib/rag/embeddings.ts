import "server-only";
import { GoogleGenAI } from "@google/genai";
import { serverConfig } from "@/lib/server-config";

let client: GoogleGenAI | null = null;

/** Shared Gemini client (server only). */
export function getGemini(): GoogleGenAI {
  if (!serverConfig.geminiApiKey) {
    throw new AiConfigError("GEMINI_API_KEY is not set on the server.");
  }
  client ??= new GoogleGenAI({ apiKey: serverConfig.geminiApiKey });
  return client;
}

/** Thrown when the AI provider is not configured or keeps failing. */
export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

function isTransient(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (typeof status === "number") return status === 429 || status >= 500;
  const message = error instanceof Error ? error.message : "";
  return /fetch failed|ECONNRESET|ETIMEDOUT|network|timeout/i.test(message);
}

/** Retry temporary failures (rate limits, 5xx, network) with exponential backoff. */
export async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isTransient(error)) throw error;
      const delay = 500 * 2 ** attempt + Math.random() * 250;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}

/** Make a vector length 1. Needed because truncated (768-d) embeddings are not pre-normalised. */
export function normalizeVector(values: number[]): number[] {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? values : values.map((v) => v / norm);
}

/** pgvector accepts vectors written like "[0.1,0.2,...]". */
export function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

const BATCH_SIZE = 50;

/**
 * Create embeddings for a list of texts.
 * Use "RETRIEVAL_DOCUMENT" for document chunks and "RETRIEVAL_QUERY" for user questions.
 */
export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  signal?: AbortSignal,
): Promise<number[][]> {
  const ai = getGemini();
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await withRetry(() =>
      ai.models.embedContent({
        model: serverConfig.embeddingModel,
        contents: batch,
        config: { taskType, outputDimensionality: serverConfig.embeddingDimensions, abortSignal: signal },
      }),
    );
    const embeddings = response.embeddings ?? [];
    if (embeddings.length !== batch.length) {
      throw new Error("The embedding service returned an unexpected number of vectors.");
    }
    for (const e of embeddings) {
      const values = e.values ?? [];
      if (values.length !== serverConfig.embeddingDimensions) {
        throw new Error(`Unexpected embedding size ${values.length} (expected ${serverConfig.embeddingDimensions}).`);
      }
      out.push(normalizeVector(values));
    }
  }
  return out;
}
