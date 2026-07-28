import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const cwd = typeof process !== "undefined" ? process.cwd() : globalThis.nodeRepl?.cwd;
const root = existsSync(join(cwd, "data", "products.csv")) ? cwd : join(cwd, "flora-aroma-site");
const shopHtmlPath = join(root, "dist", "shop", "index.html");

if (!existsSync(shopHtmlPath)) {
  throw new Error("dist/shop/index.html is missing. Run npm run build before npm run test:catalog-filters.");
}

const shopHtml = readFileSync(shopHtmlPath, "utf8");
const distDirectory = join(root, "dist");

function readFilesRecursively(directory, extensions) {
  const output = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      output.push(...readFilesRecursively(path, extensions));
      continue;
    }

    if (stats.isFile() && extensions.some((extension) => entry.endsWith(extension))) {
      output.push(readFileSync(path, "utf8"));
    }
  }

  return output;
}

const builtJs = readFilesRecursively(distDirectory, [".js"]).join("\n");
const configMatch = shopHtml.match(
  /<script[^>]*type="application\/json"[^>]*data-catalog-config[^>]*>([\s\S]*?)<\/script>/i
);

assert.ok(configMatch, "Catalog config JSON script is missing in shop HTML.");

const config = JSON.parse(configMatch[1]);
const sections = config.sections ?? [];
const quickPicks = config.quickPicks ?? [];
const products = config.products ?? [];

const sectionById = new Map(sections.map((section) => [section.id, section]));
const quickPickById = new Map(quickPicks.map((pick) => [pick.id, pick]));

function hasOption(sectionId, value) {
  const section = sectionById.get(sectionId);
  return Boolean(section?.options?.some((option) => option.value === value));
}

function hasLabel(sectionId, label) {
  const section = sectionById.get(sectionId);
  return Boolean(section?.options?.some((option) => option.label === label));
}

function matchesHeightBand(product, value) {
  if (!Number.isFinite(product.heightMin) || !Number.isFinite(product.heightMax)) return false;
  if (value === "0-30") return product.heightMax <= 30;
  if (value === "30-60") return product.heightMin <= 60 && product.heightMax >= 30;
  if (value === "60-100") return product.heightMin <= 100 && product.heightMax >= 60;
  if (value === "100-plus") return product.heightMax > 100;
  return false;
}

function matchesPriceBand(product, value) {
  if (!Number.isFinite(product.price)) return false;
  if (value === "0-50") return product.price <= 50;
  if (value === "50-100") return product.price > 50 && product.price <= 100;
  if (value === "100-plus") return product.price > 100;
  return false;
}

function productMatchesFilters(product, filters) {
  if (filters.sun?.length && !filters.sun.some((value) => product.sun.includes(value))) return false;
  if (filters.moisture?.length && !filters.moisture.some((value) => product.moisture.includes(value))) return false;
  if (filters.purpose?.length && !filters.purpose.some((value) => product.purpose.includes(value))) return false;
  if (filters.height?.length && !filters.height.some((value) => matchesHeightBand(product, value))) return false;
  if (filters.flowering?.length && !filters.flowering.some((value) => product.flowering.includes(value))) return false;
  if (filters.category?.length && !filters.category.includes(product.categoryValue)) return false;
  if (filters.format?.length && !filters.format.some((value) => product.formats.includes(value))) return false;
  if (filters.price?.length && !filters.price.some((value) => matchesPriceBand(product, value))) return false;
  return true;
}

assert.equal(products.length, 44, "Expected 44 public catalog products in the built shop config.");

for (const expectedSection of ["sun", "moisture", "purpose", "height", "flowering", "category", "format", "price"]) {
  assert.ok(sectionById.has(expectedSection), `Missing catalog filter section: ${expectedSection}`);
}

