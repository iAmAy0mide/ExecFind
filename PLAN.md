# PLAN.md — Lead Enricher

## 1. Product goal

Build a fast internal enrichment tool that turns a manually discovered B2B company into a sales-ready, evidence-backed lead.

The user may discover companies from Google Maps, Meta Ads Library, referrals, web search, or any other source. This product starts AFTER discovery.

### Core user action

Paste:

- company name
- optional website
- optional source URL/platform
- optional investment-offer hint

Receive:

- resolved company/domain
- detected investment model
- primary decision maker
- secondary decision maker / pain owner
- best professional contact route
- evidence for each conclusion
- confidence and A/B/C lead grade

The immediate campaign use case is Nigerian real-estate companies that operate investor payout programmes.

## 2. ICP classification for current campaign

### Branch A — Recurring payout operators

Examples of public signals:

- monthly ROI / monthly return
- quarterly payout / quarterly return
- periodic distribution
- regular investor income during tenure

Operational pain:

Different investors become due at different times, and staff must keep future obligations visible early enough to prepare payouts.

### Branch B — Buy-back / fixed-maturity operators

Examples of public signals:

- buy-back / buyback
- fixed investment tenure
- 6/9/12/18-month maturity
- principal + return at maturity
- capital returned at end of term

Operational pain:

Maturity obligations can become urgent if the team does not see them far enough ahead.

### Branch `both`

A company may offer both structures. The enricher should preserve that rather than forcing one category.

## 3. MVP boundaries

### In scope

- single-company enrichment
- company/domain resolution
- bounded crawl of official public website
- public business contact extraction
- executive/investment/finance contact discovery
- recurring-vs-buyback classification
- search-provider fallback
- Hunter integration for professional-email/domain enrichment
- evidence/source tracking
- deterministic lead scoring
- compact internal UI
- export/copy result
- graceful behavior when optional API keys are absent

### Explicitly out of scope

- scraping Google Maps UI
- scraping Meta Ads Library UI
- bulk prospect discovery
- cold-email sending
- CRM/sequences
- CAPTCHA bypassing
- login-wall scraping
- personal/private contact harvesting
- investor payout software itself
- browser extension
- mobile app

## 4. Recommended technical shape

Use the repository's existing Next.js/App Router/TypeScript stack if present.

Do not replace working repository conventions merely to match this plan.

### App layers

```text
UI
  ↓
server action / route handler
  ↓
EnrichmentPipeline
  ├── DomainResolver
  ├── WebsiteCrawler
  ├── PageExtractor
  ├── InvestmentClassifier
  ├── PeopleRanker
  ├── SearchProvider
  ├── ContactProvider
  ├── LeadScorer
  └── EvidenceCollector
```

### Suggested provider defaults

- domain resolution: Hunter Domain Finder where configured
- web search: Brave Search API where configured
- email/contact enrichment: Hunter API where configured
- website extraction: direct public HTTP fetch + HTML parsing

Keep every external provider behind a small interface so it can be replaced.

## 5. Enrichment pipeline

### Stage 0 — intake

Validate input.

Output a canonical `EnrichmentInput`.

### Stage 1 — domain resolution

If website is supplied:
- normalize
- validate
- treat as preferred candidate

If missing:
- try configured domain resolver
- corroborate through search when necessary

Do not choose between ambiguous domains silently.

### Stage 2 — bounded website crawl

1. resolve and validate target
2. fetch/obey `robots.txt`
3. fetch homepage
4. discover sitemap if available
5. prioritize likely relevant paths
6. fetch up to 20 unique HTML pages
7. deduplicate canonical URLs
8. stop on crawl/security limits

### Stage 3 — deterministic extraction

From each page, extract:

- page title
- headings
- visible text
- JSON-LD/structured organization/person data
- `mailto:` links
- `tel:` links
- WhatsApp links
- relevant internal links
- candidate person names + adjacent titles
- investment keywords/phrases
- short evidence snippets

### Stage 4 — investment classification

Return:

- `recurring_payout`
- `buyback_maturity`
- `both`
- `unknown`

Each positive classification must have evidence and confidence.

Generic "property investment" text is insufficient.

### Stage 5 — decision-maker ranking

Create candidates and score relevance.

Economic-buyer roles:
- Founder
- CEO
- Managing Director
- Executive Director

Pain-owner roles:
- Head/Director of Investment
- Investment Manager
- CFO
- Head of Finance
- Finance Manager
- COO / Operations Director

Prefer candidates corroborated by multiple credible sources.

### Stage 6 — web-search fallback

If website evidence is insufficient, issue a small bounded set of role queries.

Search results can:
- identify likely official pages
- discover interviews/press pages
- corroborate executive roles
- surface public professional routes

Search result snippets are evidence, not proof by themselves when ambiguity remains.

### Stage 7 — professional contact enrichment

For identified people:

1. retain public business contacts found on official/public pages
2. optionally query Hunter
3. prefer found/verified work email over inferred patterns
4. surface verification/confidence state
5. never silently convert an inferred pattern into a "verified" result

Credited Hunter endpoints must be opt-in through configuration.

### Stage 8 — lead scoring

#### ICP fit — 40

Suggested factors:
- 15: investment programme clearly detected
- 15: payout/maturity structure clearly detected
- 10: evidence suggests recurring operational payout complexity

#### Decision maker — 30

Suggested factors:
- 15: strong primary decision-maker found
- 10: relevant pain owner/secondary contact found
- 5: role corroborated by more than one source

#### Reachability — 30

Suggested factors:
- 15: direct verified professional email
- 10: public direct business phone/WhatsApp
- 5: generic company route only

Clamp each category to its maximum.

