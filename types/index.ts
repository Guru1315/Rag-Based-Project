import type { DocumentStatus } from "@/lib/config";

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
}

export interface DocumentRow {
  id: string;
  knowledge_base_id: string;
  file_name: string;
  relative_path: string;
  file_ext: string;
  size_bytes: number;
  status: DocumentStatus;
  error_code: string | null;
  error_message: string | null;
  page_count: number | null;
  chunk_count: number;
  starred: boolean;
  created_at: string;
  updated_at: string;
  indexed_at: string | null;
  knowledge_bases?: { name: string } | null;
}

export interface Conversation {
  id: string;
  knowledge_base_id: string | null;
  document_ids: string[];
  title: string;
  starred: boolean;
  created_at: string;
  updated_at: string;
}

/** One retrieved passage that supports an answer. `n` is the citation number [n]. */
export interface Source {
  n: number;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  path: string;
  page: number | null;
  section: string | null;
  excerpt: string;
  similarity: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  grounded: boolean | null;
  status: "complete" | "stopped" | "error";
  created_at: string;
}

/** Lines of the NDJSON stream sent by /api/chat. */
export type ChatStreamEvent =
  | { type: "meta"; conversationId: string; title: string }
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; grounded: boolean; followUps: string[] }
  | { type: "error"; code: string; message: string };

export interface ApiError {
  code: string;
  message: string;
}
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };
