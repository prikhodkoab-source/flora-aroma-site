import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const siteRoot = process.cwd();
const projectRoot = resolve(siteRoot, "..");
const productsCsvPath = join(siteRoot, "data", "products.csv");
const cardsCsvPath = join(projectRoot, "data", "normalized", "PlantCards_Gate1.csv");
const imageSourcesCsvPath = join(siteRoot, "data", "plant-image-sources.csv");
const publicPlantImagesDir = join(siteRoot, "public", "images", "plants");

function parseCsv(text) {
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
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }
  const [headers, ...body] = rows;
  const normalizedHeaders = headers.map((header) => header.replace(/^\uFEFF/, "").trim());
  return body.map((values) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] ?? ""])));
}

function csvValue(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(path, rows, headers) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvValue(row[header])).join(","));
  }
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const products = parseCsv(readFileSync(productsCsvPath, "utf8"));
const cards = parseCsv(readFileSync(cardsCsvPath, "utf8"));
const sources = existsSync(imageSourcesCsvPath) ? parseCsv(readFileSync(imageSourcesCsvPath, "utf8")) : [];
const sourceByPlantId = new Map(sources.map((row) => [row.plant_id, row]));
const missingProductIds = new Set(products.filter((row) => !row.image_path && !sourceByPlantId.has(row.plant_id)).map((row) => row.plant_id));
const rows = [...sources];

for (const card of cards) {
  if (!missingProductIds.has(card.plant_id)) {
    continue;
  }
  if (card.photo_status !== "review_needed" || !card.primary_photo_path || !existsSync(card.primary_photo_path)) {
    continue;
  }

  const ext = extname(card.primary_photo_path).toLowerCase() || ".jpg";
  const normalizedExt = ext === ".jpeg" ? ".jpg" : ext;
  const fileName = `${card.plant_id.toLowerCase()}-local-review${normalizedExt}`;
  copyFileSync(card.primary_photo_path, join(publicPlantImagesDir, fileName));
  rows.push({
    plant_id: card.plant_id,
    image_path: `/images/plants/${fileName}`,
    source: "Local Flora image folder",
    source_page: card.primary_photo_path,
    source_file_url: card.primary_photo_path,
    downloaded_file_url: "",
    title: card.name_uk,
    author: "Flora & Aroma local file",
    license: "local_review_needed",
    license_url: "",
    reviewed_status: "needs_operator_visual_review"
  });
}

writeCsv(imageSourcesCsvPath, rows, [
  "plant_id",
  "image_path",
  "source",
  "source_page",
  "source_file_url",
  "downloaded_file_url",
  "title",
  "author",
  "license",
  "license_url",
  "reviewed_status"
]);

console.log(`Image source manifest now has ${rows.length} rows.`);