Grades:
- A = 80–100
- B = 60–79
- C = 0–59

### Stage 9 — result

Show:

- company card
- investment model
- decision makers
- direct routes
- score
- warnings
- sources/evidence

Every uncertain field must look uncertain in the UI.

## 6. API / environment configuration

Expected variables may include:

```bash
HUNTER_API_KEY=
HUNTER_ALLOW_CREDITED_CALLS=false
BRAVE_SEARCH_API_KEY=
ENRICHER_USER_AGENT=
```

Never expose these client-side.

The tool must still perform website-only enrichment when optional provider keys are unavailable.

## 7. Data model for first version

Start with typed domain models before committing to persistence.

Core models:

- `EnrichmentInput`
- `CompanyIdentity`
- `CrawledPage`
- `Evidence`
- `InvestmentClassification`
- `PersonCandidate`
- `ContactCandidate`
- `ContactRoute`
- `LeadScore`
- `EnrichmentResult`
- `EnrichmentStage`
- `EnrichmentError`

Persistence can be added after the vertical slice is reliable.

When persistence is added, use Supabase unless the existing repository already has a better data layer.

Likely persistent records:

- leads
- enrichment_runs
- contacts
- evidence_sources

Do not store full raw page HTML unless a concrete feature requires it.

## 8. UI

One primary workspace is enough for MVP.

### Input panel

- Company name (required)
- Website (optional)
- Source platform (optional)
- Source URL (optional)
- Offer hint (optional)
- `Enrich lead` primary action

### Progress

Show meaningful stages:

- resolving company
- crawling official site
- detecting investment offer
- identifying decision makers
- enriching contact routes
- scoring lead

### Result

Prioritize:

1. grade / total score
2. company + domain
3. investment branch and offer summary
4. primary decision maker
5. secondary decision maker
6. best route
7. evidence
8. warnings

Provide copy/export actions.

Before implementation, Codex must read `.codex/skills/frontend-design/SKILL.md`.

## 9. Security requirements

External crawling creates SSRF risk and must be treated accordingly.

Required:

- block private/loopback/link-local destinations
- check redirects
- timeouts
- response-size caps
- HTML-only parsing
- crawl/page caps
- bounded concurrency
- `robots.txt`
- no anti-bot bypass
- server-only secrets
- sanitized rendering of external content

## 10. Build phases

### Phase 1 — End-to-end vertical slice

Goal: one company + optional website → real result in the UI.

Implement:

- core types/schemas
- provider interfaces
- URL/network safety layer
- bounded website crawler
- deterministic page/contact/person extraction
- investment classifier
- people ranking
- scoring
- optional Hunter domain/contact adapter
- optional Brave search adapter
- `/api/enrich` or equivalent server boundary
- single-page internal UI
- fixtures and tests
- `.env.example`
- run/build documentation

No persistence yet.

Definition of done:
- with only a public website, app can enrich from site content
- with provider keys, app can add search/contact evidence
- missing provider keys do not crash the flow
- all results expose evidence and uncertainty
- lint/typecheck/tests/build pass

### Phase 2 — Persistence and lead queue

Add:

- Supabase schema
- saved leads
- enrichment run history
- re-enrich action
- filter by A/B/C and ICP branch
- CSV export

Do not build CRM functionality.

### Phase 3 — Extraction quality

Only after real usage reveals weaknesses.

Potential additions:

- optional structured LLM extractor/classifier
- optional rendered-page fallback for JavaScript-only websites
- better entity deduplication
- better evidence corroboration
- domain ambiguity UI

Any LLM must be an optional provider, not required for deterministic core behavior.

### Phase 4 — Operational hardening

- rate limiting
- caching
- retries/backoff
- observability
- auth for deployed internal instance
- deployment configuration
- cost controls
- provider usage metrics

## 11. Validation scenarios

Use fixtures plus real public sites during manual QA.

Test scenarios:

1. user provides company + correct domain
2. user provides only company name
3. website has clear management/team page
4. site has investment language but no executive names
5. site has executive names but no investment language
6. company offers recurring payouts
7. company offers buy-back
8. company appears to offer both
9. no Hunter key
10. no Brave key
11. inaccessible site
12. ambiguous domain
13. `robots.txt` disallows a relevant path
14. malicious/private-network URL input
15. provider timeout/failure

## 12. Success criteria

The tool is successful when a manually discovered company can usually be turned into an evidence-backed outreach record in a few minutes or less, without the user manually opening a dozen tabs.

The product should optimize for:
- fewer manual enrichment steps
- high-confidence decision-maker identification
- high-confidence professional contact routes
- easy verification
- low provider/API waste

## 13. Progress

- [x] Phase 1 — End-to-end vertical slice
  - Completed 2026-10-23: strict schemas, safe bounded crawler, deterministic extraction/classification/ranking/scoring, optional Hunter and Brave adapters, `/api/enrich`, evidence-first workspace UI, fixtures, tests, and operator documentation.
  - Verification: lint, TypeScript, 37 unit tests, production build, and local no-key API smoke test pass.
- [x] Phase 2 — Persistence and lead queue
  - Completed 2026-10-23: reproducible Supabase schema and server-only transactional persistence, deterministic lead identity/deduplication, immutable success/failure run history, current contact/evidence snapshots, persistent queue filters/sorting, lead detail and re-enrichment, and filtered CSV export.
  - Verification: lint, TypeScript, 56 unit/integration tests, production build, and diff checks pass. Migration execution was not available locally because no Supabase CLI/database is installed; apply `supabase/migrations/202610230001_phase2_persistence.sql` to the target project before runtime QA.
- [ ] Phase 3 — Extraction quality
- [ ] Phase 4 — Operational hardening
