import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const cwd = typeof process !== "undefined" ? process.cwd() : globalThis.nodeRepl?.cwd;
const root = existsSync(join(cwd, "data", "products.csv")) ? cwd : join(cwd, "flora-aroma-site");
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

for (const requiredPage of ["index.html", "shop/index.html", "catalog/index.html", "cart/index.html", "admin/statistics/index.html"]) {
  if (!existsSync(join(root, "dist", requiredPage))) {
    fail(`Missing required Tilda clone page: ${requiredPage}`);
  }
}

for (const requiredAsset of [
  "public/images/tilda-clone/hero-greenhouse.jpg",
  "public/images/tilda-clone/tilda-logo.png",
  "public/cart.js",
  "functions/_analytics.js",
  "functions/api/analytics/event.js",
  "functions/api/analytics/summary.js",
  "src/lib/analytics.ts"
]) {
  if (!existsSync(join(root, requiredAsset))) {
    fail(`Missing required Tilda clone asset: ${requiredAsset}`);
  }
}

const productsCsv = readFileSync(join(root, "data", "products.csv"), "utf8");
const rows = parseCsvRows(productsCsv.trim());
const headers = rows[0].map((header) => header.replace(/^\uFEFF/, ""));
const productRows = rows.slice(1);

if (productRows.length !== 43) {
  fail(`Expected 43 product rows, found ${productRows.length}.`);
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
const variantContainersIndex = columnIndex("variant_containers");
const variantPricesIndex = columnIndex("variant_prices_uah");

for (const row of productRows) {
  const plantId = row[plantIdIndex];
  const imagePaths = (row[imagePathIndex] || "")
    .split(/[;|]/)
    .map((path) => path.trim())
    .filter(Boolean);

  if (imagePaths.length === 0) {
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
  "Рослини, вирощені за сучасними технологіями",
  "Отримати консультацію",
  "Перейти до асортименту",
  "Як ми вирощуємо",
  "Що ми вирощуємо",
  "Як замовити",
  "Ваше замовлення",
  "Оформити замовлення",
  "Оплата",
  "Інформація про доставку",
  "Статистика сайту",
  "Аналітику ще не підключено до Cloudflare"
]) {
  if (!publicHtml.includes(requiredPhrase)) {
    fail(`Expected Tilda clone phrase: ${requiredPhrase}`);
  }
}

for (const requiredMarker of [
  "tilda-cover",
  "tilda-shop-header",
  "tilda-product-card",
  "tilda-cart-page",
  "tilda-cart-icon",
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
  'property="og:description"',
  'property="og:image"'
]) {
  if (!publicHtml.includes(requiredMarker)) {
    fail(`Expected Tilda clone marker: ${requiredMarker}`);
  }
}

for (const forbidden of [
  "quantity_snapshot",
  "точний склад Flora",
  "Кількість у Tilda",
  "Джерела картки",
  "Джерела зображень",
  "Розширений опис",
  "Flora plant_id:"
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
  "Наявність, формат і можливість резерву підтвердить оператор"
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
  console.log("Site verification passed: Tilda clone shell, shop grid, product pages, safe draft cart, analytics MVP files, 43 products, local images, and SEO markers are present.");
}
