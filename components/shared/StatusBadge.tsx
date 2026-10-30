import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  FileSearch,
  Scissors,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import type { DocumentStatus } from "@/lib/config";
import { cn } from "@/lib/utils";

const STATUS: Record<DocumentStatus, { label: string; icon: LucideIcon; tone: string; active: boolean }> = {
  queued: { label: "Queued", icon: Clock, tone: "bg-surface-2 text-muted-foreground", active: true },
  uploading: { label: "Uploading", icon: UploadCloud, tone: "bg-info-bg text-info", active: true },
  extracting: { label: "Extracting", icon: FileSearch, tone: "bg-info-bg text-info", active: true },
  chunking: { label: "Chunking", icon: Scissors, tone: "bg-info-bg text-info", active: true },
  indexing: { label: "Indexing", icon: Database, tone: "bg-warning-bg text-warning", active: true },
  ready: { label: "Ready", icon: CheckCircle2, tone: "bg-success-bg text-success", active: false },
  failed: { label: "Failed", icon: AlertCircle, tone: "bg-danger-bg text-danger", active: false },
};

/** Status chip: every status has its own icon AND text, so it never relies on colour alone. */
export function StatusBadge({ status, className }: { status: DocumentStatus; className?: string }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", s.tone, className)}
    >
      <Icon className={cn("h-3.5 w-3.5", s.active && "animate-pulse-soft")} aria-hidden="true" />
      {s.label}
    </span>
  );
}
