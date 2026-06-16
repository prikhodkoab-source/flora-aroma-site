import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, "..");
const projectRoot = resolve(siteRoot, "..");
const localImageRoot = join(projectRoot, "Изображения");
const productCsvPath = join(siteRoot, "data", "products.csv");
const imageSourcesCsvPath = join(siteRoot, "data", "plant-image-sources.csv");
const publicPlantDir = join(siteRoot, "public", "images", "plants");
const publicLocalDir = join(publicPlantDir, "local");

const imagePlan = [
  {
    plantId: "PLANT-0088",
    title: "Арабіс кавказький",
    images: [{ source: "Арабіс кавказький.jpg", target: "plant-0088-local-01.jpg" }],
    remove: ["plant-0088-commons.jpg"]
  },
  {
    plantId: "PLANT-0089",
    title: "Базилік зелений",
    images: [
      { source: "Базилік зелений 1.jpg", target: "plant-0089-local-01.jpg" },
      { source: "Базилік зелений.jpg", target: "plant-0089-local-02.jpg" }
    ],
    remove: ["plant-0089-commons.jpg"]
  },
  {
    plantId: "PLANT-0055",
    title: "Лаванда широколиста",
    images: [
      { source: "Лаванда широколиста-3.jpg", target: "plant-0055-local-01.jpg" },
      { source: "Лаванда широколиста-2.jpg", target: "plant-0055-local-02.jpg" },
      { source: "Лаванда широколиста.jpg", target: "plant-0055-local-03.jpg" }
    ],
    remove: ["plant-0055-commons.jpg"]
  },
  {
    plantId: "PLANT-0004",
    title: "Гвоздика бородата",
    images: [
      { source: "Гвоздика бородата-1.jpg", target: "plant-0004-local-01.jpg" },
      { source: "Гвоздика бородата.jpg", target: "plant-0004-local-02.jpg" },
      { source: "Гвоздика бородата-3.jpg", target: "plant-0004-local-03.jpg" }
    ],
    remove: []
  }
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
  return {
    headers: normalizedHeaders,
    rows: body.map((values) =>
      Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] ?? ""]))
    )
  };
}

function csvValue(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(path, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvValue(row[header])).join(","));
  }
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function replaceCarnationText(row) {
  for (const key of Object.keys(row)) {
    row[key] = row[key]
      .replaceAll("Гвоздика турецька", "Гвоздика бородата")
      .replaceAll("гвоздика турецька", "гвоздика бородата")
      .replaceAll("Гвоздика турецкая", "Гвоздика бородатая")
      .replaceAll("гвоздика турецкая", "гвоздика бородатая");
  }
}

mkdirSync(publicLocalDir, { recursive: true });

const { headers: productHeaders, rows: products } = parseCsv(readFileSync(productCsvPath, "utf8"));
const productById = new Map(products.map((row) => [row.plant_id, row]));

for (const plan of imagePlan) {
  const product = productById.get(plan.plantId);
  if (!product) {
    throw new Error(`Product not found: ${plan.plantId}`);
  }

  const publicPaths = [];
  for (const image of plan.images) {
    const sourcePath = join(localImageRoot, image.source);
    if (!existsSync(sourcePath)) {
      throw new Error(`Local image not found for ${plan.plantId}: ${sourcePath}`);
    }
    const targetName = image.target.replace(/\.[^.]+$/, `${extname(sourcePath).toLowerCase() === ".jpeg" ? ".jpg" : extname(sourcePath).toLowerCase()}`);
    const targetPath = join(publicLocalDir, targetName);
    copyFileSync(sourcePath, targetPath);
    publicPaths.push(`/images/plants/local/${targetName}`);
  }

  product.image_path = publicPaths.join("; ");

  if (plan.plantId === "PLANT-0004") {
    product.name_uk = "Гвоздика бородата";
    replaceCarnationText(product);
  }

  for (const staleName of plan.remove) {
    const stalePath = join(publicPlantDir, staleName);
    if (existsSync(stalePath)) {
      rmSync(stalePath);
    }
  }
}

writeCsv(productCsvPath, productHeaders, products);

const imageSourceHeaders = [
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
const imageSources = existsSync(imageSourcesCsvPath)
  ? parseCsv(readFileSync(imageSourcesCsvPath, "utf8")).rows
  : [];
const replacedPlantIds = new Set(imagePlan.map((plan) => plan.plantId));
const updatedImageSources = imageSources.filter((row) => !replacedPlantIds.has(row.plant_id));

for (const plan of imagePlan) {
  for (const image of plan.images) {
    const sourcePath = join(localImageRoot, image.source);
    const targetName = image.target.replace(/\.[^.]+$/, `${extname(sourcePath).toLowerCase() === ".jpeg" ? ".jpg" : extname(sourcePath).toLowerCase()}`);
    updatedImageSources.push({
      plant_id: plan.plantId,
      image_path: `/images/plants/local/${targetName}`,
      source: "Local Flora image folder",
      source_page: sourcePath,
      source_file_url: sourcePath,
      downloaded_file_url: "",
      title: plan.title,
      author: "Flora & Aroma local file",
      license: "local_review_needed",
      license_url: "",
      reviewed_status: "operator_selected_for_storefront"
    });
  }
}

writeCsv(imageSourcesCsvPath, imageSourceHeaders, updatedImageSources);

console.log("Updated storefront image bindings:");
for (const plan of imagePlan) {
  console.log(`${plan.plantId}: ${productById.get(plan.plantId).image_path}`);
}
