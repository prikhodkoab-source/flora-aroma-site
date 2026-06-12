import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const siteRoot = process.cwd();
const imageSourcesCsvPath = join(siteRoot, "data", "plant-image-sources.csv");
const targetPath = join(siteRoot, "public", "images", "plants", "plant-0074-commons.jpg");

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
  const [headers, ...body] = rows;
  return body.map((values) => Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, "").trim(), values[index] ?? ""])));
}

function csvValue(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeCsv(path, rows, headers) {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((header) => csvValue(row[header])).join(","));
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

const sourceFileUrl = "https://upload.wikimedia.org/wikipedia/commons/9/94/Ruta_graveolens3.jpg";
const response = await fetch(sourceFileUrl, {
  headers: { "user-agent": "FloraAromaSiteImageSync/0.1 (local preview; flora-aroma.com.ua)" }
});
if (!response.ok) {
  throw new Error(`Ruta image download failed: ${response.status}`);
}
writeFileSync(targetPath, new Uint8Array(await response.arrayBuffer()));

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
const rows = parseCsv(readFileSync(imageSourcesCsvPath, "utf8")).filter((row) => row.plant_id !== "PLANT-0074");
rows.push({
  plant_id: "PLANT-0074",
  image_path: "/images/plants/plant-0074-commons.jpg",
  source: "Wikimedia Commons",
  source_page: "https://commons.wikimedia.org/wiki/File:Ruta_graveolens3.jpg",
  source_file_url: sourceFileUrl,
  downloaded_file_url: sourceFileUrl,
  title: "File:Ruta graveolens3.jpg",
  author: "Kurt Stüber",
  license: "CC BY-SA 3.0",
  license_url: "https://creativecommons.org/licenses/by-sa/3.0/",
  reviewed_status: "needs_operator_visual_review"
});
writeCsv(imageSourcesCsvPath, rows, headers);
console.log("Added Ruta graveolens image.");
