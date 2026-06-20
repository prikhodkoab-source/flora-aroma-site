import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const cwd = typeof process !== "undefined" ? process.cwd() : globalThis.nodeRepl?.cwd;
const root = existsSync(join(cwd, "data", "products.csv")) ? cwd : join(cwd, "flora-aroma-site");
const productsCsv = readFileSync(join(root, "data", "products.csv"), "utf8");
const rows = productsCsv.trim().split(/\r?\n/);
let failed = false;

function parseCsvRows(text) {
  const parsedRows = [];
  let row = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((value) => value.length > 0)) {
        parsedRows.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((value) => value.length > 0)) {
    parsedRows.push(row);
  }

  return parsedRows;
}

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
const parsedRows = parseCsvRows(productsCsv.trim());
const parsedHeaders = parsedRows[0].map((header) => header.replace(/^\uFEFF/, ""));
const productRows = parsedRows.slice(1);

if (!existsSync(join(root, "dist", "index.html"))) {
  fail("dist/index.html is missing. Run npm run build first.");
}

for (const requiredPage of [
  "catalog/index.html",
  "cart/index.html",
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

if (productRows.length !== 41) {
  fail(`Expected 41 product rows, found ${productRows.length}.`);
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

for (const required of ["variant_containers", "variant_prices_uah", "variant_units", "variant_labels", "price_rule"]) {
  if (!headers.includes(required)) {
    fail(`Missing products.csv variant column: ${required}`);
  }
}

const columnIndex = (name) => parsedHeaders.indexOf(name);
const variantContainersIndex = columnIndex("variant_containers");
const variantPricesIndex = columnIndex("variant_prices_uah");
const variantLabelsIndex = columnIndex("variant_labels");
const priceRuleIndex = columnIndex("price_rule");

let potOptionCount = 0;
for (const row of productRows) {
  const containers = (row[variantContainersIndex] || "").split(";").filter(Boolean);
  const prices = (row[variantPricesIndex] || "").split(";").filter(Boolean).map(Number);
  const labels = row[variantLabelsIndex] || "";
  const hasPot = containers.some((container) => container.startsWith("Горщик"));

  if (containers.length !== prices.length) {
    fail(`Variant container/price mismatch for row: ${row[columnIndex("plant_id")]}`);
  }

  if (hasPot && row[priceRuleIndex] !== "pot_plus_20_uah_from_cassette_base") {
    fail(`Expected pot price rule marker for ${row[columnIndex("plant_id")]}`);
  }

  potOptionCount += containers.filter((container) => container.startsWith("Горщик")).length;

  for (let index = 0; index < containers.length; index += 1) {
    if (!labels.includes(`${containers[index]} — ${prices[index]} UAH/шт.`)) {
      fail(`Variant label missing exact price for ${row[columnIndex("plant_id")]}: ${containers[index]}`);
    }
  }
}

if (potOptionCount !== 20) {
  fail(`Expected 20 pot price options, found ${potOptionCount}.`);
}

for (const required of ["ecology_text", "agrotechnics_text", "use_text", "full_description", "source_names", "source_urls"]) {
  const index = headers.indexOf(required);
  const missing = productRows.filter((row) => !row[index]?.trim());
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
  const missing = productRows.filter((row) => !row[index]?.trim());
  if (missing.length > 0) {
    fail(`Expected every product to have D2 field ${required}, missing ${missing.length}.`);
  }
}

const numericD2Fields = ["height_cm_min", "height_cm_max"];
for (const required of numericD2Fields) {
  const index = headers.indexOf(required);
  const invalid = productRows.filter((row) => Number.isNaN(Number(row[index])));
  if (invalid.length > 0) {
    fail(`Expected numeric D2 field ${required}, invalid ${invalid.length}.`);
  }
}

const imagePathIndex = headers.indexOf("image_path");
if (imagePathIndex === -1) {
  fail("Missing products.csv column: image_path");
} else {
  const imageSourcePath = join(root, "data", "plant-image-sources.csv");
  const containerPrimaryBlocked = new Set();
  if (existsSync(imageSourcePath)) {
    const imageSourceRows = readFileSync(imageSourcePath, "utf8").trim().split(/\r?\n/);
    const sourceHeaders = parseCsvLine(imageSourceRows[0]).map((header) => header.replace(/^\uFEFF/, ""));
    const sourcePlantIdIndex = sourceHeaders.indexOf("plant_id");
    const sourceImagePathIndex = sourceHeaders.indexOf("image_path");
    const sourceStatusIndex = sourceHeaders.indexOf("reviewed_status");

    for (const row of imageSourceRows.slice(1)) {
      const values = parseCsvLine(row);
      if (values[sourceStatusIndex] === "container_photo_not_primary") {
        containerPrimaryBlocked.add(`${values[sourcePlantIdIndex]}|${values[sourceImagePathIndex]}`);
      }
    }
  }

  const missingImages = productRows.filter((row) => !row[imagePathIndex]);
  if (missingImages.length > 0) {
    fail(`Expected every product to have image_path, missing ${missingImages.length}.`);
  }

  const productIdIndex = headers.indexOf("plant_id");
  for (const values of productRows) {
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

    if (imagePaths.length > 0 && containerPrimaryBlocked.has(`${plantId}|${imagePaths[0]}`)) {
      fail(`Container/pot photo must not be primary for ${plantId}: ${imagePaths[0]}`);
    }
  }
}

const plantIdIndex = parsedHeaders.indexOf("plant_id");
const nameUkIndex = parsedHeaders.indexOf("name_uk");
const latinNameIndex = parsedHeaders.indexOf("latin_name");
const thymusVulgarisRow = productRows.find((values) => values[plantIdIndex] === "PLANT-0090");
if (!thymusVulgarisRow) {
  fail("Expected PLANT-0090 Thymus vulgaris product row.");
} else {
  if (thymusVulgarisRow[nameUkIndex] !== "Чебрець звичайний") {
    fail("Expected PLANT-0090 Ukrainian name: Чебрець звичайний.");
  }
  if (thymusVulgarisRow[latinNameIndex] !== "Thymus vulgaris") {
    fail("Expected PLANT-0090 Latin name: Thymus vulgaris.");
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
  "USDA ",
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

for (const requiredWinterPhrase of [
  "Зимостійка в умовах Києва",
  "Не зимостійка у відкритому ґрунті в умовах Києва"
]) {
  if (!publicHtml.includes(requiredWinterPhrase)) {
    fail(`Expected Kyiv winter hardiness wording: ${requiredWinterPhrase}`);
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
  "Ми вирощуємо саджанці",
  "касетах Hiko та горщиках",
  "Скласти заявку",
  "Вирощуємо самі",
  "Закрита коренева система",
  "Фото виробництва",
  "Підібрати рослини",
  "Рослини для сонця",
  "Готові рішення",
  "Ароматна грядка",
  "Сухий квітник",
  "Медоносна посадка",
  "Кошик",
  "Чернетка заявки",
  "Уточнити наявність",
  "Як замовити",
  "Відкрити табличний прайс",
]) {
  if (!publicHtml.includes(requiredPhrase)) {
    fail(`Expected storefront CTA phrase: ${requiredPhrase}`);
  }
}

for (const requiredCartMarkup of [
  "data-cart-add",
  "data-cart-page",
  "data-cart-message",
  "data-cart-submit",
  "data-cart-customer-name",
  "data-cart-customer-contact",
  "data-cart-delivery",
  "data-cart-toast",
  "/cart/"
]) {
  if (!publicHtml.includes(requiredCartMarkup)) {
    fail(`Expected cart markup: ${requiredCartMarkup}`);
  }
}

if (!existsSync(join(root, "public", "cart.js"))) {
  fail("Missing public cart script: public/cart.js");
}

const cartScript = readFileSync(join(root, "public", "cart.js"), "utf8");
for (const requiredCartScriptMarker of [
  "data-cart-increase",
  "data-cart-decrease",
  "data-cart-toast-title",
  "data-cart-submit",
  'fetch("/api/site-order"',
  "optionId",
  "cartItemKey"
]) {
  if (!cartScript.includes(requiredCartScriptMarker)) {
    fail(`Expected cart script marker: ${requiredCartScriptMarker}`);
  }
}

const siteOrderFunctionPath = join(root, "functions", "api", "site-order.js");
if (!existsSync(siteOrderFunctionPath)) {
  fail("Missing Cloudflare Pages Function: functions/api/site-order.js");
} else {
  const siteOrderFunction = readFileSync(siteOrderFunctionPath, "utf8");
  for (const marker of [
    "TELEGRAM_TOKEN",
    "TELEGRAM_CHAT_ID",
    "TELEGRAM_ALLOWED_USER_IDS",
    "SITE_REQUESTS_DB",
    "status: \"draft\"",
    "stored: true",
    "заявка без резерву",
    "onRequestPost"
  ]) {
    if (!siteOrderFunction.includes(marker)) {
      fail(`Expected site order function marker: ${marker}`);
    }
  }
}

const siteOrdersExportPath = join(root, "functions", "api", "site-orders.js");
if (!existsSync(siteOrdersExportPath)) {
  fail("Missing protected site-order export: functions/api/site-orders.js");
} else {
  const exportSource = readFileSync(siteOrdersExportPath, "utf8");
  for (const marker of ["W2_SYNC_TOKEN", "SITE_REQUESTS_DB", "sync_status", "Authorization"]) {
    if (!exportSource.includes(marker)) {
      fail(`Expected site-order export marker: ${marker}`);
    }
  }
}

const plantPageSource = readFileSync(join(root, "src", "pages", "plants", "[slug].astro"), "utf8");
for (const requiredVariantMarker of ["data-product-options", "data-product-option", "data-selected-price", "data-option-id"]) {
  if (!plantPageSource.includes(requiredVariantMarker)) {
    fail(`Expected product variant marker: ${requiredVariantMarker}`);
  }
}

for (const requiredPage of [
  "selections/sunny-site/index.html",
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
  console.log("Site verification passed: MVP pages, 41 products, 20 pot price options, gallery image paths, expanded descriptions, required columns, no public source blocks or internal stock phrases.");
}
