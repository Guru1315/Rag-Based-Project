import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { DangerZone } from "@/components/settings/DangerZone";
import { ThemeSettings } from "@/components/settings/ThemeSettings";
import { getCurrentUser, userDisplay } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatBytes } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const profile = user ? userDisplay(user) : { name: "", email: "", avatarUrl: null };
  const supabase = await createClient();

  const count = (table: string) => supabase.from(table).select("id", { count: "exact", head: true });
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Real measurements from the user's own saved data.
  const [kbs, docs, chunks, chats, messages, questions24h, sizes] = await Promise.all([
    count("knowledge_bases"),
    count("documents"),
    count("document_chunks"),
    count("conversations"),
    count("messages"),
    count("messages").eq("role", "user").gte("created_at", dayAgo),
    supabase.from("documents").select("size_bytes").limit(1000),
  ]);
  const storedBytes = (sizes.data ?? []).reduce((sum, d: { size_bytes: number }) => sum + Number(d.size_bytes), 0);
  const sizesTruncated = (docs.count ?? 0) > 1000;

  const usage: [string, string][] = [
    ["Knowledge bases", String(kbs.count ?? 0)],
    ["Documents", String(docs.count ?? 0)],
    ["Indexed passages", String(chunks.count ?? 0)],
    ["Stored file size", `${sizesTruncated ? "≥ " : ""}${formatBytes(storedBytes)}`],
    ["Conversations", String(chats.count ?? 0)],
    ["Saved messages", String(messages.count ?? 0)],
    ["Questions asked in the last 24 h", String(questions24h.count ?? 0)],
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title="Settings" />

      <div className="space-y-6">
        <Section title="Profile" description="Taken from your Google account. Change it in your Google account settings.">
          <div className="flex items-center gap-4">
            <Avatar name={profile.name} src={profile.avatarUrl} className="h-14 w-14 text-lg" />
            <div className="min-w-0">
              <p className="truncate font-medium">{profile.name}</p>
              <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>
        </Section>

        <Section title="Appearance" description="Choose how DocuMind AI looks on this device.">
          <ThemeSettings />
        </Section>

        <Section title="Usage" description="Counted from your saved data. No quota is shown because none is enforced here.">
          <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
            {usage.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 bg-surface px-4 py-3">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            AI token usage is not recorded by this app. Check your Google AI Studio dashboard for API usage.
          </p>
        </Section>

        <Section title="Data and privacy" description="What is stored, and how to remove it.">
          <ul className="mb-4 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Your files are kept in a private storage bucket and their text is stored as indexed passages.</li>
            <li>Conversations and answers (with their sources) are saved so you can continue them later.</li>
            <li>To answer a question, your question and the matching passages are sent to the Google Gemini API.</li>
            <li>You can delete a single document, knowledge base or conversation from its own page.</li>
          </ul>
          <DangerZone />
          <p className="mt-3 text-xs text-muted-foreground">
            Deleting your sign-in account itself is done by the project owner in the Supabase dashboard (see the README).
          </p>
        </Section>

        <Section title="Account">
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </Button>
          </form>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`s-${title}`} className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 id={`s-${title}`} className="text-lg font-semibold">
        {title}
      </h2>
      {description ? <p className="mb-4 mt-1 text-sm text-muted-foreground">{description}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}
