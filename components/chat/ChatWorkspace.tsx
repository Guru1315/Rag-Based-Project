"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, ArrowUp, MoreHorizontal, PanelRight, Pencil, Sparkles, Square, Star, Trash2 } from "lucide-react";
import { DocumentPreviewDialog } from "@/components/documents/DocumentPreviewDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import type { ApiResponse, ChatMessage, ChatStreamEvent, Source } from "@/types";
import { MessageBubble, type UiMessage } from "./MessageBubble";
import { ScopePicker, type Scope } from "./ScopePicker";
import { SourcesPanel, sourceLocation } from "./SourcesPanel";

interface Props {
  conversation: { id: string; title: string; starred: boolean } | null;
  initialMessages: ChatMessage[];
  knowledgeBases: { id: string; name: string }[];
  initialScope: Scope;
  /** True for an existing conversation: its scope can no longer change. */
  locked: boolean;
  readyDocumentCount: number;
}

const STARTER_PROMPTS = [
  "Summarize my documents in simple language.",
  "What are the main points I should remember?",
  "Which document mentions deadlines or dates?",
  "Explain the key terms with examples.",
];

export function ChatWorkspace({ conversation, initialMessages, knowledgeBases, initialScope, locked, readyDocumentCount }: Props) {
  const router = useRouter();

  const [conversationId, setConversationId] = useState<string | null>(conversation?.id ?? null);
  const conversationIdRef = useRef<string | null>(conversation?.id ?? null);
  const [title, setTitle] = useState(conversation?.title ?? "New chat");
  const [starred, setStarred] = useState(conversation?.starred ?? false);
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [openSource, setOpenSource] = useState<Source | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const lastMessageRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scopeLocked = locked || conversationId !== null || messages.length > 0;

  // The same component serves /chat and /chat/[id]. When the user opens a DIFFERENT conversation
  // (or "New Chat"), reset the state. Our own newly created conversation does not trigger a reset.
  useEffect(() => {
    const propId = conversation?.id ?? null;
    if (propId === conversationIdRef.current) return;
    abortRef.current?.abort();
    conversationIdRef.current = propId;
    setConversationId(propId);
    setTitle(conversation?.title ?? "New chat");
    setStarred(conversation?.starred ?? false);
    setMessages(initialMessages);
    setScope(initialScope);
    setInput("");
    setError(null);
    setStreaming(false);
    setActiveMessageId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  // Stop any running answer when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the newest message in view.
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [messages]);

  const lastAssistant = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant"), [messages]);
  const panelMessage = messages.find((m) => m.id === activeMessageId) ?? lastAssistant;
  const panelSources = panelMessage && panelMessage.grounded !== false ? panelMessage.sources : [];
  const followUps = !streaming && lastAssistant?.followUps ? lastAssistant.followUps : [];

  const scopeLabel = useMemo(() => {
    const kbName = scope.kbId ? knowledgeBases.find((k) => k.id === scope.kbId)?.name ?? "Selected knowledge base" : "All my documents";
    if (scope.docs.length === 0) return kbName;
    return scope.docs.length === 1 ? `${kbName} › ${scope.docs[0].name}` : `${kbName} › ${scope.docs.length} documents`;
  }, [scope, knowledgeBases]);

  const run = useCallback(
    async (request: { message?: string; regenerate?: boolean }) => {
      setError(null);
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const stamp = Date.now();
      const assistantId = `local-assistant-${stamp}`;
      const now = new Date().toISOString();

      setMessages((prev) => {
        const next = request.regenerate && prev[prev.length - 1]?.role === "assistant" ? prev.slice(0, -1) : [...prev];
        if (request.message) {
          next.push({ id: `local-user-${stamp}`, role: "user", content: request.message, sources: [], grounded: null, status: "complete", created_at: now });
        }
        next.push({ id: assistantId, role: "assistant", content: "", sources: [], grounded: null, status: "complete", created_at: now, pending: true });
        return next;
      });
      setActiveMessageId(assistantId);

      const patchAssistant = (patch: Partial<UiMessage>) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)));
      const appendAssistant = (text: string) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + text } : m)));
      const dropPending = () => setMessages((prev) => prev.filter((m) => m.id !== assistantId));

      try {
        const isNew = conversationIdRef.current === null;
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            conversationId: conversationIdRef.current ?? undefined,
            knowledgeBaseId: isNew ? scope.kbId || undefined : undefined,
            documentIds: isNew && scope.docs.length > 0 ? scope.docs.map((d) => d.id) : undefined,
            message: request.message,
            regenerate: request.regenerate,
          }),
        });

        // Problems found before streaming starts come back as normal JSON errors.
        if (!response.ok || !response.body) {
          let message = "Something went wrong. Please try again.";
          try {
            const json = (await response.json()) as ApiResponse<unknown>;
            if (!json.ok) message = json.error.message;
          } catch {
            if (response.status === 504) message = "The server took too long to respond. Please try again.";
          }
          dropPending();
          if (request.message && isNew) {
            // Nothing was saved yet: put the text back so the user doesn't lose it.
            setMessages((prev) => prev.filter((m) => m.id !== `local-user-${stamp}`));
            setInput(request.message);
          }
          setError(message);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let failed = false;

        const handle = (event: ChatStreamEvent) => {
          switch (event.type) {
            case "meta":
              if (conversationIdRef.current === null) {
                conversationIdRef.current = event.conversationId;
                setConversationId(event.conversationId);
                setTitle(event.title);
                // Show the real address without reloading (the page keeps its state).
                window.history.replaceState(null, "", `/chat/${event.conversationId}`);
              }
              break;
            case "sources":
              patchAssistant({ sources: event.sources });
              break;
            case "delta":
              appendAssistant(event.text);
              break;
            case "done":
              patchAssistant({
                id: event.messageId || assistantId,
                pending: false,
                grounded: event.grounded,
                followUps: event.followUps,
                ...(event.grounded ? {} : { sources: [] }),
              });
              setActiveMessageId(event.messageId || assistantId);
              break;
            case "error":
              failed = true;
              setError(event.message);
              break;
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline: number;
          while ((newline = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (!line) continue;
            try {
              handle(JSON.parse(line) as ChatStreamEvent);
            } catch {
              /* ignore a malformed line */
            }
          }
        }

        if (failed) {
          setMessages((prev) => prev.filter((m) => !(m.id === assistantId && !m.content)));
          patchAssistant({ pending: false });
        } else {
          patchAssistant({ pending: false });
        }
        // Refresh server data (the sidebar list of conversations).
        router.refresh();
      } catch (e) {
        if (controller.signal.aborted) {
          // "Stop" was pressed: keep the partial answer, or remove an empty placeholder.
          setMessages((prev) => prev.filter((m) => !(m.id === assistantId && !m.content)).map((m) => (m.id === assistantId ? { ...m, pending: false, status: "stopped" } : m)));
        } else {
          dropPending();
          setError(errorMessage(e) === "Failed to fetch" ? "Network error. Check your connection and try again." : errorMessage(e));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [router, scope],
  );

  function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || streaming) return;
    lastMessageRef.current = message;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    void run({ message });
  }

  function retry() {
    if (conversationIdRef.current) void run({ regenerate: true });
    else if (lastMessageRef.current) void run({ message: lastMessageRef.current });
  }

  async function toggleStar() {
    if (!conversationId) return;
    const next = !starred;
    setStarred(next);
    try {
      await api(`/api/conversations/${conversationId}`, { method: "PATCH", body: { starred: next } });
      router.refresh();
    } catch (e) {
      setStarred(!next);
      toast.error(errorMessage(e));
    }
  }

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    if (!conversationId || !renameValue.trim()) return;
    try {
      await api(`/api/conversations/${conversationId}`, { method: "PATCH", body: { title: renameValue } });
      setTitle(renameValue.trim());
      setRenameOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function remove() {
    try {
      await api(`/api/conversations/${conversationId}`, { method: "DELETE" });
      toast.success("Conversation deleted");
      router.push("/chat");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full min-h-0">
      {/* ---------- Conversation ---------- */}
      <section aria-label="Conversation" className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{title}</h1>
            <p className="truncate text-xs text-muted-foreground">Searching: {scopeLabel}</p>
          </div>
          {conversationId ? (
            <>
              <Button variant="ghost" size="icon" onClick={toggleStar} aria-pressed={starred} aria-label={starred ? "Remove from starred" : "Star conversation"}>
                <Star className={cn("h-4 w-4", starred && "fill-warning text-warning")} aria-hidden="true" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Conversation actions">
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onSelect={() => {
                      setRenameValue(title);
                      setRenameOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-danger">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
          <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setPanelOpen(true)} aria-label="Show sources">
            <PanelRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6" aria-live="polite" aria-busy={streaming}>
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {empty ? (
              <div className="py-10 text-center">
                <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Sparkles className="h-6 w-6" aria-hidden="true" />
                </span>
                <h2 className="text-xl font-semibold">Ask about your documents</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Answers come only from the documents in the scope you choose, with sources you can open.
                </p>
                {readyDocumentCount === 0 ? (
                  <div className="mx-auto mt-5 max-w-md rounded-xl bg-warning-bg p-4 text-sm text-warning">
                    You have no indexed documents yet. <Link href="/dashboard#upload" className="font-medium underline">Upload one first</Link>, and wait until it shows “Ready”.
                  </div>
                ) : (
                  <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => send(prompt)}
                        className="rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm hover:border-primary/50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isLast={index === messages.length - 1}
                  busy={streaming}
                  onCite={(source) => {
                    setActiveMessageId(message.id);
                    setOpenSource(source);
                  }}
                  onRegenerate={() => run({ regenerate: true })}
                />
              ))
            )}

            {followUps.length > 0 ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested follow-up questions">
                {followUps.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-left text-xs hover:border-primary/50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : null}

            {error ? (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-danger-bg p-3.5 text-sm text-danger">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{error}</span>
                <Button variant="outline" size="sm" onClick={retry} disabled={streaming}>
                  Retry
                </Button>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ---------- Composer ---------- */}
        <div className="border-t border-border bg-background px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {scopeLocked ? null : (
              <div className="mb-2.5">
                <ScopePicker knowledgeBases={knowledgeBases} scope={scope} onChange={setScope} />
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 focus-within:border-ring"
            >
              <label htmlFor="chat-input" className="sr-only">
                Your question
              </label>
              <textarea
                id="chat-input"
                ref={textareaRef}
                value={input}
                rows={1}
                maxLength={4000}
                placeholder="Ask a question about your documents…"
                disabled={streaming}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={(e) => {
                  // Enter sends, Shift+Enter adds a new line (not while an IME is composing).
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                className="max-h-52 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
              />
              {streaming ? (
                <Button variant="outline" size="icon" onClick={() => abortRef.current?.abort()} aria-label="Stop generating">
                  <Square className="h-4 w-4 fill-current" aria-hidden="true" />
                </Button>
              ) : (
                <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send message">
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </form>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Enter to send · Shift+Enter for a new line · Check important facts in the cited sources.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- Sources (wide screens) ---------- */}
      <aside aria-label="Sources" className="hidden w-80 shrink-0 border-l border-border bg-surface/50 p-4 xl:block">
        <SourcesPanel sources={panelSources} onOpen={setOpenSource} />
      </aside>

      {/* Sources drawer (smaller screens) */}
      <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
        <DialogContent title="Sources" hideTitle side="right">
          <SourcesPanel
            sources={panelSources}
            onOpen={(source) => {
              setPanelOpen(false);
              setOpenSource(source);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* One cited passage */}
      <Dialog open={openSource !== null} onOpenChange={(open) => !open && setOpenSource(null)}>
        <DialogContent
          title={openSource ? `[${openSource.n}] ${openSource.documentTitle}` : "Source"}
          description={openSource ? openSource.path : undefined}
          side="right"
          className="max-w-xl"
        >
          {openSource ? (
            <div className="space-y-4">
              {sourceLocation(openSource) ? <p className="text-sm font-medium">{sourceLocation(openSource)}</p> : null}
              <blockquote className="whitespace-pre-wrap rounded-xl border border-border bg-background/50 p-4 text-sm leading-relaxed">
                {openSource.excerpt}
              </blockquote>
              <Button
                variant="outline"
                onClick={() => {
                  setPreviewDocId(openSource.documentId);
                  setOpenSource(null);
                }}
              >
                Open document preview
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <DocumentPreviewDialog documentId={previewDocId} onOpenChange={(open) => !open && setPreviewDocId(null)} />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent title="Rename conversation">
          <form onSubmit={rename} className="space-y-4">
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} maxLength={200} aria-label="Conversation title" autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim()}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this conversation?"
        description="The conversation and all of its messages will be permanently deleted."
        onConfirm={remove}
      />
    </div>
  );
}
