import { describe, expect, it } from "vitest";
import { chunkSegments } from "@/lib/rag/chunker";

const options = { maxChars: 500, overlapChars: 80 };

describe("chunkSegments", () => {
  it("returns nothing for empty input", () => {
    expect(chunkSegments([], options)).toEqual([]);
    expect(chunkSegments([{ text: "   \n  " }], options)).toEqual([]);
  });
  it("keeps short text in one chunk", () => {
    const chunks = chunkSegments([{ text: "Hello world. This is short." }], options);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Hello world. This is short.");
    expect(chunks[0].index).toBe(0);
  });

  it("never creates chunks longer than the maximum", () => {
    const paragraph = "The quick brown fox jumps over the lazy dog. ".repeat(12);
    const text = Array.from({ length: 10 }, () => paragraph).join("\n\n");
    const chunks = chunkSegments([{ text }], options);
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(options.maxChars);
  });

  it("splits a huge line with no punctuation", () => {
    const chunks = chunkSegments([{ text: "x".repeat(2000) }], options);
    expect(chunks.length).toBeGreaterThanOrEqual(4);
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(options.maxChars);
  });

  it("keeps page numbers and never mixes pages", () => {
    const chunks = chunkSegments(
      [
        { text: "Page one text about apples.", page: 1 },
        { text: "Page two text about oranges.", page: 2 },
      ],
      options,
    );
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ page: 1 });
    expect(chunks[0].content).not.toContain("oranges");
    expect(chunks[1]).toMatchObject({ page: 2 });
    expect(chunks[1].content).not.toContain("apples");
  });

  it("keeps the section label", () => {
    const [chunk] = chunkSegments([{ text: "a | b\n1 | 2", section: 'Sheet "Budget" (rows 2-3)' }], options);
    expect(chunk.section).toBe('Sheet "Budget" (rows 2-3)');
  });

  it("numbers chunks in order across segments", () => {
    const chunks = chunkSegments([{ text: "one", page: 1 }, { text: "two", page: 2 }, { text: "three", page: 3 }], options);
    expect(chunks.map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it("repeats a little text from the previous chunk (overlap)", () => {
    const sentences = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} talks about topic ${i}.`);
    const chunks = chunkSegments([{ text: sentences.join(" ") }], { maxChars: 300, overlapChars: 60 });
    expect(chunks.length).toBeGreaterThan(2);
    // The start of chunk 2 should contain words that also ended chunk 1.
    const tailWords = chunks[0].content.split(/\s+/).slice(-3).join(" ");
    expect(chunks[1].content).toContain(tailWords.split(" ").pop()!);
  });
});
