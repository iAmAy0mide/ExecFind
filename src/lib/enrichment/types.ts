import { z } from "zod";

export const sourcePlatformSchema = z.enum(["google_maps", "meta_ads", "manual", "other"]);
export const evidenceSchema = z.object({
  sourceUrl: z.string().url(),
  sourceType: z.enum(["company_site", "web_search", "hunter", "user_input"]),
  title: z.string().max(240).optional(),
  snippet: z.string().max(500).optional(),
  supports: z.array(z.string().min(1)).min(1),
  retrievedAt: z.string().datetime(),
});

export const enrichmentInputSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  website: z.string().trim().max(2048).optional().or(z.literal("")),
  sourcePlatform: sourcePlatformSchema.optional(),
  sourceUrl: z.string().trim().url().max(2048).optional().or(z.literal("")),
  investmentOfferHint: z.string().trim().max(600).optional().or(z.literal("")),
}).transform((value) => ({
  ...value,
  website: value.website || undefined,
  sourceUrl: value.sourceUrl || undefined,
  investmentOfferHint: value.investmentOfferHint || undefined,
}));

export const companyIdentitySchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional(),
  website: z.string().url().optional(),
});

export const personCandidateSchema = z.object({
  name: z.string().min(2),
  title: z.string().min(2),
  roleCategory: z.enum(["economic_buyer", "investment", "finance", "operations", "other"]),
  relevance: z.enum(["economic_buyer", "pain_owner", "other"]),
  confidence: z.number().min(0).max(1),
  sourceUrls: z.array(z.string().url()).min(1),
  evidenceSnippet: z.string().max(500),
});

export const contactRouteSchema = z.object({
  type: z.enum(["email", "phone", "whatsapp", "contact_page"]),
  value: z.string().min(1),
  sourceUrl: z.string().url(),
  public: z.boolean(),
  verification: z.enum(["verified", "found", "public", "unknown"]),
  personName: z.string().optional(),
});

export const contactCandidateSchema = personCandidateSchema.extend({
  routes: z.array(contactRouteSchema),
});

export const crawledPageSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  headings: z.array(z.string()),
  text: z.string(),
  emails: z.array(z.string()),
  phones: z.array(z.string()),
  whatsapp: z.array(z.string()),
  internalLinks: z.array(z.string().url()),
  people: z.array(personCandidateSchema),
  investmentSnippets: z.array(z.string()),
});

export const investmentClassificationSchema = z.object({
  detected: z.boolean(),
  branch: z.enum(["recurring_payout", "buyback_maturity", "both", "unknown"]),
  offerSummary: z.string().optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(evidenceSchema),
});

export const leadScoreSchema = z.object({
  icpFit: z.number().int().min(0).max(40),
  decisionMaker: z.number().int().min(0).max(30),
  reachability: z.number().int().min(0).max(30),
  total: z.number().int().min(0).max(100),
  grade: z.enum(["A", "B", "C"]),
});

export const enrichmentStageSchema = z.object({
  key: z.enum(["intake", "domain", "crawl", "classification", "people", "contacts", "scoring"]),
  status: z.enum(["pending", "running", "complete", "degraded", "failed"]),
  message: z.string(),
});

export const enrichmentErrorSchema = z.object({
  code: z.enum(["VALIDATION", "UNSAFE_URL", "DNS", "TIMEOUT", "RESPONSE_TOO_LARGE", "NON_HTML", "HTTP", "ROBOTS", "PROVIDER", "NO_DOMAIN", "UNKNOWN"]),
  message: z.string(),
  stage: z.string().optional(),
  retryable: z.boolean().default(false),
  cause: z.string().optional(),
});

export const enrichmentResultSchema = z.object({
  company: companyIdentitySchema,
  investment: investmentClassificationSchema,
  contacts: z.object({
    primary: contactCandidateSchema.optional(),
    secondary: contactCandidateSchema.optional(),
    others: z.array(contactCandidateSchema),
  }),
  bestRoute: contactRouteSchema.optional(),
  score: leadScoreSchema,
  evidence: z.array(evidenceSchema),
  warnings: z.array(z.string()),
  stages: z.array(enrichmentStageSchema),
});

export type EnrichmentInput = z.infer<typeof enrichmentInputSchema>;
export type CompanyIdentity = z.infer<typeof companyIdentitySchema>;
export type CrawledPage = z.infer<typeof crawledPageSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type InvestmentClassification = z.infer<typeof investmentClassificationSchema>;
export type PersonCandidate = z.infer<typeof personCandidateSchema>;
export type ContactCandidate = z.infer<typeof contactCandidateSchema>;
export type ContactRoute = z.infer<typeof contactRouteSchema>;
export type LeadScore = z.infer<typeof leadScoreSchema>;
export type EnrichmentStage = z.infer<typeof enrichmentStageSchema>;
export type EnrichmentError = z.infer<typeof enrichmentErrorSchema>;
export type EnrichmentResult = z.infer<typeof enrichmentResultSchema>;

export type Result<T> = { ok: true; value: T } | { ok: false; error: EnrichmentError };
