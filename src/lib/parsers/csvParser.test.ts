import { describe, expect, it } from "vitest";
import { parseCsv } from "./csvParser";

function buffer(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer as ArrayBuffer;
}

describe("parseCsv", () => {
  it("parses semicolon separated Dutch exports", () => {
    const rows = parseCsv(buffer("Campagne;Kosten;Klikken\nMerk;12,50;10"));
    expect(rows).toHaveLength(1);
    expect(rows[0].Campagne).toBe("Merk");
  });

  it("parses TSV exports", () => {
    const rows = parseCsv(buffer("Campaign\tCost\tClicks\nBrand\t10\t3"));
    expect(rows).toHaveLength(1);
    expect(rows[0].Campaign).toBe("Brand");
  });

  it("skips total rows", () => {
    const rows = parseCsv(buffer("Campaign,Cost,Clicks\nBrand,10,3\nTotal,10,3"));
    expect(rows).toHaveLength(1);
  });
});
