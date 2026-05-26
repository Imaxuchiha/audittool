"use client";

import { FormEvent, useState } from "react";
import { FileUpload, uploadSlots } from "@/components/FileUpload";
import { ReportPreview } from "@/components/ReportPreview";
import { AuditInput, AuditReport, LabelStrategy, ParsedFileSummary, UploadSlot } from "@/lib/types/audit";
import { Loader2, Sparkles } from "lucide-react";

const initialInput: AuditInput = {
  clientName: "",
  contactEmail: "",
  websiteUrl: "",
  language: "en",
  currentPeriod: "",
  previousPeriod: "",
  compareWithPreviousPeriod: false,
  businessType: "lead_gen",
  mainGoal: "leads",
  strategistNotes: "",
  leadConsent: false,
  useProductLabelizer: false,
  labelStrategies: {
    custom_label_0: "priority",
    custom_label_1: "price",
    custom_label_2: "margin",
    custom_label_3: "category",
    custom_label_4: "stock"
  }
};

const labelStrategyOptions: Array<{ value: LabelStrategy; label: string; help: string }> = [
  { value: "priority", label: "Priority / scaling", help: "Scale, standard, margin-protect or exclude." },
  { value: "price", label: "Price bucket", help: "Low, mid, high or premium." },
  { value: "margin", label: "Margin bucket", help: "Low, mid, high or unknown margin." },
  { value: "category", label: "Category", help: "Based on product type/category." },
  { value: "stock", label: "Stock status", help: "In stock, delayed or out of stock." },
  { value: "brand", label: "Brand", help: "Creates brand-based labels." },
  { value: "sale", label: "Sale / promo", help: "On sale, promo sale or regular price." },
  { value: "season", label: "Season", help: "Winter, summer, spring, autumn or evergreen." },
  { value: "shipping", label: "Shipping", help: "Free, standard, express or dropshipping." },
  { value: "performance", label: "Performance", help: "Top performer, low ROAS or waste watch if metrics exist." },
  { value: "gender", label: "Gender", help: "Uses gender column when available." },
  { value: "size", label: "Size", help: "Uses size/maat column when available." },
  { value: "release_year", label: "Release year", help: "Uses release/model year when available." },
  { value: "none", label: "Do not fill", help: "Leaves this custom label empty." }
];

interface EmailStatus {
  enabled: boolean;
  leadEmailSent: boolean;
  ownerEmailSent: boolean;
  error?: string;
}

