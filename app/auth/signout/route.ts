import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** POST /auth/signout  (a form button posts here) */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 makes the browser follow the redirect with GET.
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
