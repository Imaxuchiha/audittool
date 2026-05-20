import * as XLSX from "xlsx";
import { LabelStrategy, LabelStrategyConfig, ProductLabelSummary } from "@/lib/types/audit";
import { toNumber } from "@/lib/normalize/googleAdsColumns";

const idFields = ["id", "item id", "item_id", "offer id", "product id", "sku"];
const titleFields = ["title", "product title", "name", "product name", "titel"];
const categoryFields = ["product type", "google product category", "category", "categorie"];
const priceFields = ["price", "sale price", "prijs"];
const availabilityFields = ["availability", "stock", "voorraad"];
const brandFields = ["brand", "merk"];
const marginFields = ["margin", "gross margin", "marge", "profit margin"];
const salePriceFields = ["sale price", "sale_price", "saleprice", "discount price", "actieprijs"];
const shippingFields = ["shipping", "shipping label", "delivery", "verzending", "shipping price"];
const genderFields = ["gender", "geslacht"];
const sizeFields = ["size", "maat"];
const releaseYearFields = ["release year", "year", "jaar", "model year"];

export const defaultLabelStrategies: LabelStrategyConfig = {
  custom_label_0: "priority",
  custom_label_1: "price",
  custom_label_2: "margin",
  custom_label_3: "category",
  custom_label_4: "stock"
};

function fieldValue(row: Record<string, unknown>, fields: string[]): string {
  const key = Object.keys(row).find((candidate) => fields.includes(candidate.trim().toLowerCase()));
  const value = key ? row[key] : undefined;
  return value === undefined || value === null ? "" : String(value).trim();
}

function price(row: Record<string, unknown>): number {
  return toNumber(fieldValue(row, priceFields));
}

function margin(row: Record<string, unknown>): number {
  const raw = fieldValue(row, marginFields);
  const value = toNumber(raw);
  return value > 1 ? value / 100 : value;
}

function bucketPrice(value: number): string {
  if (!value) return "price_unknown";
  if (value < 25) return "price_low";
  if (value < 100) return "price_mid";
  if (value < 300) return "price_high";
  return "price_premium";
}

function bucketMargin(value: number): string {
  if (!value) return "margin_unknown";
  if (value < 0.2) return "margin_low";
  if (value < 0.4) return "margin_mid";
  return "margin_high";
}

function bucketAvailability(value: string): string {
  const normalized = value.toLowerCase();
  if (!normalized) return "stock_unknown";
  if (normalized.includes("out") || normalized.includes("niet") || normalized.includes("0")) return "out_of_stock";
  if (normalized.includes("preorder") || normalized.includes("backorder")) return "delayed_stock";
  return "in_stock";
}

function bucketCategory(value: string): string {
  if (!value) return "category_unknown";
  return `cat_${safeLabel(value).slice(0, 36) || "unknown"}`;
}

function safeLabel(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 100);
}

function bucketSale(row: Record<string, unknown>, productTitle: string, category: string): string {
  const basePrice = price(row);
  const salePrice = toNumber(fieldValue(row, salePriceFields));
  const text = `${productTitle} ${category}`.toLowerCase();
  if (salePrice > 0 && basePrice > 0 && salePrice < basePrice) return "on_sale";
  if (text.includes("sale") || text.includes("outlet") || text.includes("clearance") || text.includes("actie")) return "promo_sale";
  return "regular_price";
}

function bucketSeason(productTitle: string, category: string): string {
  const text = `${productTitle} ${category}`.toLowerCase();
  if (text.includes("winter") || text.includes("snow") || text.includes("kerst") || text.includes("christmas")) return "season_winter";
  if (text.includes("summer") || text.includes("zomer") || text.includes("beach") || text.includes("swim")) return "season_summer";
  if (text.includes("spring") || text.includes("lente")) return "season_spring";
  if (text.includes("autumn") || text.includes("fall") || text.includes("herfst")) return "season_autumn";
  return "season_evergreen";
}

function bucketShipping(row: Record<string, unknown>): string {
  const value = fieldValue(row, shippingFields).toLowerCase();
  if (!value) return "shipping_unknown";
  if (value.includes("free") || value.includes("gratis") || value === "0") return "free_shipping";
  if (value.includes("drop")) return "drop_shipping";
  if (value.includes("express") || value.includes("next")) return "express_shipping";
  return "standard_shipping";
}

function bucketPerformance(row: Record<string, unknown>): string {
  const spend = toNumber(fieldValue(row, ["cost", "costs", "spend", "kosten"]));
  const conversions = toNumber(fieldValue(row, ["conversions", "conv.", "conversies"]));
  const value = toNumber(fieldValue(row, ["conversion value", "conv. value", "revenue", "omzet"]));
  const clicks = toNumber(fieldValue(row, ["clicks", "klikken"]));
  const roas = spend ? value / spend : 0;
  const cvr = clicks ? conversions / clicks : 0;

  if (!spend && !conversions && !value) return "performance_unknown";
  if (roas >= 5 || cvr >= 0.05) return "top_performer";
  if (spend > 0 && conversions === 0) return "waste_watch";
  if (roas > 0 && roas < 1.5) return "low_roas";
  return "steady_performer";
}

