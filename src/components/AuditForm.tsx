"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ReportPreview } from "@/components/ReportPreview";
import { parseCsv } from "@/lib/parsers/csvParser";
import { detectSource, uploadSlotLabel } from "@/lib/recognize/sourceDetector";
import { AuditInput, AuditMode, AuditReport, ParsedFileSummary, UploadSlot } from "@/lib/types/audit";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Loader2, Trash2, UploadCloud } from "lucide-react";

const initialInput: AuditInput = {
  mode: "audit",
  clientName: "",
  contactEmail: "",
  websiteUrl: "",
  language: "nl",
  currentPeriod: "",
  previousPeriod: "",
  compareWithPreviousPeriod: false,
  businessType: "lead_gen",
  mainGoal: "leads",
  strategistNotes: "",
  leadConsent: false,
  useProductLabelizer: false,
  productLabelColumn: "custom_label_0",
  labelStrategies: {
    custom_label_0: "performance",
    custom_label_1: "none",
    custom_label_2: "none",
    custom_label_3: "none",
    custom_label_4: "none"
  }
};

const uploadOptions: UploadSlot[] = [
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
  "product_performance",
  "previous_labelizer",
  "website_notes"
];

const modeCards: Array<{ mode: AuditMode; title: string; body: string }> = [
  { mode: "audit", title: "Mijn Google Ads-account controleren", body: "Ontvang een overzicht met concrete verbeterpunten." },
  { mode: "labelizer", title: "Mijn webshopproducten labelen", body: "Download een bestand waarmee je producten slimmer kunt indelen." },
  { mode: "both", title: "Beide uitvoeren", body: "Maak een accountscan en een productbestand." }
];

interface UploadedFile {
  id: string;
  file: File;
  slot: UploadSlot | "unknown";
  confidence: "high" | "medium" | "low";
  rows: number;
  warnings: string[];
  previewRows: Record<string, unknown>[];
  error?: string;
}

interface EmailStatus {
  enabled: boolean;
  leadEmailSent: boolean;
  ownerEmailSent: boolean;
  error?: string;
}

function isAuditMode(mode: AuditMode) {
  return mode === "audit" || mode === "both";
}

function isLabelizerMode(mode: AuditMode) {
  return mode === "labelizer" || mode === "both";
}

function productId(row: Record<string, unknown>): string {
  const key = Object.keys(row).find((candidate) =>
    ["id", "item id", "item_id", "offer id", "product id", "product_id", "sku"].includes(candidate.trim().toLowerCase())
  );
  const value = key ? row[key] : undefined;
  return value === undefined || value === null ? "" : String(value).trim();
}

function fileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
}

async function readFilePreview(file: File): Promise<UploadedFile> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  try {
    const buffer = await file.arrayBuffer();
    let rows: Record<string, unknown>[] = [];

    if (extension === "txt" || extension === "md") {
      rows = [{ content: await file.text() }];
      return {
        id: fileId(file),
        file,
        slot: "website_notes",
        confidence: "high",
        rows: 1,
        warnings: [],
        previewRows: rows
      };
    }

    rows = extension === "xlsx" || extension === "xls" ? [{ bestand: file.name }] : parseCsv(buffer);
    const detection = detectSource(rows.slice(0, 200), file.name);

    return {
      id: fileId(file),
      file,
      slot: detection.slot,
      confidence: detection.confidence,
      rows: rows.length,
      warnings: detection.warnings,
      previewRows: rows.slice(0, 500)
    };
  } catch {
    return {
      id: fileId(file),
      file,
      slot: "unknown",
      confidence: "low",
      rows: 0,
      warnings: ["Dit bestand kon nog niet lokaal worden gelezen. Je kunt het type handmatig kiezen."],
      previewRows: [],
      error: "Bestand kon niet worden voorgelezen."
    };
  }
}

