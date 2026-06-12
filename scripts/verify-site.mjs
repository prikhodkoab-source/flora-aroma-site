import { existsSync, readFileSync } from "node:fs";
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

if (!existsSync(join(root, "dist", "image-credits", "index.html"))) {
  fail("dist/image-credits/index.html is missing.");
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

const imagePathIndex = headers.indexOf("image_path");
if (imagePathIndex === -1) {
  fail("Missing products.csv column: image_path");
} else {
  const missingImages = rows.slice(1).filter((row) => !parseCsvLine(row)[imagePathIndex]);
  if (missingImages.length > 0) {
    fail(`Expected every product to have image_path, missing ${missingImages.length}.`);
  }
}

const publicHtml = [
  readFileSync(join(root, "dist", "index.html"), "utf8"),
  readFileSync(join(root, "dist", "catalog", "index.html"), "utf8")
].join("\n");

for (const forbidden of ["quantity_snapshot", "точний склад Flora", "Кількість у Tilda"]) {
  if (publicHtml.includes(forbidden)) {
    fail(`Forbidden public phrase found: ${forbidden}`);
  }
}

if (!failed) {
  console.log("Site verification passed: 40 products, images, expanded descriptions, required columns, no internal stock phrases.");
}
