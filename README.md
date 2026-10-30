# DocuMind AI

**Your knowledge. One conversation away.**

DocuMind AI lets you sign in with Google, upload documents (or a whole folder), organise them into private knowledge bases, and ask questions. Answers are written from **your own documents** using Retrieval-Augmented Generation (RAG), and every answer shows the passages it used. If your documents don't contain the answer, the app says so instead of guessing.

> **Honest status.** The code in this project was written without access to the npm registry or to live Supabase / Google / Gemini services, so it has **not been run end-to-end yet**. The pure logic (chunking, table splitting, path sanitising, prompt building, PPTX text extraction) was executed and checked. Everything that needs `npm install`, a database, Google sign-in or the Gemini API is still to be verified by you — follow [docs/TESTING.md](docs/TESTING.md). Expect to fix a few small things on first run, and please report build errors so they can be fixed.

---

## What is in the box

| Area | What it does |
| --- | --- |
| Landing page | Hero, product illustration, how it works, features, formats, security statements, CTA |
| Auth | Google sign-in via Supabase Auth, protected routes, session refresh in middleware, sign-out |
| Dashboard | Real counts, upload area, recent documents / knowledge bases / conversations, onboarding |
| Knowledge bases | Create, rename, delete (with confirmation), search, sort, open, chat scoped to one |
| Documents | Search, filter by type / status / knowledge base, sort, pagination, star, preview text, retry, re-index, delete |
| Upload | Drag and drop, multi-select, **folder upload** (paths kept), SHA-256 duplicate detection, real upload progress, real processing status |
| RAG pipeline | Store → extract → chunk → embed (Gemini, 768-d) → store in pgvector → mark **Ready** only after everything is saved |
| Chat | Streaming answers, Markdown + code highlighting, citations you can open, copy, regenerate, stop, retry, follow-up suggestions, history, rename, delete, star |
| Settings | Profile, theme, real usage counts, data and privacy, bulk delete with typed confirmation |

**Supported formats (parsed and indexed):** PDF (text-based), DOCX, TXT, Markdown, CSV, XLSX, PPTX.
**Not supported:** scanned PDFs / images (no OCR), ZIP archives, other formats.

---

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Radix UI primitives · Lucide icons · Supabase (Auth, Postgres, Storage) · pgvector · Google Gemini API (`@google/genai`) · Zod · Vitest.

Parsers: `unpdf` (PDF), `mammoth` (DOCX), `exceljs` (XLSX), `jszip` (PPTX), `papaparse` (CSV).

---

## Setup in simple steps

You need: **Node.js 20+**, a free **Supabase** account, a **Google Cloud** account (for the sign-in button), a **Google AI Studio** API key (for Gemini), and optionally GitHub + Vercel to deploy.

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**. Pick a region close to you.
2. When it is ready open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** (or the newer *publishable* key) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. ⚠️ Never put the `service_role` / secret key anywhere in this project. The app does not need it.

### 3. Create the database tables

Open **SQL Editor → New query**, paste the whole file
`supabase/migrations/20261028000000_init.sql` and press **Run**.
(Or use the Supabase CLI: `supabase link` then `supabase db push`.)

This creates the tables, Row Level Security policies, the vector search function `match_chunks`, and the **private** `documents` storage bucket with owner-only storage policies.

Then run `supabase/tests/rls_isolation.sql` the same way. It creates two fake users inside a transaction, checks that user B cannot read or change user A's data (including through vector search), prints `ALL RLS ISOLATION CHECKS PASSED`, and rolls everything back. **If it raises an error, do not deploy.**

### 4. Set up Google sign-in

1. Go to <https://console.cloud.google.com/> and create or select a project.
2. **APIs & Services → OAuth consent screen**: choose *External*, fill in the app name and your email, and add yourself as a test user while the app is in testing mode.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type **Web application**.
4. Under **Authorized redirect URIs** add exactly:
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
   (your project ref is the part before `.supabase.co` in the Project URL).
5. Copy the **Client ID** and **Client secret**.
6. In Supabase go to **Authentication → Providers → Google**, switch it on, paste the Client ID and secret, and save.
7. In Supabase go to **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` (change to your Vercel URL after deploying)
   - **Redirect URLs**: add `http://localhost:3000/**` and later `https://YOUR-APP.vercel.app/**`

