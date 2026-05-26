import { NextRequest, NextResponse } from "next/server";
import { detectPainpoints, buildPriorityActions } from "@/lib/analyze/painpointDetector";
import { buildPerformanceComparison } from "@/lib/analyze/performanceComparison";
import { defaultLabelStrategies, labeledProductsToXlsxBase64, labelProducts } from "@/lib/analyze/productLabelizer";
import { normalizeGoogleAdsRows } from "@/lib/normalize/googleAdsColumns";
import { parseCsv } from "@/lib/parsers/csvParser";
import { parseXlsx } from "@/lib/parsers/xlsxParser";
import { sendAuditEmails } from "@/lib/email/auditMailer";
import { buildAuditReport } from "@/lib/report/auditPromptBuilder";
import { generateAuditDocx } from "@/lib/report/docxGenerator";
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
  "website_notes"
];

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

  return {
    clientName: field(formData, "clientName") || "Client",
    contactEmail: field(formData, "contactEmail").toLowerCase(),
    websiteUrl: field(formData, "websiteUrl"),
    language: field(formData, "language") === "nl" ? "nl" : "en",
    currentPeriod: field(formData, "currentPeriod"),
    previousPeriod: field(formData, "previousPeriod"),
    compareWithPreviousPeriod: field(formData, "compareWithPreviousPeriod") === "true",
    businessType: (field(formData, "businessType") || "lead_gen") as AuditInput["businessType"],
    mainGoal: (field(formData, "mainGoal") || "leads") as AuditInput["mainGoal"],
    strategistNotes: field(formData, "strategistNotes"),
    leadConsent: field(formData, "leadConsent") === "true",
    useProductLabelizer: field(formData, "useProductLabelizer") === "true",
    labelStrategies
  };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function parseFile(file: File, slot: UploadSlot): Promise<RawTable> {
  const buffer = await file.arrayBuffer();
  const lowerName = file.name.toLowerCase();

  if (slot === "website_notes" || lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
    return {
      fileName: file.name,
      slot,
      rows: [{ content: new TextDecoder("utf-8").decode(buffer) }]
    };
  }

  const rows = lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") ? parseXlsx(buffer) : parseCsv(buffer);
  return { fileName: file.name, slot, rows };
}

function isPreviousRow(row: Record<string, unknown>, previousLabel: string): boolean {
  const keys = Object.keys(row);
  const periodKey = keys.find((key) => ["period", "periode", "date range", "segment"].includes(key.trim().toLowerCase()));
  if (!periodKey) return false;
  const value = String(row[periodKey] || "").toLowerCase();
  return value.includes("previous") || value.includes("vorige") || (!!previousLabel && value.includes(previousLabel.toLowerCase()));
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const input = auditInputFromForm(formData);

    if (!isValidEmail(input.contactEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address before generating the audit." }, { status: 400 });
    }

    if (!input.leadConsent) {
      return NextResponse.json({ error: "Please confirm that Adsvantage may store and contact this email address." }, { status: 400 });
    }

    const parsedTables: RawTable[] = [];
    for (const slot of uploadSlots) {
      const file = formData.get(slot);
      if (file instanceof File && file.size > 0) {
        parsedTables.push(await parseFile(file, slot));
      }
    }

    const campaignTable = parsedTables.find((table) => table.slot === "google_ads_campaigns");
    const searchTermsTable = parsedTables.find((table) => table.slot === "google_ads_search_terms");
    const keywordsTable = parsedTables.find((table) => table.slot === "google_ads_keywords");
    const changeHistoryTable = parsedTables.find((table) => table.slot === "google_ads_change_history");
    const productSourceTable = parsedTables.find((table) => table.slot === "product_source");
    const websiteNoteTable = parsedTables.find((table) => table.slot === "website_notes");

    const campaignRows = campaignTable?.rows || [];
    const currentCampaignRows = normalizeGoogleAdsRows(
      input.compareWithPreviousPeriod ? campaignRows.filter((row) => !isPreviousRow(row, input.previousPeriod)) : campaignRows
    );
    const previousCampaignRows = normalizeGoogleAdsRows(
      input.compareWithPreviousPeriod ? campaignRows.filter((row) => isPreviousRow(row, input.previousPeriod)) : []
    );
    const keywordRows = normalizeGoogleAdsRows(keywordsTable?.rows || []);
    const searchTermRows = normalizeGoogleAdsRows(searchTermsTable?.rows || []);
    const changeRows = normalizeGoogleAdsRows(changeHistoryTable?.rows || []);
    const productLabels =
      input.useProductLabelizer && productSourceTable ? labelProducts(productSourceTable.rows, input.labelStrategies) : undefined;
    const websiteNotes = String(websiteNoteTable?.rows[0]?.content || "");

    const comparison = buildPerformanceComparison(currentCampaignRows.length ? currentCampaignRows : keywordRows, previousCampaignRows);
    const painpoints = detectPainpoints(input, currentCampaignRows.length ? currentCampaignRows : keywordRows, searchTermRows, changeRows);
    const actions = buildPriorityActions(painpoints);
    const report = buildAuditReport(input, comparison, painpoints, actions, searchTermRows, changeRows, websiteNotes, productLabels?.summary);
    const docxBuffer = await generateAuditDocx(input, report);
    const docxBase64 = docxBuffer.toString("base64");
    const fileName = `${input.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "audit"}-google-ads-audit.docx`;
    const emailStatus = await sendAuditEmails({ input, report, docxBase64, fileName });

    return NextResponse.json({
      report,
      parsedFiles: parsedTables.map((table) => ({
        slot: table.slot,
        fileName: table.fileName,
        rows: table.rows.length
      })),
      docxBase64,
      emailStatus,
      labeledProductsBase64: productLabels ? labeledProductsToXlsxBase64(productLabels.rows) : undefined,
      labeledProductsFileName: productLabels
        ? `${input.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "audit"}-labeled-products.xlsx`
        : undefined,
      productLabelSummary: productLabels?.summary,
      fileName
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown audit generation error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
