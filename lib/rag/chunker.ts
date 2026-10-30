import type { Segment } from "@/lib/parsing/types";

export interface ChunkOptions {
  /** Target maximum characters per chunk. */
  maxChars: number;
  /** Characters repeated from the end of the previous chunk (context overlap). */
  overlapChars: number;
}

export interface TextChunk {
  index: number;
  content: string;
  page?: number;
  section?: string;
}

/**
 * Split one piece of text into units no longer than `max`.
 * Tries paragraphs first, then lines, then sentences, then a hard cut.
 */
function splitUnits(text: string, max: number): string[] {
  const separators: RegExp[] = [/\n{2,}/, /\n/, /(?<=[.!?])\s+/];

  const split = (input: string, level: number): string[] => {
    if (input.length <= max) return [input];
    if (level >= separators.length) {
      // Hard cut as a last resort (e.g. one giant line without punctuation).
      const parts: string[] = [];
      for (let i = 0; i < input.length; i += max) parts.push(input.slice(i, i + max));
      return parts;
    }
    return input
      .split(separators[level])
      .map((p) => p.trim())
      .filter(Boolean)
      .flatMap((p) => split(p, level + 1));
  };

  return split(text, 0);
}

/** Take roughly the last `n` characters of `text`, starting at a word boundary. */
function tail(text: string, n: number): string {
  if (n <= 0 || text.length <= n) return n <= 0 ? "" : text;
  const slice = text.slice(text.length - n);
  const space = slice.search(/\s/);
  return (space === -1 ? slice : slice.slice(space + 1)).trim();
}

/**
 * Turn extracted segments into chunks that:
 *  - never mix text from different pages/sections (so page numbers stay correct),
 *  - stay under `maxChars` where possible,
 *  - overlap a little so a fact at a boundary is not lost.
 */
export function chunkSegments(segments: Segment[], options: ChunkOptions): TextChunk[] {
  const { maxChars } = options;
  // The overlap must be clearly smaller than the chunk size.
  const overlap = Math.min(options.overlapChars, Math.floor(maxChars / 4));
  const chunks: TextChunk[] = [];

  for (const segment of segments) {
    const text = segment.text.trim();
    if (!text) continue;

    // Room for the body. The overlap text (and one newline) is prepended, so chunks stay <= maxChars.
    const budget = Math.max(maxChars - overlap - 1, 200);
    const units = splitUnits(text, budget);

    let current = "";
    let previousTail = "";

    const flush = () => {
      const body = current.trim();
      if (!body) return;
      const content = previousTail ? `${previousTail}\n${body}` : body;
      chunks.push({ index: chunks.length, content, page: segment.page, section: segment.section });
      previousTail = tail(body, overlap);
      current = "";
    };

    for (const unit of units) {
      if (current && current.length + unit.length + 2 > budget) flush();
      current = current ? `${current}\n\n${unit}` : unit;
    }
    flush();
  }

  return chunks;
}
