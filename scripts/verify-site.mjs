import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const cwd = typeof process !== "undefined" ? process.cwd() : globalThis.nodeRepl?.cwd;
const root = existsSync(join(cwd, "data", "products.csv")) ? cwd : join(cwd, "flora-aroma-site");
const siteBase = "https://flora-aroma-site.pages.dev";
const pendingArticleSlug = "aromatnyi-bordiur-priani-zapashni-roslyny";
let failed = false;

function fail(message) {
  console.error(message);
  failed = true;
  process.exitCode = 1;
}

function parseCsvRows(text) {
  const rows = [];
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
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function readHtmlFiles(directory) {
  const html = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) html.push(...readHtmlFiles(path));
    if (stats.isFile() && (entry.endsWith(".html") || entry.endsWith(".xml"))) html.push(readFileSync(path, "utf8"));
  }
  return html;
}

if (!existsSync(join(root, "dist", "index.html"))) {
  fail("dist/index.html is missing. Run npm run build first.");
}

for (const requiredPage of [
  "index.html",
  "404.html",
  "shop/index.html",
  "catalog/index.html",
  "cart/index.html",
  "contacts/index.html",
  "publications/index.html",
  "admin/statistics/index.html"
]) {
  if (!existsSync(join(root, "dist", requiredPage))) {
    fail(`Missing required site page: ${requiredPage}`);
  }
}

if (existsSync(join(root, "dist", "publications", pendingArticleSlug, "index.html"))) {
  fail("Pending publication must not generate a public article route.");
}

for (const requiredAsset of [
  "public/images/tilda-clone/hero-greenhouse.jpg",
  "public/images/tilda-clone/tilda-logo.png",
  "public/images/site/nursery-irrigation.jpg",
  "public/cart.js",
  "functions/_analytics.js",
  "functions/api/analytics/event.js",
  "functions/api/analytics/summary.js",
  "src/components/SiteHeader.astro",
  "src/content.config.ts",
  "src/lib/publication-policy.mjs",
  "src/lib/publications.ts",
  "src/pages/publications/[slug].astro"
]) {
  if (!existsSync(join(root, requiredAsset))) {
    fail(`Missing required site asset: ${requiredAsset}`);
  }
}

if (existsSync(join(root, "src/pages/[slug].astro"))) {
  fail("Legacy root publication route still exists.");
}

const productsCsv = readFileSync(join(root, "data", "products.csv"), "utf8");
const rows = parseCsvRows(productsCsv.trim());
const headers = rows[0].map((header) => header.replace(/^\uFEFF/, ""));
const productRows = rows.slice(1);

if (productRows.length !== 44) {
  fail(`Expected 44 product rows, found ${productRows.length}.`);
}

for (const requiredColumn of [
  "plant_id",
  "name_uk",
  "latin_name",
  "container",
  "price_uah",
  "unit",
  "summary",
  "image_path",
  "variant_containers",
  "variant_prices_uah",
  "variant_units",
  "variant_labels"
]) {
  if (!headers.includes(requiredColumn)) {
    fail(`Missing products.csv column: ${requiredColumn}`);
  }
}

const columnIndex = (name) => headers.indexOf(name);
const imagePathIndex = columnIndex("image_path");
const plantIdIndex = columnIndex("plant_id");
const nameUkIndex = columnIndex("name_uk");
const latinNameIndex = columnIndex("latin_name");
const variantContainersIndex = columnIndex("variant_containers");
const variantPricesIndex = columnIndex("variant_prices_uah");
const productById = new Map(productRows.map((row) => [row[plantIdIndex], row]));

const plant0090 = productById.get("PLANT-0090");
if (!plant0090) {
  fail("Expected PLANT-0090 in products.csv.");
} else {
  const rowText = plant0090.join(" ");
  if (plant0090[latinNameIndex] !== "Salvia pratensis" || plant0090[nameUkIndex] !== "Шавлія лучна") {
    fail("Expected PLANT-0090 to export as Salvia pratensis / Шавлія лучна.");
  }
  if (rowText.includes("Thymus vulgaris") || rowText.includes("Чебрець")) {
    fail("PLANT-0090 contains stale Thymus / Чебрець data.");
  }
}

const plant0098 = productById.get("PLANT-0098");
if (!plant0098) {
  fail("Expected PLANT-0098 in products.csv.");
} else if (plant0098[latinNameIndex] !== "Thymus vulgaris" || plant0098[nameUkIndex] !== "Чебрець звичайний") {
  fail("Expected PLANT-0098 to export as Thymus vulgaris / Чебрець звичайний.");
}

for (const row of productRows) {
  const plantId = row[plantIdIndex];
  const imagePaths = (row[imagePathIndex] || "")
    .split(/[;|]/)
    .map((path) => path.trim())
    .filter(Boolean);

  if (imagePaths.length === 0 && plantId !== "PLANT-0090") {
    fail(`Expected product image path for ${plantId}`);
  }

  for (const imagePath of imagePaths) {
    if (!imagePath.startsWith("/")) {
      fail(`Expected absolute public image path for ${plantId}: ${imagePath}`);
      continue;
    }
    if (!existsSync(join(root, "public", imagePath.slice(1)))) {
      fail(`Missing public image file for ${plantId}: ${imagePath}`);
    }
  }

  const containers = (row[variantContainersIndex] || "").split(";").filter(Boolean);
  const prices = (row[variantPricesIndex] || "").split(";").filter(Boolean);
  if (containers.length !== prices.length) {
    fail(`Variant container/price mismatch for ${plantId}`);
  }
}

