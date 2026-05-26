# Google Ads Audit Generator

A clean internal Next.js app for PPC freelancers and agencies. Version 1 works from uploaded Google Ads, GA4, Search Console, and website note files. It does not use Google OAuth and does not store files permanently.

## Features

- Upload CSV or XLSX exports server-side.
- Require an email address before generating the audit.
- Save lead submissions through Netlify Forms when deployed on Netlify.
- Optionally email the DOCX report to the lead and notify Adsvantage through Resend.
- Normalize common Google Ads column names.
- Generate a current-state report without dates, or calculate current vs previous period metrics when enabled.
- Detect practical PPC painpoints such as wasted spend, low CTR, high CPC with low CVR, PMax ROAS issues, tracking concerns, and inactivity risk.
- Preview and edit the report in the browser.
- Download a polished DOCX audit report from the edited preview.
- Use the print flow to save the edited report as PDF.
- Optional product feed labelizer for Google Shopping custom labels.
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
- `product_source.csv`
- `website_notes.txt`

The sample campaigns file includes both `Current` and `Previous` rows in the `Period` column. Turn on comparison in the form if you want the app to split those rows into current vs previous period. Leave comparison off for a simple current-state audit.

## Lead capture and email delivery

The audit form requires an email address and consent before the report can be generated.

On Netlify, leads are submitted to a hidden Netlify Form named `campaignscan-leads`. You can find submissions in the Netlify dashboard under Forms.

Email delivery is optional and uses Resend through environment variables:

```bash
RESEND_API_KEY=...
AUDIT_FROM_EMAIL="CampaignScan <info@adsvantage.nl>"
AUDIT_OWNER_EMAIL=info@adsvantage.nl
```

Without `RESEND_API_KEY`, the app still generates the report and the user can download the DOCX/PDF in the browser. With `RESEND_API_KEY`, the DOCX report is emailed to the submitted email address and a lead notification is sent to `AUDIT_OWNER_EMAIL`.

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
- `product_source.csv` or `.xlsx` when the optional product tool is switched on
- `website_notes.md` or `.txt`

## Product source and labelizer

The product tool is off by default to keep the normal audit flow simple. Switch on **Optionele producttool** in the audit form when you want to upload a feed and create custom labels. When it is off, the product upload is hidden and no labelizer file is generated.

The product source upload accepts a product feed or spreadsheet with columns such as:

- `id`
- `title`
- `brand`
- `product type`
- `price`
- `availability`
- `margin`

Before generating the audit, choose what each Google Shopping custom label should represent. Defaults are:

- `custom_label_0`: priority label such as `priority_scale`, `priority_standard`, `priority_protect_margin`, or `priority_exclude`
- `custom_label_1`: price bucket
- `custom_label_2`: margin bucket
- `custom_label_3`: category bucket
- `custom_label_4`: stock bucket

You can also choose brand, sale/promo, season, shipping, performance, gender, size, release year, or leave a label empty.

This is meant as a starter labelizer for Google Merchant Center / Shopping / PMax workflows. The rules live in `src/lib/analyze/productLabelizer.ts` and can be adjusted per agency strategy.

Custom label inspiration:

- Google Merchant Center custom labels: `https://support.google.com/merchants/answer/6324473`
- DataFeedWatch custom label examples: `https://www.datafeedwatch.com/blog/custom-labels-google-shopping`
- Solutions 8 custom label guidance: `https://sol8.com/google-ads-custom-labels/`
- PPC community discussion about supplemental feeds / labelizers: `https://www.reddit.com/r/PPC/comments/1oj51xm/custom_labels_for_products_google_ads_google/`

## Information sources

V1 only uses files that the user uploads and manual notes that the strategist enters. It does not pull data from Google directly.

The audit can use:

- Google Ads campaign exports
- Google Ads search term exports
- Google Ads keyword exports
- Google Ads change history exports
- Google Ads conversion exports
- Google Ads asset exports
- GA4 pages and events exports
- Search Console query exports
- Product source/feed uploads when the optional product tool is enabled
- Website notes in `.txt` or `.md`
- Manual strategist notes from the form

The tool stores nothing permanently in v1.

## Sharing with employees

For a small internal team, the easiest option is to run it on one machine or server and share the local/network URL.

Local use:

```bash
open-app.bat
```

Keep the command window open and use `http://localhost:3000`.

Internal network use:

1. Run the app on a shared office machine or small Windows server.
2. Use the network URL shown by Next.js, for example `http://192.168.x.x:3000`.
3. Give employees that URL.
4. Make sure the machine firewall allows inbound traffic on port `3000`.

More professional deployment:

1. Deploy to Vercel, Render, Railway, Azure App Service, or a small VPS.
2. Put it behind login before uploading client data.
3. Add HTTPS.
4. Add a clear internal policy: uploads are processed temporarily and should not contain unnecessary personal data.

## Data storage

V1 parses uploaded files in the API request and returns a preview plus DOCX file bytes. It does not write uploads or reports to disk, database, or object storage.

Lead details are submitted to Netlify Forms when deployed on Netlify. If email delivery is enabled, Adsvantage also receives an owner notification email that can be used as a lead record.

## Environment variables

No API key is required for local report generation.

For report email delivery:

```bash
RESEND_API_KEY=...
AUDIT_FROM_EMAIL="CampaignScan <info@adsvantage.nl>"
AUDIT_OWNER_EMAIL=info@adsvantage.nl
```

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
