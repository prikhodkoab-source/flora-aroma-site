import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const localGalleryPlan = [
  ["PLANT-0084", "Агастахе фенхельне", ["Агастахе фенхельне-1.jpg", "Агастахе фенхельне V-120.jpg"]],
  ["PLANT-0058", "Аквілегія низька 'Columbine Dwarf Mixed'", ["Аквілегія-1.jpg", "Аквілегія-2_.jpg", "Аквілегія-3.jpg"]],
  ["PLANT-0064", "Волошка синя 'Низька махрова суміш'", ["Волошка синя.jpg", "Волошка 1.jpg", "Волошка синя V-120.jpg"]],
  ["PLANT-0027", "Левиний зів", ["Левиний зів -1.jpg", "Левиний зів V-120.jpg"]],
  ["PLANT-0014", "Котівник котячий", ["Котівник котячий.jpg", "Котівник котячий-2.jpg"]],
  ["PLANT-0085", "Костриця Готьє", ["Костриця готьє.jpg", "Костриця готьє-2.jpg"]],
  ["PLANT-0086", "Звіробій звичайний", ["Звіробій звичайний-2.jpg"]],
  ["PLANT-0044", "Майоран садовий", ["Майоран садовий V-120.jpg"]],
  ["PLANT-0037", "М'ята гірська", ["Мята гірська V-120.jpg"]],
  ["PLANT-0081", "М’ята перцева", ["Мята перцева V-120.jpg"]]
];

const thymusCommons = {
  plantId: "PLANT-0090",
  imagePath: "/images/plants/plant-0090-commons.jpg",
  fileName: "plant-0090-commons.jpg",
  pageTitle: "File:Thymus vulgaris 002.JPG",
  sourcePage: "https://commons.wikimedia.org/wiki/File:Thymus_vulgaris_002.JPG"
};

const galleryOverrides = new Map([
  [
    "PLANT-0049",
    [
      "/images/plants/local/plant-0049-local-01.jpg",
      "/images/plants/local/plant-0049-local-02.jpg",
      "/images/plants/local/plant-0049-local-03.jpg",
      "/images/plants/plant-0049.jpg"
    ]
  ],
  [
    "PLANT-0002",
    [
      "/images/plants/local/plant-0002-local-03.jpg",
      "/images/plants/local/plant-0002-local-01.jpg",
      "/images/plants/plant-0002.jpg"
    ]
  ],
  [
    "PLANT-0052",
    [
      "/images/plants/local/plant-0052-local-01.jpg",
      "/images/plants/local/plant-0052-local-02.jpg",
      "/images/plants/local/plant-0052-local-03.jpg",
      "/images/plants/plant-0052-commons.jpg"
    ]
  ],
  [
    "PLANT-0058",
    [
      "/images/plants/local/plant-0058-local-gallery-01.jpg",
      "/images/plants/local/plant-0058-local-gallery-02.jpg",
      "/images/plants/local/plant-0058-local-gallery-03.jpg",
      "/images/plants/plant-0058.jpg"
    ]
  ]
]);

const blockedGalleryPaths = new Map([
  ["PLANT-0058", new Set(["/images/plants/local/plant-0058-local-gallery-04.jpg"])]
]);

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

function containerPhotoRank(path) {
  const lower = path.toLowerCase();
  return /(v-?120|p-?9|p-?11|p11|р-?9|р-?11|горщик|горш|касет|hiko)/iu.test(lower) ? 1 : 0;
}

function uniquePaths(paths) {
  const seen = new Set();
  return paths.filter((path) => {
    const key = path.trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function applyGalleryOverrides() {
  for (const [plantId, preferredPaths] of galleryOverrides) {
    const product = productById.get(plantId);
    if (!product) {
      continue;
    }
    const blocked = blockedGalleryPaths.get(plantId) ?? new Set();
    const existingPaths = (product.image_path || "")
      .split(/[;|]/)
      .map((path) => path.trim())
      .filter(Boolean)
      .filter((path) => !blocked.has(path));

    product.image_path = uniquePaths([
      ...preferredPaths.filter((path) => existingPaths.includes(path)),
      ...existingPaths
    ]).join("; ");
  }
}

function addSourceStatus(plantId, imagePath, status, note) {
  const key = `${plantId}|${imagePath}`;
  if (sourceKeys.has(key)) {
    const existing = imageSources.find((row) => row.plant_id === plantId && row.image_path === imagePath);
    if (existing) {
      existing.reviewed_status = status;
      existing.title = existing.title || note;
    }
    return;
  }

  imageSources.push({
    plant_id: plantId,
    image_path: imagePath,
    source: "Flora storefront legacy image",
    source_page: "",
    source_file_url: "",
    downloaded_file_url: "",
    title: note,
    author: "Flora & Aroma local file",
    license: "local_review_needed",
    license_url: "",
    reviewed_status: status
  });
  sourceKeys.add(key);
}

function localTargetName(plantId, sourceName, index) {
  const ext = extname(sourceName).toLowerCase() === ".jpeg" ? ".jpg" : extname(sourceName).toLowerCase();
  return `${plantId.toLowerCase()}-local-gallery-${String(index + 1).padStart(2, "0")}${ext || ".jpg"}`;
}

async function commonsImageInfo(title) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|mime|mediatype|size|extmetadata",
    iiurlwidth: "1200",
    origin: "*"
  }).toString();

  const response = await fetch(url, {
    headers: { "user-agent": "FloraAromaSiteImageSync/0.2 (local preview; flora-aroma.com.ua)" }
  });
  if (!response.ok) {
    throw new Error(`Commons API failed: ${response.status}`);
  }
  const data = await response.json();
  const page = Object.values(data.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info?.thumburl && !info?.url) {
    throw new Error(`Commons image not found: ${title}`);
  }
  return info;
}

