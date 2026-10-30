import { fail, logError, ok, parseBody, requireUser } from "@/lib/api";
import { removeStorageFiles } from "@/lib/storage";
import { idParamSchema, updateDocumentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/documents/:id  { starred }  */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) return fail(400, "INVALID_ID", "Invalid id.");
  const body = await parseBody(request, updateDocumentSchema);
  if (body.error) return body.error;
  if (body.data.starred === undefined) return fail(400, "VALIDATION_ERROR", "Nothing to update.");

  const { data, error } = await auth.supabase
    .from("documents")
    .update({ starred: body.data.starred })
    .eq("id", id.data)
    .select("id, starred")
    .maybeSingle();
  if (error) {
    logError("documents.update", error);
    return fail(500, "DB_ERROR", "Could not update the document.");
  }
  if (!data) return fail(404, "NOT_FOUND", "Document not found.");
  return ok(data);
}

/** DELETE /api/documents/:id  -> removes the stored file, then the record (chunks cascade). */
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) return fail(400, "INVALID_ID", "Invalid id.");

  const { data: doc } = await auth.supabase.from("documents").select("id, storage_path").eq("id", id.data).maybeSingle();
  if (!doc) return fail(404, "NOT_FOUND", "Document not found.");

  const storageError = await removeStorageFiles(auth.supabase, [doc.storage_path]);
  if (storageError) {
    logError("documents.delete.storage", storageError);
    return fail(502, "STORAGE_ERROR", "Could not delete the stored file. Nothing was removed; please try again.");
  }
  const { error } = await auth.supabase.from("documents").delete().eq("id", id.data);
  if (error) {
    logError("documents.delete", error);
    return fail(500, "DB_ERROR", "Could not delete the document.");
  }
  return ok({ id: id.data });
}
