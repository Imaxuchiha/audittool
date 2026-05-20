"use client";

import { useMemo, useState } from "react";
import { AuditInput, AuditReport, ParsedFileSummary, PriorityAction } from "@/lib/types/audit";
import { Download, FileDown, Loader2, Printer, Save } from "lucide-react";

interface ReportPreviewProps {
  input: AuditInput;
  report?: AuditReport;
  docxBase64?: string;
  fileName?: string;
  labeledProductsBase64?: string;
  labeledProductsFileName?: string;
  parsedFiles?: ParsedFileSummary[];
  onReportChange: (report: AuditReport) => void;
}

function downloadDocx(base64: string, fileName: string) {
  downloadBase64(base64, fileName, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}

function downloadBase64(base64: string, fileName: string, type: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatMetric(value: number, type: "money" | "number" | "percent" | "ratio" = "number") {
  if (type === "money") {
    return new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
  }
  if (type === "percent") return `${(value * 100).toFixed(1)}%`;
  if (type === "ratio") return value.toFixed(1);
  return value.toFixed(0);
}

function reportHtml(input: AuditInput, report: AuditReport) {
  const section = (title: string, rows: string[]) => `
    <section>
      <h2>${title}</h2>
      ${rows.map((row) => `<p>${escapeHtml(row)}</p>`).join("")}
    </section>
  `;

  return `<!doctype html>
    <html>
      <head>
        <title>${escapeHtml(report.title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; line-height: 1.5; padding: 42px; }
          h1 { font-size: 30px; margin-bottom: 6px; }
          h2 { font-size: 18px; margin-top: 28px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
          p { font-size: 12px; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
          th, td { border: 1px solid #d1d5db; padding: 7px; text-align: left; vertical-align: top; }
          th { background: #f3f4f6; }
          .meta { color: #4b5563; margin-bottom: 24px; }
          @page { margin: 18mm; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(report.title)}</h1>
        <p class="meta">${escapeHtml(input.websiteUrl || "Website not specified")} | ${escapeHtml(input.currentPeriod || "Current period not specified")}</p>
        ${section("1. Executive Summary", report.executiveSummary)}
        ${section("2. Performance Comparison", report.performanceNarrative)}
        ${section("3. Campaign & Budget Analysis", report.campaignBudgetAnalysis)}
        ${section("4. Search Terms & Intent Analysis", report.searchTermsIntentAnalysis)}
        ${section("5. Change History & Account Hygiene", report.changeHistoryHygiene)}
        ${section("6. Website / Landing Page / GA4 CRO Notes", report.croNotes)}
        <section>
          <h2>7. Recommended Next Steps</h2>
          <table>
            <thead><tr><th>Action</th><th>Impact</th><th>Effort</th><th>Type</th></tr></thead>
            <tbody>
              ${report.nextSteps
                .map(
                  (step) =>
                    `<tr><td>${escapeHtml(step.action)}</td><td>${step.impact}</td><td>${step.effort}</td><td>${escapeHtml(step.type === "quick_win" ? "Quick win" : "Strategic")}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </section>
      </body>
    </html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printReport(input: AuditInput, report: AuditReport) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
  if (!printWindow) return;
  printWindow.document.write(reportHtml(input, report));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function SectionEditor({
  title,
  rows,
  onChange
}: {
  title: string;
  rows: string[];
  onChange: (rows: string[]) => void;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="mt-3 space-y-3">
        {rows.map((row, index) => (
          <textarea
            key={`${title}-${index}`}
            value={row}
            onChange={(event) => {
              const nextRows = [...rows];
              nextRows[index] = event.target.value;
              onChange(nextRows);
            }}
            rows={Math.max(2, Math.ceil(row.length / 95))}
            className="w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-sm leading-6 text-gray-700"
          />
        ))}
      </div>
    </section>
  );
}

export function ReportPreview({
  input,
  report,
  docxBase64,
  fileName,
  labeledProductsBase64,
  labeledProductsFileName,
  parsedFiles = [],
  onReportChange
}: ReportPreviewProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string>();

  const uploadedRows = useMemo(() => parsedFiles.reduce((sum, file) => sum + file.rows, 0), [parsedFiles]);

  async function downloadEditedDocx() {
    if (!report) return;
    setExporting(true);
    setExportError(undefined);
    const response = await fetch("/api/audit/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, report, fileName })
    });
    const payload = await response.json();
    setExporting(false);

    if (!response.ok) {
      setExportError(payload.error || "Could not export DOCX.");
      return;
    }

    downloadDocx(payload.docxBase64, payload.fileName);
  }

  function updateReport(partial: Partial<AuditReport>) {
    if (!report) return;
    onReportChange({ ...report, ...partial });
  }

  function updateAction(index: number, patch: Partial<PriorityAction>) {
    if (!report) return;
    const nextSteps = [...report.nextSteps];
    nextSteps[index] = { ...nextSteps[index], ...patch };
    updateReport({ nextSteps });
  }

  if (!report) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-mist p-8 text-sm text-gray-600">
        Your audit preview will appear here after generation. Uploads stay in memory for this request only.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-white p-6 shadow-soft">
      <div className="flex flex-col gap-4 border-b border-line pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Editable report preview</p>
            <input
              value={report.title}
              onChange={(event) => updateReport({ title: event.target.value })}
              className="mt-1 w-full rounded-md border border-transparent px-0 text-2xl font-semibold text-ink focus:border-line focus:px-2"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {docxBase64 ? (
              <button
                type="button"
                onClick={downloadEditedDocx}
                disabled={exporting}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                Download DOCX
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => printReport(input, report)}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-mist"
            >
              <Printer size={16} />
              Save as PDF
            </button>
            {labeledProductsBase64 ? (
              <button
                type="button"
                onClick={() =>
                  downloadBase64(
                    labeledProductsBase64,
                    labeledProductsFileName || "labeled-products.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-mist"
              >
                <FileDown size={16} />
                Download labeled products
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-lg bg-mist p-3">
            <p className="text-xs font-medium text-gray-500">Parsed files</p>
            <p className="mt-1 font-semibold text-ink">{parsedFiles.length}</p>
          </div>
          <div className="rounded-lg bg-mist p-3">
            <p className="text-xs font-medium text-gray-500">Parsed rows</p>
            <p className="mt-1 font-semibold text-ink">{uploadedRows}</p>
          </div>
          <div className="rounded-lg bg-mist p-3">
            <p className="text-xs font-medium text-gray-500">Detected painpoints</p>
            <p className="mt-1 font-semibold text-ink">{report.painpoints.length}</p>
          </div>
        </div>

        {parsedFiles.length ? (
          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
            {parsedFiles.map((file) => (
              <span key={`${file.slot}-${file.fileName}`} className="rounded-full border border-line px-3 py-1">
                {file.fileName}: {file.rows} rows
              </span>
            ))}
          </div>
        ) : null}

        {exportError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{exportError}</p> : null}
      </div>

      <div className="mt-6 grid gap-6">
        <section className="grid gap-3 md:grid-cols-3">
          {[
            ["Spend", formatMetric(report.comparison.current.spend, "money")],
            ["Conversions", formatMetric(report.comparison.current.conversions)],
            ["ROAS", formatMetric(report.comparison.current.roas, "ratio")]
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line p-4">
              <p className="text-xs font-medium text-gray-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
            </div>
          ))}
        </section>

        <SectionEditor title="1. Executive Summary" rows={report.executiveSummary} onChange={(rows) => updateReport({ executiveSummary: rows })} />
        <SectionEditor title="2. Performance Comparison" rows={report.performanceNarrative} onChange={(rows) => updateReport({ performanceNarrative: rows })} />
        <SectionEditor title="3. Campaign & Budget Analysis" rows={report.campaignBudgetAnalysis} onChange={(rows) => updateReport({ campaignBudgetAnalysis: rows })} />
        <SectionEditor title="4. Search Terms & Intent Analysis" rows={report.searchTermsIntentAnalysis} onChange={(rows) => updateReport({ searchTermsIntentAnalysis: rows })} />
        <SectionEditor title="5. Change History & Account Hygiene" rows={report.changeHistoryHygiene} onChange={(rows) => updateReport({ changeHistoryHygiene: rows })} />
        <SectionEditor title="6. Website / Landing Page / GA4 CRO Notes" rows={report.croNotes} onChange={(rows) => updateReport({ croNotes: rows })} />

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Detected painpoints</h3>
          <div className="mt-3 space-y-3">
            {report.painpoints.length ? (
              report.painpoints.slice(0, 8).map((painpoint) => (
                <div key={`${painpoint.title}-${painpoint.evidence}`} className="rounded-lg border border-line p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold text-ink">{painpoint.title}</p>
                    <span className="rounded-full bg-mist px-2 py-1 text-xs font-medium text-gray-600">{painpoint.severity}</span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{painpoint.evidence}</p>
                  <p className="mt-2 text-sm text-gray-800">{painpoint.recommendation}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-600">No automatic painpoints detected yet. Add campaign and search term exports for sharper output.</p>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">7. Recommended Next Steps</h3>
            <Save size={16} className="text-gray-400" />
          </div>
          <div className="mt-3 divide-y divide-line rounded-lg border border-line">
            {report.nextSteps.map((step, index) => (
              <div key={`${step.action}-${index}`} className="grid gap-3 p-4 text-sm md:grid-cols-[1fr_88px_88px_130px]">
                <textarea
                  value={step.action}
                  onChange={(event) => updateAction(index, { action: event.target.value })}
                  rows={2}
                  className="rounded-md border border-line px-3 py-2 font-medium text-ink"
                />
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={step.impact}
                  onChange={(event) => updateAction(index, { impact: Number(event.target.value) as PriorityAction["impact"] })}
                  className="rounded-md border border-line px-3 py-2"
                  aria-label="Impact"
                />
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={step.effort}
                  onChange={(event) => updateAction(index, { effort: Number(event.target.value) as PriorityAction["effort"] })}
                  className="rounded-md border border-line px-3 py-2"
                  aria-label="Effort"
                />
                <select
                  value={step.type}
                  onChange={(event) => updateAction(index, { type: event.target.value as PriorityAction["type"] })}
                  className="rounded-md border border-line px-3 py-2"
                  aria-label="Action type"
                >
                  <option value="quick_win">Quick win</option>
                  <option value="strategic">Strategic</option>
                </select>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <FileDown size={14} />
            DOCX export uses the edited text above. PDF uses the browser print dialog, so choose “Save as PDF”.
          </p>
        </section>
      </div>
    </div>
  );
}
