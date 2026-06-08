import JSZip from "jszip";
import { CustomLabelColumn, LabelStrategyConfig, ProductLabelSummary } from "@/lib/types/audit";
import { safeFileName } from "@/lib/security/uploadGuards";
import { toNumber } from "@/lib/normalize/googleAdsColumns";

const idFields = ["id", "item id", "item_id", "offer id", "product id", "product_id", "sku"];
const titleFields = ["title", "product title", "name", "product name", "titel"];
const categoryFields = ["product type", "google product category", "category", "categorie"];
const priceFields = ["price", "sale price", "prijs"];
const availabilityFields = ["availability", "stock", "voorraad"];
const brandFields = ["brand", "merk"];
const customLabelColumns: CustomLabelColumn[] = ["custom_label_0", "custom_label_1", "custom_label_2", "custom_label_3", "custom_label_4"];

export const defaultLabelStrategies: LabelStrategyConfig = {
  custom_label_0: "performance",
  custom_label_1: "none",
  custom_label_2: "none",
  custom_label_3: "none",
  custom_label_4: "none"
};

export interface ProductLabelizerSettings {
  preferredColumn?: CustomLabelColumn;
  minimumClicksForDecision?: number;
  minimumSpendForDecision?: number;
  heroValueShare?: number;
  minimumMatchRate?: number;
}

interface ProductPerformance {
  id: string;
  clicks: number;
  spend: number;
  conversions: number;
  conversionValue: number;
}

export interface ProductLabelizerPackage {
  zipBase64: string;
  zipFileName: string;
  summary: ProductLabelSummary;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, " ");
}

function fieldKey(row: Record<string, unknown>, fields: string[]): string | undefined {
  return Object.keys(row).find((candidate) => fields.includes(normalizeKey(candidate)));
}

function fieldValue(row: Record<string, unknown>, fields: string[]): string {
  const key = fieldKey(row, fields);
  const value = key ? row[key] : undefined;
  return value === undefined || value === null ? "" : String(value).trim();
}

export function productId(row: Record<string, unknown>): string {
  return fieldValue(row, idFields).trim();
}

function metric(row: Record<string, unknown>, fields: string[]): number {
  return toNumber(fieldValue(row, fields));
}

function safeCsvCell(value: unknown): string {
  const raw = value === undefined || value === null ? "" : String(value);
  const protectedValue = /^[=+\-@\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  return [headers.map(safeCsvCell).join(","), ...rows.map((row) => headers.map((header) => safeCsvCell(row[header])).join(","))].join("\r\n");
}

function existingLabelColumns(rows: Record<string, unknown>[]): CustomLabelColumn[] {
  return customLabelColumns.filter((column) =>
    rows.some((row) => {
      const key = fieldKey(row, [column, column.replace(/_/g, " ")]);
      const value = key ? row[key] : undefined;
      return value !== undefined && value !== null && String(value).trim() !== "";
    })
  );
}

function chooseLabelColumn(rows: Record<string, unknown>[], preferred?: CustomLabelColumn): { column: CustomLabelColumn; warning?: string } {
  const occupied = existingLabelColumns(rows);
  if (preferred && !occupied.includes(preferred)) return { column: preferred };
  const free = customLabelColumns.find((column) => !occupied.includes(column));
  if (!free) {
    throw new Error("Alle vijf custom-labelkolommen bevatten al waarden. Kies eerst bewust welke kolom mag worden overschreven.");
  }
  return {
    column: free,
    warning: preferred && occupied.includes(preferred) ? `${preferred} bevat al waarden. Daarom is ${free} gekozen als vrije kolom.` : undefined
  };
}

function aggregatePerformance(rows: Record<string, unknown>[]): Map<string, ProductPerformance> {
  const map = new Map<string, ProductPerformance>();

  for (const row of rows) {
    const id = productId(row);
    if (!id) continue;
    const current = map.get(id) || { id, clicks: 0, spend: 0, conversions: 0, conversionValue: 0 };
    current.clicks += metric(row, ["clicks", "klikken"]);
    current.spend += metric(row, ["cost", "costs", "spend", "kosten"]);
    current.conversions += metric(row, ["conversions", "conv.", "conversies"]);
    current.conversionValue += metric(row, ["conversion value", "conv. value", "conversiewaarde", "revenue", "omzet"]);
    map.set(id, current);
  }

  return map;
}

function previousLabels(rows: Record<string, unknown>[], column: CustomLabelColumn): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const id = productId(row);
    if (!id) continue;
    const value = fieldValue(row, [column, "new label", "nieuw label", "previous label", "vorig label"]);
    if (value) map.set(id, value);
  }
  return map;
}

