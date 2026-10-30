# Phase 1 prompt — paste into Antigravity (Planning mode)

Read `AGENTS.md` and sections 3 (Visual design), 16 (Accessibility) and 18 (Project structure) of `docs/SPEC.md`.

Implement **Phase 1: Foundation and design system** only. Do not build the landing page, auth, dashboard or backend yet.

First, inspect the workspace and give me a short plan listing the files you will create. Then implement:

1. Scaffold Next.js (App Router) + TypeScript + Tailwind in the current folder (skip if already present). Add scripts: `lint`, `typecheck` (tsc --noEmit), `build`.
2. Initialize shadcn/ui and add: button, dialog, dropdown-menu, input, textarea, skeleton, sonner (toasts), badge, tooltip, separator, sheet, avatar.
3. Theme system with next-themes:
   - Dark theme is the default; complete light theme; theme toggle component.
   - Define CSS variable tokens: deep navy/charcoal surfaces, indigo/violet accent, readable high-contrast text, refined borders, rounded corners, subtle shadows.
   - Respect `prefers-reduced-motion`.
4. Fonts: a clean modern sans (e.g. Inter or Geist) via `next/font`.
5. `components/brand/Logo.tsx`: a clean document-inspired mark with a subtle sparkle motif (inline SVG), plus the wordmark "DocuMind AI". Support a compact (icon-only) variant.
6. Shared components in `components/shared/`: `EmptyState`, `PageHeader`, `LoadingSkeleton`, `ThemeToggle`, `StatusBadge` (statuses: Queued, Uploading, Extracting, Chunking, Indexing, Ready, Failed, each with a distinct icon and colour, not colour alone).
7. Create the folder structure from the spec: `lib/data`, `lib/mock`, `lib/utils`, `types`, `docs`.
8. Create `docs/DECISIONS.md` with the choices made in this phase.
9. A temporary `/design` route showing every component in both themes, so I can review it visually.

Constraints: keep it simple and beginner-readable, no unused dependencies, no placeholder text claiming features that don't exist.

When finished: run lint, typecheck and build; open `/design` in the browser; screenshot it in dark and light at 1440px and 375px; fix any issues. Then summarize files changed, commands run, and anything incomplete.
