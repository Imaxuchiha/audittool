import { MetricRow, PerformanceComparison, SummaryMetrics } from "@/lib/types/audit";

const emptySummary: SummaryMetrics = {
  impressions: 0,
  clicks: 0,
  spend: 0,
  conversions: 0,
  conversionValue: 0,
  ctr: 0,
  avgCpc: 0,
  cpa: 0,
  roas: 0,
  conversionRate: 0
};

function summarize(rows: MetricRow[]): SummaryMetrics {
  const total = rows.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      spend: acc.spend + row.spend,
      conversions: acc.conversions + row.conversions,
      conversionValue: acc.conversionValue + row.conversionValue
    }),
    {
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      conversionValue: 0
    }
  );

  return {
    ...total,
    ctr: total.impressions ? total.clicks / total.impressions : 0,
    avgCpc: total.clicks ? total.spend / total.clicks : 0,
    cpa: total.conversions ? total.spend / total.conversions : 0,
    roas: total.spend ? total.conversionValue / total.spend : 0,
    conversionRate: total.clicks ? total.conversions / total.clicks : 0
  };
}

function diff(a: SummaryMetrics, b: SummaryMetrics): SummaryMetrics {
  return Object.keys(emptySummary).reduce((acc, key) => {
    const metric = key as keyof SummaryMetrics;
    acc[metric] = a[metric] - b[metric];
    return acc;
  }, { ...emptySummary });
}

function diffPercent(a: SummaryMetrics, b: SummaryMetrics): SummaryMetrics {
  return Object.keys(emptySummary).reduce((acc, key) => {
    const metric = key as keyof SummaryMetrics;
    acc[metric] = b[metric] ? (a[metric] - b[metric]) / b[metric] : 0;
    return acc;
  }, { ...emptySummary });
}

function groupByCampaign(rows: MetricRow[]): MetricRow[] {
  const map = new Map<string, MetricRow>();

  for (const row of rows) {
    const key = row.campaign || "Unlabelled campaign";
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...row, campaign: key });
      continue;
    }

    current.impressions += row.impressions;
    current.clicks += row.clicks;
    current.spend += row.spend;
    current.conversions += row.conversions;
    current.conversionValue += row.conversionValue;
    current.ctr = current.impressions ? current.clicks / current.impressions : 0;
    current.avgCpc = current.clicks ? current.spend / current.clicks : 0;
    current.cpa = current.conversions ? current.spend / current.conversions : 0;
    current.roas = current.spend ? current.conversionValue / current.spend : 0;
    current.conversionRate = current.clicks ? current.conversions / current.clicks : 0;
  }

  return [...map.values()];
}

export function buildPerformanceComparison(currentRows: MetricRow[], previousRows: MetricRow[]): PerformanceComparison {
  const current = summarize(currentRows);
  const previous = summarize(previousRows);
  const campaigns = groupByCampaign(currentRows);

  return {
    current,
    previous,
    delta: diff(current, previous),
    deltaPercent: diffPercent(current, previous),
    hasPreviousData: previousRows.length > 0,
    topCampaigns: [...campaigns]
      .filter((row) => row.spend > 0)
      .sort((a, b) => b.conversionValue - a.conversionValue || b.conversions - a.conversions || b.roas - a.roas)
      .slice(0, 5),
    weakCampaigns: [...campaigns]
      .filter((row) => row.spend > 0)
      .sort((a, b) => b.spend / Math.max(b.conversions, 0.01) - a.spend / Math.max(a.conversions, 0.01))
      .slice(0, 5)
  };
}
