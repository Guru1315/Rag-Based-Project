import * as mammoth from "mammoth";
import { ParseError, type ParsedDocument } from "./types";
import { normalizeText } from "./text";

/** Word (.docx). Extracts the readable text; images and complex layout are ignored. */
export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  let value: string;
  try {
    const result = await mammoth.extractRawText({ buffer });
    value = result.value;
  } catch {
    throw new ParseError("CORRUPTED", "This Word document could not be read. It may be corrupted or password-protected.");
  }
  const text = normalizeText(value);
  if (!text) throw new ParseError("EMPTY", "The document contains no readable text.");
  return { segments: [{ text }] };
}
