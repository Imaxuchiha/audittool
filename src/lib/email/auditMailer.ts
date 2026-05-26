import { AuditInput, AuditReport } from "@/lib/types/audit";

export interface AuditEmailStatus {
  enabled: boolean;
  leadEmailSent: boolean;
  ownerEmailSent: boolean;
  error?: string;
}

interface SendAuditEmailInput {
  input: AuditInput;
  report: AuditReport;
  docxBase64: string;
  fileName: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function firstRows(rows: string[], limit = 3): string {
  return rows
    .slice(0, limit)
    .map((row) => `<li>${escapeHtml(row)}</li>`)
    .join("");
}

async function sendResendEmail(apiKey: string, payload: Record<string, unknown>) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Resend returned ${response.status}`);
  }
}

export async function sendAuditEmails({ input, report, docxBase64, fileName }: SendAuditEmailInput): Promise<AuditEmailStatus> {
  const apiKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.AUDIT_OWNER_EMAIL || "info@adsvantage.nl";
  const fromEmail = process.env.AUDIT_FROM_EMAIL || "CampaignScan <info@adsvantage.nl>";

  if (!apiKey) {
    return {
      enabled: false,
      leadEmailSent: false,
      ownerEmailSent: false
    };
  }

  const status: AuditEmailStatus = {
    enabled: true,
    leadEmailSent: false,
    ownerEmailSent: false
  };

  const leadHtml = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.55">
      <h1 style="font-size:22px;margin-bottom:8px">${escapeHtml(report.title)}</h1>
      <p>Hi,</p>
      <p>Je CampaignScan auditrapport staat in de bijlage. Het rapport is gemaakt op basis van de uploads en notities die je hebt ingevuld.</p>
      <p>Wil je dat we meekijken naar de belangrijkste kansen of blokkades? Reageer gerust op deze mail.</p>
      <h2 style="font-size:16px;margin-top:24px">Korte samenvatting</h2>
      <ul>${firstRows(report.executiveSummary)}</ul>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">CampaignScan is een project van Adsvantage.</p>
    </div>
  `;

  const ownerHtml = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.55">
      <h1 style="font-size:22px;margin-bottom:8px">Nieuwe CampaignScan lead</h1>
      <p><strong>Email:</strong> ${escapeHtml(input.contactEmail)}</p>
      <p><strong>Klant/bedrijf:</strong> ${escapeHtml(input.clientName || "Niet opgegeven")}</p>
      <p><strong>Website:</strong> ${escapeHtml(input.websiteUrl || "Niet opgegeven")}</p>
      <p><strong>Type:</strong> ${escapeHtml(input.businessType)} | <strong>Doel:</strong> ${escapeHtml(input.mainGoal)}</p>
      <p><strong>Toestemming:</strong> ${input.leadConsent ? "ja" : "nee"}</p>
      <p>Het gegenereerde auditrapport zit in de bijlage. Deze mail kan ook als backup lead-record gebruikt worden.</p>
    </div>
  `;

  try {
    await sendResendEmail(apiKey, {
      from: fromEmail,
      to: [input.contactEmail],
      reply_to: ownerEmail,
      subject: `Je CampaignScan auditrapport voor ${input.clientName || input.websiteUrl || "je account"}`,
      html: leadHtml,
      attachments: [{ filename: fileName, content: docxBase64 }]
    });
    status.leadEmailSent = true;
  } catch (error) {
    status.error = error instanceof Error ? error.message : "Could not email the audit report to the lead.";
  }

  try {
    await sendResendEmail(apiKey, {
      from: fromEmail,
      to: [ownerEmail],
      reply_to: input.contactEmail,
      subject: `Nieuwe CampaignScan lead: ${input.clientName || input.contactEmail}`,
      html: ownerHtml,
      attachments: [{ filename: fileName, content: docxBase64 }]
    });
    status.ownerEmailSent = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not email the owner notification.";
    status.error = status.error ? `${status.error} Owner notification: ${message}` : message;
  }

  return status;
}
