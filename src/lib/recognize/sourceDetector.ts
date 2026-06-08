import { UploadSlot } from "@/lib/types/audit";

export interface SourceDetection {
  slot: UploadSlot | "unknown";
  confidence: "high" | "medium" | "low";
  reason: string;
  requiredFieldsPresent: boolean;
  warnings: string[];
}

interface SourceRule {
  slot: UploadSlot;
  label: string;
  requiredAny: string[][];
  strongSignals: string[];
  weakSignals?: string[];
}

const rules: SourceRule[] = [
  {
    slot: "google_ads_campaigns",
    label: "Google Ads-campagnes",
    requiredAny: [["campaign", "campagne"], ["cost", "costs", "kosten", "spend"]],
    strongSignals: ["campaign", "campagne", "impressions", "impr.", "clicks", "klikken", "cost", "kosten"],
    weakSignals: ["budget", "campaign type", "campagnetype"]
  },
  {
    slot: "google_ads_search_terms",
    label: "zoektermen",
    requiredAny: [["search term", "zoekterm", "zoektermen"]],
    strongSignals: ["search term", "zoekterm", "added/excluded", "match type"],
    weakSignals: ["keyword", "zoekwoord", "ad group"]
  },
  {
    slot: "google_ads_keywords",
    label: "zoekwoorden",
    requiredAny: [["keyword", "zoekwoord"]],
    strongSignals: ["keyword", "zoekwoord", "quality score", "match type"],
    weakSignals: ["ad group", "campaign"]
  },
  {
    slot: "google_ads_change_history",
    label: "wijzigingsgeschiedenis",
    requiredAny: [["change", "wijziging", "change type", "description"]],
    strongSignals: ["change", "change type", "changed by", "wijziging", "gebruiker"],
    weakSignals: ["date", "datum"]
  },
  {
    slot: "google_ads_conversions",
    label: "conversies",
    requiredAny: [["conversion", "conversions", "conversies", "conversion action"]],
    strongSignals: ["conversion action", "conversions", "conversies", "all conv."],
    weakSignals: ["value", "waarde"]
  },
  {
    slot: "google_ads_assets",
    label: "assets",
    requiredAny: [["asset", "asset type"]],
    strongSignals: ["asset", "asset type", "performance", "policy"],
    weakSignals: ["impressions", "clicks"]
  },
  {
    slot: "ga4_pages",
    label: "GA4-pagina's",
    requiredAny: [["page", "page path", "pagina", "landing page"]],
    strongSignals: ["page path", "page title", "views", "sessions", "engagement"],
    weakSignals: ["bounce", "users"]
  },
  {
    slot: "ga4_events",
    label: "GA4-events",
    requiredAny: [["event", "event name", "gebeurtenis"]],
    strongSignals: ["event name", "event count", "key events", "events"],
    weakSignals: ["users"]
  },
  {
    slot: "search_console_queries",
    label: "Search Console-query's",
    requiredAny: [["query", "zoekopdracht"]],
    strongSignals: ["query", "clicks", "impressions", "position", "ctr"],
    weakSignals: ["page"]
  },
  {
    slot: "product_source",
    label: "productfeed",
    requiredAny: [["id", "item id", "offer id", "product id", "sku"]],
    strongSignals: ["id", "title", "product type", "google product category", "availability", "price"],
    weakSignals: ["brand", "custom_label_0", "custom label 0"]
  },
  {
    slot: "product_performance",
    label: "productprestaties",
    requiredAny: [["id", "item id", "offer id", "product id", "sku"], ["cost", "costs", "kosten", "spend", "clicks", "klikken", "conversion value", "conversiewaarde"]],
    strongSignals: ["item id", "offer id", "product id", "clicks", "cost", "kosten", "conversion value", "conversiewaarde"],
    weakSignals: ["roas", "conversions", "conversies"]
  },
  {
    slot: "previous_labelizer",
    label: "vorig labelizerbestand",
    requiredAny: [["id"], ["new label", "nieuw label", "previous label", "vorig label", "custom_label_0"]],
    strongSignals: ["previous label", "new label", "nieuw label", "labelizer", "custom_label_0"],
    weakSignals: ["reden", "reason"]
  }
];

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getColumns(rows: Record<string, unknown>[]): string[] {
  const columns = new Set<string>();
  rows.slice(0, 20).forEach((row) => Object.keys(row).forEach((key) => columns.add(normalize(key))));
  return [...columns];
}

