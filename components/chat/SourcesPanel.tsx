"use client";

import { FileText, Quote } from "lucide-react";
import type { Source } from "@/types";

export function sourceLocation(source: Pick<Source, "page" | "section">): string {
  return [source.page ? `Page ${source.page}` : null, source.section].filter(Boolean).join(" · ");
}

/** Lists the passages that were retrieved for an answer. Each one opens the full passage. */
export function SourcesPanel({ sources, onOpen }: { sources: Source[]; onOpen: (source: Source) => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Quote className="h-4 w-4 text-primary" aria-hidden="true" />
        Sources
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">Passages from your documents that were used for the selected answer.</p>

      {sources.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Sources appear here when an answer is based on your documents.</p>
      ) : (
        <ul className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {sources.map((source) => (
            <li key={source.chunkId}>
              <button
                type="button"
                onClick={() => onOpen(source)}
                className="w-full rounded-xl border border-border bg-background/50 p-3 text-left hover:border-primary/50"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/15 px-1 text-xs font-semibold text-primary">
                    {source.n}
                  </span>
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate text-sm font-medium">{source.documentTitle}</span>
                </span>
                {sourceLocation(source) ? <span className="mt-1.5 block text-xs text-muted-foreground">{sourceLocation(source)}</span> : null}
                <span className="mt-2 line-clamp-3 block text-xs leading-relaxed text-muted-foreground">{source.excerpt}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
