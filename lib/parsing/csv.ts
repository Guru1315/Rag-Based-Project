import * as Papa from "papaparse";
import { ParseError, type ParsedDocument, type Segment } from "./types";

/** Number of characters of table text per segment (kept below the chunk size). */
const SEGMENT_CHAR_BUDGET = 1400;

/** Turn a table into text segments. Every segment repeats the header row so each chunk stays understandable. */
export function tableToSegments(rows: string[][], sectionPrefix: string): Segment[] {
  const clean = rows
    .map((r) => r.map((c) => String(c ?? "").replace(/\s+/g, " ").trim()))
    .filter((r) => r.some((c) => c !== ""));
  if (clean.length === 0) return [];

  const header = clean[0];
  const headerLine = header.join(" | ");
  const segments: Segment[] = [];

  let lines: string[] = [];
  let size = 0;
  let firstRow = 2; // 1-based row number in the sheet (row 1 is the header)
  let rowNumber = 1;

  const flush = () => {
    if (lines.length === 0) return;
    segments.push({
      text: `${headerLine}\n${lines.join("\n")}`,
      section: `${sectionPrefix} (rows ${firstRow}-${firstRow + lines.length - 1})`,
    });
    firstRow += lines.length;
    lines = [];
    size = 0;
  };

  for (const row of clean.slice(1)) {
    rowNumber++;
    const line = row.join(" | ").slice(0, 1200);
    if (size + line.length > SEGMENT_CHAR_BUDGET) flush();
    if (lines.length === 0) firstRow = rowNumber;
    lines.push(line);
    size += line.length + 1;
  }
  flush();

  // Table with a header only.
  if (segments.length === 0) segments.push({ text: headerLine, section: sectionPrefix });
  return segments;
}

export function parseCsv(buffer: Buffer): ParsedDocument {
  const result = Papa.parse<string[]>(buffer.toString("utf8"), { skipEmptyLines: "greedy" });
  if (result.errors.some((e) => e.type === "Quotes")) {
    throw new ParseError("CORRUPTED", "This CSV file is malformed (unbalanced quotes).");
  }
  const segments = tableToSegments(result.data, "Table");
  if (segments.length === 0) throw new ParseError("EMPTY", "The CSV file contains no data.");
  return { segments };
}
