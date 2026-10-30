import { fail, logError, ok, parseBody, requireUser } from "@/lib/api";
import { queryDocuments } from "@/lib/data/documents";
import { serverConfig } from "@/lib/server-config";
import { sanitizeRelativePath, safeFileName } from "@/lib/utils";
import { documentListSchema, registerDocumentSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = documentListSchema.safeParse(params);
  if (!parsed.success) return fail(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid query.");

  try {
    const result = await queryDocuments(auth.supabase, parsed.data);
    return ok({ ...result, page: parsed.data.page, pageSize: parsed.data.pageSize });
  } catch (error) {
    logError("documents.list", error);
    return fail(500, "DB_ERROR", "Could not load documents.");
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;
  const body = await parseBody(request, registerDocumentSchema);
  if (body.error) return body.error;
  const input = body.data;

  const { data: kb } = await supabase.from("knowledge_bases").select("id").eq("id", input.knowledgeBaseId).maybeSingle();
  if (!kb) return fail(404, "KB_NOT_FOUND", "Knowledge base not found.");

  const { data: existing } = await supabase
    .from("documents")
    .select("id, status, storage_path")
    .eq("knowledge_base_id", input.knowledgeBaseId)
    .eq("content_hash", input.contentHash)
    .maybeSingle();

  if (existing) {
   
    if (["failed", "uploading", "queued"].includes(existing.status)) {
      return ok({ id: existing.id, storagePath: existing.storage_path, resumed: true });
    }
    return fail(409, "DUPLICATE", "This file is already in this knowledge base.");
  }

  const { count } = await supabase.from("documents").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= serverConfig.maxDocumentsPerUser) {
    return fail(403, "LIMIT_REACHED", `You can store up to ${serverConfig.maxDocumentsPerUser} documents.`);
  }

  const id = crypto.randomUUID();
  const storagePath = `${user.id}/${id}/${safeFileName(input.fileName)}`;

  const { error } = await supabase.from("documents").insert({
    id,
    user_id: user.id,
    knowledge_base_id: input.knowledgeBaseId,
    file_name: input.fileName,
    relative_path: sanitizeRelativePath(input.relativePath, input.fileName),
    file_ext: input.extension,
    mime_type: input.mimeType ?? null,
    size_bytes: input.sizeBytes,
    content_hash: input.contentHash,
    storage_path: storagePath,
    status: "uploading",
  });

  if (error) {
    if (error.code === "23505") return fail(409, "DUPLICATE", "This file is already in this knowledge base.");
    logError("documents.register", error);
    return fail(500, "DB_ERROR", "Could not register the document.");
  }

  await supabase.from("knowledge_bases").update({ last_accessed_at: new Date().toISOString() }).eq("id", input.knowledgeBaseId);

  return ok({ id, storagePath, resumed: false }, 201);
}