> The Google client secret is entered only in the Supabase dashboard. It is never stored in this project.

### 5. Get a Gemini API key

1. Open <https://aistudio.google.com/apikey> and create a key.
2. Put it in `.env.local` as `GEMINI_API_KEY`. It is read **only on the server**.
3. Model names can change over time. They are configurable: `GEMINI_CHAT_MODEL` (default `gemini-2.5-flash`) and `GEMINI_EMBEDDING_MODEL` (default `gemini-embedding-001`). Embeddings are requested with `outputDimensionality = 768` to match the database column `vector(768)`.

### 6. Run it

```bash
npm run dev
```

Open <http://localhost:3000>, click **Get Started Free**, sign in, create a knowledge base, upload a file and wait for **Ready**, then open a chat.

> Folder upload and file hashing need a secure context. `http://localhost` works; for other devices use HTTPS (for example your Vercel URL).

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build / run it |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm test` | Unit tests (Vitest): chunker, parsers (generated PPTX/XLSX files), validation, prompt building, utilities |

---

## Deploying to Vercel

1. Push the project to a GitHub repository (`.env.local` is git-ignored, so no secrets are committed).
2. On <https://vercel.com/new> import the repository. Framework: **Next.js** (auto-detected).
3. Add these **Environment Variables** (Production and Preview):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, and optionally the model / limit variables from `.env.example`.
4. Deploy. Then copy your production URL and add it in Supabase → **Authentication → URL Configuration** (Site URL and `https://YOUR-APP.vercel.app/**` in Redirect URLs).
5. If you want Preview deployments to sign in too, add `https://*-YOUR-TEAM.vercel.app/**` as a redirect URL.
6. In Vercel → Settings → Functions, choose a region close to your Supabase region.

**Why uploads work on Vercel:** files go **directly from the browser to Supabase Storage**, so they do not hit Vercel's 4.5 MB request-body limit. The server only receives small JSON requests.

**Function time limit:** indexing (`/api/documents/:id/process`) and chat (`/api/chat`) declare `maxDuration = 60`. That is the maximum on the Hobby plan; larger documents may need a paid plan or the background-queue upgrade described below.

---

## How it works

```
Browser ──(1) register file details──▶ POST /api/documents          (validate, duplicate check, create row "uploading")
Browser ──(2) upload bytes ──────────▶ Supabase Storage (private)   (owner-only storage policy, real progress)
Browser ──(3) process ───────────────▶ POST /api/documents/:id/process
                                         claim job → download → extract text → chunk → embed (Gemini)
                                         → insert chunks + vectors → status "ready"
                                         (status written to the DB at every stage; the UI polls it)

Question ─▶ POST /api/chat
              rate limit → embed question → match_chunks() in Postgres (user + KB + document filters INSIDE the query)
              → no passage above the similarity threshold?  → "I couldn't find enough information…" (model not called)
              → otherwise Gemini answers using ONLY the numbered passages → streamed as NDJSON
              → answer + the real retrieved passages are saved; citations [n] map to those passages
```

Folder layout:

```
app/                 routes: landing, login, (app)/ dashboard, knowledge-bases, documents, chat, starred, settings, api/*
components/          ui/ (buttons, dialogs…), app/ (shell, search), documents/, chat/, settings/, shared/
lib/supabase/        browser, server and middleware clients (no service-role key anywhere)
lib/parsing/         pdf, docx, xlsx, pptx, csv, text parsers (+ safe error messages)
lib/rag/             chunker, embeddings, retrieval, prompt
lib/pipeline/        process-document.ts (the indexing pipeline)
lib/validation.ts    Zod schemas for every write
supabase/migrations/ SQL schema, RLS, vector function, storage policies
supabase/tests/      RLS isolation test (SQL)
tests/               Vitest unit tests
docs/                SPEC.md, DECISIONS.md, TESTING.md
```

Key numbers (change in `lib/server-config.ts` / `.env`): chunk size 1800 characters with 250 overlap (config version `v1`), top-k 8, minimum similarity 0.5, 10 questions per minute per user, 200 documents per user, 20 MB per file.

---

## Security notes