function labelProductsByPerformance(
  feedRows: Record<string, unknown>[],
  performanceRows: Record<string, unknown>[],
  previousRows: Record<string, unknown>[] = [],
  settings: ProductLabelizerSettings = {}
) {
  const minimumClicks = settings.minimumClicksForDecision ?? 20;
  const minimumSpend = settings.minimumSpendForDecision ?? 25;
  const heroValueShare = settings.heroValueShare ?? 0.8;
  const minimumMatchRate = settings.minimumMatchRate ?? 0.5;
  const { column, warning } = chooseLabelColumn(feedRows, settings.preferredColumn || "custom_label_0");
  const performance = aggregatePerformance(performanceRows);
  const feedIds = feedRows.map(productId).filter(Boolean);
  const uniqueFeedIds = new Set(feedIds);
  const duplicateFeedIds = feedIds.filter((id, index) => feedIds.indexOf(id) !== index);
  const matchedIds = feedIds.filter((id) => performance.has(id));
  const matchRate = uniqueFeedIds.size ? new Set(matchedIds).size / uniqueFeedIds.size : 0;

  if (!feedRows.length || !uniqueFeedIds.size) {
    throw new Error("We konden geen product-ID herkennen in de productfeed. Voeg een kolom met product-ID of id toe en probeer het opnieuw.");
  }

  if (!performanceRows.length || !performance.size) {
    throw new Error("We konden geen productprestaties met product-ID herkennen. Upload een prestatierapport met product-ID en klik-, kosten- of omzetkolommen.");
  }

  if (matchRate < minimumMatchRate) {
    const examples = feedIds.filter((id) => !performance.has(id)).slice(0, 5).join(", ");
    throw new Error(`Je productfeed en prestatierapport sluiten onvoldoende op elkaar aan (${Math.round(matchRate * 100)}% match). Controleer of beide bestanden dezelfde product-ID's gebruiken. Voorbeelden zonder match: ${examples || "geen voorbeelden beschikbaar"}.`);
  }

  const matchedPerformance = [...performance.values()].filter((item) => uniqueFeedIds.has(item.id));
  const totalValue = matchedPerformance.reduce((sum, item) => sum + item.conversionValue, 0);
  const heroIds = new Set<string>();
  let cumulativeValue = 0;

  matchedPerformance
    .filter((item) => item.conversionValue > 0 && (item.clicks >= minimumClicks || item.spend >= minimumSpend))
    .sort((a, b) => b.conversionValue - a.conversionValue)
    .forEach((item) => {
      if (totalValue > 0 && cumulativeValue / totalValue <= heroValueShare) {
        heroIds.add(item.id);
        cumulativeValue += item.conversionValue;
      }
    });

  const previous = previousLabels(previousRows, column);
  const labels: Record<string, number> = {};

  const changes = feedRows.map((row) => {
    const id = productId(row);
    const perf = performance.get(id);
    const hasEnoughData = !!perf && (perf.clicks >= minimumClicks || perf.spend >= minimumSpend);
    const roas = perf?.spend ? perf.conversionValue / perf.spend : 0;
    let label = "test";
    let reason = "Onvoldoende betrouwbare data voor een harde beoordeling.";

    if (perf && heroIds.has(id)) {
      label = "hero";
      reason = `Bewezen aandeel in conversiewaarde binnen de top ${Math.round(heroValueShare * 100)}%.`;
    } else if (perf && hasEnoughData && perf.conversionValue > 0) {
      label = "growth";
      reason = "Aantoonbare potentie, maar geen hero-product binnen de huidige criteria.";
    } else if (perf && hasEnoughData && perf.conversionValue <= 0) {
      label = "review";
      reason = "Voldoende verkeer of kosten, maar geen zichtbare conversiewaarde.";
    }

    labels[label] = (labels[label] || 0) + 1;

    return {
      id,
      "vorig label": previous.get(id) || "",
      "nieuw label": label,
      reden: reason,
      clicks: perf?.clicks ?? 0,
      kosten: perf?.spend ?? 0,
      conversies: perf?.conversions ?? 0,
      conversiewaarde: perf?.conversionValue ?? 0,
      roas: roas ? roas.toFixed(2) : "",
      analyseperiode: new Date().toISOString().slice(0, 10)
    };
  });

  const supplemental = changes.map((change) => ({
    id: change.id,
    [column]: change["nieuw label"]
  }));

  const rollback = changes
    .filter((change) => change["vorig label"])
    .map((change) => ({
      id: change.id,
      [column]: change["vorig label"]
    }));

  const guide = [
    "CampaignScan implementatiehandleiding",
    "",
    "1. Open Google Merchant Center.",
    "2. Ga naar producten en voeg een aanvullende gegevensbron toe.",
    "3. Upload merchant-center-supplemental-feed.csv.",
    "4. Zorg dat de kolom id exact overeenkomt met de product-ID's in je primaire productbron.",
    `5. Gebruik ${column} daarna in Shopping- en Performance Max-campagnes om producten slimmer te segmenteren.`,
    "",
    "Labels:",
    "- hero: bewezen sterke producten.",
    "- growth: producten met potentie.",
    "- test: producten met onvoldoende data.",
    "- review: producten met voldoende verkeer/kosten maar zwakke resultaten.",
    "",
    "Terugzetten:",
    "Gebruik labelizer-herstelbestand.csv wanneer je een vorige situatie wilt terugplaatsen. Dit bestand is alleen gevuld als een vorig labelizerbestand is geupload."
  ].join("\r\n");

  const notes = [
    warning,
    duplicateFeedIds.length ? `${duplicateFeedIds.length} dubbele product-ID's in de feed gevonden.` : undefined,
    `Matchpercentage tussen feed en prestaties: ${Math.round(matchRate * 100)}%.`,
    `Criteria: minimaal ${minimumClicks} klikken of ${minimumSpend} kosten voor een beslissing; hero-groep tot ${Math.round(heroValueShare * 100)}% van bewezen conversiewaarde.`
  ].filter(Boolean) as string[];

  return {
    column,
    matchRate,
    labels,
    notes,
    supplemental,
    changes,
    rollback,
    guide
  };
}

