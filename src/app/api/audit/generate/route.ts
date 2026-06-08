import { NextRequest, NextResponse } from "next/server";
import { buildPriorityActions, detectPainpoints } from "@/lib/analyze/painpointDetector";
import { buildPerformanceComparison } from "@/lib/analyze/performanceComparison";
import { buildProductLabelizerPackage, defaultLabelStrategies } from "@/lib/analyze/productLabelizer";
import { sendAuditEmails } from "@/lib/email/auditMailer";
import { normalizeGoogleAdsRows } from "@/lib/normalize/googleAdsColumns";
import { parseCsv } from "@/lib/parsers/csvParser";
import { parseXlsx } from "@/lib/parsers/xlsxParser";
import { detectSource } from "@/lib/recognize/sourceDetector";
import { buildAuditReport } from "@/lib/report/auditPromptBuilder";
import { generateAuditDocx } from "@/lib/report/docxGenerator";
import { assertAllowedFile, assertRowLimit, getExtension, rateLimit, safeFileName, uploadLimits } from "@/lib/security/uploadGuards";
import { AuditInput, RawTable, UploadSlot } from "@/lib/types/audit";

export const runtime = "nodejs";

const uploadSlots: UploadSlot[] = [
  "google_ads_campaigns",
  "google_ads_search_terms",
  "google_ads_keywords",
  "google_ads_change_history",
  "google_ads_conversions",
  "google_ads_assets",
  "ga4_pages",
  "ga4_events",
  "search_console_queries",
  "product_source",
  "product_performance",
  "previous_labelizer",
  "website_notes"
];

interface ParsedTable extends RawTable {
  confidence?: "high" | "medium" | "low";
  warnings?: string[];
}

function field(formData: FormData, key: keyof AuditInput): string {
  return String(formData.get(key) || "").trim();
}

function auditInputFromForm(formData: FormData): AuditInput {
  const rawLabelStrategies = String(formData.get("labelStrategies") || "");
  let labelStrategies = defaultLabelStrategies;

  if (rawLabelStrategies) {
    try {
      labelStrategies = { ...defaultLabelStrategies, ...JSON.parse(rawLabelStrategies) };
    } catch {
      labelStrategies = defaultLabelStrategies;
    }
  }

  const mode = (field(formData, "mode") || "audit") as AuditInput["mode"];

  return {
    mode,
    clientName: field(formData, "clientName") || "Bedrijf",
    contactEmail: field(formData, "contactEmail").toLowerCase(),
    websiteUrl: field(formData, "websiteUrl"),
    language: "nl",
    currentPeriod: field(formData, "currentPeriod"),
    previousPeriod: field(formData, "previousPeriod"),
    compareWithPreviousPeriod: field(formData, "compareWithPreviousPeriod") === "true",
    businessType: (field(formData, "businessType") || "lead_gen") as AuditInput["businessType"],
    mainGoal: (field(formData, "mainGoal") || "leads") as AuditInput["mainGoal"],
    strategistNotes: field(formData, "strategistNotes"),
    leadConsent: field(formData, "leadConsent") === "true",
    useProductLabelizer: mode === "labelizer" || mode === "both" || field(formData, "useProductLabelizer") === "true",
    productLabelColumn: (field(formData, "productLabelColumn") || "custom_label_0") as AuditInput["productLabelColumn"],
    labelStrategies
  };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPreviousRow(row: Record<string, unknown>, previousLabel: string): boolean {
  const keys = Object.keys(row);
  const periodKey = keys.find((key) => ["period", "periode", "date range", "segment"].includes(key.trim().toLowerCase()));
  if (!periodKey) return false;
  const value = String(row[periodKey] || "").toLowerCase();
  return value.includes("previous") || value.includes("vorige") || (!!previousLabel && value.includes(previousLabel.toLowerCase()));
}

async function parseFileRows(file: File, slotHint?: UploadSlot): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer();
  const lowerName = file.name.toLowerCase();

  if (slotHint === "website_notes" || lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
    return [{ content: new TextDecoder("utf-8", { fatal: false }).decode(buffer) }];
  }

  const rows = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") ? await parseXlsx(buffer) : parseCsv(buffer);
  assertRowLimit(rows, file.name);
  return rows;
}

function collectFiles(formData: FormData): Array<{ file: File; slotHint?: UploadSlot }> {
  const seen = new Set<string>();
  const files: Array<{ file: File; slotHint?: UploadSlot }> = [];

  for (const slot of uploadSlots) {
    for (const value of formData.getAll(slot)) {
      if (value instanceof File && value.size > 0) {
        const key = `${value.name}-${value.size}-${slot}`;
        if (!seen.has(key)) {
          seen.add(key);
          files.push({ file: value, slotHint: slot });
        }
      }
    }
  }

  for (const value of formData.getAll("uploads")) {
    if (value instanceof File && value.size > 0) {
      const key = `${value.name}-${value.size}-uploads`;
      if (!seen.has(key)) {
        seen.add(key);
        files.push({ file: value });
      }
    }
  }

  return files;
}

