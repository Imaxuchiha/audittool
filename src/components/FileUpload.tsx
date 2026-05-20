"use client";

import { UploadSlot } from "@/lib/types/audit";
import { FileSpreadsheet, FileText } from "lucide-react";

const labels: Record<UploadSlot, string> = {
  google_ads_campaigns: "Google Ads campaigns",
  google_ads_search_terms: "Search terms",
  google_ads_keywords: "Keywords",
  google_ads_change_history: "Change history",
  google_ads_conversions: "Conversions",
  google_ads_assets: "Assets",
  ga4_pages: "GA4 pages",
  ga4_events: "GA4 events",
  search_console_queries: "Search Console queries",
  product_source: "Product source / feed",
  website_notes: "Website notes"
};

const hints: Record<UploadSlot, string> = {
  google_ads_campaigns: "campaigns.csv or .xlsx",
  google_ads_search_terms: "search_terms.csv or .xlsx",
  google_ads_keywords: "keywords.csv or .xlsx",
  google_ads_change_history: "change_history.csv or .xlsx",
  google_ads_conversions: "conversions.csv or .xlsx",
  google_ads_assets: "assets.csv or .xlsx",
  ga4_pages: "pages.csv or .xlsx",
  ga4_events: "events.csv or .xlsx",
  search_console_queries: "queries.csv or .xlsx",
  product_source: "product feed.csv or .xlsx",
  website_notes: ".md or .txt"
};

export const uploadSlots = Object.keys(labels) as UploadSlot[];

interface FileUploadProps {
  files: Partial<Record<UploadSlot, File>>;
  onChange: (slot: UploadSlot, file?: File) => void;
}

export function FileUpload({ files, onChange }: FileUploadProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {uploadSlots.map((slot) => {
        const file = files[slot];
        const Icon = slot === "website_notes" ? FileText : FileSpreadsheet;
        return (
          <label
            key={slot}
            className="group flex cursor-pointer items-center gap-4 rounded-lg border border-line bg-white p-4 shadow-sm transition hover:border-ink"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-mist text-ink">
              <Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{labels[slot]}</span>
              <span className="block truncate text-xs text-gray-500">{file ? file.name : hints[slot]}</span>
            </span>
            <input
              type="file"
              accept={slot === "website_notes" ? ".txt,.md" : ".csv,.xlsx,.xls"}
              className="hidden"
              onChange={(event) => onChange(slot, event.target.files?.[0])}
            />
          </label>
        );
      })}
    </div>
  );
}
