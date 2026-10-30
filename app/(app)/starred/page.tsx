import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, Star } from "lucide-react";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { queryDocuments } from "@/lib/data/documents";
import { createClient } from "@/lib/supabase/server";
import { documentListSchema } from "@/lib/validation";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Starred" };

export default async function StarredPage() {
  const supabase = await createClient();
  const [docs, chats] = await Promise.all([
    queryDocuments(supabase, documentListSchema.parse({ starred: "1", pageSize: 50 })),
    supabase.from("conversations").select("id, title, updated_at").eq("starred", true).order("updated_at", { ascending: false }).limit(50),
  ]);
  const conversations = chats.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader title="Starred" description="Documents and conversations you marked as favourites." />

      <section aria-labelledby="starred-docs">
        <h2 id="starred-docs" className="mb-3 text-lg font-semibold">
          Documents
        </h2>
        {docs.rows.length === 0 ? (
          <EmptyState icon={Star} title="No starred documents" description="Use the star button in any document list to pin it here." />
        ) : (
          <DocumentsTable rows={docs.rows} />
        )}
      </section>

      <section aria-labelledby="starred-chats" className="mt-10">
        <h2 id="starred-chats" className="mb-3 text-lg font-semibold">
          Conversations
        </h2>
        {conversations.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No starred conversations" description="Open a chat and use the star button in its header." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`/chat/${c.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary/50">
                  <Star className="h-4 w-4 shrink-0 fill-warning text-warning" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <span className="block text-xs text-muted-foreground">{timeAgo(c.updated_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
