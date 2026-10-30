import { extractText, getDocumentProxy } from "unpdf";
import { ParseError, type ParsedDocument } from "./types";
import { toSegments } from "./text";

/** Text-based PDFs only. Scanned PDFs (images) need OCR, which is NOT implemented. */
export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  let pages: string[];
  let totalPages: number;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: false });
    pages = Array.isArray(result.text) ? result.text : [String(result.text)];
    totalPages = result.totalPages;
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : "";
    if (name === "PasswordException" || /password/i.test(message)) {
      throw new ParseError("PASSWORD_PROTECTED", "This PDF is password-protected. Remove the password and upload it again.");
    }
    throw new ParseError("CORRUPTED", "This PDF could not be read. It may be corrupted.");
  }

  const segments = toSegments(pages.map((text, i) => ({ text, page: i + 1 })));
  const totalChars = segments.reduce((sum, s) => sum + s.text.length, 0);

  // Almost no text for the number of pages => probably scanned images.
  if (totalChars < 20 || totalChars / Math.max(totalPages, 1) < 10) {
    throw new ParseError(
      "OCR_REQUIRED",
      "No selectable text was found. This looks like a scanned PDF, and OCR is not supported yet.",
    );
  }
  return { segments, pageCount: totalPages };
}
