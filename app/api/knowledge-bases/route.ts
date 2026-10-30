import { fail, logError, ok, parseBody, requireUser } from "@/lib/api";
import { createKnowledgeBaseSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** GET /api/knowledge-bases?q=  -> the signed-in user's knowledge bases */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100);
  let query = auth.supabase
    .from("knowledge_bases")
    .select("id, name, description, created_at, updated_at, last_accessed_at")
    .order("last_accessed_at", { ascending: false })
    .limit(100);
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);

  const { data, error } = await query;
  if (error) {
    logError("kb.list", error);
    return fail(500, "DB_ERROR", "Could not load knowledge bases.");
  }
  return ok(data);
}

/** POST /api/knowledge-bases  { name, description? } */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const body = await parseBody(request, createKnowledgeBaseSchema);
  if (body.error) return body.error;

  const { data, error } = await auth.supabase
    .from("knowledge_bases")
    .insert({ name: body.data.name, description: body.data.description || null, user_id: auth.user.id })
    .select("id, name, description, created_at, updated_at, last_accessed_at")
    .single();

  if (error) {
    if (error.code === "23505") return fail(409, "DUPLICATE_NAME", "You already have a knowledge base with this name.");
    logError("kb.create", error);
    return fail(500, "DB_ERROR", "Could not create the knowledge base.");
  }
  return ok(data, 201);
}
