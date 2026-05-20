import { AuditInput, MetricRow, Painpoint, PriorityAction } from "@/lib/types/audit";

const informationalTerms = [
  "how",
  "what",
  "why",
  "guide",
  "tutorial",
  "free",
  "example",
  "meaning",
  "wat",
  "hoe",
  "gratis",
  "uitleg",
  "voorbeeld"
];

function money(value: number): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export function detectPainpoints(input: AuditInput, campaignRows: MetricRow[], searchTermRows: MetricRow[], changeRows: MetricRow[]): Painpoint[] {
  const painpoints: Painpoint[] = [];
  const accountSpend = campaignRows.reduce((sum, row) => sum + row.spend, 0);
  const accountCtr =
    campaignRows.reduce((sum, row) => sum + row.clicks, 0) /
    Math.max(campaignRows.reduce((sum, row) => sum + row.impressions, 0), 1);

  const highSpendZeroConversions = campaignRows
    .filter((row) => row.spend > accountSpend * 0.08 && row.conversions === 0)
    .slice(0, 4);

  for (const row of highSpendZeroConversions) {
    painpoints.push({
      title: `${row.campaign || "Campaign"} is spending without conversions`,
      severity: "high",
      evidence: `${row.campaign || "This campaign"} spent ${money(row.spend)} and recorded no conversions in the uploaded period.`,
      recommendation: "Pause the worst queries or assets first, then check tracking and landing-page intent before adding more budget.",
      section: "budget"
    });
  }

  const lowCtrRows = campaignRows.filter((row) => row.impressions > 500 && row.ctr > 0 && row.ctr < accountCtr * 0.65).slice(0, 3);
  for (const row of lowCtrRows) {
    painpoints.push({
      title: `${row.campaign || "Campaign"} has weak click-through rate`,
      severity: "medium",
      evidence: `CTR is ${(row.ctr * 100).toFixed(1)}% versus an account average of ${(accountCtr * 100).toFixed(1)}%.`,
      recommendation: "Tighten targeting, split mixed intent, and refresh ad copy around the strongest commercial hook.",
      section: "performance"
    });
  }

  const highCpcLowCvr = campaignRows.filter((row) => row.avgCpc > 0 && row.conversionRate < 0.01 && row.clicks > 50).slice(0, 3);
  for (const row of highCpcLowCvr) {
    painpoints.push({
      title: `${row.campaign || "Campaign"} pays for clicks that do not turn into demand`,
      severity: "high",
      evidence: `${row.clicks.toFixed(0)} clicks produced a ${(row.conversionRate * 100).toFixed(1)}% conversion rate at ${money(row.avgCpc)} average CPC.`,
      recommendation: "Review search intent and the landing page together; the issue is probably not solved by bids alone.",
      section: "cro"
    });
  }

  const wasteTerms = searchTermRows
    .filter((row) => {
      const term = row.searchTerm?.toLowerCase() || "";
      return row.spend > 10 && informationalTerms.some((word) => term.includes(word)) && row.conversions === 0;
    })
    .slice(0, 8);

  if (wasteTerms.length) {
    painpoints.push({
      title: "Informational search terms are consuming budget",
      severity: "medium",
      evidence: `Examples: ${wasteTerms.map((row) => row.searchTerm).filter(Boolean).slice(0, 5).join(", ")}.`,
      recommendation: "Add negatives for clear research intent and isolate discovery terms from bottom-funnel campaigns.",
      section: "search_terms"
    });
  }

  const pmaxRisk = campaignRows.find((row) => (row.campaignType || row.campaign || "").toLowerCase().includes("pmax") && row.spend > 50 && row.roas < 1.5);
  if (pmaxRisk) {
    painpoints.push({
      title: "PMax needs more segmentation before scaling",
      severity: "medium",
      evidence: `${pmaxRisk.campaign || "PMax"} has ${pmaxRisk.roas.toFixed(1)} ROAS on ${money(pmaxRisk.spend)} spend.`,
      recommendation: "Break out product/category performance, check feed quality, and separate proven winners from testing inventory.",
      section: "budget"
    });
  }

  const ecommerceLowCvr = input.businessType === "ecommerce" && campaignRows.some((row) => row.clicks > 200 && row.conversionRate < 0.01);
  if (ecommerceLowCvr) {
    painpoints.push({
      title: "Traffic volume is not translating into ecommerce conversion rate",
      severity: "high",
      evidence: "The uploads show meaningful click volume with weak purchase conversion rate.",
      recommendation: "Audit product pages, price competitiveness, delivery promises, reviews, and checkout friction before buying more traffic.",
      section: "cro"
    });
  }

  const leadGenNoLeads = input.businessType === "lead_gen" && campaignRows.some((row) => row.clicks > 100 && row.conversions === 0);
  if (leadGenNoLeads) {
    painpoints.push({
      title: "Lead gen traffic is not producing visible leads",
      severity: "high",
      evidence: "Campaigns have click volume but no recorded lead conversions.",
      recommendation: "Check form tracking, thank-you page events, call tracking, and landing-page message match before judging media quality.",
      section: "tracking"
    });
  }

  if (changeRows.length > 80) {
    painpoints.push({
      title: "Account activity may be too noisy",
      severity: "medium",
      evidence: `${changeRows.length} change-history rows were uploaded for the period.`,
      recommendation: "Cluster changes by date and theme so performance shifts can be connected to actual decisions.",
      section: "hygiene"
    });
  } else if (campaignRows.length && changeRows.length < 3 && campaignRows.some((row) => row.spend > 100 && row.conversions === 0)) {
    painpoints.push({
      title: "Poor performance with little visible optimization activity",
      severity: "medium",
      evidence: "The account shows spend issues but very limited change-history data.",
      recommendation: "Set a weekly optimization rhythm for search terms, budgets, bid strategy checks, and landing-page learnings.",
      section: "hygiene"
    });
  }

  const scaleOpportunity = campaignRows.find((row) => row.roas >= 5 && row.spend > 0 && row.spend < accountSpend * 0.15);
  if (scaleOpportunity) {
    painpoints.push({
      title: `${scaleOpportunity.campaign || "A profitable campaign"} looks underfunded`,
      severity: "low",
      evidence: `${scaleOpportunity.roas.toFixed(1)} ROAS with only ${money(scaleOpportunity.spend)} spend.`,
      recommendation: "Increase budget gradually while watching marginal CPA/ROAS, search lost IS, and impression-share ceilings.",
      section: "budget"
    });
  }

  const budgetLost = campaignRows.find((row) => row.impressionShareLostBudget && row.impressionShareLostBudget > 20 && row.roas > 2);
  if (budgetLost) {
    painpoints.push({
      title: "Profitable demand is being capped by budget",
      severity: "medium",
      evidence: `${budgetLost.campaign || "A campaign"} reports ${budgetLost.impressionShareLostBudget?.toFixed(0)}% lost impression share by budget.`,
      recommendation: "Move budget from low-return campaigns before increasing total spend.",
      section: "budget"
    });
  }

  const rankLost = campaignRows.find((row) => row.impressionShareLostRank && row.impressionShareLostRank > 35);
  if (rankLost) {
    painpoints.push({
      title: "Ranking losses point to relevance, quality, or bid pressure",
      severity: "medium",
      evidence: `${rankLost.campaign || "A campaign"} reports ${rankLost.impressionShareLostRank?.toFixed(0)}% lost impression share by rank.`,
      recommendation: "Improve ad relevance and landing-page alignment before simply pushing CPCs higher.",
      section: "performance"
    });
  }

  return painpoints.slice(0, 12);
}

export function buildPriorityActions(painpoints: Painpoint[]): PriorityAction[] {
  const baseActions = painpoints.slice(0, 8).map((painpoint): PriorityAction => ({
    action: painpoint.recommendation,
    impact: painpoint.severity === "high" ? 5 : painpoint.severity === "medium" ? 4 : 3,
    effort: painpoint.section === "cro" || painpoint.section === "tracking" ? 4 : 2,
    type: painpoint.section === "cro" || painpoint.section === "tracking" ? "strategic" : "quick_win"
  }));

  const fallbackAction: PriorityAction = {
    action: "Create a weekly optimization log that links budget, query, bid, and landing-page changes to performance movement.",
    impact: 4,
    effort: 2,
    type: "quick_win"
  };

  return [
    ...baseActions,
    fallbackAction
  ].slice(0, 10);
}
