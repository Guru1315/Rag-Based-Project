import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, MessageSquare } from "lucide-react";
import { KnowledgeBaseActions } from "@/components/app/KnowledgeBaseActions";
import { DocumentFilters } from "@/components/documents/DocumentFilters";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { UploadZone } from "@/components/documents/UploadZone";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { buttonVariants } from "@/components/ui/button";
import { queryDocuments } from "@/lib/data/documents";
import { createClient } from "@/lib/supabase/server";
import { documentListSchema, idParamSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Knowledge base" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function KnowledgeBasePage({ params, searchParams }: Props) {
  const id = idParamSchema.safeParse((await params).id);
  if (!id.success) notFound();

  const supabase = await createClient();
  // Row Level Security: another user's knowledge base simply is not found.
  const { data: kb } = await supabase
    .from("knowledge_bases")
    .select("id, name, description")
    .eq("id", id.data)
    .maybeSingle();
  if (!kb) notFound();

  const sp = await searchParams;
  const parsed = documentListSchema.safeParse({ ...sp, kb: kb.id });
  const filters = parsed.success ? parsed.data : documentListSchema.parse({ kb: kb.id });

  await supabase.from("knowledge_bases").update({ last_accessed_at: new Date().toISOString() }).eq("id", kb.id);

  const { rows, total } = await queryDocuments(supabase, filters);
  const { count: totalInKb } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("knowledge_base_id", kb.id);
  const hasFilters = Boolean(filters.q || filters.type || filters.status);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/knowledge-bases" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All knowledge bases
      </Link>

      <PageHeader
        title={kb.name}
        description={kb.description || "No description"}
        actions={
          <>
            <Link href={`/chat?kb=${kb.id}`} className={buttonVariants({ variant: "primary" })}>
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Start chat
            </Link>
            <KnowledgeBaseActions id={kb.id} name={kb.name} description={kb.description} documentCount={totalInKb ?? 0} />
          </>
        }
      />

      <UploadZone knowledgeBases={[{ id: kb.id, name: kb.name }]} fixedKnowledgeBaseId={kb.id} />

      <section aria-labelledby="kb-docs" className="mt-8">
        <h2 id="kb-docs" className="mb-3 text-lg font-semibold">
          Documents
        </h2>
        {(totalInKb ?? 0) > 0 ? (
          <DocumentFilters action={`/knowledge-bases/${kb.id}`} values={{ q: filters.q, type: filters.type, status: filters.status, sort: filters.sort }} />
        ) : null}

        {rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={hasFilters ? "No documents match these filters" : "No documents in this knowledge base yet"}
            description={hasFilters ? "Try clearing the search or filters." : "Use the upload area above to add files or a folder."}
          />
        ) : (
          <DocumentsTable rows={rows} showKnowledgeBase={false} />
        )}

        <Pagination
          page={filters.page}
          pageSize={filters.pageSize}
          total={total}
          basePath={`/knowledge-bases/${kb.id}`}
          params={{ q: filters.q, type: filters.type, status: filters.status, sort: filters.sort !== "recent" ? filters.sort : undefined }}
        />
      </section>
    </div>
  );
}
