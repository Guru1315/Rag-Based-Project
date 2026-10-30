import { fail, logError, ok, requireUser } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/documents/status?ids=a,b,c  -> real processing status read from the database */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const raw = new URL(request.url).searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    .slice(0, 100);
  if (ids.length === 0) return ok([]);

  const { data, error } = await auth.supabase
    .from("documents")
    .select("id, status, error_code, error_message, chunk_count")
    .in("id", ids);
  if (error) {
    logError("documents.status", error);
    return fail(500, "DB_ERROR", "Could not read document status.");
  }
  return ok(data);
}
