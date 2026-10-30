import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_BUCKET, MAX_UPLOAD_BYTES } from "@/lib/config";
import { serverConfig } from "@/lib/server-config";
import { parseDocument, ParseError } from "@/lib/parsing";
import { chunkSegments } from "@/lib/rag/chunker";
import { AiConfigError, embedTexts, toPgVector } from "@/lib/rag/embeddings";
import { logError } from "@/lib/api";

export type ProcessResult =
  | { ok: true; chunkCount: number }
  | { ok: false; status: number; code: string; message: string };

const INSERT_BATCH = 100;

/**
 * The real indexing pipeline for one document:
 *   claim -> download -> extract -> chunk -> embed -> store -> mark ready
 * The status column is updated at every stage, so the UI shows genuine progress.
 * A document becomes "ready" ONLY after every chunk and embedding was saved.
 */
export async function processDocument(
  supabase: SupabaseClient,
  documentId: string,
  options: { reindex?: boolean } = {},
): Promise<ProcessResult> {
  // ----- 1. Claim the job atomically so two requests can't process the same file.
  const allowed = options.reindex
    ? ["uploading", "queued", "failed", "ready"]
    : ["uploading", "queued", "failed"];
  const staleBefore = new Date(Date.now() - serverConfig.staleJobMs).toISOString();

  const { data: doc, error: claimError } = await supabase
    .from("documents")
    .update({
      status: "extracting",
      error_code: null,
      error_message: null,
      processing_started_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .or(
      `status.in.(${allowed.join(",")}),and(status.in.(extracting,chunking,indexing),updated_at.lt.${staleBefore})`,
    )
    .select("id, user_id, knowledge_base_id, file_ext, storage_path, size_bytes")
    .maybeSingle();

  if (claimError) {
    logError("process.claim", claimError);
    return { ok: false, status: 500, code: "DB_ERROR", message: "Could not start processing." };
  }
  if (!doc) {
    // Either it does not exist / is not yours (RLS), or it is already being processed / ready.
    const { data: existing } = await supabase.from("documents").select("status").eq("id", documentId).maybeSingle();
    if (!existing) return { ok: false, status: 404, code: "NOT_FOUND", message: "Document not found." };
    return {
      ok: false,
      status: 409,
      code: "ALREADY_PROCESSING",
      message: existing.status === "ready" ? "This document is already indexed." : "This document is already being processed.",
    };
  }

  const setStatus = async (status: "chunking" | "indexing") => {
    const { error } = await supabase.from("documents").update({ status }).eq("id", documentId);
    if (error) throw new Error(`Could not update status: ${error.message}`);
  };

  const fail = async (code: string, message: string): Promise<ProcessResult> => {
    // Remove any partial chunks, then record the failure.
    await supabase.from("document_chunks").delete().eq("document_id", documentId);
    await supabase
      .from("documents")
      .update({ status: "failed", error_code: code, error_message: message, chunk_count: 0, indexed_at: null })
      .eq("id", documentId);
    return { ok: false, status: 422, code, message };
  };

  try {
    // ----- 2. Download the original file from private storage.
    const { data: blob, error: downloadError } = await supabase.storage.from(STORAGE_BUCKET).download(doc.storage_path);
    if (downloadError || !blob) {
      return await fail("FILE_MISSING", "The uploaded file was not found. Please upload it again.");
    }
    const buffer = Buffer.from(await blob.arrayBuffer());
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return await fail("TOO_LARGE", "The file is larger than the allowed upload size.");
    }

    // ----- 3. Extract text (status: extracting).
    const parsed = await parseDocument(doc.file_ext, buffer);
    const totalChars = parsed.segments.reduce((sum, s) => sum + s.text.length, 0);
    if (totalChars > serverConfig.maxExtractedChars) {
      return await fail("TOO_LARGE_TEXT", "The document contains too much text to index.");
    }

    // ----- 4. Split into chunks (status: chunking).
    await setStatus("chunking");
    const chunks = chunkSegments(parsed.segments, serverConfig.chunk);
    if (chunks.length === 0) return await fail("EMPTY", "No readable text was found in this document.");

    // ----- 5. Embed + store (status: indexing).
    await setStatus("indexing");
    const embeddings = await embedTexts(
      chunks.map((c) => c.content),
      "RETRIEVAL_DOCUMENT",
    );

    // Re-indexing / retry: remove old chunks first so we never keep duplicates.
    const { error: clearError } = await supabase.from("document_chunks").delete().eq("document_id", documentId);
    if (clearError) throw new Error(`Could not clear old chunks: ${clearError.message}`);

    for (let i = 0; i < chunks.length; i += INSERT_BATCH) {
      const rows = chunks.slice(i, i + INSERT_BATCH).map((chunk, j) => ({
        user_id: doc.user_id,
        knowledge_base_id: doc.knowledge_base_id,
        document_id: documentId,
        chunk_index: chunk.index,
        content: chunk.content,
        page_number: chunk.page ?? null,
        section: chunk.section ?? null,
        char_count: chunk.content.length,
        embedding: toPgVector(embeddings[i + j]),
      }));
      const { error: insertError } = await supabase.from("document_chunks").insert(rows);
      if (insertError) throw new Error(`Could not save chunks: ${insertError.message}`);
    }

    // ----- 6. Only now mark the document as ready.
    const { error: readyError } = await supabase
      .from("documents")
      .update({
        status: "ready",
        error_code: null,
        error_message: null,
        page_count: parsed.pageCount ?? null,
        chunk_count: chunks.length,
        char_count: totalChars,
        embedding_model: serverConfig.embeddingModel,
        embedding_dimensions: serverConfig.embeddingDimensions,
        chunk_config_version: serverConfig.chunk.version,
        indexed_at: new Date().toISOString(),
      })
      .eq("id", documentId);
    if (readyError) throw new Error(`Could not mark document ready: ${readyError.message}`);

    return { ok: true, chunkCount: chunks.length };
  } catch (error) {
    if (error instanceof ParseError) return fail(error.code, error.message);
    if (error instanceof AiConfigError) {
      logError("process.config", error);
      return fail("AI_NOT_CONFIGURED", "The AI service is not configured on the server (missing API key).");
    }
    logError("process", error);
    return fail("PROCESSING_FAILED", "Processing failed. Please try again in a moment.");
  }
}
