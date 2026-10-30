# AGENTS.md — DocuMind AI

## Project
DocuMind AI is a RAG-based document chat SaaS. The full specification is in `docs/SPEC.md`.
I am a beginner software engineering student, so keep code simple, readable, and commented where logic is non-obvious.

## Stack (do not change without asking)
- Next.js (App Router) + React + TypeScript
- Tailwind CSS + shadcn/ui + Lucide icons
- Later phases: Supabase (Auth, Storage, Postgres + pgvector), Google Gemini API, Zod

## How to work
1. Read ONLY the sections of `docs/SPEC.md` relevant to the current phase.
2. Before coding, produce a short plan listing files you will create or change. Wait for approval on large changes.
3. Implement one phase at a time. Do not build features from later phases.
4. Preserve existing code. Do not rewrite files blindly.
5. Prefer small, reusable components. Folder structure:
   - `app/` routes and layouts
   - `components/ui/` shadcn components
   - `components/` app components (grouped by feature)
   - `lib/data/` typed data layer (mock now, Supabase later)
   - `lib/mock/` mock data, clearly labelled
   - `lib/utils/`, `types/`
6. After each task run: `npm run lint`, `npm run typecheck`, `npm run build`. Fix errors before finishing.
7. For UI work, open the app in the browser, check desktop (1440px), tablet (768px) and mobile (375px), and fix visual problems.
8. End every task with a summary: files changed, commands run, what works, what is incomplete.

## Honesty rules
- NEVER show fake statistics or fake activity as real. Use empty states, or data clearly labelled as sample/mock.
- NEVER claim a feature works if it is only UI. Label mock-backed features in code comments and in `docs/DECISIONS.md`.
- NEVER claim certifications or security guarantees on the landing page.
- Only list file formats that will actually be implemented: PDF, DOCX, TXT, Markdown, CSV, XLSX, PPTX.
- Every visible primary button must do something real (navigate, open a dialog, or act). No dead links.
- Statuses (Queued, Uploading, Extracting, Chunking, Indexing, Ready, Failed) must come from a state machine, never a hard-coded timer pretending to be real processing.

## UI rules
- Default theme: dark (deep navy/charcoal, indigo/violet accent). Full light theme + toggle.
- Accessible: semantic HTML, keyboard support, visible focus rings, ARIA labels, reduced-motion support.
- Skeletons only for genuinely loading data.
- Render Markdown safely (sanitized) to prevent XSS.

## Security rules
- Never put secrets in client code or commit `.env` files. Only `.env.example` with placeholders.
- AI calls and secret-dependent work happen server-side only.

## Decisions log
Append notable architectural choices (and why) to `docs/DECISIONS.md`.