Implemented:
- Row Level Security on every table; **all** queries run as the signed-in user, so RLS is enforced by the database. There is no service-role key.
- `match_chunks` filters on `auth.uid()`, knowledge base and document ids **inside** the SQL function (and RLS applies as well).
- Private storage bucket; policies only allow access to `<your-user-id>/…`.
- File type allow-list, size limit, magic-byte check (PDF / ZIP-based Office files), empty / corrupted / password-protected / scanned-PDF messages.
- Relative paths from folder uploads are sanitised (no `..`); storage file names are sanitised.
- Markdown from the model is rendered without raw HTML and without images; links are `http(s)` only with `rel="noopener noreferrer"`.
- Prompt-injection defence: documents are wrapped as untrusted data, closing tags inside documents are stripped, and the system prompt tells the model to ignore instructions found in documents. (This reduces risk; it cannot guarantee safety.)
- Zod validation on all request bodies; consistent `{ ok, data | error }` responses; no stack traces sent to users; logs avoid document content.
- Redirect targets after login are restricted to same-site paths; login error text is chosen from a fixed list.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).
- Deleting a document / knowledge base removes the stored files first, then the rows (chunks cascade).

**Still to do before real production use:**
- Add a strict Content-Security-Policy and tune it for your deployment.
- Rate limiting is per user and database-based; add IP-level / edge rate limiting (for example Vercel Firewall or Upstash) against abuse.
- Add malware scanning for uploads and monitoring/alerting.
- Complete account deletion (removing the Supabase auth user needs a server-side admin action).
- Have the RLS policies and storage policies reviewed independently and re-run `supabase/tests/rls_isolation.sql` after every schema change.
- Use Supabase Pro backups if the data matters.

---

## Known limitations

- **No OCR.** Scanned PDFs are rejected with a clear message.
- **No ZIP upload** (optional in the brief; skipped rather than shipped half-safe). Folder upload works through the browser.
- **Indexing runs inside one serverless request** (≤ 60 s). Very large files may time out; the document then shows *Failed* or stays in a working state and can be retried (a stuck job can be picked up again after 5 minutes). A durable queue (Supabase Queues / Inngest / Trigger.dev) is the proper next step.
- **Server-side processing cannot be cancelled** once it starts (uploads can).
- Retrieval is **vector-only** (no keyword / hybrid search). With the HNSW index and filters, very large multi-user tables may need `hnsw.iterative_scan` (pgvector ≥ 0.8) for best recall.
- Follow-up question suggestions cost one extra Gemini call per answer and are not saved with history.
- Citation numbers inside a streamed answer become clickable once the sources arrive; the model could still omit a citation, so the sources panel lists every retrieved passage.
- Usage page shows counts from your data only; Gemini token usage is not recorded.
- If you change `chunk` settings or the embedding model, bump the config version and use **Re-index** on documents. If the embedding **dimension** changes, you also need a migration for `vector(768)`.

---

## Troubleshooting

| Problem | Try this |
| --- | --- |
| Login page says sign-in isn't configured | `.env.local` is missing the two Supabase variables; restart `npm run dev` after editing it |
| Google says `redirect_uri_mismatch` | The redirect URI in Google Cloud must be exactly `https://<ref>.supabase.co/auth/v1/callback` |
| After Google sign-in you land back on `/login?error=failed` | Check Supabase → Auth → URL Configuration contains your site URL and `/**` redirect |
| Upload row fails with "Upload was not allowed" | The migration (storage policies) was not run, or your session expired; sign in again |
| Document ends in **Failed**: "AI service is not configured" | `GEMINI_API_KEY` is missing on the server (or in the Vercel env vars) |
| Document ends in **Failed**: "Processing failed" | Usually a Gemini quota / model-name problem; check the server log and your model env vars, then **Retry processing** |
| "No selectable text … scanned PDF" | The PDF is images only; OCR it first (for example with a PDF tool) and upload again |
| Chat always says it couldn't find enough information | Wait for documents to be **Ready**; try lowering `RAG_MIN_SIMILARITY` (e.g. 0.4); check the chat scope is the right knowledge base |
| `crypto.subtle` is undefined | You opened the app over plain HTTP on a non-localhost address; use HTTPS or localhost |
| Build error about a type | Run `npm run typecheck` and send the message; some packages' types differ slightly between versions |
