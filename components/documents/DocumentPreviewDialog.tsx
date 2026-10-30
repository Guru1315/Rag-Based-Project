"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/client-api";
import type { DocumentStatus } from "@/lib/config";
import { formatBytes, timeAgo } from "@/lib/utils";

interface Preview {
  document: {
    id: string;
    knowledge_base_id: string;
    file_name: string;
    relative_path: string;
    file_ext: string;
    size_bytes: number;
    status: DocumentStatus;
    error_message: string | null;
    page_count: number | null;
    chunk_count: number;
    char_count: number | null;
    created_at: string;
    indexed_at: string | null;
    knowledge_bases?: { name: string } | null;
  };
  passages: { id: string; chunk_index: number; page_number: number | null; section: string | null; content: string }[];
  offset: number;
  limit: number;
}

export function DocumentPreviewDialog({
  documentId,
  onOpenChange,
}: {
  documentId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<Preview | null>(null);
  const [passages, setPassages] = useState<Preview["passages"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (id: string, offset: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<Preview>(`/api/documents/${id}/preview?offset=${offset}`);
      setData(result);
      setPassages((prev) => (offset === 0 ? result.passages : [...prev, ...result.passages]));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setData(null);
    setPassages([]);
    if (documentId) void load(documentId, 0);
  }, [documentId, load]);

  const doc = data?.document;
  const hasMore = doc ? passages.length < doc.chunk_count : false;

  return (
    <Dialog open={documentId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        title={doc?.file_name ?? "Document preview"}
        description={doc ? doc.relative_path : undefined}
        side="right"
        className="max-w-xl"
      >
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        {!doc && loading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}

        {doc ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Meta label="Status">
                <StatusBadge status={doc.status} />
              </Meta>
              <Meta label="Type">{doc.file_ext.toUpperCase()}</Meta>
              <Meta label="Size">{formatBytes(doc.size_bytes)}</Meta>
              <Meta label="Knowledge base">{doc.knowledge_bases?.name ?? "—"}</Meta>
              <Meta label="Pages / slides">{doc.page_count ?? "—"}</Meta>
              <Meta label="Indexed passages">{doc.chunk_count}</Meta>
              <Meta label="Uploaded">{timeAgo(doc.created_at)}</Meta>
              <Meta label="Indexed">{doc.indexed_at ? timeAgo(doc.indexed_at) : "—"}</Meta>
            </dl>

            {doc.error_message ? (
              <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger">
                {doc.error_message}
              </p>
            ) : null}

            {doc.status === "ready" ? (
              <Link
                href={`/chat?kb=${doc.knowledge_base_id}&doc=${doc.id}`}
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                Chat about this document
              </Link>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-semibold">Extracted text</h3>
              {passages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {doc.status === "ready" ? "No text available." : "Text appears here once the document is indexed."}
                </p>
              ) : (
                <ol className="space-y-3">
                  {passages.map((p) => (
                    <li key={p.id} className="rounded-xl border border-border bg-background/50 p-3">
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                        Passage {p.chunk_index + 1}
                        {p.page_number ? ` · page ${p.page_number}` : ""}
                        {p.section ? ` · ${p.section}` : ""}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
                    </li>
                  ))}
                </ol>
              )}
              {hasMore ? (
                <Button variant="outline" size="sm" className="mt-3" loading={loading} onClick={() => load(doc.id, passages.length)}>
                  Load more
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
