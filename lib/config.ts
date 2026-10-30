// Settings that are safe to use in BOTH browser and server code.
// (Only NEXT_PUBLIC_* environment variables are read here.)

export const APP_NAME = "DocuMind AI";
export const TAGLINE = "Your knowledge. One conversation away.";

/** File types that are uploaded AND parsed AND indexed by this app. */
export const SUPPORTED_EXTENSIONS = ["pdf", "docx", "txt", "md", "csv", "xlsx", "pptx"] as const;
export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export const FORMAT_LABELS: Record<SupportedExtension, string> = {
  pdf: "PDF (text-based)",
  docx: "Word (.docx)",
  txt: "Plain text",
  md: "Markdown",
  csv: "CSV",
  xlsx: "Excel (.xlsx)",
  pptx: "PowerPoint (.pptx)",
};

const parsedMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB);
/** Upload limit. Keep in sync with the storage bucket limit in the SQL migration. */
export const MAX_UPLOAD_MB = Number.isFinite(parsedMb) && parsedMb > 0 ? parsedMb : 20;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const STORAGE_BUCKET = "documents";

/** Document processing states (stored in documents.status). */
export const DOCUMENT_STATUSES = [
  "queued",
  "uploading",
  "extracting",
  "chunking",
  "indexing",
  "ready",
  "failed",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Statuses meaning "the server is still working on it". */
export const ACTIVE_STATUSES: DocumentStatus[] = ["queued", "uploading", "extracting", "chunking", "indexing"];

export const PAGE_SIZE = 20;

/** Shown when no retrieved passage is relevant enough. */
export const NOT_ENOUGH_INFO =
  "I couldn't find enough information in the selected documents to answer this reliably.";
