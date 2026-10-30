/** A piece of extracted text plus where it came from. */
export interface Segment {
  text: string;
  /** PDF page or PowerPoint slide number (1-based), when known. */
  page?: number;
  /** Sheet name, row range, heading, etc., when known. */
  section?: string;
}

export interface ParsedDocument {
  segments: Segment[];
  pageCount?: number;
}

export type ParseErrorCode =
  | "UNSUPPORTED_TYPE"
  | "EMPTY"
  | "CORRUPTED"
  | "PASSWORD_PROTECTED"
  | "OCR_REQUIRED"
  | "TOO_LARGE_TEXT";

/** An error with a safe, user-readable message. */
export class ParseError extends Error {
  constructor(
    public code: ParseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ParseError";
  }
}
