import { NextRequest, NextResponse } from "next/server";
import { generateAuditDocx } from "@/lib/report/docxGenerator";
import { AuditInput, AuditReport } from "@/lib/types/audit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      input?: AuditInput;
      report?: AuditReport;
      fileName?: string;
    };

    if (!body.input || !body.report) {
      return NextResponse.json({ error: "Missing audit input or report payload." }, { status: 400 });
    }

    const docxBuffer = await generateAuditDocx(body.input, body.report);
    const safeClient = body.input.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "audit";

    return NextResponse.json({
      docxBase64: docxBuffer.toString("base64"),
      fileName: body.fileName || `${safeClient}-google-ads-audit.docx`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown export error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
