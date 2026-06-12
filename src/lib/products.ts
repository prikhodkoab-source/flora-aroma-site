import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Product = {
  plant_id: string;
  name_uk: string;
  latin_name: string;
  category: string;
  container: string;
  price_uah: number;
  unit: string;
  availability_status: string;
  summary: string;
  ecology_text: string;
  agrotechnics_text: string;
  use_text: string;
  full_description: string;
  content_status: string;
  source_names: string;
  source_urls: string;
  source_confidence: string;
  source_note: string;
  seo_title: string;
  seo_description: string;
  image_path: string;
  slug: string;
  category_slug: string;
};

const projectRoot = process.cwd();
const productsCsvPath =
  [join(projectRoot, "data", "products.csv"), join(projectRoot, "flora-aroma-site", "data", "products.csv")].find(
    existsSync
  ) ?? join(projectRoot, "data", "products.csv");

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
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

const transliterationMap: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  є: "ie",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ю: "iu",
  я: "ia",
  ь: "",
  ы: "y",
  э: "e",
  ё: "io",
  ъ: ""
};

export function slugify(value: string): string {
  const transliterated = value
    .toLowerCase()
    .replace(/[а-яіїєґё]/giu, (char) => transliterationMap[char] ?? char);

  return transliterated
    .replace(/['’`×.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getProducts(): Product[] {
  const csv = readFileSync(productsCsvPath, "utf8").trim();
  const [headerLine, ...lines] = csv.split(/\r?\n/);
  const headers = parseCsvLine(headerLine).map((header) => header.replace(/^\uFEFF/, ""));

  return lines
    .filter(Boolean)
    .map((line) => {
      const values = parseCsvLine(line);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));

      return {
        plant_id: row.plant_id,
        name_uk: row.name_uk,
        latin_name: row.latin_name,
        category: row.category,
        container: row.container,
        price_uah: Number(row.price_uah),
        unit: row.unit,
        availability_status: row.availability_status,
        summary: row.summary,
        ecology_text: row.ecology_text,
        agrotechnics_text: row.agrotechnics_text,
        use_text: row.use_text,
        full_description: row.full_description,
        content_status: row.content_status,
        source_names: row.source_names,
        source_urls: row.source_urls,
        source_confidence: row.source_confidence,
        source_note: row.source_note,
        seo_title: row.seo_title,
        seo_description: row.seo_description,
        image_path: row.image_path,
        slug: `${slugify(row.name_uk)}-${row.plant_id.toLowerCase()}`,
        category_slug: slugify(row.category)
      };
    })
    .sort((a, b) => a.name_uk.localeCompare(b.name_uk, "uk"));
}

export function getCategories(): { name: string; slug: string; count: number }[] {
  const counts = new Map<string, { name: string; slug: string; count: number }>();

  for (const product of getProducts()) {
    const current = counts.get(product.category_slug) ?? {
      name: product.category,
      slug: product.category_slug,
      count: 0
    };
    current.count += 1;
    counts.set(product.category_slug, current);
  }

  return Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name, "uk"));
}

export function getPublicAvailabilityLabel(product: Product): string {
  if (product.availability_status === "ready_for_sale") {
    return "Уточнюємо в день відповіді.";
  }

  return "Потребує уточнення оператора.";
}
