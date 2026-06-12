import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const cwd = typeof process !== "undefined" ? process.cwd() : globalThis.nodeRepl?.cwd;
const root = existsSync(join(cwd, "data", "products.csv")) ? cwd : join(cwd, "flora-aroma-site");
const productsCsv = readFileSync(join(root, "data", "products.csv"), "utf8");
const rows = productsCsv.trim().split(/\r?\n/);
let failed = false;

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function fail(message) {
  console.error(message);
  failed = true;
  if (typeof process !== "undefined") {
    process.exitCode = 1;
  }
}

const headers = parseCsvLine(rows[0]).map((header) => header.replace(/^\uFEFF/, ""));

if (!existsSync(join(root, "dist", "index.html"))) {
  fail("dist/index.html is missing. Run npm run build first.");
}

for (const requiredPage of [
  "catalog/index.html",
  "price/index.html",
  "how-to-order/index.html",
  "contacts/index.html"
]) {
  if (!existsSync(join(root, "dist", requiredPage))) {
    fail(`Missing required MVP page: ${requiredPage}`);
  }
}

for (const requiredAsset of [
  "public/images/site/nursery-hero.jpg",
  "public/images/site/nursery-irrigation.jpg",
  "public/images/site/nursery-greenhouse.jpg"
]) {
  if (!existsSync(join(root, requiredAsset))) {
    fail(`Missing required design asset: ${requiredAsset}`);
  }
}

if (rows.length !== 41) {
  fail(`Expected 40 product rows, found ${rows.length - 1}.`);
}

const requiredColumns = [
  "plant_id",
  "name_uk",
  "latin_name",
  "category",
  "summary",
  "ecology_text",
  "agrotechnics_text",
  "use_text",
  "full_description",
  "content_status",
  "source_names",
  "source_urls",
  "source_confidence",
  "source_note",
  "sun_exposure",
  "moisture",
  "height_cm_min",
  "height_cm_max",
  "flowering_months",
  "flower_color",
  "winter_hardiness",
  "use_cases",
  "spacing_cm",
  "selection_tags",
  "seo_title",
  "seo_description"
];

for (const required of requiredColumns) {
  if (!headers.includes(required)) {
    fail(`Missing products.csv column: ${required}`);
  }
}

for (const required of ["ecology_text", "agrotechnics_text", "use_text", "full_description", "source_names", "source_urls"]) {
  const index = headers.indexOf(required);
  const missing = rows.slice(1).filter((row) => !parseCsvLine(row)[index]?.trim());
  if (missing.length > 0) {
    fail(`Expected every product to have ${required}, missing ${missing.length}.`);
  }
}

for (const required of [
  "sun_exposure",
  "moisture",
  "height_cm_min",
  "height_cm_max",
  "flowering_months",
  "flower_color",
  "winter_hardiness",
  "use_cases",
  "spacing_cm",
  "selection_tags"
]) {
  const index = headers.indexOf(required);
  const missing = rows.slice(1).filter((row) => !parseCsvLine(row)[index]?.trim());
  if (missing.length > 0) {
    fail(`Expected every product to have D2 field ${required}, missing ${missing.length}.`);
  }
}

const numericD2Fields = ["height_cm_min", "height_cm_max"];
for (const required of numericD2Fields) {
  const index = headers.indexOf(required);
  const invalid = rows.slice(1).filter((row) => Number.isNaN(Number(parseCsvLine(row)[index])));
  if (invalid.length > 0) {
    fail(`Expected numeric D2 field ${required}, invalid ${invalid.length}.`);
  }
}

const imagePathIndex = headers.indexOf("image_path");
if (imagePathIndex === -1) {
  fail("Missing products.csv column: image_path");
} else {
  const missingImages = rows.slice(1).filter((row) => !parseCsvLine(row)[imagePathIndex]);
  if (missingImages.length > 0) {
    fail(`Expected every product to have image_path, missing ${missingImages.length}.`);
  }

  const productIdIndex = headers.indexOf("plant_id");
  for (const row of rows.slice(1)) {
    const values = parseCsvLine(row);
    const plantId = values[productIdIndex];
    const imagePaths = values[imagePathIndex]
      .split(/[;|]/)
      .map((path) => path.trim())
      .filter(Boolean);

    for (const imagePath of imagePaths) {
      if (!imagePath.startsWith("/")) {
        fail(`Expected absolute public image path for ${plantId}: ${imagePath}`);
        continue;
      }

      if (!existsSync(join(root, "public", imagePath.slice(1)))) {
        fail(`Missing public image file for ${plantId}: ${imagePath}`);
      }
    }
  }
}

function readHtmlFiles(directory) {
  const entries = readdirSync(directory);
  const html = [];

  for (const entry of entries) {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      html.push(...readHtmlFiles(path));
    } else if (entry.endsWith(".html") || entry.endsWith(".xml")) {
      html.push(readFileSync(path, "utf8"));
    }
  }

  return html;
}

const publicHtml = readHtmlFiles(join(root, "dist")).join("\n");

for (const forbidden of [
  "quantity_snapshot",
  "точний склад Flora",
  "Кількість у Tilda",
  "Джерела картки",
  "Джерела зображень",
  "Розширений опис",
  "/image-credits/",
  "image-credits"
]) {
  if (publicHtml.includes(forbidden)) {
    fail(`Forbidden public phrase found: ${forbidden}`);
  }
}

if (!publicHtml.includes("data-gallery")) {
  fail("Expected product gallery markup in public HTML.");
}

if (publicHtml.includes('src="/images/plants/') && publicHtml.includes("; /images/plants/")) {
  fail("A product list appears to use an unsplit multi-image path as an img src.");
}

for (const requiredPhrase of [
  "Дім правильних рослин",
  "Саджанці, вирощені за сучасними технологіями",
  "Підібрати рослини",
  "Посухостійкі рослини",
  "Уточнити наявність",
  "Як замовити",
  "Відкрити табличний прайс",
]) {
  if (!publicHtml.includes(requiredPhrase)) {
    fail(`Expected storefront CTA phrase: ${requiredPhrase}`);
  }
}

for (const requiredPage of [
  "selections/drought-tolerant/index.html",
  "selections/aromatic-garden/index.html",
  "selections/pollinator-plants/index.html",
  "selections/border-plants/index.html",
  "selections/low-maintenance/index.html"
]) {
  if (!existsSync(join(root, "dist", requiredPage))) {
    fail(`Missing required D2 selection page: ${requiredPage}`);
  }
}

if (!failed) {
  console.log("Site verification passed: MVP pages, 40 products, gallery image paths, expanded descriptions, required columns, no public source blocks or internal stock phrases.");
}
