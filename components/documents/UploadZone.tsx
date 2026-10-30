"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, FolderUp, Plus, RotateCw, UploadCloud, X } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CreateKnowledgeBaseDialog } from "@/components/app/CreateKnowledgeBaseDialog";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { ApiClientError, api, errorMessage } from "@/lib/client-api";
import {
  FORMAT_LABELS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  SUPPORTED_EXTENSIONS,
  type DocumentStatus,
} from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import { fromDataTransfer, fromFileList, sha256Hex, type CollectedFile } from "@/lib/upload/collect";
import { uploadToStorage } from "@/lib/upload/storage";
import { cn, fileExtension, formatBytes } from "@/lib/utils";

interface Item {
  key: string;
  file: File;
  path: string;
  kbId: string;
  /** Same values as the database statuses. "queued" = waiting in the browser. */
  status: DocumentStatus;
  progress: number;
  docId?: string;
  error?: string;
  retriable?: boolean;
}

/** Errors worth retrying. Parsing errors (corrupted, password-protected...) will fail again. */
const RETRIABLE_CODES = new Set([
  "NETWORK",
  "TIMEOUT",
  "BAD_RESPONSE",
  "STORAGE_ERROR",
  "STORAGE_DENIED",
  "FILE_MISSING",
  "PROCESSING_FAILED",
  "AI_NOT_CONFIGURED",
  "ALREADY_PROCESSING",
  "UNKNOWN",
]);

const MAX_FILES_PER_BATCH = 100;
const CONCURRENCY = 2;

interface KnowledgeBaseOption {
  id: string;
  name: string;
}

