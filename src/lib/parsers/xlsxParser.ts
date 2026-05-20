import * as XLSX from "xlsx";

export function parseXlsx(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    return [];
  }

  const worksheet = workbook.Sheets[firstSheet];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false
  });
}