function rowsFor(tables: ParsedTable[], slot: UploadSlot): Record<string, unknown>[] {
  return tables.filter((table) => table.slot === slot).flatMap((table) => table.rows);
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(request);
  if (!limit.allowed) {
    return jsonError(`Te veel aanvragen. Probeer het opnieuw over ${limit.retryAfterSeconds} seconden.`, 429);
  }

  try {
    const formData = await request.formData();
    const input = auditInputFromForm(formData);

    if (!isValidEmail(input.contactEmail)) {
      return jsonError("Vul een geldig e-mailadres in voordat je de scan maakt.");
    }

    if (!input.leadConsent) {
      return jsonError("Bevestig dat Adsvantage dit e-mailadres mag opslaan en mag gebruiken voor opvolging.");
    }

    const files = collectFiles(formData);
    if (files.length > uploadLimits.maxFiles) {
      return jsonError(`Je hebt ${files.length} bestanden gekozen. De limiet is ${uploadLimits.maxFiles} bestanden per scan.`);
    }

    const parsedTables: ParsedTable[] = [];
    for (const { file, slotHint } of files) {
      assertAllowedFile(file);
      const extension = getExtension(file.name);
      const rows = await parseFileRows(file, slotHint);
      const detection =
        slotHint || extension === ".txt" || extension === ".md"
          ? {
              slot: slotHint || "website_notes",
              confidence: "high" as const,
              warnings: [] as string[]
            }
          : detectSource(rows, file.name);

      if (detection.slot === "unknown") {
        parsedTables.push({
          fileName: file.name,
          slot: "website_notes",
          rows: [{ content: `Onbekend bestand toegevoegd: ${file.name}` }],
          confidence: "low",
          warnings: detection.warnings
        });
        continue;
      }

      parsedTables.push({
        fileName: file.name,
        slot: detection.slot,
        rows,
        confidence: detection.confidence,
        warnings: detection.warnings
      });
    }

    const campaignRows = rowsFor(parsedTables, "google_ads_campaigns");
    const keywordRows = normalizeGoogleAdsRows(rowsFor(parsedTables, "google_ads_keywords"));
    const searchTermRows = normalizeGoogleAdsRows(rowsFor(parsedTables, "google_ads_search_terms"));
    const changeRows = normalizeGoogleAdsRows(rowsFor(parsedTables, "google_ads_change_history"));
    const productSourceRows = rowsFor(parsedTables, "product_source");
    const productPerformanceRows = rowsFor(parsedTables, "product_performance");
    const previousLabelizerRows = rowsFor(parsedTables, "previous_labelizer");
    const websiteNotes = rowsFor(parsedTables, "website_notes")
      .map((row) => String(row.content || ""))
      .filter(Boolean)
      .join("\n\n");

    if ((input.mode === "audit" || input.mode === "both") && !campaignRows.length) {
      return jsonError("Selecteer minimaal een Google Ads-campagne-export voor een accountscan.");
    }

    if (input.useProductLabelizer && !productSourceRows.length) {
      return jsonError("Upload een productfeed met minimaal een product-ID voordat je de productlabelizer maakt.");
    }

    if (input.useProductLabelizer && !productPerformanceRows.length) {
      return jsonError("Upload ook een productprestatierapport met product-ID en prestatiekolommen voor betrouwbare productlabels.");
    }

    const currentCampaignRows = normalizeGoogleAdsRows(
      input.compareWithPreviousPeriod ? campaignRows.filter((row) => !isPreviousRow(row, input.previousPeriod)) : campaignRows
    );
    const previousCampaignRows = normalizeGoogleAdsRows(
      input.compareWithPreviousPeriod ? campaignRows.filter((row) => isPreviousRow(row, input.previousPeriod)) : []
    );

    const productPackage = input.useProductLabelizer
      ? await buildProductLabelizerPackage(productSourceRows, productPerformanceRows, previousLabelizerRows, input.clientName, {
          preferredColumn: input.productLabelColumn
        })
      : undefined;

    const metricRows = currentCampaignRows.length ? currentCampaignRows : keywordRows;
    const comparison = buildPerformanceComparison(metricRows, previousCampaignRows);
    const painpoints = detectPainpoints(input, metricRows, searchTermRows, changeRows);
    const actions = buildPriorityActions(painpoints);
    const report = buildAuditReport(input, comparison, painpoints, actions, searchTermRows, changeRows, websiteNotes, productPackage?.summary);
    const docxBuffer = await generateAuditDocx(input, report);
    const docxBase64 = docxBuffer.toString("base64");
    const fileName = `${safeFileName(input.clientName.toLowerCase())}-google-ads-audit.docx`;
    const emailStatus = await sendAuditEmails({ input, report, docxBase64, fileName });

    return NextResponse.json({
      report,
      parsedFiles: parsedTables.map((table) => ({
        slot: table.slot,
        fileName: table.fileName,
        rows: table.rows.length,
        confidence: table.confidence,
        warnings: table.warnings
      })),
      docxBase64,
      emailStatus,
      labeledProductsBase64: productPackage?.zipBase64,
      labeledProductsFileName: productPackage?.zipFileName,
      labeledProductsMimeType: productPackage ? "application/zip" : undefined,
      productLabelSummary: productPackage?.summary,
      fileName
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "De scan kon niet worden gemaakt. Controleer je bestanden en probeer het opnieuw.";
    return jsonError(message, 500);
  }
}
