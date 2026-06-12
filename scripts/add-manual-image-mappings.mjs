import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const siteRoot = process.cwd();
const projectRoot = resolve(siteRoot, "..");
const imageSourcesCsvPath = join(siteRoot, "data", "plant-image-sources.csv");
const publicPlantImagesDir = join(siteRoot, "public", "images", "plants");

const mappings = [
  ["PLANT-0086", "Звіробій звичайний", "Звіробій звичайний 1.jpg"],
  ["PLANT-0051", "Каламінта котовникова", "Каламинта котовникова.jpg"],
  ["PLANT-0042", "Кніфофія ягідна", "Кніфофія ягідна 1.jpg"],
  ["PLANT-0044", "Майоран садовий", "Майоран садовий.jpg"],
  ["PLANT-0032", "Сосна звичайна", "Сосна звичайна V-120.jpg"],
  ["PLANT-0087", "Чебрець повзучий", "Чебрець повзучий 2.jpg"]
];

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

const headers = [
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
];
const rows = existsSync(imageSourcesCsvPath) ? parseCsv(readFileSync(imageSourcesCsvPath, "utf8")) : [];
const existing = new Set(rows.map((row) => row.plant_id));

for (const [plantId, title, localFileName] of mappings) {
  if (existing.has(plantId)) {
    continue;
  }
  const sourcePath = join(projectRoot, "Изображения", localFileName);
  if (!existsSync(sourcePath)) {
    console.log(`Missing local image for ${plantId}: ${sourcePath}`);
    continue;
  }
  const ext = extname(sourcePath).toLowerCase() || ".jpg";
  const fileName = `${plantId.toLowerCase()}-local-review${ext === ".jpeg" ? ".jpg" : ext}`;
  copyFileSync(sourcePath, join(publicPlantImagesDir, fileName));
  rows.push({
    plant_id: plantId,
    image_path: `/images/plants/${fileName}`,
    source: "Local Flora image folder",
    source_page: sourcePath,
    source_file_url: sourcePath,
    downloaded_file_url: "",
    title,
    author: "Flora & Aroma local file",
    license: "local_review_needed",
    license_url: "",
    reviewed_status: "needs_operator_visual_review"
  });
}

writeCsv(imageSourcesCsvPath, rows, headers);
console.log(`Image source manifest now has ${rows.length} rows.`);
