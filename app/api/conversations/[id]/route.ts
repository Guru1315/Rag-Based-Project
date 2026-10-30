import { fail, logError, ok, parseBody, requireUser } from "@/lib/api";
import { idParamSchema, updateConversationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/conversations/:id  { title?, starred? }  (rename / star) */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) return fail(400, "INVALID_ID", "Invalid id.");
  const body = await parseBody(request, updateConversationSchema);
  if (body.error) return body.error;

  const { data, error } = await auth.supabase
    .from("conversations")
    .update(body.data)
    .eq("id", id.data)
    .select("id, title, starred")
    .maybeSingle();
  if (error) {
    logError("conversations.update", error);
    return fail(500, "DB_ERROR", "Could not update the conversation.");
  }
  if (!data) return fail(404, "NOT_FOUND", "Conversation not found.");
  return ok(data);
}

/** DELETE /api/conversations/:id  (messages cascade) */
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) return fail(400, "INVALID_ID", "Invalid id.");

  const { data, error } = await auth.supabase.from("conversations").delete().eq("id", id.data).select("id");
  if (error) {
    logError("conversations.delete", error);
    return fail(500, "DB_ERROR", "Could not delete the conversation.");
  }
  if (!data || data.length === 0) return fail(404, "NOT_FOUND", "Conversation not found.");
  return ok({ id: id.data });
}
