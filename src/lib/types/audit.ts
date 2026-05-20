export type AuditLanguage = "en" | "nl";

export type BusinessType = "ecommerce" | "lead_gen" | "local_service" | "b2b" | "other";

export type MainGoal = "leads" | "purchases" | "roas" | "revenue" | "bookings" | "calls";

export type LabelStrategy =
  | "none"
  | "priority"
  | "price"
  | "margin"
  | "category"
  | "stock"
  | "brand"
  | "sale"
  | "season"
  | "shipping"
  | "performance"
  | "product_type"
  | "gender"
  | "size"
  | "release_year";

export interface LabelStrategyConfig {
  custom_label_0: LabelStrategy;
  custom_label_1: LabelStrategy;
  custom_label_2: LabelStrategy;
  custom_label_3: LabelStrategy;
  custom_label_4: LabelStrategy;
}

export type UploadSlot =
  | "google_ads_campaigns"
  | "google_ads_search_terms"
  | "google_ads_keywords"
  | "google_ads_change_history"
  | "google_ads_conversions"
  | "google_ads_assets"
  | "ga4_pages"
  | "ga4_events"
  | "search_console_queries"
  | "product_source"
  | "website_notes";

export interface AuditInput {
  clientName: string;
  websiteUrl: string;
  language: AuditLanguage;
  currentPeriod: string;
  previousPeriod: string;
  businessType: BusinessType;
  mainGoal: MainGoal;
  strategistNotes: string;
  labelStrategies: LabelStrategyConfig;
}

export interface RawTable {
  fileName: string;
  slot: UploadSlot;
  rows: Record<string, unknown>[];
}

export interface ParsedFileSummary {
  fileName: string;
  slot: UploadSlot;
  rows: number;
}

export interface ProductLabelSummary {
  totalProducts: number;
  labeledProducts: number;
  labels: Record<string, number>;
  notes: string[];
}

export interface MetricRow {
  campaign?: string;
  campaignType?: string;
  adGroup?: string;
  keyword?: string;
  searchTerm?: string;
  landingPage?: string;
  date?: string;
  change?: string;
  changeUser?: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  avgCpc: number;
  cpa: number;
  roas: number;
  conversionRate: number;
  impressionShareLostBudget?: number;
  impressionShareLostRank?: number;
  raw: Record<string, unknown>;
}

export interface PerformanceComparison {
  current: SummaryMetrics;
  previous: SummaryMetrics;
  delta: SummaryMetrics;
  deltaPercent: SummaryMetrics;
  topCampaigns: MetricRow[];
  weakCampaigns: MetricRow[];
}

export interface SummaryMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  avgCpc: number;
  cpa: number;
  roas: number;
  conversionRate: number;
}

export type PainpointSeverity = "high" | "medium" | "low";

export interface Painpoint {
  title: string;
  severity: PainpointSeverity;
  evidence: string;
  recommendation: string;
  section: "performance" | "budget" | "search_terms" | "tracking" | "cro" | "hygiene";
}

export interface PriorityAction {
  action: string;
  impact: 1 | 2 | 3 | 4 | 5;
  effort: 1 | 2 | 3 | 4 | 5;
  type: "quick_win" | "strategic";
}

export interface AuditReport {
  title: string;
  executiveSummary: string[];
  performanceNarrative: string[];
  campaignBudgetAnalysis: string[];
  searchTermsIntentAnalysis: string[];
  changeHistoryHygiene: string[];
  croNotes: string[];
  nextSteps: PriorityAction[];
  painpoints: Painpoint[];
  comparison: PerformanceComparison;
  generatedAt: string;
}
