import type { Metadata } from "next";
import { Files } from "lucide-react";
import { DocumentFilters } from "@/components/documents/DocumentFilters";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { queryDocuments } from "@/lib/data/documents";
import { createClient } from "@/lib/supabase/server";
import { documentListSchema } from "@/lib/validation";
import { CreateKnowledgeBaseButton } from "@/components/app/CreateKnowledgeBaseButton";

export const metadata: Metadata = { title: "All Documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  // Invalid filter values (e.g. a hand-edited URL) fall back to the defaults.
  const parsed = documentListSchema.safeParse(sp);
  const filters = parsed.success ? parsed.data : documentListSchema.parse({});

  const supabase = await createClient();
  const [{ rows, total }, kbs] = await Promise.all([
    queryDocuments(supabase, filters),
    supabase.from("knowledge_bases").select("id, name").order("name").limit(200),
  ]);
  const hasFilters = Boolean(filters.q || filters.type || filters.status || filters.kb);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader title="All Documents" description="Every document across your knowledge bases." />

      <DocumentFilters
        action="/documents"
        values={{ q: filters.q, type: filters.type, status: filters.status, sort: filters.sort, kb: filters.kb }}
        knowledgeBases={kbs.data ?? []}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Files}
          title={hasFilters ? "No documents match these filters" : "No documents yet"}
          description={hasFilters ? "Try clearing the search or filters." : "Create a knowledge base, then upload your first file."}
        >
          {hasFilters ? null : <CreateKnowledgeBaseButton />}
        </EmptyState>
      ) : (
        <DocumentsTable rows={rows} />
      )}

      <Pagination
        page={filters.page}
        pageSize={filters.pageSize}
        total={total}
        basePath="/documents"
        params={{
          q: filters.q,
          kb: filters.kb,
          type: filters.type,
          status: filters.status,
          sort: filters.sort !== "recent" ? filters.sort : undefined,
        }}
      />
    </div>
  );
}
