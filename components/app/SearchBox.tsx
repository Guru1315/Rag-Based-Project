"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Library, Loader2, MessageSquare, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Results {
  knowledgeBases: { id: string; name: string }[];
  documents: { id: string; file_name: string; knowledge_bases?: { name: string } | null }[];
  conversations: { id: string; title: string }[];
}

export function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const json = await response.json();
        if (json.ok) setResults(json.data as Results);
      } catch {
        // Aborted or offline: keep the previous results.
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const close = () => {
    setOpen(false);
  };
  const empty =
    results && results.knowledgeBases.length + results.documents.length + results.conversations.length === 0;

  return (
    <div
      className="relative w-full max-w-md"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search knowledge bases, documents, chats…"
        aria-label="Search your knowledge bases, documents and chats"
        className="pl-9"
      />
      {loading ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" /> : null}

      {open && q.trim().length >= 2 && results ? (
        <div className="animate-fade-in absolute left-0 right-0 top-12 z-40 max-h-96 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-card">
          {empty ? <p className="px-3 py-4 text-sm text-muted-foreground">No matches for “{q.trim()}”.</p> : null}

          {results.knowledgeBases.map((kb) => (
            <Result key={kb.id} href={`/knowledge-bases/${kb.id}`} icon={Library} title={kb.name} hint="Knowledge base" onClick={close} />
          ))}
          {results.documents.map((doc) => (
            <Result
              key={doc.id}
              href={`/documents?q=${encodeURIComponent(doc.file_name)}`}
              icon={FileText}
              title={doc.file_name}
              hint={doc.knowledge_bases?.name ?? "Document"}
              onClick={close}
            />
          ))}
          {results.conversations.map((c) => (
            <Result key={c.id} href={`/chat/${c.id}`} icon={MessageSquare} title={c.title} hint="Conversation" onClick={close} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Result({
  href,
  icon: Icon,
  title,
  hint,
  onClick,
}: {
  href: string;
  icon: typeof FileText;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>
    </Link>
  );
}
