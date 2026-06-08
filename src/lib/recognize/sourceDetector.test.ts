import { describe, expect, it } from "vitest";
import { detectSource } from "./sourceDetector";

describe("detectSource", () => {
  it("recognizes campaign exports by columns", () => {
    const result = detectSource([{ Campaign: "Brand", Cost: "10", Clicks: "2", Impressions: "20" }], "random.csv");
    expect(result.slot).toBe("google_ads_campaigns");
    expect(result.requiredFieldsPresent).toBe(true);
  });

  it("recognizes product performance by filename and metrics", () => {
    const result = detectSource([{ id: "SKU-001", clicks: "10", cost: "20", "conversion value": "120" }], "product_performance.csv");
    expect(result.slot).toBe("product_performance");
  });

  it("returns unknown for empty files", () => {
    const result = detectSource([], "empty.csv");
    expect(result.slot).toBe("unknown");
  });
});