function directFieldLabel(row: Record<string, unknown>, fields: string[], fallback: string, prefix = ""): string {
  const value = fieldValue(row, fields);
  if (!value) return fallback;
  return `${prefix}${safeLabel(value) || fallback}`.slice(0, 100);
}

function labelForStrategy(
  strategy: LabelStrategy,
  row: Record<string, unknown>,
  context: {
    priorityLabel: string;
    priceLabel: string;
    marginLabel: string;
    stockLabel: string;
    categoryLabel: string;
    title: string;
    category: string;
  }
): string {
  switch (strategy) {
    case "priority":
      return context.priorityLabel;
    case "price":
      return context.priceLabel;
    case "margin":
      return context.marginLabel;
    case "category":
    case "product_type":
      return context.categoryLabel;
    case "stock":
      return context.stockLabel;
    case "brand":
      return directFieldLabel(row, brandFields, "brand_unknown", "brand_");
    case "sale":
      return bucketSale(row, context.title, context.category);
    case "season":
      return bucketSeason(context.title, context.category);
    case "shipping":
      return bucketShipping(row);
    case "performance":
      return bucketPerformance(row);
    case "gender":
      return directFieldLabel(row, genderFields, "gender_unknown", "gender_");
    case "size":
      return directFieldLabel(row, sizeFields, "size_unknown", "size_");
    case "release_year":
      return directFieldLabel(row, releaseYearFields, "year_unknown", "year_");
    case "none":
      return "";
    default:
      return "";
  }
}

function count(labels: Record<string, number>, label: string) {
  labels[label] = (labels[label] || 0) + 1;
}

export function labelProducts(rows: Record<string, unknown>[], strategies: LabelStrategyConfig = defaultLabelStrategies): {
  rows: Record<string, unknown>[];
  summary: ProductLabelSummary;
} {
  const labels: Record<string, number> = {};
  const notes: string[] = [];

  const labeledRows = rows.map((row) => {
    const productPrice = price(row);
    const productMargin = margin(row);
    const availability = fieldValue(row, availabilityFields);
    const category = fieldValue(row, categoryFields);
    const brand = fieldValue(row, brandFields);
    const title = fieldValue(row, titleFields);
    const id = fieldValue(row, idFields);

    const priceLabel = bucketPrice(productPrice);
    const marginLabel = bucketMargin(productMargin);
    const stockLabel = bucketAvailability(availability);
    const categoryLabel = bucketCategory(category);
    const priorityLabel =
      stockLabel !== "in_stock"
        ? "priority_exclude"
        : productMargin >= 0.4 && productPrice >= 50
          ? "priority_scale"
          : productMargin < 0.2
            ? "priority_protect_margin"
            : "priority_standard";

    const context = {
      priorityLabel,
      priceLabel,
      marginLabel,
      stockLabel,
      categoryLabel,
      title,
      category
    };

    const customLabels = {
      custom_label_0: labelForStrategy(strategies.custom_label_0, row, context),
      custom_label_1: labelForStrategy(strategies.custom_label_1, row, context),
      custom_label_2: labelForStrategy(strategies.custom_label_2, row, context),
      custom_label_3: labelForStrategy(strategies.custom_label_3, row, context),
      custom_label_4: labelForStrategy(strategies.custom_label_4, row, context)
    };

    Object.values(customLabels)
      .filter(Boolean)
      .forEach((label) => count(labels, label));

    return {
      ...row,
      ...customLabels,
      labelizer_product_id: id,
      labelizer_product_title: title,
      labelizer_brand: brand
    };
  });

  if (rows.length && !rows.some((row) => fieldValue(row, priceFields))) {
    notes.push("No price column was detected, so price labels are mostly unknown.");
  }
  if (rows.length && !rows.some((row) => fieldValue(row, marginFields))) {
    notes.push("No margin column was detected. Add margin or gross margin for stronger Shopping/PMax labels.");
  }
  if (labels.priority_scale) {
    notes.push(`${labels.priority_scale} products look suitable for a scaling label based on price, stock and margin.`);
  }
  if (labels.out_of_stock || labels.delayed_stock) {
    notes.push("Some products should be excluded or separated because availability is weak.");
  }

  return {
    rows: labeledRows,
    summary: {
      totalProducts: rows.length,
      labeledProducts: labeledRows.length,
      labels,
      notes
    }
  };
}

export function labeledProductsToXlsxBase64(rows: Record<string, unknown>[]): string {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "labeled-products");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buffer.toString("base64");
}
