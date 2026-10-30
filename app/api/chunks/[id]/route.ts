import { fail, logError, ok, requireUser } from "@/lib/api";
import { idParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) return fail(400, "INVALID_ID", "Invalid id.");

  const { data, error } = await auth.supabase
    .from("document_chunks")
    .select("id, chunk_index, page_number, section, content, document_id, documents(file_name, relative_path, knowledge_base_id)")
    .eq("id", id.data)
    .maybeSingle();
  if (error) {
    logError("chunks.get", error);
    return fail(500, "DB_ERROR", "Could not load the passage.");
  }
  if (!data) return fail(404, "NOT_FOUND", "Passage not found (it may have been deleted or re-indexed).");
  return ok(data);
}
