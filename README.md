# Google Ads Audit Generator

A clean internal Next.js app for PPC freelancers and agencies. Version 1 works from uploaded Google Ads, GA4, Search Console, and website note files. It does not use Google OAuth and does not store files permanently.

## Features

- Upload CSV or XLSX exports server-side.
- Normalize common Google Ads column names.
- Calculate current vs previous period metrics when exports include a `Period` / `Segment` column.
- Detect practical PPC painpoints such as wasted spend, low CTR, high CPC with low CVR, PMax ROAS issues, tracking concerns, and inactivity risk.
- Preview and edit the report in the browser.
- Download a polished DOCX audit report from the edited preview.
- Use the print flow to save the edited report as PDF.
- Future-ready placeholders for Google Ads API, GA4 API, and Search Console API.

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Test with sample files

Use the files in `/samples`:

- `google_ads_campaigns.csv`
- `google_ads_search_terms.csv`
- `google_ads_change_history.csv`
- `google_ads_keywords.csv`
- `google_ads_conversions.csv`
- `google_ads_assets.csv`
- `ga4_pages.csv`
- `ga4_events.csv`
- `search_console_queries.csv`
- `website_notes.txt`

The sample campaigns file includes both `Current` and `Previous` rows in the `Period` column so the app can calculate period-over-period differences.

## Upload slots

The app accepts:

- `google_ads_campaigns.csv` or `.xlsx`
- `google_ads_search_terms.csv` or `.xlsx`
- `google_ads_keywords.csv` or `.xlsx`
- `google_ads_change_history.csv` or `.xlsx`
- `google_ads_conversions.csv` or `.xlsx`
- `google_ads_assets.csv` or `.xlsx`
- `ga4_pages.csv` or `.xlsx`
- `ga4_events.csv` or `.xlsx`
- `search_console_queries.csv` or `.xlsx`
- `website_notes.md` or `.txt`

## Data storage

V1 parses uploaded files in the API request and returns a preview plus DOCX file bytes. It does not write uploads or reports to disk, database, or object storage.

## Environment variables

No API key is required in v1.

If you later add an LLM for report rewriting, keep keys in `.env.local`, for example:

```bash
OPENAI_API_KEY=...
```

Do not expose private keys to client components.

## V2 Google API requirements

To add direct Google integrations later, you will need:

- Google Cloud project.
- OAuth consent screen.
- Privacy policy and terms URL for the consent screen.
- Google Ads API developer token.
- Google Ads customer ID.
- Google Ads manager account login customer ID when using an MCC.
- GA4 property ID.
- Search Console site URL/property.
- Secure refresh token storage.
- Encrypted account connection records.
- Scopes:
  - `https://www.googleapis.com/auth/adwords`
  - `https://www.googleapis.com/auth/analytics.readonly`
  - `https://www.googleapis.com/auth/webmasters.readonly`

V2 should add OAuth only after deciding where encrypted refresh tokens live and who can access connected accounts.

## Architecture

- `src/app/audits/new/page.tsx`: audit creation screen.
- `src/app/api/audit/generate/route.ts`: server-side parsing, normalization, analysis, and DOCX response.
- `src/lib/parsers`: CSV/XLSX parsing.
- `src/lib/normalize`: Google Ads column normalization.
- `src/lib/analyze`: performance comparison and painpoint detection.
- `src/lib/report`: report assembly and DOCX generation.
- `src/lib/integrations`: v2 API placeholders.

PDF export uses the browser print dialog from the edited report preview. Click `Save as PDF`, then choose `Save as PDF` in the browser print destination. DOCX is generated server-side from the edited preview state.