export function UploadZone({
  knowledgeBases,
  fixedKnowledgeBaseId,
}: {
  knowledgeBases: KnowledgeBaseOption[];
  /** When set, the upload always goes to this knowledge base (no selector). */
  fixedKnowledgeBaseId?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [created, setCreated] = useState<KnowledgeBaseOption[]>([]);
  const options = useMemo(
    () => [...knowledgeBases, ...created.filter((c) => !knowledgeBases.some((k) => k.id === c.id))],
    [knowledgeBases, created],
  );
  const [kbId, setKbId] = useState(fixedKnowledgeBaseId ?? knowledgeBases[0]?.id ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const aborts = useRef(new Map<string, AbortController>());
  const cancelled = useRef(new Set<string>());

  // If the list of knowledge bases changes (e.g. the first one was just created), pick one.
  useEffect(() => {
    if (!kbId && options[0]) setKbId(options[0].id);
  }, [kbId, options]);

  const busy = items.some((i) => ["queued", "uploading", "extracting", "chunking", "indexing"].includes(i.status));

  // Warn before closing the tab while files are still being uploaded or processed.
  useEffect(() => {
    if (!busy) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [busy]);

  const update = useCallback((key: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }, []);

  /** The real pipeline for one file: hash -> register -> upload -> process (server updates the status). */
  const processItem = useCallback(
    async (item: Item) => {
      if (cancelled.current.has(item.key)) return;
      const controller = new AbortController();
      aborts.current.set(item.key, controller);
      let docId: string | undefined = item.docId;
      let poller: ReturnType<typeof setInterval> | undefined;

      try {
        update(item.key, { status: "uploading", progress: 0, error: undefined, retriable: undefined });

        const contentHash = await sha256Hex(item.file);
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

        // 1. Register: the server validates the file details and creates the record.
        const registered = await api<{ id: string; storagePath: string }>("/api/documents", {
          body: {
            knowledgeBaseId: item.kbId,
            fileName: item.file.name,
            relativePath: item.path,
            sizeBytes: item.file.size,
            mimeType: item.file.type || null,
            contentHash,
            extension: fileExtension(item.file.name),
          },
          signal: controller.signal,
        });
        docId = registered.id;
        update(item.key, { docId });

        // 2. Upload to private storage with real progress.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new ApiClientError("STORAGE_DENIED", "Your session expired. Please sign in again.");
        await uploadToStorage({
          storagePath: registered.storagePath,
          file: item.file,
          accessToken: session.access_token,
          onProgress: (progress) => update(item.key, { progress }),
          signal: controller.signal,
        });

        // 3. Process on the server. While it runs we read the REAL status from the database.
        update(item.key, { status: "extracting", progress: 100 });
        poller = setInterval(async () => {
          try {
            const rows = await api<{ id: string; status: DocumentStatus }[]>(`/api/documents/status?ids=${docId}`);
            const status = rows[0]?.status;
            if (status && ["extracting", "chunking", "indexing"].includes(status)) update(item.key, { status });
          } catch {
            /* polling is best-effort */
          }
        }, 1500);

        await api(`/api/documents/${docId}/process`, { method: "POST" });
        update(item.key, { status: "ready", progress: 100 });
      } catch (error) {
        if (cancelled.current.has(item.key)) {
          // The user cancelled: remove the half-finished record.
          if (docId) await api(`/api/documents/${docId}`, { method: "DELETE" }).catch(() => undefined);
          return;
        }
        const code = error instanceof ApiClientError ? error.code : "UNKNOWN";
        update(item.key, {
          status: "failed",
          error: errorMessage(error),
          retriable: RETRIABLE_CODES.has(code),
        });
      } finally {
        if (poller) clearInterval(poller);
        aborts.current.delete(item.key);
      }
    },
    [supabase, update],
  );

  /** Run a list of items with a small number of files at the same time. */
  const runItems = useCallback(
    async (list: Item[]) => {
      const queue = [...list];
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        for (;;) {
          const next = queue.shift();
          if (!next) return;
          await processItem(next);
        }
      });
      await Promise.all(workers);
      router.refresh(); // update the document lists on the page
    },
    [processItem, router],
  );

  const addFiles = useCallback(
    (collected: CollectedFile[]) => {
      if (!kbId) {
        toast.error("Choose or create a knowledge base first.");
        return;
      }
      const next: Item[] = [];
      let skipped = 0;
      let tooMany = 0;

      for (const { file, path } of collected) {
        const fromFolder = path.includes("/");
        const ext = fileExtension(file.name);
        const supported = (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);

        // Hidden files and unsupported files inside a folder are skipped quietly (and counted).
        if (file.name.startsWith(".") || (fromFolder && !supported)) {
          skipped++;
          continue;
        }
        if (next.length >= MAX_FILES_PER_BATCH) {
          tooMany++;
          continue;
        }

        let problem: string | undefined;
        if (!supported) problem = `".${ext || "?"}" files are not supported.`;
        else if (file.size === 0) problem = "The file is empty.";
        else if (file.size > MAX_UPLOAD_BYTES) problem = `The file is larger than ${MAX_UPLOAD_MB} MB.`;

        const key = `${path}:${file.size}:${file.lastModified}`;
        const duplicate =
          items.some((i) => i.key === key && i.kbId === kbId) || next.some((i) => i.key === key);
        if (duplicate) {
          skipped++;
          continue;
        }

        next.push({
          key,
          file,
          path,
          kbId,
          status: problem ? "failed" : "queued",
          progress: 0,
          error: problem,
          retriable: problem ? false : undefined,
        });
      }

      if (skipped > 0) toast.info(`Skipped ${skipped} file${skipped === 1 ? "" : "s"} (unsupported type, hidden or already added).`);
      if (tooMany > 0) toast.warning(`Only ${MAX_FILES_PER_BATCH} files can be added at once. ${tooMany} were left out.`);
      if (next.length === 0) return;

      setItems((prev) => [...prev, ...next]);
      void runItems(next.filter((i) => i.status === "queued"));
    },
    [items, kbId, runItems],
  );

  function retry(item: Item) {
    cancelled.current.delete(item.key);
    update(item.key, { status: "queued", error: undefined, progress: 0 });
    void runItems([{ ...item, status: "queued", error: undefined }]);
  }

  /** Cancel (while queued/uploading) or dismiss a row. */
  function remove(item: Item) {
    if (item.status === "queued" || item.status === "uploading") {
      cancelled.current.add(item.key);
      aborts.current.get(item.key)?.abort();
    }
    setItems((prev) => prev.filter((i) => i.key !== item.key));
  }

  async function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    try {
      addFiles(await fromDataTransfer(event.dataTransfer));
    } catch {
      toast.error("Could not read the dropped files.");
    }
  }

  const finished = items.filter((i) => i.status === "ready" || i.status === "failed").length;

  return (
    <section aria-labelledby="upload-heading" className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="upload-heading" className="text-lg font-semibold">
            Upload documents
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Files are stored privately and indexed so you can chat with them.
          </p>
        </div>

        {fixedKnowledgeBaseId ? null : (
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="upload-kb" className="mb-1">
                Knowledge base
              </Label>
              <Select
                id="upload-kb"
                value={kbId}
                onChange={(e) => setKbId(e.target.value)}
                className="w-56 max-w-full"
                disabled={options.length === 0}
              >
                {options.length === 0 ? <option value="">No knowledge bases yet</option> : null}
                {options.map((kb) => (
                  <option key={kb.id} value={kb.id}>
                    {kb.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="outline" onClick={() => setCreateOpen(true)} aria-label="Create a new knowledge base">
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "mt-5 flex flex-col items-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors",
          dragging ? "border-primary bg-primary/10" : "border-border bg-background/40",
        )}
      >
        <UploadCloud className="h-9 w-9 text-primary" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium">Drag and drop files or a folder here</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {SUPPORTED_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")} · up to {MAX_UPLOAD_MB} MB each
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => fileInput.current?.click()} disabled={!kbId}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            Choose files
          </Button>
          <Button variant="outline" onClick={() => folderInput.current?.click()} disabled={!kbId}>
            <FolderUp className="h-4 w-4" aria-hidden="true" />
            Choose folder
          </Button>
        </div>
        {!kbId ? <p className="mt-3 text-xs text-warning">Create a knowledge base first to enable uploads.</p> : null}

        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept={SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(",")}
          aria-label="Choose files to upload"
          onChange={(e) => {
            addFiles(fromFileList(e.target.files));
            e.target.value = "";
          }}
        />
        <input
          ref={folderInput}
          type="file"
          hidden
          aria-label="Choose a folder to upload"
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(e) => {
            addFiles(fromFileList(e.target.files));
            e.target.value = "";
          }}
        />
      </div>

      {/* Queue */}
      {items.length > 0 ? (
        <div className="mt-5">
          <p className="sr-only" role="status" aria-live="polite">
            {finished} of {items.length} files finished.
          </p>
          <ul className="space-y-2">
            {items.map((item) => (
              <UploadRow key={item.key} item={item} onRetry={() => retry(item)} onRemove={() => remove(item)} />
            ))}
          </ul>
          {!busy ? (
            <div className="mt-3 text-right">
              <Button variant="ghost" size="sm" onClick={() => setItems([])}>
                Clear list
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Keep this tab open until processing finishes. Processing on the server cannot be cancelled once it starts.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Supported: {SUPPORTED_EXTENSIONS.map((e) => FORMAT_LABELS[e]).join(" · ")}
        </p>
      )}

      <CreateKnowledgeBaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(kb) => {
          setCreated((prev) => [...prev, kb]);
          setKbId(kb.id);
        }}
      />
    </section>
  );
}

function UploadRow({ item, onRetry, onRemove }: { item: Item; onRetry: () => void; onRemove: () => void }) {
  const hasFolder = item.path.includes("/");
  const cancellable = item.status === "queued" || item.status === "uploading";
  const processing = ["extracting", "chunking", "indexing"].includes(item.status);

  return (
    <li className="rounded-xl border border-border bg-background/50 p-3">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={item.path}>
            {item.file.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {fileExtension(item.file.name).toUpperCase() || "FILE"} · {formatBytes(item.file.size)}
            {hasFolder ? ` · ${item.path.slice(0, item.path.lastIndexOf("/"))}` : ""}
          </p>
        </div>
        <StatusBadge status={item.status} />
        {item.status === "failed" && item.retriable ? (
          <Button variant="ghost" size="icon" onClick={onRetry} aria-label={`Retry ${item.file.name}`}>
            <RotateCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
        {!processing ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={cancellable ? `Cancel ${item.file.name}` : `Dismiss ${item.file.name}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {item.status === "uploading" ? (
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label={`Upload progress for ${item.file.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={item.progress}
        >
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${item.progress}%` }} />
        </div>
      ) : null}

      {item.status === "failed" && item.error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {item.error}
        </p>
      ) : null}
    </li>
  );
}
