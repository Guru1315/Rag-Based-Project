import { fail, logError, ok, parseBody, requireUser } from "@/lib/api";
import { collectStoragePaths, removeStorageFiles } from "@/lib/storage";
import { idParamSchema, updateKnowledgeBaseSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/knowledge-bases/:id  { name?, description? }  (rename / edit) */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) return fail(400, "INVALID_ID", "Invalid id.");
  const body = await parseBody(request, updateKnowledgeBaseSchema);
  if (body.error) return body.error;

  const update: Record<string, unknown> = {};
  if (body.data.name !== undefined) update.name = body.data.name;
  if (body.data.description !== undefined) update.description = body.data.description || null;

  const { data, error } = await auth.supabase
    .from("knowledge_bases")
    .update(update)
    .eq("id", id.data)
    .select("id, name, description, created_at, updated_at, last_accessed_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return fail(409, "DUPLICATE_NAME", "You already have a knowledge base with this name.");
    logError("kb.update", error);
    return fail(500, "DB_ERROR", "Could not update the knowledge base.");
  }
  if (!data) return fail(404, "NOT_FOUND", "Knowledge base not found.");
  return ok(data);
}

/**
 * DELETE /api/knowledge-bases/:id
 * Removes the stored files first, then the knowledge base. The database then
 * cascades to documents and chunks. Conversations are kept (their scope is cleared).
 */
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) return fail(400, "INVALID_ID", "Invalid id.");

  const { data: kb } = await auth.supabase.from("knowledge_bases").select("id").eq("id", id.data).maybeSingle();
  if (!kb) return fail(404, "NOT_FOUND", "Knowledge base not found.");

  try {
    const paths = await collectStoragePaths(auth.supabase, id.data);
    const storageError = await removeStorageFiles(auth.supabase, paths);
    if (storageError) {
      logError("kb.delete.storage", storageError);
      return fail(502, "STORAGE_ERROR", "Could not delete the stored files. Nothing was removed; please try again.");
    }
    const { error } = await auth.supabase.from("knowledge_bases").delete().eq("id", id.data);
    if (error) throw error;
  } catch (error) {
    logError("kb.delete", error);
    return fail(500, "DB_ERROR", "Could not delete the knowledge base.");
  }
  return ok({ id: id.data });
}
