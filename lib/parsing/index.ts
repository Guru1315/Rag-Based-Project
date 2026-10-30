import { ParseError, type ParsedDocument } from "./types";
import { parseTextFile } from "./text";
import { parsePdf } from "./pdf";
import { parseDocx } from "./docx";
import { parseCsv } from "./csv";
import { parseXlsx } from "./xlsx";
import { parsePptx } from "./pptx";
import { SUPPORTED_EXTENSIONS, type SupportedExtension } from "@/lib/config";

export { ParseError } from "./types";
export type { ParsedDocument, Segment } from "./types";

export function isSupportedExtension(ext: string): ext is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

/** Extra safety check: the file's first bytes must match its extension. */
function looksLikeExpectedType(ext: SupportedExtension, buffer: Buffer): boolean {
  const startsWith = (sig: string) => buffer.subarray(0, sig.length).toString("latin1") === sig;
  switch (ext) {
    case "pdf":
      return buffer.subarray(0, 1024).toString("latin1").includes("%PDF-");
    case "docx":
    case "xlsx":
    case "pptx":
      return startsWith("PK"); // these formats are ZIP containers
    default:
      return true;
  }
}

/** Extract text from a file buffer, keeping page / section metadata. Throws ParseError with a safe message. */
export async function parseDocument(ext: string, buffer: Buffer): Promise<ParsedDocument> {
  if (!isSupportedExtension(ext)) {
    throw new ParseError("UNSUPPORTED_TYPE", `Files of type ".${ext}" are not supported.`);
  }
  if (buffer.length === 0) throw new ParseError("EMPTY", "The file is empty.");
  if (!looksLikeExpectedType(ext, buffer)) {
    throw new ParseError("CORRUPTED", `This file does not look like a real .${ext} file.`);
  }

  switch (ext) {
    case "pdf":
      return parsePdf(buffer);
    case "docx":
      return parseDocx(buffer);
    case "xlsx":
      return parseXlsx(buffer);
    case "pptx":
      return parsePptx(buffer);
    case "csv":
      return parseCsv(buffer);
    case "txt":
    case "md":
      return parseTextFile(buffer);
  }
}
