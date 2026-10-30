import { fail, logError, ok, requireUser } from "@/lib/api";
import { idParamSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/documents/:id/preview?offset=0  -> metadata + a page of extracted passages */
export async function GET(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) return fail(400, "INVALID_ID", "Invalid id.");

  const offset = Math.max(0, Number(new URL(request.url).searchParams.get("offset")) || 0);
  const limit = 5;

  const { data: doc, error } = await auth.supabase
    .from("documents")
    .select(
      "id, knowledge_base_id, file_name, relative_path, file_ext, size_bytes, status, error_message, page_count, chunk_count, char_count, created_at, indexed_at, knowledge_bases(name)",
    )
    .eq("id", id.data)
    .maybeSingle();
  if (error) {
    logError("documents.preview", error);
    return fail(500, "DB_ERROR", "Could not load the document.");
  }
  if (!doc) return fail(404, "NOT_FOUND", "Document not found.");

  const { data: passages } = await auth.supabase
    .from("document_chunks")
    .select("id, chunk_index, page_number, section, content")
    .eq("document_id", id.data)
    .order("chunk_index")
    .range(offset, offset + limit - 1);

  return ok({ document: doc, passages: passages ?? [], offset, limit });
}
