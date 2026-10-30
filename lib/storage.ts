import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_BUCKET } from "@/lib/config";

/** Delete files from the private bucket (in groups of 100). Returns an error message or null. */
export async function removeStorageFiles(supabase: SupabaseClient, paths: string[]): Promise<string | null> {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths.slice(i, i + 100));
    if (error) return error.message;
  }
  return null;
}

/** All storage paths of the user's documents (optionally only one knowledge base). */
export async function collectStoragePaths(supabase: SupabaseClient, knowledgeBaseId?: string): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from("documents").select("storage_path");
    if (knowledgeBaseId) query = query.eq("knowledge_base_id", knowledgeBaseId);
    const { data, error } = await query.order("created_at").range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    paths.push(...(data ?? []).map((d: { storage_path: string }) => d.storage_path));
    if (!data || data.length < pageSize) break;
  }
  return paths;
}
