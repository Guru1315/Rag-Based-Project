import { z } from "zod";
import { fail, logError, ok, parseBody, requireUser } from "@/lib/api";
import { collectStoragePaths, removeStorageFiles } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  scope: z.enum(["documents", "conversations"]),
  confirm: z.literal("DELETE"),
});

/**
 * DELETE /api/account/data  { scope, confirm: "DELETE" }
 *   scope "documents"     -> every knowledge base, document, chunk and stored file
 *   scope "conversations" -> every conversation and message
 * (Deleting the sign-in account itself needs the Supabase dashboard; see the README.)
 */
export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const body = await parseBody(request, schema);
  if (body.error) return body.error;

  try {
    if (body.data.scope === "documents") {
      const paths = await collectStoragePaths(auth.supabase);
      const storageError = await removeStorageFiles(auth.supabase, paths);
      if (storageError) {
        logError("account.delete.storage", storageError);
        return fail(502, "STORAGE_ERROR", "Could not delete the stored files. Nothing was removed; please try again.");
      }
      const { error } = await auth.supabase.from("knowledge_bases").delete().eq("user_id", auth.user.id);
      if (error) throw error;
    } else {
      const { error } = await auth.supabase.from("conversations").delete().eq("user_id", auth.user.id);
      if (error) throw error;
    }
  } catch (error) {
    logError("account.delete", error);
    return fail(500, "DB_ERROR", "Could not delete your data.");
  }
  return ok({ scope: body.data.scope });
}
