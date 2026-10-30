import { redirect } from "next/navigation";
import { Settings2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { getCurrentUser, isSupabaseConfigured, userDisplay } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Layout for every signed-in page: checks the session, then renders the sidebar shell. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) {
    return (
      <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4 text-center">
        <Settings2 className="mb-4 h-10 w-10 text-primary" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Setup needed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your environment
          variables (see the README), then restart the app.
        </p>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, title")
    .order("updated_at", { ascending: false })
    .limit(8);

  return (
    <AppShell user={userDisplay(user)} conversations={conversations ?? []}>
      {children}
    </AppShell>
  );
}