function metadataValue(metadata, key) {
  return metadata?.[key]?.value ? String(metadata[key].value).replace(/<[^>]+>/g, "").trim() : "";
}

async function downloadImage(url, targetPath) {
  const response = await fetch(url, {
    headers: { "user-agent": "FloraAromaSiteImageSync/0.2 (local preview; flora-aroma.com.ua)" }
  });
  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status} ${url}`);
  }
  writeFileSync(targetPath, new Uint8Array(await response.arrayBuffer()));
}

mkdirSync(publicLocalDir, { recursive: true });
mkdirSync(publicPlantDir, { recursive: true });

const { headers: productHeaders, rows: products } = parseCsv(readFileSync(productCsvPath, "utf8"));
const productById = new Map(products.map((row) => [row.plant_id, row]));

function restoreMissingProductRowsFromHead(requiredPlantIds) {
  let previousProducts = [];
  try {
    const previousCsv = execFileSync("git", ["show", "HEAD:data/products.csv"], {
      cwd: siteRoot,
      encoding: "utf8"
    });
    previousProducts = parseCsv(previousCsv).rows;
  } catch (error) {
    console.log(`Could not read previous products.csv from git: ${error.message}`);
    return;
  }

  const previousById = new Map(previousProducts.map((row) => [row.plant_id, row]));
  for (const plantId of requiredPlantIds) {
    if (!productById.has(plantId) && previousById.has(plantId)) {
      const restored = previousById.get(plantId);
      products.push(restored);
      productById.set(plantId, restored);
      console.log(`Restored missing product row from HEAD: ${plantId}`);
    }
  }
}

restoreMissingProductRowsFromHead(localGalleryPlan.map(([plantId]) => plantId));

const { headers: sourceHeaders, rows: imageSources } = existsSync(imageSourcesCsvPath)
  ? parseCsv(readFileSync(imageSourcesCsvPath, "utf8"))
  : {
      headers: [
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
      ],
      rows: []
    };
const sourceKeys = new Set(imageSources.map((row) => `${row.plant_id}|${row.image_path}`));

for (const [plantId, title, fileNames] of localGalleryPlan) {
  const product = productById.get(plantId);
  if (!product) {
    continue;
  }

  const newPaths = [];
  const sourceRankByPath = new Map();
  fileNames.forEach((fileName, index) => {
    const sourcePath = join(localImageRoot, fileName);
    if (!existsSync(sourcePath)) {
      console.log(`Missing local image: ${fileName}`);
      return;
    }
    const targetName = localTargetName(plantId, fileName, index);
    const targetPath = join(publicLocalDir, targetName);
    copyFileSync(sourcePath, targetPath);
    const publicPath = `/images/plants/local/${targetName}`;
    newPaths.push(publicPath);
    sourceRankByPath.set(publicPath, containerPhotoRank(fileName));

    const key = `${plantId}|${publicPath}`;
    if (!sourceKeys.has(key)) {
      imageSources.push({
        plant_id: plantId,
        image_path: publicPath,
        source: "Local Flora image folder",
        source_page: sourcePath,
        source_file_url: sourcePath,
        downloaded_file_url: "",
        title,
        author: "Flora & Aroma local file",
        license: "local_review_needed",
        license_url: "",
        reviewed_status: containerPhotoRank(fileName) ? "container_photo_not_primary" : "operator_selected_for_storefront"
      });
      sourceKeys.add(key);
    }
  });

  const existingPaths = (product.image_path || "")
    .split(/[;|]/)
    .map((path) => path.trim())
    .filter(Boolean);
  product.image_path = uniquePaths([...newPaths, ...existingPaths])
    .sort((a, b) => (sourceRankByPath.get(a) ?? containerPhotoRank(a)) - (sourceRankByPath.get(b) ?? containerPhotoRank(b)))
    .join("; ");
}

applyGalleryOverrides();
addSourceStatus("PLANT-0049", "/images/plants/plant-0049.jpg", "container_photo_not_primary", "Sinyukha cassette plug photo kept as non-primary gallery image");
addSourceStatus("PLANT-0002", "/images/plants/plant-0002.jpg", "container_photo_not_primary", "Immortelle pot photo kept as non-primary gallery image");
addSourceStatus("PLANT-0058", "/images/plants/local/plant-0058-local-gallery-04.jpg", "duplicate_hidden_from_product_gallery", "Duplicate aquilegia pot photo removed from public product gallery");

if (!productById.has("PLANT-0090")) {
  const summary =
    "Ароматичний напівкущик і класичний кулінарний чебрець для сонячних, добре дренованих місць. Має дрібне запашне сіро-зелене листя, літнє цвітіння і підходить для пряно-ароматичних посадок, контейнерів, рокаріїв та сухіших бордюрів. Зимостійкість: USDA 5-9.";
  const ecology =
    "Довідкова основа картки: Чебрець звичайний (Thymus vulgaris) росте як низький дерев'янистий ароматичний напівкущик для відкритих сонячних місць. Найкраще підходить легкий, водопроникний грунт без застою води; у важких або перезволожених місцях рослина швидше втрачає декоративність і зимостійкість.";
  const agrotechnics =
    "Поточний формат постачання: Горщик P9. Після висадки підтримують помірну вологість до вкорінення, далі поливають стримано. Посадку не загущують, після цвітіння можна легко підрізати пагони для компактності, а надмірне азотне живлення не бажане.";
  const use =
    "Господарське застосування: пряні грядки, ароматичні бордюри, рокарії, сухі сонячні квітники, контейнерні посадки і невеликі товарні партії для роздрібного продажу. Харчове використання згадується як довідкова характеристика культури, не як медична рекомендація.";
  const row = Object.fromEntries(productHeaders.map((header) => [header, ""]));
  Object.assign(row, {
    plant_id: "PLANT-0090",
    name_uk: "Чебрець звичайний",
    latin_name: "Thymus vulgaris",
    category: "Пряні рослини",
    container: "Горщик P9",
    price_uah: "30",
    unit: "шт.",
    availability_status: "ready_for_sale",
    summary,
    ecology_text: ecology,
    agrotechnics_text: agrotechnics,
    use_text: use,
    full_description: `${ecology} ${agrotechnics} ${use}`,
    content_status: "source_backed_species_draft",
    source_names: "NC State Extension Gardener Plant Toolbox; Missouri Botanical Garden; Plants of the World Online / Kew",
    source_urls:
      "https://plants.ces.ncsu.edu/plants/thymus-vulgaris/; https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=281450; https://powo.science.kew.org/results?q=Thymus%20vulgaris",
    source_confidence: "high",
    source_note: "Common thyme is a separate catalog taxon from creeping thyme; public availability remains operator-confirmed.",
    seo_title: "Чебрець звичайний - саджанці Flora & Aroma",
    seo_description: "Чебрець звичайний (Thymus vulgaris). Горщик P9. Ціна 30 UAH/шт. Наявність підтверджує оператор.",
    image_path: thymusCommons.imagePath,
    sun_exposure: "full_sun",
    moisture: "dry;medium",
    height_cm_min: "15",
    height_cm_max: "30",
    flowering_months: "06;07;08",
    flower_color: "pink;purple",
    winter_hardiness: "USDA 5-9",
    use_cases: "culinary;aromatic;pollinator;dry_site;container",
    spacing_cm: "25-30",
    selection_tags: "aromatic_garden;pollinator_plants;drought_tolerant;low_maintenance"
  });
  products.push(row);
  productById.set(row.plant_id, row);
}

const thymusTarget = join(publicPlantDir, thymusCommons.fileName);
if (!existsSync(thymusTarget)) {
  const info = await commonsImageInfo(thymusCommons.pageTitle);
  await downloadImage(info.thumburl || info.url, thymusTarget);
  const key = `${thymusCommons.plantId}|${thymusCommons.imagePath}`;
  if (!sourceKeys.has(key)) {
    imageSources.push({
      plant_id: thymusCommons.plantId,
      image_path: thymusCommons.imagePath,
      source: "Wikimedia Commons",
      source_page: metadataValue(info.extmetadata, "ObjectName") ? thymusCommons.sourcePage : info.descriptionurl || thymusCommons.sourcePage,
      source_file_url: info.url,
      downloaded_file_url: info.thumburl || info.url,
      title: "Thymus vulgaris 002.JPG",
      author: metadataValue(info.extmetadata, "Artist") || "H. Zell",
      license: metadataValue(info.extmetadata, "LicenseShortName") || metadataValue(info.extmetadata, "UsageTerms"),
      license_url: metadataValue(info.extmetadata, "LicenseUrl"),
      reviewed_status: "needs_operator_visual_review"
    });
    sourceKeys.add(key);
  }
}

writeCsv(productCsvPath, productHeaders, products);
writeCsv(imageSourcesCsvPath, sourceHeaders, imageSources);

console.log(`Products now: ${products.length}`);
console.log("Synced local gallery photos and added PLANT-0090.");
