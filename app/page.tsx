import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  FileText,
  FolderUp,
  History,
  Lock,
  MessagesSquare,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { FORMAT_LABELS, MAX_UPLOAD_MB, SUPPORTED_EXTENSIONS, TAGLINE } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";

const STEPS = [
  { icon: UploadCloud, title: "Upload", text: "Add files or a whole folder. Text is extracted and split into searchable passages." },
  { icon: Sparkles, title: "Understand", text: "Each passage is turned into an embedding so questions can find the right part of your documents." },
  { icon: MessagesSquare, title: "Ask", text: "Ask in plain language. Answers are written from the retrieved passages and link back to them." },
];

const FEATURES = [
  { icon: MessagesSquare, title: "Document chat", text: "Ask questions, request summaries or compare files. Streaming answers with Markdown and code." },
  { icon: FolderUp, title: "Folder upload", text: "Drop a folder and its nested paths are kept, so you can tell similar files apart." },
  { icon: Quote, title: "Source citations", text: "Every answer shows the passages it used, with document name, page or section, and an excerpt." },
  { icon: BookMarked, title: "Private knowledge bases", text: "Group documents by project or course and chat with just that group, or with selected files." },
  { icon: History, title: "Chat history", text: "Conversations are saved to your account so you can continue them later." },
  { icon: Search, title: "Search and filters", text: "Find documents by name, type or status, and star the ones you use most." },
];

const SECURITY = [
  "Sign-in uses Google through Supabase Auth. DocuMind AI never sees or stores a password.",
  "Uploaded files go to a private storage bucket. Storage rules only let the owner's account read them.",
  "Database tables use Row Level Security, so queries only return rows that belong to the signed-in user.",
  "AI and database secret keys stay on the server and are never sent to your browser.",
  "To answer a question, your question and the retrieved passages are sent to the Google Gemini API.",
  "Deleting a document removes its stored file and all of its indexed passages.",
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-dvh">
      {/* ---------- Navigation ---------- */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <div className="hidden items-center gap-1 sm:flex">
            <a href="#features" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              How It Works
            </a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href={user ? "/dashboard" : "/login"} className={buttonVariants({ variant: user ? "primary" : "outline", size: "md" })}>
              {user ? "Open dashboard" : "Sign In"}
            </Link>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_srgb,var(--primary)_28%,transparent),transparent)]"
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
            <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              {TAGLINE}
            </p>
            <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
              Chat with your documents. <span className="text-primary">Discover more.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              DocuMind AI answers questions using only the files you upload. It retrieves the relevant passages first, cites
              them, and tells you when your documents don&apos;t contain the answer.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={user ? "/dashboard" : "/login"} className={buttonVariants({ size: "lg" })}>
                Get Started Free
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a href="#features" className={buttonVariants({ variant: "outline", size: "lg" })}>
                Explore Features
              </a>
            </div>
          </div>

          <div className="relative mx-auto max-w-5xl px-4 pb-20 sm:px-6">
            <div
              role="img"
              aria-label="Illustration of the DocuMind AI workspace: a knowledge base list on the left and a chat answer with source citations on the right."
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
            >
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                <span className="ml-3 text-xs text-muted-foreground">Illustrative preview with sample content</span>
              </div>
              <div className="grid text-left md:grid-cols-[15rem_1fr]">
                <div className="hidden border-r border-border bg-surface-2/50 p-4 md:block">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Knowledge bases</p>
                  {["Software Engineering", "Final-year project", "Research papers"].map((name, i) => (
                    <div
                      key={name}
                      className={`mb-1.5 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${i === 0 ? "bg-primary/15 text-foreground" : "text-muted-foreground"}`}
                    >
                      <BookMarked className="h-4 w-4" aria-hidden="true" />
                      {name}
                    </div>
                  ))}
                  <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents</p>
                  {["requirements.pdf", "lecture-notes.docx", "budget.xlsx"].map((name) => (
                    <div key={name} className="mb-1.5 flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      {name}
                    </div>
                  ))}
                </div>
                <div className="space-y-4 p-5 sm:p-6">
                  <div className="ml-auto max-w-md rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm text-primary-foreground">
                    What are the non-functional requirements?
                  </div>
                  <div className="max-w-xl rounded-2xl rounded-tl-md border border-border bg-background px-4 py-3 text-sm leading-relaxed">
                    The document lists performance, security and availability requirements. Pages must load in under 3
                    seconds <CiteChip n={1} /> and user data must be encrypted in transit <CiteChip n={2} />.
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <SourceCard n={1} title="requirements.pdf" where="Page 7" />
                      <SourceCard n={2} title="requirements.pdf" where="Page 9" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how-it-works" className="scroll-mt-20 border-t border-border bg-surface/40 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">Three steps from files to answers.</p>
            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-2xl border border-border bg-surface p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <step.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">Step {i + 1}</span>
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">Built for working with your own files</h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-border bg-surface p-6">
                  <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-primary">
                    <f.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Supported formats ---------- */}
        <section className="border-t border-border bg-surface/40 py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">Supported formats</h2>
            <p className="mt-3 text-muted-foreground">
              Every format below is parsed and indexed by the app. Files up to {MAX_UPLOAD_MB} MB each.
            </p>
            <ul className="mt-8 flex flex-wrap justify-center gap-3">
              {SUPPORTED_EXTENSIONS.map((ext) => (
                <li key={ext} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium">
                  {FORMAT_LABELS[ext]}
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-6 max-w-xl text-sm text-muted-foreground">
              Scanned PDFs and images are not supported yet because OCR is not implemented. You will see a clear message if a
              file has no selectable text.
            </p>
          </div>
        </section>

        {/* ---------- Security and privacy ---------- */}
        <section id="security" className="scroll-mt-20 py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-success-bg text-success">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="text-3xl font-semibold tracking-tight">Security and privacy</h2>
              <p className="mt-3 text-muted-foreground">What the app actually does to keep your documents private.</p>
            </div>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {SECURITY.map((line) => (
                <li key={line} className="flex gap-3 rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              DocuMind AI is a student project. It has not been through an independent security audit and holds no
              compliance certifications.
            </p>
          </div>
        </section>

        {/* ---------- Final call to action ---------- */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-surface p-10 text-center shadow-card sm:p-14">
            <h2 className="text-3xl font-semibold tracking-tight">Your knowledge. One conversation away.</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">Sign in with Google, upload a document and ask your first question.</p>
            <Link href={user ? "/dashboard" : "/login"} className={`${buttonVariants({ size: "lg" })} mt-8`}>
              Get Started Free
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} DocuMind AI. Answers can be wrong, so check important facts in the cited sources.</p>
        </div>
      </footer>
    </div>
  );
}

function CiteChip({ n }: { n: number }) {
  return (
    <span className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/15 px-1 text-xs font-semibold text-primary">
      {n}
    </span>
  );
}

function SourceCard({ n, title, where }: { n: number; title: string; where: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
      <CiteChip n={n} />
      <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="truncate font-medium">{title}</span>
      <span className="ml-auto shrink-0 text-muted-foreground">{where}</span>
    </div>
  );
}
