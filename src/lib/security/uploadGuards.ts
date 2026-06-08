import { NextRequest } from "next/server";

export const allowedUploadExtensions = [".csv", ".tsv", ".xlsx", ".xls", ".txt", ".md"];

export const uploadLimits = {
  maxFiles: Number(process.env.AUDIT_MAX_FILES || 14),
  maxFileSizeBytes: Number(process.env.AUDIT_MAX_FILE_SIZE_BYTES || 8 * 1024 * 1024),
  maxRowsPerFile: Number(process.env.AUDIT_MAX_ROWS_PER_FILE || 25000),
  rateLimitWindowMs: Number(process.env.AUDIT_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
  rateLimitMaxRequests: Number(process.env.AUDIT_RATE_LIMIT_MAX_REQUESTS || 20)
};

const requests = new Map<string, number[]>();

export function safeFileName(value: string, fallback = "campaignscan"): string {
  const safe = value
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return safe || fallback;
}

export function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

export function assertAllowedFile(file: File) {
  const extension = getExtension(file.name);
  if (!allowedUploadExtensions.includes(extension)) {
    throw new Error(`Het bestand "${file.name}" is geen toegestaan type. Gebruik CSV, TSV, XLSX, XLS, TXT of MD.`);
  }

  if (file.size > uploadLimits.maxFileSizeBytes) {
    throw new Error(`Het bestand "${file.name}" is groter dan de toegestane limiet van ${Math.round(uploadLimits.maxFileSizeBytes / 1024 / 1024)} MB.`);
  }
}

export function assertRowLimit(rows: unknown[], fileName: string) {
  if (rows.length > uploadLimits.maxRowsPerFile) {
    throw new Error(`Het bestand "${fileName}" bevat ${rows.length} regels. De limiet is ${uploadLimits.maxRowsPerFile} regels per bestand.`);
  }
}

export function rateLimit(request: NextRequest): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const windowStart = now - uploadLimits.rateLimitWindowMs;
  const recent = (requests.get(key) || []).filter((timestamp) => timestamp >= windowStart);

  if (recent.length >= uploadLimits.rateLimitMaxRequests) {
    const oldest = Math.min(...recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((oldest + uploadLimits.rateLimitWindowMs - now) / 1000)
    };
  }

  recent.push(now);
  requests.set(key, recent);
  return { allowed: true };
}