const publicHtml = readHtmlFiles(join(root, "dist")).join("\n");

for (const requiredPhrase of [
  "Дім правильних рослин",
  "Перейти до асортименту",
  "Поради та ідеї",
  "Контакти",
  "Матеріали готуються",
  "Написати в Telegram",
  "Що написати",
  "Ваше замовлення",
  "Оформити замовлення",
  "Статистика сайту",
  "Confirmed order analytics not connected."
]) {
  if (!publicHtml.includes(requiredPhrase)) {
    fail(`Expected public phrase: ${requiredPhrase}`);
  }
}

for (const requiredMarker of [
  "site-header",
  "site-cart-button",
  "data-site-menu-toggle",
  "data-site-mobile-menu",
  "publications-empty",
  "publication-catalog-cta",
  "tilda-cart-page",
  "data-cart-add",
  "data-cart-page",
  "data-cart-submit",
  "data-cart-customer-name",
  "data-cart-customer-contact",
  "data-order-success",
  "tilda-order-success",
  "data-product-option",
  "data-selected-price",
  'rel="canonical"',
  'property="og:title"',
  'property="og:description"'
]) {
  if (!publicHtml.includes(requiredMarker)) {
    fail(`Expected site marker: ${requiredMarker}`);
  }
}

for (const forbiddenMarker of ["tilda-cart-icon", "tilda-shop-header", "Flora plant_id:"]) {
  if (publicHtml.includes(forbiddenMarker)) {
    fail(`Forbidden legacy marker found: ${forbiddenMarker}`);
  }
}

const publicationsPage = readFileSync(join(root, "dist", "publications", "index.html"), "utf8");
if (publicationsPage.includes("hero-greenhouse.jpg")) {
  fail("Publications index must not use the greenhouse placeholder image.");
}
if (publicationsPage.includes("publication-card__image-link")) {
  fail("Empty publications page must not render article cards.");
}
if (publicationsPage.includes(pendingArticleSlug)) {
  fail("Pending publication slug leaked into publications index.");
}

const contactsPage = readFileSync(join(root, "dist", "contacts", "index.html"), "utf8");
for (const requiredContactMarker of ["tel:+380500272882", "https://flora-aroma.com.ua", "nursery-irrigation.jpg"]) {
  if (!contactsPage.includes(requiredContactMarker)) {
    fail(`Contacts page is missing: ${requiredContactMarker}`);
  }
}

const sitemap = readFileSync(join(root, "dist", "sitemap-index.xml"), "utf8");
const publicationIndexUrl = `${siteBase}/publications/`;
if (!sitemap.includes(publicationIndexUrl)) {
  fail("Expected /publications/ in sitemap.");
}
if (sitemap.includes(`${siteBase}/publications/${pendingArticleSlug}/`) || sitemap.includes(`${siteBase}/${pendingArticleSlug}/`)) {
  fail("Pending publication must not appear in sitemap.");
}
if (sitemap.includes("https://flora-aroma.com.ua")) {
  fail("Main-domain URLs must not appear in sitemap.");
}
for (const forbiddenSitemapPath of ["/admin/", "/api/"]) {
  if (sitemap.includes(forbiddenSitemapPath)) {
    fail(`Forbidden sitemap path found: ${forbiddenSitemapPath}`);
  }
}

for (const forbidden of [
  "quantity_snapshot",
  "точний склад Flora",
  "Кількість у Tilda",
  "Джерела картки",
  "Джерела зображень",
  "Розширений опис"
]) {
  if (publicHtml.includes(forbidden)) {
    fail(`Forbidden public phrase found: ${forbidden}`);
  }
}

const cartScript = readFileSync(join(root, "public", "cart.js"), "utf8");
for (const requiredCartScriptMarker of [
  "localStorage",
  "data-cart-increase",
  "data-cart-decrease",
  "data-cart-remove",
  'fetch("/api/site-order"',
  "optionId",
  "cartItemKey",
  "flora-analytics-event",
  "copy_order_request",
  "Наявність, об'єм і можливість резерву підтвердить оператор"
]) {
  if (!cartScript.includes(requiredCartScriptMarker)) {
    fail(`Expected cart script marker: ${requiredCartScriptMarker}`);
  }
}

for (const forbiddenCartScriptMarker of ["confirmed", "reserved", "paid", "stock_movement"]) {
  if (cartScript.includes(forbiddenCartScriptMarker)) {
    fail(`Forbidden live accounting marker in public cart script: ${forbiddenCartScriptMarker}`);
  }
}

for (const forbiddenPublicSecret of ["CF_ANALYTICS_API_TOKEN", "replace_with_account_analytics_read_token"]) {
  if (publicHtml.includes(forbiddenPublicSecret)) {
    fail(`Forbidden analytics secret marker in public bundle: ${forbiddenPublicSecret}`);
  }
}

if (!failed) {
  console.log(
    "Site verification passed: unified header is present, contacts page is rebuilt, publications stay fail-closed without placeholder covers, 44 products remain intact, and public cart/analytics markers are still wired."
  );
}
