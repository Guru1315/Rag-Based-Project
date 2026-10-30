import Link from "next/link";
import { cn } from "@/lib/utils";

/** Document-shaped mark with a small sparkle (the "AI" hint). */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <rect x="3" y="2" width="22" height="28" rx="5.5" fill="#5a56e6" />
      <path d="M17.5 2H20a5.5 5.5 0 0 1 5.5 5.5V10h-5A3 3 0 0 1 17.5 7V2z" fill="#ffffff" fillOpacity="0.25" />
      <path d="M8 15h10M8 19.5h7M8 24h9" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M25.5 15.5l1.3 3.4 3.4 1.3-3.4 1.3-1.3 3.4-1.3-3.4-3.4-1.3 3.4-1.3z"
        fill="#c4b5fd"
        stroke="#8b5cf6"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Logo + wordmark. `compact` shows only the mark (for a collapsed sidebar). */
export function Logo({
  compact = false,
  href = "/",
  className,
}: {
  compact?: boolean;
  href?: string;
  className?: string;
}) {
  return (
    <Link href={href} aria-label="DocuMind AI home" className={cn("inline-flex items-center gap-2.5 rounded-lg", className)}>
      <LogoMark />
      {compact ? null : (
        <span className="text-lg font-semibold tracking-tight">
          DocuMind <span className="text-primary">AI</span>
        </span>
      )}
    </Link>
  );
}
