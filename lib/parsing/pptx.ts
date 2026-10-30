import JSZip from "jszip";
import { ParseError, type ParsedDocument } from "./types";
import { normalizeText } from "./text";

const MAX_SLIDES = 500;
const MAX_XML_CHARS_PER_SLIDE = 2_000_000;

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Read the text of one slide's XML. Paragraphs (<a:p>) become lines. */
function slideXmlToText(xml: string): string {
  const paragraphs = xml.match(/<a:p[ >][\s\S]*?<\/a:p>/g) ?? [];
  return paragraphs
    .map((p) => {
      const runs = p.match(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g) ?? [];
      return runs.map((r) => decodeXml(r.replace(/<[^>]+>/g, ""))).join("");
    })
    .filter(Boolean)
    .join("\n");
}

/** PowerPoint (.pptx). Slide text only (no images, charts or speaker notes). Each slide = one page. */
export async function parsePptx(buffer: Buffer): Promise<ParsedDocument> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new ParseError("CORRUPTED", "This PowerPoint file could not be read. It may be corrupted or password-protected.");
  }

  const slideFiles = Object.keys(zip.files)
    .map((name) => ({ name, match: name.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
    .filter((f): f is { name: string; match: RegExpMatchArray } => f.match !== null)
    .map((f) => ({ name: f.name, number: Number(f.match[1]) }))
    .sort((a, b) => a.number - b.number)
    .slice(0, MAX_SLIDES);

  if (slideFiles.length === 0) {
    throw new ParseError("CORRUPTED", "No slides were found. This does not look like a valid .pptx file.");
  }

  const segments = [];
  for (const file of slideFiles) {
    const xml = (await zip.files[file.name].async("string")).slice(0, MAX_XML_CHARS_PER_SLIDE);
    const text = normalizeText(slideXmlToText(xml));
    if (text) segments.push({ text, page: file.number, section: `Slide ${file.number}` });
  }

  if (segments.length === 0) throw new ParseError("EMPTY", "The presentation contains no readable text.");
  return { segments, pageCount: slideFiles.length };
}
