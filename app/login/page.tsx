import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Settings2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { isSupabaseConfigured } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: "Google sign-in was cancelled or failed. Please try again.",
  failed: "We couldn't complete sign-in. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error: errorCode, next } = await searchParams;
  const error = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.failed) : null;
  const configured = isSupabaseConfigured();

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(50%_60%_at_50%_0%,color-mix(in_srgb,var(--primary)_25%,transparent),transparent)]"
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <main id="main" className="relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-7 shadow-card">
          <h1 className="text-xl font-semibold tracking-tight">Welcome to DocuMind AI</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Sign in to upload documents and chat with them.</p>

          {error ? (
            <div role="alert" className="mt-5 flex gap-2.5 rounded-xl bg-danger-bg p-3.5 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {configured ? (
            <div className="mt-6">
              <GoogleButton next={next} />
            </div>
          ) : (
            <div className="mt-6 flex gap-2.5 rounded-xl bg-warning-bg p-3.5 text-sm text-warning" role="status">
              <Settings2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Sign-in isn&apos;t configured yet. Add your Supabase URL and key to <code>.env.local</code> (see the README),
                then restart the app.
              </span>
            </div>
          )}

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            We only use your Google account to identify you (name, email, photo). Your documents are private to your account.
          </p>
        </div>

        <Link
          href="/"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>
      </main>
    </div>
  );
}
