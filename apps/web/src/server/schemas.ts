import { z } from "zod";

const reference = z.string().trim().min(1).max(100);
const limit = z.number().int().min(1).max(500).optional();

export const relatedRequestSchema = z.object({
  reference,
  limit,
  filters: z.object({
    books: z.array(z.string().min(1)).max(66).optional(),
    testament: z.enum(["OT", "NT"]).optional(),
  }).strict().optional(),
  algorithmVersion: z.string().optional(),
}).strict();

export const compareRequestSchema = z.object({
  references: z.array(reference).min(2).max(10),
}).strict();

export const graphRequestSchema = z.object({
  reference,
  resultLimit: z.number().int().min(1).max(50).optional(),
  termLimit: z.number().int().min(0).max(25).optional(),
  nodeLimit: z.number().int().min(2).max(100).optional(),
}).strict();

export const workflowRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("gather_mentions"), term: z.string().trim().min(1).max(100), limit }).strict(),
  z.object({ type: z.literal("candidate_mates"), reference, limit: z.number().int().min(1).max(100).optional() }).strict(),
  z.object({ type: z.literal("divide_term"), term: z.string().trim().min(1).max(100), exampleLimitPerBook: z.number().int().min(1).max(10).optional() }).strict(),
  z.object({ type: z.literal("first_mention_chain"), term: z.string().trim().min(1).max(100), limit }).strict(),
  z.object({ type: z.literal("lexical_witnesses"), reference, count: z.union([z.literal(2), z.literal(3)]), candidateLimit: z.number().int().min(2).max(500).optional() }).strict(),
]);

export const topicRequestSchema = z.object({
  topic: z.string().trim().min(1).max(100),
  selectedSenseId: z.string().trim().min(1).max(100).optional(),
  selectedCandidates: z.array(z.string().trim().min(1).max(100)).min(1).max(20).optional(),
  limitPerCandidate: z.number().int().min(1).max(500).optional(),
}).strict();

export const researchQuerySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("reference"), input: reference, context: z.number().int().min(0).max(20).optional() }).strict(),
  z.object({ mode: z.enum(["exact-word", "exact-phrase"]), input: z.string().trim().min(1).max(200), limit, caseSensitive: z.boolean().optional() }).strict(),
  z.object({ mode: z.literal("related"), input: reference, limit, filters: relatedRequestSchema.shape.filters }).strict(),
  z.object({ mode: z.literal("compare"), references: z.array(reference).min(2).max(10) }).strict(),
  z.object({ mode: z.literal("graph"), ...graphRequestSchema.shape }).strict(),
  z.object({ mode: z.literal("workflow"), request: workflowRequestSchema }).strict(),
  z.object({ mode: z.literal("topic"), request: topicRequestSchema }).strict(),
]);
