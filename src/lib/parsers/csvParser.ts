import Papa from "papaparse";

const likelyHeaderTerms = [
  "campaign",
  "campagne",
  "search term",
  "zoekterm",
  "keyword",
  "zoekwoord",
  "cost",
  "kosten",
  "clicks",
  "klikken",
  "impressions",
  "vertoningen",
  "conversions",
  "conversies",
  "conversion value",
  "conversiewaarde",
  "asset",
  "page",
  "query",
  "event"
];

const delimiters = [",", ";", "\t"];

function countFields(line: string, delimiter: string): number {
  return Papa.parse<string[]>(line, { delimiter }).data[0]?.length || 0;
}

function detectDelimiter(lines: string[]): string {
  const candidates = delimiters.map((delimiter) => ({
    delimiter,
    fields: Math.max(...lines.slice(0, 20).map((line) => countFields(line, delimiter)))
  }));

  return candidates.sort((a, b) => b.fields - a.fields)[0]?.delimiter || ",";
}

function headerScore(line: string): number {
  const normalized = line.toLowerCase();
  return likelyHeaderTerms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}

function sliceFromLikelyHeader(text: string): { csv: string; delimiter?: string } {
  const rawLines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const nonEmptyLines = rawLines.filter((line) => line.trim().length > 0);
  const sepLine = nonEmptyLines[0]?.trim().toLowerCase();
  const explicitDelimiter = sepLine?.startsWith("sep=") ? sepLine.replace("sep=", "") : undefined;
  const delimiter = explicitDelimiter || detectDelimiter(nonEmptyLines);
  const lines = explicitDelimiter ? nonEmptyLines.slice(1) : nonEmptyLines;

  const candidates = lines
    .map((line, index) => ({
      index,
      fields: countFields(line, delimiter),
      score: headerScore(line)
    }))
    .filter((candidate) => candidate.fields > 1);

  const bestKnownHeader = candidates
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.fields - a.fields)[0];

  const fallbackHeader = candidates.sort((a, b) => b.fields - a.fields)[0];
  const headerIndex = bestKnownHeader?.index ?? fallbackHeader?.index ?? 0;

  return {
    csv: lines.slice(headerIndex).join("\n"),
    delimiter
  };
}

export function parseCsv(buffer: ArrayBuffer): Record<string, unknown>[] {
  const text = new TextDecoder("utf-8").decode(buffer);
  const { csv, delimiter } = sliceFromLikelyHeader(text);
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    delimiter,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });

  if (parsed.errors.length) {
    const blockingError = parsed.errors.find((error) => error.type !== "Delimiter" && error.type !== "FieldMismatch");
    if (blockingError) {
      throw new Error(`CSV parse error: ${blockingError.message}`);
    }
  }

  return parsed.data
    .map((row) => {
      const cleanRow = { ...row };
      delete (cleanRow as Record<string, unknown>).__parsed_extra;
      return cleanRow;
    })
    .filter((row) => Object.values(row).some((value) => value !== undefined && value !== null && value !== ""));
}
