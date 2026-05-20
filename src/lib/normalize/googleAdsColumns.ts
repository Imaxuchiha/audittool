import { MetricRow } from "@/lib/types/audit";

const aliases: Record<string, string[]> = {
  campaign: ["campaign", "campaign name", "campagne", "campaign_name"],
  campaignType: ["campaign type", "advertising channel type", "type", "campagnetype"],
  adGroup: ["ad group", "ad group name", "advertentiegroep"],
  keyword: ["keyword", "keyword text", "zoekwoord"],
  searchTerm: ["search term", "search terms", "zoekterm", "zoektermen"],
  landingPage: ["landing page", "final url", "page path", "pagina", "url"],
  date: ["date", "day", "datum"],
  change: ["change", "change type", "wijziging", "description"],
  changeUser: ["user", "changed by", "gebruiker"],
  impressions: ["impr.", "impressions", "impressies"],
  clicks: ["clicks", "klikken"],
  spend: ["cost", "costs", "spend", "kosten"],
  conversions: ["conversions", "conv.", "conversies"],
  conversionValue: ["conversion value", "conv. value", "conversion value/cost", "conversiewaarde", "revenue"],
  ctr: ["ctr"],
  avgCpc: ["avg. cpc", "average cpc", "gem. cpc"],
  cpa: ["cost / conv.", "cost per conversion", "cpa", "kosten / conv."],
  roas: ["conv. value / cost", "roas", "return on ad spend"],
  conversionRate: ["conv. rate", "conversion rate", "conversieratio"],
  impressionShareLostBudget: ["search lost is (budget)", "impr. share lost budget", "lost is budget"],
  impressionShareLostRank: ["search lost is (rank)", "impr. share lost rank", "lost is rank"]
};

function keyFor(row: Record<string, unknown>, field: string): string | undefined {
  const normalizedKeys = Object.keys(row).map((key) => ({
    original: key,
    normalized: key.trim().toLowerCase()
  }));

  return normalizedKeys.find(({ normalized }) => aliases[field]?.includes(normalized))?.original;
}

function text(row: Record<string, unknown>, field: string): string | undefined {
  const key = keyFor(row, field);
  const value = key ? row[key] : undefined;
  if (value === undefined || value === null || value === "") return undefined;
  return String(value).trim();
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null || value === "") return 0;

  const cleaned = String(value)
    .replace(/[€$£,\s]/g, "")
    .replace("%", "")
    .replace(/\((.*)\)/, "-$1");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function number(row: Record<string, unknown>, field: string): number {
  const key = keyFor(row, field);
  return toNumber(key ? row[key] : undefined);
}

export function normalizeGoogleAdsRows(rows: Record<string, unknown>[]): MetricRow[] {
  return rows.map((row) => {
    const impressions = number(row, "impressions");
    const clicks = number(row, "clicks");
    const spend = number(row, "spend");
    const conversions = number(row, "conversions");
    const conversionValue = number(row, "conversionValue");
    const ctr = number(row, "ctr") || (impressions ? clicks / impressions : 0);
    const avgCpc = number(row, "avgCpc") || (clicks ? spend / clicks : 0);
    const cpa = number(row, "cpa") || (conversions ? spend / conversions : 0);
    const roas = number(row, "roas") || (spend ? conversionValue / spend : 0);
    const conversionRate = number(row, "conversionRate") || (clicks ? conversions / clicks : 0);

    return {
      campaign: text(row, "campaign"),
      campaignType: text(row, "campaignType"),
      adGroup: text(row, "adGroup"),
      keyword: text(row, "keyword"),
      searchTerm: text(row, "searchTerm"),
      landingPage: text(row, "landingPage"),
      date: text(row, "date"),
      change: text(row, "change"),
      changeUser: text(row, "changeUser"),
      impressions,
      clicks,
      spend,
      conversions,
      conversionValue,
      ctr,
      avgCpc,
      cpa,
      roas,
      conversionRate,
      impressionShareLostBudget: number(row, "impressionShareLostBudget"),
      impressionShareLostRank: number(row, "impressionShareLostRank"),
      raw: row
    };
  });
}
