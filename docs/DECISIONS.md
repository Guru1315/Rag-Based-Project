# Decisions log
Short notes on notable choices and why they were made.

## Environment constraint (important)
The code was written in a sandbox where the npm registry was blocked (HTTP 403 from the egress proxy) and no live services were reachable. Consequently the project was written by hand instead of with `create-next-app` / the shadcn CLI, dependencies were never installed, and **nothing that needs them has been executed**. Only pure-logic modules were run directly with Node. See README → Honest status.

## Stack
- **Next.js 15 App Router + React 19 + Tailwind 4** as requested. Tailwind 4 uses CSS tokens (`app/globals.css`) so dark/light themes are one set of variables.
- **No shadcn CLI.** UI primitives (`components/ui/*`) are small hand-written wrappers around Radix Dialog and Dropdown Menu in the shadcn style. This avoids ~12 extra Radix packages and keeps the code readable.
- **`@google/genai`** (the current Google SDK) for both embeddings and streaming generation.

## Security model
- **No service-role key at all.** Every server query runs as the signed-in user with RLS. Storage deletes and chunk inserts also go through RLS policies. This removes the biggest foot-gun (a privileged key leaking or a missing filter).
- `match_chunks` is `SECURITY INVOKER`, filters on `auth.uid()` itself, and takes the knowledge-base / document filters as parameters, so the filtering happens in the database query.
- Uploads go browser → Supabase Storage directly (works around Vercel's 4.5 MB body limit and keeps large files off the function). The server never trusts the browser's claims: it re-checks type, size limit and ownership at registration, then re-checks size and magic bytes after downloading.

## Processing and status
- No separate job table. `documents.status` **is** the job state; the server writes `extracting → chunking → indexing → ready|failed` as it works and the UI polls it. "Optional processing-job records" were therefore not added.
- Claiming a job is one atomic `UPDATE … WHERE status IN (…)`; a job stuck in a working state for >5 minutes can be reclaimed, which handles function time-outs without a queue.
- A document is `ready` only after **all** chunks and embeddings were inserted. Any failure deletes partial chunks and records an error code and message.
- Processing runs inside one request (≤ 60 s) because a durable queue is outside the free Vercel/Supabase setup. This is the main scaling limit (README).

## RAG
- Embeddings: `gemini-embedding-001` with `outputDimensionality = 768`, vectors L2-normalised (needed for truncated dimensions), cosine distance with an HNSW index. Document chunks use `RETRIEVAL_DOCUMENT`, questions `RETRIEVAL_QUERY`.
- Chunking: paragraph → line → sentence → hard-cut; chunks never cross pages / slides / sheets so page citations stay correct; 250-character overlap; spreadsheets are split into row groups that each repeat the header.
- No evidence (no chunk above `RAG_MIN_SIMILARITY`) → the model is **not called** and a fixed sentence is returned, so it cannot invent an answer.
- Citations are numbers `[n]` that map to the retrieved chunks saved with the message. The UI only turns `[n]` into a link when `n` is a real source; the sources panel lists all retrieved passages, and no "N sources" count is shown as a quality signal.
- Short follow-up questions are searched together with the previous question so "and the second one?" still retrieves something.

## Streaming
- `/api/chat` streams newline-delimited JSON (`meta`, `sources`, `delta`, `done`, `error`). Plain `fetch` + a reader on the client, no extra library.
- One page component serves `/chat` and `/chat/[id]` (optional catch-all route) so the component is not remounted when a new conversation receives its id mid-stream.

## Not implemented (on purpose)
- OCR, ZIP archives, hybrid keyword search, background queue, IP rate limiting, auth-user deletion. Each is listed in README → Known limitations rather than half-done.
