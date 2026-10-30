import { fail, logError, ok, requireUser } from "@/lib/api";
import { escapeLike } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=  -> knowledge bases, documents and conversations whose
 * name/title matches. Everything goes through RLS, so only the user's own data can match.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (q.length < 2) return ok({ knowledgeBases: [], documents: [], conversations: [] });
  const pattern = `%${escapeLike(q)}%`;

  const [kbs, docs, chats] = await Promise.all([
    auth.supabase.from("knowledge_bases").select("id, name").ilike("name", pattern).limit(5),
    auth.supabase
      .from("documents")
      .select("id, file_name, status, knowledge_base_id, knowledge_bases(name)")
      .ilike("file_name", pattern)
      .limit(8),
    auth.supabase.from("conversations").select("id, title").ilike("title", pattern).limit(5),
  ]);

  const error = kbs.error ?? docs.error ?? chats.error;
  if (error) {
    logError("search", error);
    return fail(500, "DB_ERROR", "Search failed.");
  }
  return ok({ knowledgeBases: kbs.data, documents: docs.data, conversations: chats.data });
}
