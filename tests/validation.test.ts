import { describe, expect, it } from "vitest";
import {
  chatRequestSchema,
  createKnowledgeBaseSchema,
  documentListSchema,
  registerDocumentSchema,
  updateConversationSchema,
} from "@/lib/validation";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const hash = "a".repeat(64);
describe("registerDocumentSchema", () => {
  const valid = {
    knowledgeBaseId: uuid,
    fileName: "notes.pdf",
    relativePath: "course/notes.pdf",
    sizeBytes: 1024,
    contentHash: hash,
    extension: "pdf",
  };

  it("accepts a valid upload", () => {
    expect(registerDocumentSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects unsupported extensions", () => {
    const result = registerDocumentSchema.safeParse({ ...valid, extension: "exe" });
    expect(result.success).toBe(false);
  });

  it("rejects empty and oversized files", () => {
    expect(registerDocumentSchema.safeParse({ ...valid, sizeBytes: 0 }).success).toBe(false);
    expect(registerDocumentSchema.safeParse({ ...valid, sizeBytes: 5 * 1024 * 1024 * 1024 }).success).toBe(false);
  });

  it("rejects a malformed hash or id", () => {
    expect(registerDocumentSchema.safeParse({ ...valid, contentHash: "xyz" }).success).toBe(false);
    expect(registerDocumentSchema.safeParse({ ...valid, knowledgeBaseId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("createKnowledgeBaseSchema", () => {
  it("trims and requires a name", () => {
    expect(createKnowledgeBaseSchema.parse({ name: "  My KB  " }).name).toBe("My KB");
    expect(createKnowledgeBaseSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(createKnowledgeBaseSchema.safeParse({ name: "x".repeat(101) }).success).toBe(false);
  });
});

describe("chatRequestSchema", () => {
  it("accepts a normal message and rejects a very long one", () => {
    expect(chatRequestSchema.safeParse({ message: "What is the deadline?" }).success).toBe(true);
    expect(chatRequestSchema.safeParse({ message: "a".repeat(4001) }).success).toBe(false);
  });

  it("rejects invalid document ids", () => {
    expect(chatRequestSchema.safeParse({ message: "hi", documentIds: ["1; drop table"] }).success).toBe(false);
  });
});

describe("updateConversationSchema", () => {
  it("needs at least one field", () => {
    expect(updateConversationSchema.safeParse({}).success).toBe(false);
    expect(updateConversationSchema.safeParse({ starred: true }).success).toBe(true);
  });
});

describe("documentListSchema", () => {
  it("applies defaults", () => {
    expect(documentListSchema.parse({})).toMatchObject({ sort: "recent", page: 1, pageSize: 20 });
  });

  it("rejects unknown filter values", () => {
    expect(documentListSchema.safeParse({ status: "hacked" }).success).toBe(false);
    expect(documentListSchema.safeParse({ type: "exe" }).success).toBe(false);
  });
});