export async function buildProductLabelizerPackage(
  feedRows: Record<string, unknown>[],
  performanceRows: Record<string, unknown>[],
  previousRows: Record<string, unknown>[] = [],
  clientName = "campaignscan",
  settings: ProductLabelizerSettings = {}
): Promise<ProductLabelizerPackage> {
  const result = labelProductsByPerformance(feedRows, performanceRows, previousRows, settings);
  const zip = new JSZip();

  zip.file("merchant-center-supplemental-feed.csv", toCsv(result.supplemental, ["id", result.column]));
  zip.file("labelizer-wijzigingen.csv", toCsv(result.changes, ["id", "vorig label", "nieuw label", "reden", "clicks", "kosten", "conversies", "conversiewaarde", "roas", "analyseperiode"]));
  zip.file("labelizer-herstelbestand.csv", toCsv(result.rollback, ["id", result.column]));
  zip.file("implementatiehandleiding.txt", result.guide);

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const zipFileName = `${safeFileName(clientName.toLowerCase())}-productlabels.zip`;

  return {
    zipBase64: buffer.toString("base64"),
    zipFileName,
    summary: {
      totalProducts: feedRows.length,
      labeledProducts: result.supplemental.length,
      labels: result.labels,
      notes: result.notes,
      matchRate: result.matchRate,
      selectedColumn: result.column,
      warnings: result.notes
    }
  };
}

export function labelProducts(rows: Record<string, unknown>[], strategies: LabelStrategyConfig = defaultLabelStrategies) {
  const column = Object.entries(strategies).find(([, strategy]) => strategy !== "none")?.[0] as CustomLabelColumn | undefined;
  const labeledRows = rows.map((row) => ({
    id: productId(row),
    [column || "custom_label_0"]: "test",
    labelizer_product_title: fieldValue(row, titleFields),
    labelizer_brand: fieldValue(row, brandFields),
    labelizer_category: fieldValue(row, categoryFields),
    labelizer_price: fieldValue(row, priceFields),
    labelizer_availability: fieldValue(row, availabilityFields)
  }));

  return {
    rows: labeledRows,
    summary: {
      totalProducts: rows.length,
      labeledProducts: labeledRows.length,
      labels: { test: labeledRows.length },
      notes: ["Productfeed geupload zonder apart prestatierapport. Labels zijn daarom alleen als test gemarkeerd."],
      selectedColumn: column || "custom_label_0"
    }
  };
}
