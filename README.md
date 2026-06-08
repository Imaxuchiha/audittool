# CampaignScan

CampaignScan is een file-first Google Ads-accountscan en productlabelizer voor Adsvantage. Versie 1 gebruikt uploads, geen Google OAuth.

## Wat de tool doet

- Nederlandse wizard met zes stappen: keuze, basisgegevens, uploads, controle, genereren en resultaten.
- Accountscan op basis van Google Ads-campagnes, zoektermen, zoekwoorden, wijzigingsgeschiedenis en optionele extra bronnen.
- Productlabelizer voor webshops met een Merchant Center supplemental feed.
- Verplichte e-mail en toestemming voor leadopvolging door Adsvantage.
- DOCX-download voor het auditrapport.
- ZIP-download voor productlabels met:
  - `merchant-center-supplemental-feed.csv`
  - `labelizer-wijzigingen.csv`
  - `labelizer-herstelbestand.csv`
  - `implementatiehandleiding.txt`
- Publieke privacyuitleg op `/privacy`.
- Publieke voorbeeldbestanden op `/samples/...`.

## Lokaal draaien

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Productiebuild testen:

```bash
npm run lint
npm test
npm run build
npm run start
```

## Voorbeeldbestanden

De voorbeeldbestanden staan in `/samples` en worden publiek geserveerd vanuit `/public/samples`.

Belangrijke voorbeelden:

- `/samples/google_ads_campaigns.csv`
- `/samples/google_ads_search_terms.csv`
- `/samples/product_source.csv`
- `/samples/product_performance.csv`

De homepageknop `Bekijk voorbeeldbestand` verwijst naar `/samples/google_ads_campaigns.csv`.

## Uploads

Ondersteund:

- `.csv`
- `.tsv`
- `.xlsx`
- `.xls`
- `.txt`
- `.md`

De wizard herkent bestanden zoveel mogelijk op basis van kolommen en inhoud. Bij twijfel kan de gebruiker het bestandstype handmatig kiezen.

Voor een accountscan is minimaal een Google Ads-campagne-export nodig.

Voor de productlabelizer zijn minimaal nodig:

- productfeed met product-ID;
- productprestaties met product-ID en prestatiekolommen.

Optioneel:

- zoektermen;
- zoekwoorden;
- wijzigingsgeschiedenis;
- conversies;
- assets;
- GA4-pagina's;
- GA4-events;
- Search Console-query's;
- website-notities;
- vorig CampaignScan-labelizerbestand.

## Productlabelizer

De labelizer schrijft niet rechtstreeks naar Google Ads of Merchant Center. Hij maakt een veilig aanvullend bestand dat de gebruiker in Merchant Center kan uploaden.

Standaard vult de tool een vrije custom-labelkolom met:

- `hero`
- `growth`
- `test`
- `review`

De tool:

- bewaart product-ID's als tekst;
- detecteert dubbele product-ID's;
- berekent matchpercentage tussen feed en prestatierapport;
- blokkeert generatie wanneer de match lager is dan de ingestelde limiet;
- overschrijft geen bezette custom-labelkolom zonder waarschuwing;
- beschermt gegenereerde CSV's tegen CSV-injection.

## Lead capture en e-mail

De audit vraagt om e-mailadres en toestemming. Op Netlify wordt een verborgen formulier gebruikt met naam:

```text
campaignscan-leads
```

E-mailen van rapporten is optioneel en gebruikt Resend:

```bash
RESEND_API_KEY=...
AUDIT_FROM_EMAIL="CampaignScan <info@adsvantage.nl>"
AUDIT_OWNER_EMAIL=info@adsvantage.nl
```

Zonder `RESEND_API_KEY` blijft de tool werken en kan de gebruiker rapporten downloaden. Met `RESEND_API_KEY` mailt de tool het DOCX-rapport naar de gebruiker en stuurt hij een leadmelding naar Adsvantage.

## Security en limieten

Configureerbaar via environmentvariabelen:

```bash
AUDIT_MAX_FILES=14
AUDIT_MAX_FILE_SIZE_BYTES=8388608
AUDIT_MAX_ROWS_PER_FILE=25000
AUDIT_RATE_LIMIT_WINDOW_MS=600000
AUDIT_RATE_LIMIT_MAX_REQUESTS=20
```

In v1 schrijft de app uploads niet naar publieke mappen, database of vaste opslag. Uploads worden in de request verwerkt. Hostingproviders kunnen wel technische logs bewaren, zoals IP-adres, foutcodes en timing. Log geen volledige CSV-inhoud, websitenotities of rapportteksten.

## Tests

Unit tests:

- CSV/TSV parsing;
- Nederlandse en Engelse getalnormalisatie;
- bronherkenning;
- productlabelizer, ID-behoud, ZIP-output en lage matchrate.

Command:

```bash
npm test
```

## Bekende beperkingen

- Er is nog geen Google OAuth of directe Google Ads API-koppeling.
- Er is geen database of uitgebreid CRM; Netlify Forms en e-mailmelding zijn de eenvoudige v1 leadoplossing.
- E2E-tests met Playwright zijn nog niet toegevoegd.
- `npm audit --omit=dev` meldt nog een moderate PostCSS-kwetsbaarheid via Next zelf. `npm audit fix --force` probeert Next naar een ongeschikte oude versie te downgraden en is daarom niet toegepast.

## V2 Google API requirements

Voor directe Google-integraties later:

- Google Cloud project;
- OAuth consent screen;
- privacy policy en terms URL;
- Google Ads API developer token;
- Google Ads customer ID;
- Google Ads manager account login customer ID wanneer een MCC wordt gebruikt;
- GA4 property ID;
- Search Console site URL/property;
- veilige refresh token storage;
- encrypted account connection records;
- scopes:
  - `https://www.googleapis.com/auth/adwords`
  - `https://www.googleapis.com/auth/analytics.readonly`
  - `https://www.googleapis.com/auth/webmasters.readonly`

## Architectuur

- `src/app/page.tsx`: publieke homepage.
- `src/app/privacy/page.tsx`: privacyuitleg.
- `src/components/AuditForm.tsx`: wizardflow.
- `src/app/api/audit/generate/route.ts`: parsing, herkenning, analyse, rapport en downloads.
- `src/lib/parsers`: CSV/TSV/XLSX parsing.
- `src/lib/recognize`: bronherkenning.
- `src/lib/security`: uploadlimieten, veilige bestandsnamen en rate limiting.
- `src/lib/analyze`: performance-analyse, painpoints en productlabelizer.
- `src/lib/report`: rapporttekst en DOCX.
- `src/lib/integrations`: placeholders voor toekomstige API-koppelingen.
