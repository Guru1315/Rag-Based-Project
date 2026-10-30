"use client";

import { AlertTriangle, Check, Copy, FileText, Info, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/shared/Markdown";
import { Button } from "@/components/ui/button";
import type { ChatMessage, Source } from "@/types";
import { sourceLocation } from "./SourcesPanel";

export type UiMessage = ChatMessage & { pending?: boolean; followUps?: string[] };

export function MessageBubble({
  message,
  isLast,
  busy,
  onCite,
  onRegenerate,
}: {
  message: UiMessage;
  isLast: boolean;
  busy: boolean;
  onCite: (source: Source) => void;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm text-primary-foreground sm:max-w-[75%]">
          {message.content}
        </div>
      </div>
    );
  }

  const openCitation = (n: number) => {
    const source = message.sources.find((s) => s.n === n);
    if (source) onCite(source);
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy to the clipboard.");
    }
  }

  const waiting = message.pending && !message.content;
  const notGrounded = message.grounded === false;

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3.5 sm:px-5">
        {waiting ? (
          <p className="animate-pulse-soft text-sm text-muted-foreground" role="status">
            {message.sources.length === 0 ? "Searching your documents…" : "Writing the answer…"}
          </p>
        ) : (
          <Markdown content={message.content} validCitations={message.sources.map((s) => s.n)} onCite={openCitation} />
        )}

        {notGrounded && !message.pending ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>No supporting passages were found, so this reply is not based on your documents.</span>
          </p>
        ) : null}
        {message.status === "stopped" ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Generation was stopped before it finished.
          </p>
        ) : null}
      </div>

      {/* Citations: only real retrieved passages are listed */}
      {!notGrounded && message.sources.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Sources for this answer" role="group">
          {message.sources.map((source) => (
            <button
              key={source.chunkId}
              type="button"
              onClick={() => onCite(source)}
              title={sourceLocation(source) || undefined}
              className="inline-flex max-w-56 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs hover:border-primary/50"
            >
              <span className="font-semibold text-primary">{source.n}</span>
              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{source.documentTitle}</span>
              {source.page ? <span className="shrink-0 text-muted-foreground">p.{source.page}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {!message.pending ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy answer">
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          {isLast ? (
            <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={busy} aria-label="Regenerate answer">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Regenerate
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
