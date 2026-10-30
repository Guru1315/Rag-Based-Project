import * as ExcelJS from "exceljs";
import { ParseError, type ParsedDocument, type Segment } from "./types";
import { tableToSegments } from "./csv";

/** Convert an ExcelJS cell value to plain text. */
function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((t) => t.text).join("");
    if ("result" in v && v.result !== undefined && v.result !== null) return String(v.result); // formulas
    if ("text" in v && typeof v.text === "string") return v.text; // hyperlinks
    return "";
  }
  return String(value);
}

/** Excel (.xlsx). Every sheet becomes one or more segments; the sheet name is kept as the section. */
export async function parseXlsx(buffer: Buffer): Promise<ParsedDocument> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ParseError("CORRUPTED", "This Excel file could not be read. It may be corrupted or password-protected.");
  }

  const segments: Segment[] = [];
  workbook.eachSheet((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map((v) => cellToText(v as ExcelJS.CellValue)));
    });
    segments.push(...tableToSegments(rows, `Sheet "${sheet.name}"`));
  });

  if (segments.length === 0) throw new ParseError("EMPTY", "The workbook contains no data.");
  return { segments };
}
