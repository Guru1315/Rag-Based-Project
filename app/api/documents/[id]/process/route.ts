import { fail, ok, requireUser } from "@/lib/api";
import { processDocument } from "@/lib/pipeline/process-document";
import { idParamSchema, processDocumentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
// Vercel limit for this function. Large files can take a while (parse + embeddings).
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/documents/:id/process  { reindex? }
 * Runs the indexing pipeline. Used after upload, for "Retry" and for "Re-index".
 * Progress is visible to the browser through /api/documents/status.
 */
export async function POST(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) return fail(400, "INVALID_ID", "Invalid id.");

  // The body is optional: an empty body means "process normally".
  let reindex = false;
  const raw = await request.text();
  if (raw.trim()) {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return fail(400, "INVALID_JSON", "The request body must be valid JSON.");
    }
    const parsed = processDocumentSchema.safeParse(json);
    if (!parsed.success) return fail(400, "VALIDATION_ERROR", "Invalid request.");
    reindex = parsed.data.reindex ?? false;
  }

  const result = await processDocument(auth.supabase, id.data, { reindex });
  if (!result.ok) return fail(result.status, result.code, result.message);
  return ok({ id: id.data, chunkCount: result.chunkCount });
}
