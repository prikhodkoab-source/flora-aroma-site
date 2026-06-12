import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const siteRoot = process.cwd();
const productsCsvPath = join(siteRoot, "data", "products.csv");
const imageSourcesCsvPath = join(siteRoot, "data", "plant-image-sources.csv");
const publicPlantImagesDir = join(siteRoot, "public", "images", "plants");

const blockedTitlePatterns = [
  /distribution/i,
  /range/i,
  /map/i,
  /diagram/i,
  /icon/i,
  /logo/i,
  /seedling/i
];

const allowedLicensePatterns = [
  /public domain/i,
  /cc0/i,
  /cc by/i,
  /cc-by/i,
  /creative commons/i
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

function cleanLatinName(latinName) {
  return latinName
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\bLindl\.?\b/gi, "")
    .replace(/\bL\.?\b/gi, "")
    .replace(/\bMoench\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function safeExtFromUrl(url, mime) {
  const lowerExt = extname(new URL(url).pathname).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(lowerExt)) {
    return lowerExt === ".jpeg" ? ".jpg" : lowerExt;
  }
  if (mime === "image/png") {
    return ".png";
  }
  if (mime === "image/webp") {
    return ".webp";
  }
  return ".jpg";
}

function metadataValue(metadata, key) {
  return metadata?.[key]?.value ? String(metadata[key].value).replace(/<[^>]+>/g, "").trim() : "";
}

function isUsableImage(page, info) {
  if (!info || info.mediatype !== "BITMAP") {
    return false;
  }
  if (!/^image\/(jpeg|png|webp)$/i.test(info.mime ?? "")) {
    return false;
  }
  if (Number(info.width ?? 0) < 500 || Number(info.height ?? 0) < 350) {
    return false;
  }
  if (blockedTitlePatterns.some((pattern) => pattern.test(page.title))) {
    return false;
  }
  const license = metadataValue(info.extmetadata, "LicenseShortName") || metadataValue(info.extmetadata, "UsageTerms");
  return allowedLicensePatterns.some((pattern) => pattern.test(license));
}

async function commonsSearch(product) {
  const latin = cleanLatinName(product.latin_name);
  const search = `${latin} plant`;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "15",
    gsrsearch: search,
    prop: "imageinfo",
    iiprop: "url|mime|mediatype|size|extmetadata",
    iiurlwidth: "900",
    origin: "*"
  }).toString();

  const response = await fetch(url, {
    headers: {
      "user-agent": "FloraAromaSiteImageSync/0.1 (local preview; flora-aroma.com.ua)"
    }
  });
  if (!response.ok) {
    throw new Error(`Commons API failed for ${product.plant_id}: ${response.status}`);
  }

  const data = await response.json();
  const pages = Object.values(data.query?.pages ?? {});
  const candidates = pages
    .map((page) => ({ page, info: page.imageinfo?.[0] }))
    .filter(({ page, info }) => isUsableImage(page, info))
    .sort((a, b) => {
      const aExact = a.page.title.toLowerCase().includes(latin.toLowerCase()) ? 1 : 0;
      const bExact = b.page.title.toLowerCase().includes(latin.toLowerCase()) ? 1 : 0;
      return bExact - aExact || Number(b.info.width ?? 0) * Number(b.info.height ?? 0) - Number(a.info.width ?? 0) * Number(a.info.height ?? 0);
    });

  return candidates[0] ?? null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadImage(url, targetPath) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "user-agent": "FloraAromaSiteImageSync/0.1 (local preview; flora-aroma.com.ua)"
      }
    });
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      writeFileSync(targetPath, bytes);
      return true;
    }
    if (response.status !== 429 || attempt === 3) {
      console.log(`Image download skipped: ${response.status} ${url}`);
      return false;
    }
    await sleep(2500 * attempt);
  }
  return false;
}

mkdirSync(publicPlantImagesDir, { recursive: true });

const products = parseCsv(readFileSync(productsCsvPath, "utf8"));
const existingSources = existsSync(imageSourcesCsvPath)
  ? parseCsv(readFileSync(imageSourcesCsvPath, "utf8"))
  : [];
const sourceByPlantId = new Map(existingSources.map((row) => [row.plant_id, row]));
const rows = [...existingSources];

for (const product of products.filter((row) => !row.image_path && !sourceByPlantId.has(row.plant_id))) {
  console.log(`Searching image for ${product.plant_id} ${product.latin_name}`);
  const candidate = await commonsSearch(product);
  if (!candidate) {
    console.log(`No usable Commons image found for ${product.plant_id}`);
    continue;
  }

  const { page, info } = candidate;
  const downloadUrl = info.thumburl || info.url;
  const ext = safeExtFromUrl(downloadUrl, info.mime);
  const fileName = `${product.plant_id.toLowerCase()}-commons${ext}`;
  const targetPath = join(publicPlantImagesDir, fileName);
  const downloaded = await downloadImage(downloadUrl, targetPath);
  if (!downloaded) {
    continue;
  }

  rows.push({
    plant_id: product.plant_id,
    image_path: `/images/plants/${fileName}`,
    source: "Wikimedia Commons",
    source_page: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/^File:/, "File:"))}`,
    source_file_url: info.url,
    downloaded_file_url: downloadUrl,
    title: page.title,
    author: metadataValue(info.extmetadata, "Artist"),
    license: metadataValue(info.extmetadata, "LicenseShortName") || metadataValue(info.extmetadata, "UsageTerms"),
    license_url: metadataValue(info.extmetadata, "LicenseUrl"),
    reviewed_status: "needs_operator_visual_review"
  });
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
  await sleep(900);
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