export function AuditForm() {
  const [step, setStep] = useState(1);
  const [input, setInput] = useState<AuditInput>(initialInput);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [report, setReport] = useState<AuditReport>();
  const [docxBase64, setDocxBase64] = useState<string>();
  const [fileName, setFileName] = useState<string>();
  const [labeledProductsBase64, setLabeledProductsBase64] = useState<string>();
  const [labeledProductsFileName, setLabeledProductsFileName] = useState<string>();
  const [labeledProductsMimeType, setLabeledProductsMimeType] = useState<string>();
  const [parsedFiles, setParsedFiles] = useState<ParsedFileSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "reading" | "parsing" | "ready" | "error">("idle");
  const [error, setError] = useState<string>();
  const [leadSaved, setLeadSaved] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>();
  const [resultTab, setResultTab] = useState("Samenvatting");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const route = new URLSearchParams(window.location.search).get("route");
    if (route === "labelizer") {
      update("mode", "labelizer");
    }
  }, []);

  function update<K extends keyof AuditInput>(key: K, value: AuditInput[K]) {
    setInput((current) => {
      const next = { ...current, [key]: value };
      if (key === "mode") {
        next.useProductLabelizer = value === "labelizer" || value === "both";
      }
      return next;
    });
  }

  function updateFileSlot(id: string, slot: UploadSlot | "unknown") {
    setFiles((current) => current.map((item) => (item.id === id ? { ...item, slot, confidence: slot === "unknown" ? "low" : item.confidence } : item)));
  }

  async function addFiles(fileList: FileList | File[]) {
    setStatus("reading");
    setError(undefined);
    const nextFiles = await Promise.all(Array.from(fileList).map(readFilePreview));
    setFiles((current) => [...current, ...nextFiles]);
    setStatus("idle");
  }

  function removeFile(id: string) {
    setFiles((current) => current.filter((file) => file.id !== id));
  }

  const filesBySlot = useMemo(() => {
    const map = new Map<UploadSlot | "unknown", UploadedFile[]>();
    files.forEach((file) => map.set(file.slot, [...(map.get(file.slot) || []), file]));
    return map;
  }, [files]);

  const labelizerMatch = useMemo(() => {
    const feedRows = (filesBySlot.get("product_source") || []).flatMap((file) => file.previewRows);
    const performanceRows = (filesBySlot.get("product_performance") || []).flatMap((file) => file.previewRows);
    const feedIds = new Set(feedRows.map(productId).filter(Boolean));
    const performanceIds = new Set(performanceRows.map(productId).filter(Boolean));
    if (!feedIds.size || !performanceIds.size) return undefined;
    const matched = [...feedIds].filter((id) => performanceIds.has(id));
    return matched.length / feedIds.size;
  }, [filesBySlot]);

  const requiredMissing = useMemo(() => {
    const missing: string[] = [];
    if (isAuditMode(input.mode) && !filesBySlot.get("google_ads_campaigns")?.length) {
      missing.push("Google Ads-campagne-export");
    }
    if (isLabelizerMode(input.mode) && !filesBySlot.get("product_source")?.length) {
      missing.push("productfeed");
    }
    if (isLabelizerMode(input.mode) && !filesBySlot.get("product_performance")?.length) {
      missing.push("productprestaties");
    }
    return missing;
  }, [filesBySlot, input.mode]);

  const dataQualityScore = useMemo(() => {
    let score = 45;
    if (filesBySlot.get("google_ads_campaigns")?.length) score += 20;
    if (filesBySlot.get("google_ads_search_terms")?.length) score += 10;
    if (filesBySlot.get("google_ads_change_history")?.length) score += 8;
    if (filesBySlot.get("ga4_pages")?.length) score += 7;
    if (filesBySlot.get("search_console_queries")?.length) score += 5;
    if (isLabelizerMode(input.mode) && labelizerMatch !== undefined) score += labelizerMatch >= 0.8 ? 15 : labelizerMatch >= 0.5 ? 7 : -20;
    return Math.max(0, Math.min(100, score));
  }, [filesBySlot, input.mode, labelizerMatch]);

  function canGoNext() {
    if (step === 1) return !!input.mode;
    if (step === 2) return input.clientName.trim() && input.contactEmail.trim() && input.leadConsent;
    if (step === 3) return requiredMissing.length === 0 && !files.some((file) => file.slot === "unknown");
    if (step === 4) return requiredMissing.length === 0 && (labelizerMatch === undefined || labelizerMatch >= 0.5);
    return true;
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
        audit_mode: input.mode,
        current_period: input.currentPeriod,
        previous_period: input.previousPeriod,
        consent: input.leadConsent ? "yes" : "no",
        uploaded_files: nextParsedFiles.map((file) => file.fileName).join(", "),
        submitted_at: new Date().toISOString()
      });

      const response = await fetch("/__forms.html", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      setLeadSaved(response.ok);
    } catch {
      setLeadSaved(false);
    }
  }

  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (status === "parsing") return;
    if (!canGoNext()) {
      setError("Controleer de ontbrekende gegevens voordat je doorgaat.");
      return;
    }

    setStep(5);
    setStatus("parsing");
    setError(undefined);
    setEmailStatus(undefined);
    setLeadSaved(false);

    const formData = new FormData();
    Object.entries(input).forEach(([key, value]) => {
      if (key === "labelStrategies") {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    });
    files.forEach((item) => {
      if (item.slot !== "unknown") formData.append(item.slot, item.file);
      else formData.append("uploads", item.file);
    });

    const response = await fetch("/api/audit/generate", {
      method: "POST",
      body: formData
    });

    const payload = await response.json();
    if (!response.ok) {
      setStatus("error");
      setStep(4);
      setError(payload.error || "De scan kon niet worden gemaakt.");
      return;
    }

    setReport(payload.report);
    setDocxBase64(payload.docxBase64);
    setFileName(payload.fileName);
    setLabeledProductsBase64(payload.labeledProductsBase64);
    setLabeledProductsFileName(payload.labeledProductsFileName);
    setLabeledProductsMimeType(payload.labeledProductsMimeType);
    setParsedFiles(payload.parsedFiles || []);
    setEmailStatus(payload.emailStatus);
    setStatus("ready");
    setStep(6);
    void saveLeadToNetlifyForms(payload.parsedFiles || []);
  }

  function resetWizard() {
    if (!window.confirm("Weet je zeker dat je alle ingevulde gegevens en uploads wilt wissen?")) return;
    setInput(initialInput);
    setFiles([]);
    setReport(undefined);
    setDocxBase64(undefined);
    setLabeledProductsBase64(undefined);
    setStep(1);
  }

  const steps = ["Keuze", "Gegevens", "Uploads", "Controle", "Genereren", "Resultaten"];

  return (
    <>
      <div className="rounded-lg border border-line bg-white p-6 shadow-soft">
        <nav aria-label="Voortgang" className="grid gap-2 sm:grid-cols-6">
          {steps.map((label, index) => {
            const number = index + 1;
            const active = step === number;
            const done = step > number;
            return (
              <button
                key={label}
                type="button"
                onClick={() => number < step && setStep(number)}
                className={`rounded-md border px-3 py-2 text-left text-xs font-semibold ${active ? "border-ink bg-ink text-white" : done ? "border-line bg-mist text-ink" : "border-line text-gray-500"}`}
                aria-current={active ? "step" : undefined}
              >
                {number}. {label}
              </button>
            );
          })}
        </nav>

        {error ? (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}

        <form onSubmit={submit} className="mt-8">
          {step === 1 ? (
            <section>
              <h1 className="text-3xl font-semibold tracking-tight text-ink">Wat wil je maken?</h1>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {modeCards.map((card) => (
                  <button
                    key={card.mode}
                    type="button"
                    onClick={() => update("mode", card.mode)}
                    className={`rounded-lg border p-5 text-left transition hover:border-ink ${input.mode === card.mode ? "border-ink bg-mist" : "border-line bg-white"}`}
                  >
                    <span className="block text-lg font-semibold text-ink">{card.title}</span>
                    <span className="mt-2 block text-sm leading-6 text-gray-600">{card.body}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section>
              <h1 className="text-3xl font-semibold tracking-tight text-ink">Basisgegevens</h1>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Bedrijfsnaam
                  <input required value={input.clientName} onChange={(event) => update("clientName", event.target.value)} className="rounded-md border border-line px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  E-mailadres voor het rapport
                  <input required type="email" value={input.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} className="rounded-md border border-line px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Website-URL <span className="font-normal text-gray-500">(optioneel)</span>
                  <input value={input.websiteUrl} onChange={(event) => update("websiteUrl", event.target.value)} className="rounded-md border border-line px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Type bedrijf
                  <select value={input.businessType} onChange={(event) => update("businessType", event.target.value as AuditInput["businessType"])} className="rounded-md border border-line px-3 py-2">
                    <option value="ecommerce">Webshop</option>
                    <option value="lead_gen">Leadgeneratie</option>
                    <option value="local_service">Lokale dienstverlener</option>
                    <option value="b2b">B2B</option>
                    <option value="other">Overig</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink sm:col-span-2">
                  Belangrijkste doel
                  <select value={input.mainGoal} onChange={(event) => update("mainGoal", event.target.value as AuditInput["mainGoal"])} className="rounded-md border border-line px-3 py-2">
                    <option value="leads">Leads</option>
                    <option value="purchases">Aankopen</option>
                    <option value="roas">ROAS</option>
                    <option value="revenue">Omzet</option>
                    <option value="bookings">Afspraken</option>
                    <option value="calls">Telefoongesprekken</option>
                  </select>
                </label>
                <label className="flex gap-3 rounded-md border border-line bg-mist p-3 text-sm leading-6 text-gray-700 sm:col-span-2">
                  <input required type="checkbox" checked={input.leadConsent} onChange={(event) => update("leadConsent", event.target.checked)} className="mt-1 h-4 w-4 rounded border-line" />
                  <span>Ik ga ermee akkoord dat Adsvantage dit e-mailadres opslaat en contact mag opnemen over deze scan.</span>
                </label>
              </div>

              <button type="button" onClick={() => setExtraOpen(!extraOpen)} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ink">
                Extra context toevoegen
                <ChevronDown size={16} />
              </button>
              {extraOpen ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Huidige periode <span className="font-normal text-gray-500">(optioneel)</span>
                    <input value={input.currentPeriod} onChange={(event) => update("currentPeriod", event.target.value)} className="rounded-md border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Vergelijken met vorige periode?
                    <select value={input.compareWithPreviousPeriod ? "yes" : "no"} onChange={(event) => update("compareWithPreviousPeriod", event.target.value === "yes")} className="rounded-md border border-line px-3 py-2">
                      <option value="no">Nee, maak een huidige-status scan</option>
                      <option value="yes">Ja, splits huidige en vorige periode</option>
                    </select>
                  </label>
                  {input.compareWithPreviousPeriod ? (
                    <label className="grid gap-1 text-sm font-medium text-ink sm:col-span-2">
                      Vorige vergelijkingsperiode <span className="font-normal text-gray-500">(optioneel label)</span>
                      <input value={input.previousPeriod} onChange={(event) => update("previousPeriod", event.target.value)} className="rounded-md border border-line px-3 py-2" />
                    </label>
                  ) : null}
                  <label className="grid gap-1 text-sm font-medium text-ink sm:col-span-2">
                    Notities voor de specialist <span className="font-normal text-gray-500">(optioneel)</span>
                    <textarea value={input.strategistNotes} onChange={(event) => update("strategistNotes", event.target.value)} rows={4} className="rounded-md border border-line px-3 py-2" />
                  </label>
                </div>
              ) : null}
            </section>
          ) : null}

          {step === 3 ? (
            <section>
              <h1 className="text-3xl font-semibold tracking-tight text-ink">Bestanden uploaden</h1>
              <p className="mt-2 text-gray-600">Wij herkennen automatisch welke exports je hebt toegevoegd.</p>
              <div
                className={`mt-6 rounded-lg border-2 border-dashed p-8 text-center transition ${dragging ? "border-ink bg-mist" : "border-line bg-white"}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void addFiles(event.dataTransfer.files);
                }}
              >
                <UploadCloud className="mx-auto text-ink" size={34} />
                <p className="mt-3 text-lg font-semibold text-ink">Sleep je bestanden hierheen</p>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-3 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
                  of kies bestanden vanaf je computer
                </button>
                <input ref={fileInputRef} type="file" multiple accept=".csv,.tsv,.xlsx,.xls,.txt,.md" className="hidden" onChange={(event) => event.target.files && void addFiles(event.target.files)} />
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a href="/samples/google_ads_campaigns.csv" className="font-semibold text-ink hover:underline">
                  Bekijk voorbeeldbestand
                </a>
                <a href="https://support.google.com/google-ads/answer/2404039" className="font-semibold text-ink hover:underline">
                  Bekijk waar je de exports vindt
                </a>
              </div>

              <div className="mt-6 grid gap-3">
                {files.map((item) => (
                  <div key={item.id} className="rounded-lg border border-line p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-ink">{item.file.name}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          {item.rows} regels - {uploadSlotLabel(item.slot)} - zekerheid {item.confidence}
                        </p>
                        {item.warnings.map((warning) => (
                          <p key={warning} className="mt-1 text-sm text-amber-700">
                            {warning}
                          </p>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <select value={item.slot} onChange={(event) => updateFileSlot(item.id, event.target.value as UploadSlot | "unknown")} className="rounded-md border border-line px-3 py-2 text-sm">
                          <option value="unknown">Handmatig kiezen</option>
                          {uploadOptions.map((slot) => (
                            <option key={slot} value={slot}>
                              {uploadSlotLabel(slot)}
                            </option>
                          ))}
                        </select>
                        <button type="button" onClick={() => removeFile(item.id)} className="rounded-md border border-line p-2 text-gray-500 hover:text-red-700" aria-label={`${item.file.name} verwijderen`}>
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Checklist filesBySlot={filesBySlot} mode={input.mode} />
            </section>
          ) : null}

          {step === 4 ? (
            <section>
              <h1 className="text-3xl font-semibold tracking-tight text-ink">Controle voor generatie</h1>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <SummaryCard label="Herkende bestanden" value={String(files.length)} />
                <SummaryCard label="Datakwaliteit" value={`${dataQualityScore}%`} />
                <SummaryCard label="Periode" value={input.currentPeriod || "Niet opgegeven"} />
              </div>
              <div className="mt-6 rounded-lg border border-line p-4">
                <h2 className="font-semibold text-ink">Samenvatting</h2>
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  {files.map((file) => (
                    <li key={file.id}>
                      {uploadSlotLabel(file.slot)} - {file.file.name} - {file.rows} regels
                    </li>
                  ))}
                </ul>
                {requiredMissing.length ? (
                  <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">Ontbrekend: {requiredMissing.join(", ")}.</p>
                ) : null}
                {isLabelizerMode(input.mode) ? (
                  <div className="mt-4 rounded-md bg-mist p-3 text-sm text-gray-700">
                    Matchpercentage productfeed/prestaties: {labelizerMatch === undefined ? "wordt gecontroleerd bij generatie" : `${Math.round(labelizerMatch * 100)}%`}.
                    {labelizerMatch !== undefined && labelizerMatch < 0.5 ? (
                      <p className="mt-2 text-red-700">Dit is te laag om betrouwbaar labels te maken. Controleer of beide bestanden dezelfde product-ID&apos;s gebruiken.</p>
                    ) : null}
                    <label className="mt-3 grid gap-1 font-medium text-ink">
                      Vrije custom-labelkolom
                      <select value={input.productLabelColumn} onChange={(event) => update("productLabelColumn", event.target.value as AuditInput["productLabelColumn"])} className="rounded-md border border-line bg-white px-3 py-2">
                        <option value="custom_label_0">custom_label_0</option>
                        <option value="custom_label_1">custom_label_1</option>
                        <option value="custom_label_2">custom_label_2</option>
                        <option value="custom_label_3">custom_label_3</option>
                        <option value="custom_label_4">custom_label_4</option>
                      </select>
                    </label>
                  </div>
                ) : null}
                <div className="mt-4 rounded-md bg-mist p-3 text-sm text-gray-700">
                  <p className="font-semibold text-ink">Wat we nog niet volledig konden controleren</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {!filesBySlot.get("google_ads_search_terms")?.length ? <li>Geen zoektermenbestand: irrelevante zoekopdrachten kunnen beperkt worden beoordeeld.</li> : null}
                    {!filesBySlot.get("google_ads_change_history")?.length ? <li>Geen wijzigingsgeschiedenis: oorzaken van prestatieverschuivingen blijven indicatief.</li> : null}
                    {!filesBySlot.get("ga4_pages")?.length ? <li>Geen GA4-pagina-export: landingspagina-engagement kan niet hard worden bewezen.</li> : null}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {step === 5 ? (
            <section className="py-14 text-center">
              <Loader2 className="mx-auto animate-spin text-ink" size={42} />
              <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink">Je scan wordt gemaakt</h1>
              <div className="mx-auto mt-6 grid max-w-md gap-2 text-left text-sm text-gray-700">
                {["Upload verwerken", "Bestanden controleren", "Cijfers analyseren", "Rapport samenstellen", "Downloads voorbereiden"].map((stage) => (
                  <p key={stage} className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-ink" />
                    {stage}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          {step === 6 && report ? (
            <section>
              <h1 className="text-3xl font-semibold tracking-tight text-ink">Resultaten</h1>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Samenvatting", "Belangrijkste acties", "Uitgebreide analyse", ...(labeledProductsBase64 ? ["Productlabels"] : []), "Downloads"].map((tab) => (
                  <button key={tab} type="button" onClick={() => setResultTab(tab)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${resultTab === tab ? "border-ink bg-ink text-white" : "border-line text-gray-600 hover:border-ink"}`}>
                    {tab}
                  </button>
                ))}
              </div>
              {leadSaved ? <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">Lead opgeslagen voor Adsvantage-opvolging.</p> : null}
              {emailStatus?.leadEmailSent ? <p className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-700">Het rapport is gemaild naar {input.contactEmail}.</p> : null}
              {emailStatus?.enabled && emailStatus.error ? <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700">Rapport gemaakt, maar e-mail vraagt aandacht: {emailStatus.error}</p> : null}
              <div className="mt-6">
                <ReportPreview
                  input={input}
                  report={report}
                  docxBase64={docxBase64}
                  fileName={fileName}
                  labeledProductsBase64={labeledProductsBase64}
                  labeledProductsFileName={labeledProductsFileName}
                  labeledProductsMimeType={labeledProductsMimeType}
                  parsedFiles={parsedFiles}
                  onReportChange={setReport}
                />
              </div>
            </section>
          ) : null}

          {step !== 5 ? (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <button type="button" onClick={() => (step > 1 ? setStep(step - 1) : resetWizard())} className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-mist">
                <ArrowLeft size={16} />
                {step > 1 ? "Vorige" : "Wissen"}
              </button>
              {step < 4 ? (
                <button type="button" disabled={!canGoNext()} onClick={() => setStep(step + 1)} className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
                  Volgende
                  <ArrowRight size={16} />
                </button>
              ) : null}
              {step === 4 ? (
                <button type="submit" disabled={status === "parsing" || !canGoNext()} className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {status === "parsing" ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                  Scan maken
                </button>
              ) : null}
            </div>
          ) : null}
        </form>
      </div>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-mist p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function Checklist({ filesBySlot, mode }: { filesBySlot: Map<UploadSlot | "unknown", UploadedFile[]>; mode: AuditMode }) {
  const rows: Array<{ slot: UploadSlot; label: string; required: boolean }> = [
    { slot: "google_ads_campaigns", label: "Google Ads-campagnes", required: isAuditMode(mode) },
    { slot: "google_ads_search_terms", label: "Zoektermen", required: false },
    { slot: "google_ads_keywords", label: "Zoekwoorden", required: false },
    { slot: "google_ads_change_history", label: "Wijzigingsgeschiedenis", required: false },
    { slot: "ga4_pages", label: "GA4-pagina's", required: false },
    { slot: "search_console_queries", label: "Search Console-query's", required: false },
    { slot: "product_source", label: "Productfeed", required: isLabelizerMode(mode) },
    { slot: "product_performance", label: "Productprestaties", required: isLabelizerMode(mode) }
  ];

  return (
    <div className="mt-6 rounded-lg border border-line p-4">
      <h2 className="font-semibold text-ink">Herkende bestanden</h2>
      <div className="mt-3 grid gap-2 text-sm">
        {rows.map((row) => {
          const file = filesBySlot.get(row.slot)?.[0];
          const present = !!file;
          return (
            <p key={row.slot} className="flex items-center gap-2 text-gray-700">
              {present ? <CheckCircle2 size={16} className="text-green-700" /> : row.required ? <AlertTriangle size={16} className="text-amber-600" /> : <span className="h-4 w-4 rounded-full border border-line" />}
              {present ? `${row.label} herkend - ${file.rows} regels` : `${row.label} ${row.required ? "ontbreekt" : "niet toegevoegd - optioneel"}`}
            </p>
          );
        })}
      </div>
    </div>
  );
}
