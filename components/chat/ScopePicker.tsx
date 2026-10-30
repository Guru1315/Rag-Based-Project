"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/client-api";
import type { DocumentRow } from "@/types";

export interface Scope {
  /** Empty string = all of the user's documents */
  kbId: string;
  docs: { id: string; name: string }[];
}

/** Choose which knowledge base (and optionally which documents) a new chat searches. */
export function ScopePicker({
  knowledgeBases,
  scope,
  onChange,
}: {
  knowledgeBases: { id: string; name: string }[];
  scope: Scope;
  onChange: (scope: Scope) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<DocumentRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});

  // Load ready documents (from the API, which only returns the user's own) when the dialog is open.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setError(null);
      try {
        const params = new URLSearchParams({ status: "ready", pageSize: "100", sort: "name" });
        if (scope.kbId) params.set("kb", scope.kbId);
        if (search.trim()) params.set("q", search.trim());
        const result = await api<{ rows: DocumentRow[]; total: number }>(`/api/documents?${params}`, {
          signal: controller.signal,
        });
        setRows(result.rows);
        setTotal(result.total);
      } catch (e) {
        if (!(e instanceof DOMException)) setError(errorMessage(e));
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, scope.kbId, search]);

  function openDialog() {
    setSelected(Object.fromEntries(scope.docs.map((d) => [d.id, d.name])));
    setSearch("");
    setRows(null);
    setOpen(true);
  }

  function toggle(row: DocumentRow) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[row.id]) delete next[row.id];
      else next[row.id] = row.file_name;
      return next;
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="scope-kb" className="sr-only">
        Knowledge base to search
      </label>
      <Select
        id="scope-kb"
        value={scope.kbId}
        onChange={(e) => onChange({ kbId: e.target.value, docs: [] })}
        className="h-9 w-52 max-w-full text-xs"
      >
        <option value="">All my documents</option>
        {knowledgeBases.map((kb) => (
          <option key={kb.id} value={kb.id}>
            {kb.name}
          </option>
        ))}
      </Select>
      <Button variant="outline" size="sm" onClick={openDialog}>
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        {scope.docs.length > 0 ? `${scope.docs.length} document${scope.docs.length === 1 ? "" : "s"} selected` : "Choose documents"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Choose documents"
          description="Limit the chat to specific documents. Leave empty to search everything in the selected scope."
        >
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file name…"
            aria-label="Search documents"
            className="mb-3"
          />
          <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
            {error ? (
              <p role="alert" className="p-3 text-sm text-danger">
                {error}
              </p>
            ) : rows === null ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-5/6" />
              </div>
            ) : rows.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No indexed documents found here yet.</p>
            ) : (
              <ul>
                {rows.map((row) => (
                  <li key={row.id} className="border-b border-border last:border-0">
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[row.id])}
                        onChange={() => toggle(row)}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      <span className="min-w-0 flex-1 truncate">{row.file_name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{row.file_ext.toUpperCase()}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {total > 100 ? (
            <p className="mt-2 text-xs text-muted-foreground">Showing the first 100 of {total}. Search or pick a knowledge base to narrow down.</p>
          ) : null}
          <div className="mt-4 flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setSelected({})}>
              Clear
            </Button>
            <Button
              onClick={() => {
                onChange({ ...scope, docs: Object.entries(selected).map(([id, name]) => ({ id, name })) });
                setOpen(false);
              }}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
