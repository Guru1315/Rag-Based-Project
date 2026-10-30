import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedTexts, toPgVector } from "./embeddings";
import { serverConfig } from "@/lib/server-config";
import type { Source } from "@/types";

interface RetrieveArgs {
  supabase: SupabaseClient;
  question: string;
  knowledgeBaseId?: string | null;
  documentIds?: string[];
  signal?: AbortSignal;
}

/**
 * Embed the question and fetch the closest chunks from the user's own data.
 * The ownership, knowledge-base and document filters run INSIDE the database
 * function `match_chunks` (see the SQL migration), not in this code.
 */
export async function retrieveSources(args: RetrieveArgs): Promise<Source[]> {
  const { supabase, question, knowledgeBaseId, documentIds, signal } = args;

  const [embedding] = await embedTexts([question], "RETRIEVAL_QUERY", signal);

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: toPgVector(embedding),
    match_count: serverConfig.ragTopK,
    min_similarity: serverConfig.ragMinSimilarity,
    kb_id: knowledgeBaseId ?? null,
    doc_ids: documentIds && documentIds.length > 0 ? documentIds : null,
  });
  if (error) throw new Error(`Vector search failed: ${error.message}`);

  type Row = {
    id: string;
    document_id: string;
    document_title: string;
    relative_path: string;
    chunk_index: number;
    page_number: number | null;
    section: string | null;
    content: string;
    similarity: number;
  };

  return ((data ?? []) as Row[]).map((row, i) => ({
    n: i + 1,
    chunkId: row.id,
    documentId: row.document_id,
    documentTitle: row.document_title,
    path: row.relative_path,
    page: row.page_number,
    section: row.section,
    excerpt: row.content,
    similarity: Math.round(row.similarity * 1000) / 1000,
  }));
}
