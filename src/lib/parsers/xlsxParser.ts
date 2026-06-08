import readXlsxFile from "read-excel-file/node";

function findHeaderRow(rows: unknown[][]): number {
  const terms = ["campaign", "campagne", "cost", "kosten", "clicks", "klikken", "id", "product", "search term", "zoekterm"];
  const scored = rows.map((row, index) => ({
    index,
    score: row.reduce<number>((sum, cell) => {
      const value = String(cell || "").toLowerCase();
      return sum + terms.reduce((inner, term) => inner + (value.includes(term) ? 1 : 0), 0);
    }, 0)
  }));
  return scored.sort((a, b) => b.score - a.score)[0]?.index || 0;
}

function cellValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value ?? "";
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const sheets = await readXlsxFile(Buffer.from(buffer));
  const output: Record<string, unknown>[] = [];

  for (const sheet of sheets) {
    const rawRows = sheet.data.map((row) => row.map(cellValue));
    if (!rawRows.length) continue;
    const headerIndex = findHeaderRow(rawRows);
    const headers = rawRows[headerIndex].map((cell, index) => String(cell || `Kolom ${index + 1}`).trim());

    rawRows.slice(headerIndex + 1).forEach((values) => {
      const row: Record<string, unknown> = { __sheet: sheet.sheet };
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });
      if (Object.entries(row).some(([key, value]) => key !== "__sheet" && value !== "" && value !== null && value !== undefined)) {
        output.push(row);
      }
    });
  }

  return output;
}
