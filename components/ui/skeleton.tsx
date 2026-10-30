import { cn } from "@/lib/utils";

/** Placeholder shown only while data is genuinely loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse-soft rounded-lg bg-surface-2", className)} />;
}
