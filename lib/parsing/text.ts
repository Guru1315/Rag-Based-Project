import { ParseError, type ParsedDocument, type Segment } from "./types";

/** Clean extracted text without destroying paragraphs or table lines. */
export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v ]+/g, " ") // collapse spaces, keep newlines
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Plain text and Markdown. */
export function parseTextFile(buffer: Buffer): ParsedDocument {
  // Binary files renamed to .txt contain lots of NUL bytes.
  const sample = buffer.subarray(0, 4000);
  let nulls = 0;
  for (const byte of sample) if (byte === 0) nulls++;
  if (sample.length > 0 && nulls / sample.length > 0.02) {
    throw new ParseError("CORRUPTED", "This file does not look like readable text.");
  }
  const text = normalizeText(buffer.toString("utf8"));
  if (!text) throw new ParseError("EMPTY", "The file contains no readable text.");
  return { segments: [{ text }] };
}

/** Helper to turn a list of named text blocks into segments. */
export function toSegments(blocks: { text: string; page?: number; section?: string }[]): Segment[] {
  return blocks
    .map((b) => ({ ...b, text: normalizeText(b.text) }))
    .filter((b) => b.text.length > 0);
}