function includesAny(columns: string[], candidates: string[]): boolean {
  return candidates.some((candidate) => columns.includes(normalize(candidate)));
}

function scoreRule(columns: string[], rule: SourceRule): number {
  const strong = rule.strongSignals.reduce((score, signal) => score + (columns.includes(normalize(signal)) ? 2 : 0), 0);
  const weak = (rule.weakSignals || []).reduce((score, signal) => score + (columns.includes(normalize(signal)) ? 1 : 0), 0);
  const required = rule.requiredAny.every((group) => includesAny(columns, group)) ? 4 : 0;
  return strong + weak + required;
}

function fileNameHint(fileName: string): UploadSlot | undefined {
  const lower = fileName.toLowerCase();
  if (lower.includes("search") || lower.includes("zoekterm")) return "google_ads_search_terms";
  if (lower.includes("keyword") || lower.includes("zoekwoord")) return "google_ads_keywords";
  if (lower.includes("change") || lower.includes("wijzig")) return "google_ads_change_history";
  if (lower.includes("asset")) return "google_ads_assets";
  if (lower.includes("conversion") || lower.includes("conversie")) return "google_ads_conversions";
  if (lower.includes("ga4") && lower.includes("event")) return "ga4_events";
  if (lower.includes("ga4") || lower.includes("page") || lower.includes("pagina")) return "ga4_pages";
  if (lower.includes("console") || lower.includes("query")) return "search_console_queries";
  if (lower.includes("performance") || lower.includes("prestatie")) return "product_performance";
  if (lower.includes("labelizer") || lower.includes("wijzigingen")) return "previous_labelizer";
  if (lower.includes("product") || lower.includes("feed") || lower.includes("merchant")) return "product_source";
  if (lower.includes("campaign") || lower.includes("campagne")) return "google_ads_campaigns";
  return undefined;
}

export function detectSource(rows: Record<string, unknown>[], fileName = ""): SourceDetection {
  if (!rows.length) {
    return {
      slot: "unknown",
      confidence: "low",
      reason: "Het bestand is leeg of bevat geen herkenbare rijen.",
      requiredFieldsPresent: false,
      warnings: ["Leeg bestand."]
    };
  }

  const columns = getColumns(rows);
  const scored = rules
    .map((rule) => ({
      rule,
      score: scoreRule(columns, rule),
      requiredFieldsPresent: rule.requiredAny.every((group) => includesAny(columns, group))
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const hint = fileNameHint(fileName);
  const hintedRule = hint ? scored.find((item) => item.rule.slot === hint) : undefined;
  const selected = hintedRule && hintedRule.score >= Math.max(3, best.score - 2) ? hintedRule : best;

  if (!selected || selected.score < 3) {
    return {
      slot: hint || "unknown",
      confidence: hint ? "low" : "low",
      reason: hint ? "Het bestandstype is alleen op basis van de bestandsnaam ingeschat." : "We herkennen dit bestand nog niet betrouwbaar.",
      requiredFieldsPresent: false,
      warnings: ["Controleer of de export de juiste kolommen bevat."]
    };
  }

  const confidence: SourceDetection["confidence"] = selected.score >= 8 && selected.requiredFieldsPresent ? "high" : selected.score >= 5 ? "medium" : "low";
  const warnings = selected.requiredFieldsPresent ? [] : [`We herkennen dit als ${selected.rule.label}, maar missen een verplichte kolomgroep.`];

  return {
    slot: selected.rule.slot,
    confidence,
    reason: `Herkend als ${selected.rule.label} op basis van kolommen zoals ${columns.slice(0, 5).join(", ")}.`,
    requiredFieldsPresent: selected.requiredFieldsPresent,
    warnings
  };
}

export function uploadSlotLabel(slot: UploadSlot | "unknown"): string {
  return rules.find((rule) => rule.slot === slot)?.label || "onbekend bestand";
}
