import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ZodType, ZodTypeDef } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Every API route answers with one of two shapes:
 *   { ok: true,  data: ... }
 *   { ok: false, error: { code, message } }
 */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

type AuthResult =
  | { supabase: SupabaseClient; user: User; error?: undefined }
  | { error: NextResponse; supabase?: undefined; user?: undefined };

/** Returns the signed-in user, or a ready-made 401 response. */
export async function requireUser(): Promise<AuthResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { error: fail(503, "NOT_CONFIGURED", "The server is not configured yet (missing Supabase settings).") };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: fail(401, "UNAUTHENTICATED", "Please sign in to continue.") };
  return { supabase, user };
}

/** Parse and validate a JSON request body with a Zod schema. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T, ZodTypeDef, unknown>,
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { error: fail(400, "INVALID_JSON", "The request body must be valid JSON.") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid request.";
    return { error: fail(400, "VALIDATION_ERROR", message) };
  }
  return { data: result.data };
}

/** Log an error on the server WITHOUT document content or secrets. */
export function logError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${scope}]`, message.slice(0, 300));
}
