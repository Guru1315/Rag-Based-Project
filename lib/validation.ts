import { z } from "zod";
import { DOCUMENT_STATUSES, MAX_UPLOAD_BYTES, SUPPORTED_EXTENSIONS } from "@/lib/config";

const uuid = z.string().uuid();

export const createKnowledgeBaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long (max 100)"),
  description: z.string().trim().max(500, "Description is too long (max 500)").optional().nullable(),
});

export const updateKnowledgeBaseSchema = createKnowledgeBaseSchema.partial().refine(
  (v) => v.name !== undefined || v.description !== undefined,
  "Nothing to update",
);

export const registerDocumentSchema = z.object({
  knowledgeBaseId: uuid,
  fileName: z.string().trim().min(1).max(255),
  relativePath: z.string().trim().min(1).max(1000),
  sizeBytes: z.number().int().positive("File is empty").max(MAX_UPLOAD_BYTES, "File is too large"),
  mimeType: z.string().max(200).optional().nullable(),
  // SHA-256 in hex
  contentHash: z.string().regex(/^[a-f0-9]{64}$/, "Invalid file hash"),
  extension: z.enum(SUPPORTED_EXTENSIONS, { message: "Unsupported file type" }),
});

export const updateDocumentSchema = z.object({
  starred: z.boolean().optional(),
});

export const processDocumentSchema = z.object({
  reindex: z.boolean().optional(),
});

export const chatRequestSchema = z.object({
  conversationId: uuid.optional(),
  knowledgeBaseId: uuid.optional(),
  documentIds: z.array(uuid).max(50).optional(),
  message: z.string().trim().max(4000, "Message is too long (max 4000 characters)").optional(),
  regenerate: z.boolean().optional(),
});

export const updateConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    starred: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.starred !== undefined, "Nothing to update");

export const documentListSchema = z.object({
  q: z.string().trim().max(100).optional(),
  kb: uuid.optional(),
  type: z.enum(SUPPORTED_EXTENSIONS).optional(),
  status: z.enum(DOCUMENT_STATUSES).optional(),
  starred: z.enum(["1"]).optional(),
  sort: z.enum(["recent", "name", "upload"]).default("recent"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type DocumentListQuery = z.infer<typeof documentListSchema>;

export const idParamSchema = uuid;
