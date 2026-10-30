import type { Metadata } from "next";
import Link from "next/link";
import { BookMarked, Library, Search } from "lucide-react";
import { CreateKnowledgeBaseButton } from "@/components/app/CreateKnowledgeBaseButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "My Knowledge Bases" };

const PAGE_SIZE = 12;
type SearchParams = Promise<{ q?: string; sort?: string; page?: string }>;

export default async function KnowledgeBasesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const sort = ["recent", "name", "created"].includes(sp.sort ?? "") ? (sp.sort as string) : "recent";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("knowledge_bases")
    .select("id, name, description, created_at, last_accessed_at, documents(count)", { count: "exact" });
  if (q) query = query.ilike("name", `%${escapeLike(q)}%`);
  query =
    sort === "name"
      ? query.order("name", { ascending: true })
      : sort === "created"
        ? query.order("created_at", { ascending: false })
        : query.order("last_accessed_at", { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    description: string | null;
    last_accessed_at: string;
    documents: { count: number }[];
  }[];
  const total = count ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="My Knowledge Bases"
        description="Group related documents, then chat with the whole group."
        actions={<CreateKnowledgeBaseButton />}
      />

      <form method="get" role="search" aria-label="Filter knowledge bases" className="mb-5 flex flex-wrap items-end gap-3">
        <div className="relative min-w-48 flex-1">
          <label htmlFor="kb-q" className="sr-only">
            Search knowledge bases
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="kb-q" name="q" defaultValue={q} placeholder="Search by name…" className="pl-9" maxLength={100} />
        </div>
        <div>
          <label htmlFor="kb-sort" className="sr-only">
            Sort by
          </label>
          <Select id="kb-sort" name="sort" defaultValue={sort} className="w-44">
            <option value="recent">Recently used</option>
            <option value="name">Name</option>
            <option value="created">Date created</option>
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {rows.length === 0 ? (
        q ? (
          <EmptyState icon={Search} title="No matches" description={`No knowledge base is named like “${q}”.`} />
        ) : (
          <EmptyState icon={Library} title="Create your first knowledge base" description="A knowledge base keeps related documents together so you can ask questions across all of them.">
            <CreateKnowledgeBaseButton />
          </EmptyState>
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((kb) => {
            const docs = kb.documents?.[0]?.count ?? 0;
            return (
              <li key={kb.id}>
                <Link
                  href={`/knowledge-bases/${kb.id}`}
                  className="flex h-full flex-col rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary/50"
                >
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <BookMarked className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="truncate text-base font-semibold">{kb.name}</span>
                  <span className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{kb.description || "No description"}</span>
                  <span className="mt-4 text-xs text-muted-foreground">
                    {docs} document{docs === 1 ? "" : "s"} · used {timeAgo(kb.last_accessed_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/knowledge-bases" params={{ q: q || undefined, sort: sort !== "recent" ? sort : undefined }} />
    </div>
  );
}