assert.ok(hasOption("sun", "full-sun"), "Sun filter is missing full-sun.");
assert.ok(hasOption("sun", "part-sun"), "Sun filter is missing part-sun.");
assert.ok(hasOption("moisture", "dry"), "Moisture filter is missing dry.");
assert.ok(hasOption("moisture", "medium"), "Moisture filter is missing medium.");
assert.ok(hasOption("moisture", "moist"), "Moisture filter is missing moist.");
assert.ok(hasOption("height", "30-60"), "Height filter is missing 30-60.");
assert.ok(hasOption("price", "0-50"), "Price filter is missing 0-50.");
assert.ok(hasOption("price", "50-100"), "Price filter is missing 50-100.");

assert.ok(hasLabel("format", "0,12 л"), "Format filter is missing 0,12 л.");
assert.ok(hasLabel("format", "0,4 л"), "Format filter is missing 0,4 л.");

assert.ok(
  !hasLabel("category", "Злаки") && !hasLabel("category", "Кущі"),
  "Catalog filters must not invent category labels that are absent in the public export."
);

for (const expectedQuickPick of [
  "sunny",
  "part-shade",
  "dry-sites",
  "pollinators",
  "aromatic-garden",
  "long-blooming",
  "culinary-herbs",
  "medicinal-plants"
]) {
  assert.ok(quickPickById.has(expectedQuickPick), `Missing quick pick: ${expectedQuickPick}`);
}

assert.ok(
  !quickPickById.has("ornamental-grasses"),
  "The ornamental grasses quick pick must stay hidden until a matching public category exists."
);

for (const [id, quickPick] of quickPickById.entries()) {
  const matchedCount = products.filter((product) => productMatchesFilters(product, quickPick.filters ?? {})).length;
  assert.equal(matchedCount, quickPick.count, `Quick pick count mismatch for ${id}.`);
}

const firstPollinatorProduct = products.find((product) => product.purpose.includes("pollinator"));
assert.ok(firstPollinatorProduct, "Expected at least one pollinator-friendly product in the public catalog.");
assert.ok(
  productMatchesFilters(firstPollinatorProduct, { purpose: ["pollinator"] }),
  "Pollinator filters should match products that expose the pollinator purpose."
);

const festuca = products.find((product) => product.plantId === "PLANT-0048");
assert.ok(festuca, "Expected PLANT-0048 in the public catalog config.");
assert.ok(!festuca.purpose.includes("pollinator"), "PLANT-0048 must not be marked as pollinator-friendly.");
assert.ok(
  !productMatchesFilters(festuca, { purpose: ["pollinator"] }),
  "PLANT-0048 must not match the pollinator quick filter."
);

const firstPartShadeProduct = products.find((product) => product.sun.includes("part-sun"));
assert.ok(firstPartShadeProduct, "Expected at least one part-shade product in the public catalog.");
assert.ok(
  productMatchesFilters(firstPartShadeProduct, { sun: ["part-sun"] }),
  "Part-shade filters should match products that expose the part-sun value."
);

const filteredByHeight = products.filter((product) => productMatchesFilters(product, { height: ["30-60"] }));
assert.ok(filteredByHeight.length > 0, "Expected products inside the 30-60 cm height band.");

const filteredByPrice = products.filter((product) => productMatchesFilters(product, { price: ["50-100"] }));
assert.ok(filteredByPrice.length > 0, "Expected products inside the 50-100 UAH price band.");

assert.match(builtJs, /history\.replaceState\(null,\s*""\s*,/, "Catalog filters should sync state to URL.");
assert.match(builtJs, /new URLSearchParams\(window\.location\.search\)/, "Catalog filters should initialize from URL query params.");
assert.match(shopHtml, /data-catalog-search/, "Catalog search input marker is missing from built HTML.");
assert.match(shopHtml, /data-catalog-open-filters/, "Catalog mobile filter toggle marker is missing from built HTML.");
assert.match(shopHtml, /data-catalog-active-chip-list/, "Active filter chip marker is missing from built HTML.");
assert.ok(
  !shopHtml.includes("Наявність підтверджуємо перед замовленням"),
  "Catalog page must not repeat the operator-confirmed availability notice in the heading or product cards."
);

assert.equal(quickPickById.get("pollinators")?.label, "Для запилювачів", "Pollinator quick pick label must match the filter label.");

console.log("Catalog filter integration checks passed.");
