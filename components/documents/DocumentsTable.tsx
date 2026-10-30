"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, FileText, MessageSquare, MoreHorizontal, RefreshCw, Star, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { api, errorMessage } from "@/lib/client-api";
import { ACTIVE_STATUSES, type DocumentStatus } from "@/lib/config";
import { cn, formatBytes, timeAgo } from "@/lib/utils";
import type { DocumentRow } from "@/types";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";

const STALE_MS = 5 * 60 * 1000;

export function DocumentsTable({ rows, showKnowledgeBase = true }: { rows: DocumentRow[]; showKnowledgeBase?: boolean }) {
  const router = useRouter();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DocumentRow | null>(null);
  const [working, setWorking] = useState<Set<string>>(new Set());
  const [starred, setStarred] = useState<Record<string, boolean>>({});

  const activeIds = rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).map((r) => r.id);
  const activeKey = activeIds.join(",");
  useEffect(() => {
    if (!activeKey) return;
    const timer = setInterval(async () => {
      try {
        const current = await api<{ id: string; status: DocumentStatus }[]>(`/api/documents/status?ids=${activeKey}`);
        const changed = current.some((c) => rows.find((r) => r.id === c.id)?.status !== c.status);
        if (changed) router.refresh();
      } catch {
       
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [activeKey, rows, router]);

  async function toggleStar(row: DocumentRow) {
    const next = !(starred[row.id] ?? row.starred);
    setStarred((prev) => ({ ...prev, [row.id]: next }));
    try {
      await api(`/api/documents/${row.id}`, { method: "PATCH", body: { starred: next } });
      router.refresh();
    } catch (e) {
      setStarred((prev) => ({ ...prev, [row.id]: !next }));
      toast.error(errorMessage(e));
    }
  }

  async function reprocess(row: DocumentRow) {
    setWorking((prev) => new Set(prev).add(row.id));
    toast.info(`Processing “${row.file_name}”…`);
    try {
      await api(`/api/documents/${row.id}/process`, { method: "POST", body: { reindex: row.status === "ready" } });
      toast.success(`“${row.file_name}” is ready.`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setWorking((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      router.refresh();
    }
  }

  async function remove(row: DocumentRow) {
    try {
      await api(`/api/documents/${row.id}`, { method: "DELETE" });
      toast.success(`Deleted “${row.file_name}”`);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      throw e; // keeps the confirmation dialog open
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">Documents</caption>
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">Name</th>
              {showKnowledgeBase ? <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Knowledge base</th> : null}
              <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">Size</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Updated</th>
              <th scope="col" className="w-24 px-4 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isStarred = starred[row.id] ?? row.starred;
              const stale = ACTIVE_STATUSES.includes(row.status) && Date.now() - new Date(row.updated_at).getTime() > STALE_MS;
              const canProcess = row.status === "failed" || row.status === "ready" || stale;
              return (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="max-w-[16rem] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4.5 w-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setPreviewId(row.id)}
                          className="block max-w-full truncate text-left font-medium hover:text-primary"
                          title={row.relative_path}
                        >
                          {row.file_name}
                        </button>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.file_ext.toUpperCase()}
                          {row.relative_path.includes("/") ? ` · ${row.relative_path.slice(0, row.relative_path.lastIndexOf("/"))}` : ""}
                        </p>
                        {row.status === "failed" && row.error_message ? (
                          <p className="mt-1 text-xs text-danger">{row.error_message}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  {showKnowledgeBase ? (
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <Link href={`/knowledge-bases/${row.knowledge_base_id}`} className="text-muted-foreground hover:text-foreground">
                        {row.knowledge_bases?.name ?? "—"}
                      </Link>
                    </td>
                  ) : null}
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{formatBytes(row.size_bytes)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={working.has(row.id) ? "indexing" : row.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{timeAgo(row.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleStar(row)}
                        aria-label={isStarred ? `Remove ${row.file_name} from starred` : `Star ${row.file_name}`}
                        aria-pressed={isStarred}
                      >
                        <Star className={cn("h-4 w-4", isStarred && "fill-warning text-warning")} aria-hidden="true" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${row.file_name}`}>
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => setPreviewId(row.id)}>
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            Preview
                          </DropdownMenuItem>
                          {row.status === "ready" ? (
                            <DropdownMenuItem asChild>
                              <Link href={`/chat?kb=${row.knowledge_base_id}&doc=${row.id}`}>
                                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                                Chat about this
                              </Link>
                            </DropdownMenuItem>
                          ) : null}
                          {canProcess ? (
                            <DropdownMenuItem onSelect={() => reprocess(row)} disabled={working.has(row.id)}>
                              <RefreshCw className="h-4 w-4" aria-hidden="true" />
                              {row.status === "ready" ? "Re-index" : "Retry processing"}
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setDeleting(row)} className="text-danger">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DocumentPreviewDialog documentId={previewId} onOpenChange={(open) => !open && setPreviewId(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this document?"
        description={`“${deleting?.file_name ?? ""}” and its indexed text will be permanently removed. This cannot be undone.`}
        onConfirm={() => remove(deleting!)}
      />
    </>
  );
}