export function AuditForm() {
  const [input, setInput] = useState<AuditInput>(initialInput);
  const [files, setFiles] = useState<Partial<Record<UploadSlot, File>>>({});
  const [report, setReport] = useState<AuditReport>();
  const [docxBase64, setDocxBase64] = useState<string>();
  const [fileName, setFileName] = useState<string>();
  const [labeledProductsBase64, setLabeledProductsBase64] = useState<string>();
  const [labeledProductsFileName, setLabeledProductsFileName] = useState<string>();
  const [parsedFiles, setParsedFiles] = useState<ParsedFileSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "parsing" | "ready" | "error">("idle");
  const [error, setError] = useState<string>();
  const [leadSaved, setLeadSaved] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>();
  const activeUploadSlots = uploadSlots.filter((slot) => input.useProductLabelizer || slot !== "product_source");

  function update<K extends keyof AuditInput>(key: K, value: AuditInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function updateLabelStrategy(label: keyof AuditInput["labelStrategies"], value: LabelStrategy) {
    setInput((current) => ({
      ...current,
      labelStrategies: {
        ...current.labelStrategies,
        [label]: value
      }
    }));
  }

  function updateFile(slot: UploadSlot, file?: File) {
    setFiles((current) => ({ ...current, [slot]: file }));
  }

  function toggleComparison(enabled: boolean) {
    setInput((current) => ({
      ...current,
      compareWithPreviousPeriod: enabled,
      previousPeriod: enabled ? current.previousPeriod : ""
    }));
  }

  function toggleProductLabelizer(enabled: boolean) {
    setInput((current) => ({ ...current, useProductLabelizer: enabled }));

    if (!enabled) {
      setFiles((current) => {
        const next = { ...current };
        delete next.product_source;
        return next;
      });
      setLabeledProductsBase64(undefined);
      setLabeledProductsFileName(undefined);
    }
  }

  async function saveLeadToNetlifyForms(nextParsedFiles: ParsedFileSummary[]) {
    try {
      const body = new URLSearchParams({
        "form-name": "campaignscan-leads",
        email: input.contactEmail,
        client_name: input.clientName,
        website_url: input.websiteUrl,
        business_type: input.businessType,
        main_goal: input.mainGoal,
        audit_language: input.language,
        current_period: input.currentPeriod,
        previous_period: input.previousPeriod,
        consent: input.leadConsent ? "yes" : "no",
        uploaded_files: nextParsedFiles.map((file) => file.fileName).join(", "),
        submitted_at: new Date().toISOString()
      });

      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });

      setLeadSaved(response.ok);
    } catch {
      setLeadSaved(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("parsing");
    setError(undefined);
    setLeadSaved(false);
    setEmailStatus(undefined);

    const formData = new FormData();
    Object.entries(input).forEach(([key, value]) => {
      if (key === "labelStrategies") {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    });
    activeUploadSlots.forEach((slot) => {
      const file = files[slot];
      if (file) formData.append(slot, file);
    });

    const response = await fetch("/api/audit/generate", {
      method: "POST",
      body: formData
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus("error");
      setError(payload.error || "The audit could not be generated.");
      return;
    }

    setReport(payload.report);
    setDocxBase64(payload.docxBase64);
    setFileName(payload.fileName);
    setLabeledProductsBase64(payload.labeledProductsBase64);
    setLabeledProductsFileName(payload.labeledProductsFileName);
    setParsedFiles(payload.parsedFiles || []);
    setEmailStatus(payload.emailStatus);
    setStatus("ready");
    void saveLeadToNetlifyForms(payload.parsedFiles || []);
  }

  return (
    <>
      <form name="campaignscan-leads" data-netlify="true" hidden>
        <input type="hidden" name="form-name" value="campaignscan-leads" />
        <input type="email" name="email" />
        <input type="text" name="client_name" />
        <input type="text" name="website_url" />
        <input type="text" name="business_type" />
        <input type="text" name="main_goal" />
        <input type="text" name="audit_language" />
        <input type="text" name="current_period" />
        <input type="text" name="previous_period" />
        <input type="text" name="consent" />
        <input type="text" name="uploaded_files" />
        <input type="text" name="submitted_at" />
      </form>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <form onSubmit={submit} className="rounded-lg border border-line bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">New audit</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Upload exports, get a strategist-grade report.</h1>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-line bg-mist p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Send report to</h2>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-ink">
              Email address
              <input
                required
                type="email"
                value={input.contactEmail}
                onChange={(event) => update("contactEmail", event.target.value)}
                placeholder="you@company.com"
                className="rounded-md border border-line bg-white px-3 py-2"
              />
            </label>
            <label className="flex gap-3 rounded-md border border-line bg-white p-3 text-sm leading-6 text-gray-700">
              <input
                required
                type="checkbox"
                checked={input.leadConsent}
                onChange={(event) => update("leadConsent", event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-line"
              />
              <span>
                I agree that Adsvantage may store this email address and contact me about this audit and relevant PPC follow-up.
              </span>
            </label>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-ink">
            Client name
            <input required value={input.clientName} onChange={(event) => update("clientName", event.target.value)} className="rounded-md border border-line px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-ink">
            Website URL
            <input value={input.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} className="rounded-md border border-line px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-ink">
            Audit language
            <select value={input.language} onChange={(event) => update("language", event.target.value as AuditInput["language"])} className="rounded-md border border-line px-3 py-2">
              <option value="en">English</option>
              <option value="nl">Dutch</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-ink">
            Business type
            <select value={input.businessType} onChange={(event) => update("businessType", event.target.value as AuditInput["businessType"])} className="rounded-md border border-line px-3 py-2">
              <option value="ecommerce">Ecommerce</option>
              <option value="lead_gen">Lead gen</option>
              <option value="local_service">Local service</option>
              <option value="b2b">B2B</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-ink">
            Current period <span className="font-normal text-gray-500">(optional)</span>
            <input placeholder="Apr 1 - Apr 30, 2026" value={input.currentPeriod} onChange={(event) => update("currentPeriod", event.target.value)} className="rounded-md border border-line px-3 py-2" />
          </label>
          <div className="grid gap-3 rounded-lg border border-line bg-mist p-3 text-sm font-medium text-ink">
            <div className="flex items-center justify-between gap-3">
              <span>Compare with previous period?</span>
              <button
                type="button"
                aria-pressed={input.compareWithPreviousPeriod}
                onClick={() => toggleComparison(!input.compareWithPreviousPeriod)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  input.compareWithPreviousPeriod ? "border-ink bg-ink text-white" : "border-line bg-white text-gray-600 hover:border-ink"
                }`}
              >
                {input.compareWithPreviousPeriod ? "Yes" : "No"}
              </button>
            </div>
            {input.compareWithPreviousPeriod ? (
              <label className="grid gap-1">
                Previous comparison period <span className="font-normal text-gray-500">(optional label)</span>
                <input
                  placeholder="Mar 1 - Mar 31, 2026"
                  value={input.previousPeriod}
                  onChange={(event) => update("previousPeriod", event.target.value)}
                  className="rounded-md border border-line bg-white px-3 py-2"
                />
              </label>
            ) : (
              <p className="text-xs font-normal leading-5 text-gray-500">
                Leave this off for a quick current-state audit. The report will not force a period comparison.
              </p>
            )}
          </div>
          <label className="grid gap-1 text-sm font-medium text-ink sm:col-span-2">
            Main goal
            <select value={input.mainGoal} onChange={(event) => update("mainGoal", event.target.value as AuditInput["mainGoal"])} className="rounded-md border border-line px-3 py-2">
              <option value="leads">Leads</option>
              <option value="purchases">Purchases</option>
              <option value="roas">ROAS</option>
              <option value="revenue">Revenue</option>
              <option value="bookings">Bookings</option>
              <option value="calls">Calls</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-ink sm:col-span-2">
            Notes from strategist
            <textarea value={input.strategistNotes} onChange={(event) => update("strategistNotes", event.target.value)} rows={5} className="rounded-md border border-line px-3 py-2" />
          </label>
        </div>

        <div className="mt-8 rounded-lg border border-line bg-mist p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Optionele producttool</h2>
              <p className="mt-1 text-sm text-gray-600">
                Zet aan als je een productfeed wilt uploaden en automatisch custom labels wilt maken.
              </p>
            </div>
            <button
              type="button"
              aria-pressed={input.useProductLabelizer}
              onClick={() => toggleProductLabelizer(!input.useProductLabelizer)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                input.useProductLabelizer ? "border-ink bg-ink text-white" : "border-line bg-white text-gray-600 hover:border-ink"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${input.useProductLabelizer ? "bg-white" : "bg-gray-300"}`}
              />
              {input.useProductLabelizer ? "Aan" : "Uit"}
            </button>
          </div>

          {input.useProductLabelizer ? (
            <div className="mt-4 grid gap-3 border-t border-line pt-4">
              <p className="text-sm text-gray-600">
                Kies simpel wat de tool invult in Google Shopping custom_label_0 t/m custom_label_4.
              </p>
              {(["custom_label_0", "custom_label_1", "custom_label_2", "custom_label_3", "custom_label_4"] as const).map((label) => {
                const selected = labelStrategyOptions.find((option) => option.value === input.labelStrategies[label]);
                return (
                  <label key={label} className="grid gap-1 text-sm font-medium text-ink sm:grid-cols-[130px_1fr] sm:items-center">
                    <span>{label}</span>
                    <span>
                      <select
                        value={input.labelStrategies[label]}
                        onChange={(event) => updateLabelStrategy(label, event.target.value as LabelStrategy)}
                        className="w-full rounded-md border border-line bg-white px-3 py-2"
                      >
                        {labelStrategyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1 block text-xs font-normal text-gray-500">{selected?.help}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-line bg-white px-3 py-2 text-sm text-gray-500">
              Productfeed upload staat uit. Voor een normale audit hoef je hier niets mee te doen.
            </p>
          )}
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Uploads</h2>
          <div className="mt-3">
            <FileUpload files={files} onChange={updateFile} slots={activeUploadSlots} />
          </div>
        </div>

        {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {leadSaved ? <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">Lead saved for Adsvantage follow-up.</p> : null}
        {emailStatus?.leadEmailSent ? (
          <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">The audit report was emailed to {input.contactEmail}.</p>
        ) : null}
        {emailStatus?.enabled && emailStatus.error ? (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
            Report generated, but email sending needs attention: {emailStatus.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status === "parsing"}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "parsing" ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
          {status === "parsing" ? "Parsing exports and writing report" : "Generate and email audit report"}
        </button>
      </form>

      <ReportPreview
        input={input}
        report={report}
        docxBase64={docxBase64}
        fileName={fileName}
        labeledProductsBase64={labeledProductsBase64}
        labeledProductsFileName={labeledProductsFileName}
        parsedFiles={parsedFiles}
        onReportChange={setReport}
      />
      </div>
    </>
  );
}
