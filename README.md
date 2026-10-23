# Execfind Lead Enricher

Execfind turns one manually discovered B2B company into an evidence-backed, persistent lead. It resolves an official site, performs a small robots-aware crawl, classifies the public investment offer, ranks decision makers, finds legitimate professional contact routes, and stores a deterministic current snapshot plus immutable enrichment history.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Configuration

- `HUNTER_API_KEY`: optional, server-only Hunter key. Enables the free company-to-domain resolver.
- `HUNTER_ALLOW_CREDITED_CALLS`: defaults to `false`. Set to `true` only when you explicitly want Domain Search, Email Finder (Found), or Email Verifier calls to consume Hunter credits. Phase 1 uses Domain Search for contact enrichment; adapter methods for Finder (Found) and Verifier are also available.
- `BRAVE_SEARCH_API_KEY`: optional, server-only Brave Search key used for a maximum of four bounded role queries when website evidence is insufficient.
- `ENRICHER_USER_AGENT`: crawler identity. In deployment, include a URL or email where site operators can identify the crawler.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL. Despite Supabase's standard variable name, Execfind reads it only from server modules.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service-role key. Never expose this value to browser code.

Never prefix provider keys or the Supabase service-role key with `NEXT_PUBLIC_`.

## Supabase setup

1. Create a Supabase project.
2. Apply every file in `supabase/migrations` with the Supabase CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Alternatively, run the migration SQL through your controlled deployment workflow. The migration creates `leads`, `enrichment_runs`, `contacts`, and `evidence_sources`, their indexes and constraints, and server-only RPC functions used for transactional persistence. No table needs to be created manually in the dashboard.

3. Copy the project URL and service-role key into `.env.local`, then restart the development server.

The enrichment API returns `503` with a clear configuration message when Supabase is missing. It does not report an unsaved result as saved. Re-enrichment creates a new run, updates the current lead snapshot only on success, and leaves the preceding successful snapshot intact on failure.

## What works without enrichment-provider keys

When an official website is supplied, Execfind still validates it against private-network access, respects `robots.txt`, reads relevant sitemap links, crawls up to 20 same-origin HTML pages with bounded concurrency, extracts public contacts and named leaders, classifies investment language, scores the lead, and exposes evidence and warnings. If no website and no Hunter key are supplied, the pipeline returns a valid uncertainty-first result instead of guessing a domain. Supabase is required for the application flow because successful Phase 2 enrichments auto-save.

## Safety and current limitations

- Direct fetches reject non-HTTP protocols, credentials in URLs, localhost, private, loopback, link-local, reserved IPs, and redirects to those destinations.
- Responses are time- and size-bounded and only HTML is parsed as a page.
- The deterministic extractor does not render JavaScript-only sites, solve access challenges, or bypass robots and login walls.
- Search snippets are candidate evidence, not definitive identity proof; low-confidence candidates are displayed as such.
- Persistence uses a privileged server-side client and row-level security with no browser policies. There is no application authentication yet: do not expose a deployed instance publicly until the hardening phase adds access control.
- There is no rate limiting or background job runner yet.
- Execfind intentionally does not scrape Google Maps or Meta Ads Library and does not send outreach.
