import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import { AuditInput, AuditReport, PriorityAction, SummaryMetrics } from "@/lib/types/audit";

function paragraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 160 },
    alignment: AlignmentType.LEFT
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 260, after: 140 }
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    bullet: { level: 0 },
    spacing: { after: 100 }
  });
}

function money(value: number): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function metricTable(current: SummaryMetrics, previous: SummaryMetrics, hasPreviousData: boolean, isDutch: boolean): Table {
  const rows = [
    [isDutch ? "Kosten" : "Spend", money(current.spend), money(previous.spend)],
    [isDutch ? "Klikken" : "Clicks", current.clicks.toFixed(0), previous.clicks.toFixed(0)],
    [isDutch ? "Vertoningen" : "Impressions", current.impressions.toFixed(0), previous.impressions.toFixed(0)],
    ["CTR", percent(current.ctr), percent(previous.ctr)],
    ["Avg CPC", money(current.avgCpc), money(previous.avgCpc)],
    [isDutch ? "Conversies" : "Conversions", current.conversions.toFixed(1), previous.conversions.toFixed(1)],
    ["CPA", money(current.cpa), money(previous.cpa)],
    [isDutch ? "Conversiewaarde" : "Conversion value", money(current.conversionValue), money(previous.conversionValue)],
    ["ROAS", current.roas.toFixed(1), previous.roas.toFixed(1)]
  ];

  const header = hasPreviousData
    ? [isDutch ? "Metric" : "Metric", isDutch ? "Huidig" : "Current", isDutch ? "Vorige" : "Previous"]
    : [isDutch ? "Metric" : "Metric", isDutch ? "Huidig" : "Current"];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: header.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: cell, bold: true })] })]
            })
        )
      }),
      ...rows.map(
        ([metric, currentValue, previousValue]) =>
          new TableRow({
            children: (hasPreviousData ? [metric, currentValue, previousValue] : [metric, currentValue]).map(
              (cell) => new TableCell({ children: [new Paragraph(cell)] })
            )
          })
      )
    ]
  });
}

function actionTable(actions: PriorityAction[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: ["Action", "Impact", "Effort", "Type"].map(
          (cell) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cell, bold: true })] })] })
        )
      }),
      ...actions.map(
        (action) =>
          new TableRow({
            children: [
              action.action,
              String(action.impact),
              String(action.effort),
              action.type === "quick_win" ? "Quick win" : "Strategic"
            ].map((cell) => new TableCell({ children: [new Paragraph(cell)] }))
          })
      )
    ]
  });
}

export async function generateAuditDocx(input: AuditInput, report: AuditReport): Promise<Buffer> {
  const isDutch = input.language === "nl";
  const doc = new Document({
    creator: "CampaignScan",
    title: report.title,
    description: "Google Ads-scan op basis van geuploade exports.",
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: report.title, bold: true, size: 38 })],
            spacing: { after: 120 }
          }),
          paragraph(`${input.websiteUrl} | ${input.currentPeriod}`),
          paragraph(isDutch ? "Een praktische Google Ads-scan op basis van de geuploade exports en notities." : "A practical PPC audit based on the uploaded exports and strategist notes."),
          heading(isDutch ? "1. Samenvatting" : "1. Executive Summary"),
          ...report.executiveSummary.map(paragraph),
          heading(isDutch ? (report.comparison.hasPreviousData ? "2. Prestatievergelijking" : "2. Prestatieoverzicht") : "2. Performance Comparison"),
          ...report.performanceNarrative.map(paragraph),
          metricTable(report.comparison.current, report.comparison.previous, report.comparison.hasPreviousData, isDutch),
          heading(isDutch ? "3. Campagnes en budget" : "3. Campaign & Budget Analysis"),
          ...report.campaignBudgetAnalysis.map(paragraph),
          heading(isDutch ? "4. Zoektermen en intentie" : "4. Search Terms & Intent Analysis"),
          ...report.searchTermsIntentAnalysis.map(paragraph),
          heading(isDutch ? "5. Wijzigingen en accountkwaliteit" : "5. Change History & Account Hygiene"),
          ...report.changeHistoryHygiene.map(paragraph),
          heading(isDutch ? "6. Website, landingspagina en CRO" : "6. Website / Landing Page / GA4 CRO Notes"),
          ...report.croNotes.map(paragraph),
          heading(isDutch ? "7. Aanbevolen vervolgstappen" : "7. Recommended Next Steps"),
          ...report.painpoints.slice(0, 6).map((painpoint) => bullet(`${painpoint.title}: ${painpoint.recommendation}`)),
          actionTable(report.nextSteps)
        ]
      }
    ]
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
