import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentRow } from "@/types";
import type { DocumentListQuery } from "@/lib/validation";
import { escapeLike } from "@/lib/utils";

export const DOCUMENT_COLUMNS =
  "id, knowledge_base_id, file_name, relative_path, file_ext, size_bytes, status, error_code, error_message, page_count, chunk_count, starred, created_at, updated_at, indexed_at, knowledge_bases(name)";

/**
 * List the signed-in user's documents with search, filters, sorting and pagination.
 * Ownership is enforced by Row Level Security in the database.
 */
export async function queryDocuments(supabase: SupabaseClient, query: DocumentListQuery) {
  let builder = supabase.from("documents").select(DOCUMENT_COLUMNS, { count: "exact" });

  if (query.q) builder = builder.ilike("file_name", `%${escapeLike(query.q)}%`);
  if (query.kb) builder = builder.eq("knowledge_base_id", query.kb);
  if (query.type) builder = builder.eq("file_ext", query.type);
  if (query.status) builder = builder.eq("status", query.status);
  if (query.starred) builder = builder.eq("starred", true);

  if (query.sort === "name") builder = builder.order("file_name", { ascending: true });
  else if (query.sort === "upload") builder = builder.order("created_at", { ascending: false });
  else builder = builder.order("updated_at", { ascending: false });

  const from = (query.page - 1) * query.pageSize;
  const { data, count, error } = await builder.range(from, from + query.pageSize - 1);
  if (error) throw new Error(error.message);

  return { rows: (data ?? []) as unknown as DocumentRow[], total: count ?? 0 };
}
