import { describe, expect, it } from "vitest";
import * as ExcelJS from "exceljs";
import JSZip from "jszip";
import { ParseError, parseDocument } from "@/lib/parsing";
import { parseCsv } from "@/lib/parsing/csv";
import { parseTextFile } from "@/lib/parsing/text";
describe("text files", () => {
  it("reads plain text and markdown", () => {
    const parsed = parseTextFile(Buffer.from("# Title\r\n\r\n\r\n\r\nSome   text  here"));
    expect(parsed.segments).toHaveLength(1);
    expect(parsed.segments[0].text).toBe("# Title\n\nSome text here");
  });
  it("rejects empty files", () => {
    expect(() => parseTextFile(Buffer.from("   \n "))).toThrowError(ParseError);
  });

  it("rejects binary data renamed to .txt", () => {
    const binary = Buffer.alloc(500);
    binary.fill(0);
    binary[0] = 65;
    expect(() => parseTextFile(binary)).toThrowError(/readable text/);
  });
});

describe("csv", () => {
  it("keeps the header with every row group and records row ranges", () => {
    const rows = ["name,score", ...Array.from({ length: 300 }, (_, i) => `student${i},${i}`)].join("\n");
    const parsed = parseCsv(Buffer.from(rows));
    expect(parsed.segments.length).toBeGreaterThan(1);
    for (const segment of parsed.segments) {
      expect(segment.text.startsWith("name | score")).toBe(true);
      expect(segment.section).toMatch(/rows \d+-\d+/);
    }
    expect(parsed.segments[0].section).toContain("rows 2-");
  });

  it("rejects an empty CSV", () => {
    expect(() => parseCsv(Buffer.from("\n\n"))).toThrowError(/no data/);
  });
});

describe("parseDocument safety checks", () => {
  it("rejects unsupported types", async () => {
    await expect(parseDocument("exe", Buffer.from("MZ"))).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });
  });

  it("rejects empty files", async () => {
    await expect(parseDocument("txt", Buffer.alloc(0))).rejects.toMatchObject({ code: "EMPTY" });
  });

  it("rejects a file whose content does not match its extension", async () => {
    await expect(parseDocument("pdf", Buffer.from("this is not a pdf"))).rejects.toMatchObject({ code: "CORRUPTED" });
    await expect(parseDocument("docx", Buffer.from("plain text"))).rejects.toMatchObject({ code: "CORRUPTED" });
  });

  it("reports a corrupted PDF clearly", async () => {
    await expect(parseDocument("pdf", Buffer.from("%PDF-1.4 garbage garbage"))).rejects.toBeInstanceOf(ParseError);
  });
});

describe("pptx", () => {
  async function makePptx(slides: string[][]) {
    const zip = new JSZip();
    slides.forEach((paragraphs, i) => {
      const body = paragraphs.map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`).join("");
      zip.file(`ppt/slides/slide${i + 1}.xml`, `<p:sld><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`);
    });
    return zip.generateAsync({ type: "nodebuffer" });
  }

  it("extracts text per slide with slide numbers (in numeric order)", async () => {
    const buffer = await makePptx([["Intro &amp; goals"], ["Second slide", "More text"], ["Third"]]);
    const parsed = await parseDocument("pptx", buffer);
    expect(parsed.pageCount).toBe(3);
    expect(parsed.segments.map((s) => s.page)).toEqual([1, 2, 3]);
    expect(parsed.segments[0].text).toBe("Intro & goals");
    expect(parsed.segments[1].text).toBe("Second slide\nMore text");
    expect(parsed.segments[1].section).toBe("Slide 2");
  });

  it("reports an empty presentation", async () => {
    const buffer = await makePptx([[]]);
    await expect(parseDocument("pptx", buffer)).rejects.toMatchObject({ code: "EMPTY" });
  });

  it("reports a zip that is not a presentation", async () => {
    const zip = new JSZip();
    zip.file("hello.txt", "hi");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    await expect(parseDocument("pptx", buffer)).rejects.toMatchObject({ code: "CORRUPTED" });
  });
});

describe("xlsx", () => {
  it("extracts every sheet with its name", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Budget");
    sheet.addRow(["Item", "Cost"]);
    sheet.addRow(["Laptop", 1200]);
    sheet.addRow(["Mouse", 25]);
    workbook.addWorksheet("Empty");
    const other = workbook.addWorksheet("Notes");
    other.addRow(["Topic"]);
    other.addRow(["Deadline is Friday"]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parseDocument("xlsx", buffer);

    const budget = parsed.segments.find((s) => s.section?.includes("Budget"));
    expect(budget?.text).toContain("Item | Cost");
    expect(budget?.text).toContain("Laptop | 1200");
    expect(parsed.segments.some((s) => s.section?.includes("Notes") && s.text.includes("Deadline is Friday"))).toBe(true);
  });
});
