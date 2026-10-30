import type { Metadata } from "next";
import Link from "next/link";
import { BookMarked, CheckCircle2, FileText, Files, Library, Loader2, MessageSquare, MessageSquarePlus } from "lucide-react";
import { CreateKnowledgeBaseButton } from "@/components/app/CreateKnowledgeBaseButton";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { UploadZone } from "@/components/documents/UploadZone";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser, userDisplay } from "@/lib/auth";
import { ACTIVE_STATUSES } from "@/lib/config";
import { DOCUMENT_COLUMNS } from "@/lib/data/documents";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/utils";
import type { DocumentRow } from "@/types";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const firstName = user ? userDisplay(user).name.split(" ")[0] : "there";

  const count = (table: string) => supabase.from(table).select("id", { count: "exact", head: true });

  // Every number below is counted from the signed-in user's own rows (Row Level Security).
  const [kbCount, docCount, readyCount, activeCount, kbs, recentDocs, conversations] = await Promise.all([
    count("knowledge_bases"),
    count("documents"),
    count("documents").eq("status", "ready"),
    count("documents").in("status", ACTIVE_STATUSES),
    supabase
      .from("knowledge_bases")
      .select("id, name, description, last_accessed_at")
      .order("last_accessed_at", { ascending: false })
      .limit(100),
    supabase.from("documents").select(DOCUMENT_COLUMNS).order("created_at", { ascending: false }).limit(5),
    supabase.from("conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(5),
  ]);

  const knowledgeBases = kbs.data ?? [];
  const documents = (recentDocs.data ?? []) as unknown as DocumentRow[];
  const totalKbs = kbCount.count ?? 0;
  const totalDocs = docCount.count ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Upload documents, organise them into knowledge bases and ask questions."
        actions={
          <>
            <Link href="/chat" className={buttonVariants({ variant: "outline" })}>
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              New Chat
            </Link>
            <CreateKnowledgeBaseButton />
          </>
        }
      />

      {/* Real counts */}
      <section aria-label="Your library at a glance" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Library} label="Knowledge bases" value={totalKbs} />
        <StatCard icon={Files} label="Documents" value={totalDocs} />
        <StatCard icon={CheckCircle2} label="Indexed (ready)" value={readyCount.count ?? 0} />
        <StatCard icon={Loader2} label="Processing now" value={activeCount.count ?? 0} hint="Uploading or indexing" />
      </section>

      {/* First-time guidance */}
      {totalKbs === 0 ? (
        <section aria-labelledby="start-heading" className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 p-6">
          <h2 id="start-heading" className="text-lg font-semibold">
            Get started in three steps
          </h2>
          <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <li className="rounded-xl bg-surface p-4">
              <span className="font-semibold">1. Create a knowledge base</span>
              <p className="mt-1 text-muted-foreground">A folder-like group for related documents, e.g. one per course or project.</p>
            </li>
            <li className="rounded-xl bg-surface p-4">
              <span className="font-semibold">2. Upload documents</span>
              <p className="mt-1 text-muted-foreground">Drop files or a whole folder. Wait until each shows “Ready”.</p>
            </li>
            <li className="rounded-xl bg-surface p-4">
              <span className="font-semibold">3. Ask a question</span>
              <p className="mt-1 text-muted-foreground">Open a chat and get answers with citations from your files.</p>
            </li>
          </ol>
        </section>
      ) : null}

      <div id="upload" className="mt-6 scroll-mt-24">
        <UploadZone knowledgeBases={knowledgeBases.map((k) => ({ id: k.id, name: k.name }))} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <section aria-labelledby="recent-docs" className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recent-docs" className="text-lg font-semibold">
              Recently uploaded
            </h2>
            {totalDocs > 0 ? (
              <Link href="/documents" className="text-sm text-primary hover:underline">
                View all
              </Link>
            ) : null}
          </div>
          {documents.length === 0 ? (
            <EmptyState icon={FileText} title="No documents yet" description="Upload your first file above and it will appear here." />
          ) : (
            <DocumentsTable rows={documents} />
          )}
        </section>

        <div className="space-y-8">
          <section aria-labelledby="recent-kbs">
            <h2 id="recent-kbs" className="mb-3 text-lg font-semibold">
              Recent knowledge bases
            </h2>
            {knowledgeBases.length === 0 ? (
              <EmptyState icon={BookMarked} title="No knowledge bases" description="Create one to start organising your documents." />
            ) : (
              <ul className="space-y-2">
                {knowledgeBases.slice(0, 4).map((kb) => (
                  <li key={kb.id}>
                    <Link href={`/knowledge-bases/${kb.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 hover:border-primary/50">
                      <BookMarked className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{kb.name}</span>
                        <span className="block text-xs text-muted-foreground">Used {timeAgo(kb.last_accessed_at)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="recent-chats">
            <h2 id="recent-chats" className="mb-3 text-lg font-semibold">
              Recent conversations
            </h2>
            {(conversations.data ?? []).length === 0 ? (
              <EmptyState icon={MessageSquare} title="No conversations yet" description="Start a chat once a document is ready.">
                <Link href="/chat" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  New chat
                </Link>
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {(conversations.data ?? []).map((c) => (
                  <li key={c.id}>
                    <Link href={`/chat/${c.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 hover:border-primary/50">
                      <MessageSquare className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
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
      </div>
    </div>
  );
}
