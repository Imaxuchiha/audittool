import { describe, expect, it } from "vitest";
import { toNumber } from "./googleAdsColumns";

describe("toNumber", () => {
  it("parses Dutch decimal comma and thousands separators", () => {
    expect(toNumber("€ 1.234,56")).toBe(1234.56);
  });

  it("parses English decimal point", () => {
    expect(toNumber("$1,234.56")).toBe(1234.56);
  });

  it("converts percent values to ratios", () => {
    expect(toNumber("12,5%")).toBe(0.125);
  });

  it("handles zero safely", () => {
    expect(toNumber("0")).toBe(0);
  });
});
