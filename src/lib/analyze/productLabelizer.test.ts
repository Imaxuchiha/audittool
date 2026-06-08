import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildProductLabelizerPackage, productId } from "./productLabelizer";

describe("productLabelizer", () => {
  const feed = [
    { id: "001", title: "Hero product" },
    { id: "002", title: "Review product" },
    { id: "003", title: "Test product" }
  ];

  const performance = [
    { id: "001", clicks: "100", cost: "50", "conversion value": "500", conversions: "5" },
    { id: "002", clicks: "80", cost: "120", "conversion value": "0", conversions: "0" },
    { id: "003", clicks: "3", cost: "2", "conversion value": "0", conversions: "0" }
  ];

  it("preserves leading zero product IDs", () => {
    expect(productId({ id: "001" })).toBe("001");
  });

  it("creates a supplemental ZIP package", async () => {
    const result = await buildProductLabelizerPackage(feed, performance, [], "test-client");
    expect(result.zipFileName).toBe("test-client-productlabels.zip");
    expect(result.summary.matchRate).toBe(1);
    expect(result.summary.labels.hero).toBeGreaterThanOrEqual(1);

    const zip = await JSZip.loadAsync(Buffer.from(result.zipBase64, "base64"));
    expect(zip.file("merchant-center-supplemental-feed.csv")).toBeTruthy();
    expect(zip.file("labelizer-wijzigingen.csv")).toBeTruthy();
    expect(zip.file("implementatiehandleiding.txt")).toBeTruthy();
  });

  it("blocks low match rates", async () => {
    await expect(buildProductLabelizerPackage(feed, [{ id: "NOPE", clicks: "100", cost: "10" }], [], "bad")).rejects.toThrow(
      /onvoldoende op elkaar aan/
    );
  });
});
