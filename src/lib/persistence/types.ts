import { z } from "zod";
import { enrichmentInputSchema, enrichmentResultSchema, leadScoreSchema } from "../enrichment/types";

export const leadGradeSchema = z.enum(["A", "B", "C"]);
export const investmentBranchSchema = z.enum(["recurring_payout", "buyback_maturity", "both", "unknown"]);
export const reachabilitySchema = z.enum(["direct_email", "phone_or_whatsapp", "company_route", "none"]);
export const sortSchema = z.enum(["score_desc", "newest", "oldest", "company_asc"]);

export const leadQuerySchema = z.object({
  search: z.string().trim().max(160).optional().default(""),
  grades: z.array(leadGradeSchema).max(3).optional().default([]),
  branches: z.array(investmentBranchSchema).max(4).optional().default([]),
  reachability: z.array(reachabilitySchema).max(4).optional().default([]),
  sort: sortSchema.optional().default("score_desc"),
  limit: z.coerce.number().int().min(1).max(5000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const leadListItemSchema = z.object({
  id: z.string().uuid(), companyName: z.string(), domain: z.string().nullable(), website: z.string().nullable(),
  sourcePlatform: z.string().nullable(), sourceUrl: z.string().nullable(), investmentBranch: investmentBranchSchema,
  offerSummary: z.string().nullable(), investmentConfidence: z.number(), totalScore: z.number(), icpFitScore: z.number(),
  decisionMakerScore: z.number(), reachabilityScore: z.number(), grade: leadGradeSchema,
  primaryContactName: z.string().nullable(), primaryContactRole: z.string().nullable(), primaryEmail: z.string().nullable(),
  primaryEmailVerification: z.string().nullable(), primaryPhone: z.string().nullable(), primaryWhatsapp: z.string().nullable(),
  secondaryContactName: z.string().nullable(), secondaryContactRole: z.string().nullable(), bestRouteType: z.string().nullable(),
  bestRouteValue: z.string().nullable(), reachability: reachabilitySchema, lastEnrichedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});

export const leadSummarySchema = z.object({ total: z.number(), gradeA: z.number(), recurringPayout: z.number(), buybackMaturity: z.number(), both: z.number() });
export const leadListResponseSchema = z.object({ items: z.array(leadListItemSchema), total: z.number(), summary: leadSummarySchema });

export const enrichmentRunRecordSchema = z.object({
  id: z.string().uuid(), status: z.enum(["running", "succeeded", "failed"]), input: enrichmentInputSchema,
  result: enrichmentResultSchema.nullable(), score: leadScoreSchema.nullable(), warnings: z.array(z.string()),
  error: z.record(z.string(), z.unknown()).nullable(), startedAt: z.string().datetime(), completedAt: z.string().datetime().nullable(),
});

export const leadDetailSchema = z.object({ lead: leadListItemSchema.extend({ investmentOfferHint: z.string().nullable(), latestEnrichmentRunId: z.string().uuid().nullable() }), runs: z.array(enrichmentRunRecordSchema) });

export type LeadQuery = z.infer<typeof leadQuerySchema>;
export type LeadListItem = z.infer<typeof leadListItemSchema>;
export type LeadListResponse = z.infer<typeof leadListResponseSchema>;
export type LeadDetail = z.infer<typeof leadDetailSchema>;

export type PersistenceContact = {
  name: string; title: string; roleCategory: string; relevance: string; workEmail: string | null;
  emailVerification: string | null; businessPhone: string | null; businessWhatsapp: string | null;
  confidence: number; status: "primary" | "secondary" | "other"; sourceUrls: string[]; evidenceSnippet: string;
};
