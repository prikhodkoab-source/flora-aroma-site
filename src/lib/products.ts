import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ProductOption = {
  variant_id: string;
  container: string;
  price_uah: number;
  unit: string;
  label: string;
};

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
  sun_exposure: string;
  moisture: string;
  height_cm_min: number;
  height_cm_max: number;
  flowering_months: string;
  flower_color: string;
  flower_color_labels: string[];
  winter_hardiness: string;
  winter_hardiness_short: string;
  use_cases: string;
  spacing_cm: string;
  selection_tags: string;
  sun_labels: string[];
  moisture_labels: string[];
  flowering_labels: string[];
  use_case_labels: string[];
  selection_tag_list: string[];
  seo_title: string;
  seo_description: string;
  image_path: string;
  image_paths: string[];
  primary_image_path: string;
  options: ProductOption[];
  has_multiple_options: boolean;
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

const sunLabels: Record<string, string> = {
  full_sun: "сонце",
  part_sun: "півтінь",
  shade: "тінь"
};

const moistureLabels: Record<string, string> = {
  dry: "сухо",
  medium: "помірно",
  moist: "волого"
};

const monthLabels: Record<string, string> = {
  "04": "квітень",
  "05": "травень",
  "06": "червень",
  "07": "липень",
  "08": "серпень",
  "09": "вересень",
  "10": "жовтень"
};

const useCaseLabels: Record<string, string> = {
  accent: "акцент",
  aromatic: "ароматична посадка",
  border: "бордюр",
  container: "контейнер",
  culinary: "пряна рослина",
  cut_flower: "зріз",
  dried_flower: "сухоцвіт",
  dry_site: "сухе місце",
  edible: "їстівне використання",
  groundcover: "ґрунтопокривна",
  landscape: "ландшафт",
  mass_planting: "масив",
  meadow: "луговий квітник",
  medicinal: "лікарська",
  moist_site: "вологе місце",
  naturalistic: "натуралістична посадка",
  ornamental: "декоративна",
  ornamental_grass: "декоративний злак",
  pollinator: "для запилювачів",
  rain_garden: "вологий квітник",
  rock_garden: "рокарій",
  shade: "тіньова посадка",
  shade_border: "напівтіньовий бордюр",
  tree: "дерево",
  windbreak: "вітрозахист"
};

const flowerColorLabels: Record<string, string> = {
  blue: "синій",
  cream: "кремовий",
  green: "зелений",
  inconspicuous: "непомітне цвітіння",
  lavender: "лавандовий",
  lilac: "ліловий",
  mixed: "суміш кольорів",
  orange: "помаранчевий",
  pale_pink: "світло-рожевий",
  pale_yellow: "світло-жовтий",
  pink: "рожевий",
  purple: "пурпуровий",
  red: "червоний",
  tan: "солом'яний",
  violet: "фіолетовий",
  white: "білий",
  yellow: "жовтий"
};

export const selectionDefinitions = [
  {
    slug: "sunny-site",
    tag: "sunny_site",
    match: "sun:full_sun",
    title: "Рослини для сонця",
    description: "Культури для відкритих сонячних місць: квітники, бордюри, ароматичні посадки та сухіші ділянки з добрим дренажем."
  },
  {
    slug: "drought-tolerant",
    tag: "drought_tolerant",
    match: "tag:drought_tolerant",
    title: "Посухостійкі рослини",
    description: "Рослини для сонячних, добре дренованих місць, де важлива витривалість до коротких сухих періодів."
  },
  {
    slug: "aromatic-garden",
    tag: "aromatic_garden",
    match: "tag:aromatic_garden",
    title: "Ароматичний сад",
    description: "Пряні, ефіроолійні та ароматні культури для доріжок, бордюрів і камерних посадок."
  },
  {
    slug: "pollinator-plants",
    tag: "pollinator_plants",
    match: "tag:pollinator_plants",
    title: "Рослини для запилювачів",
    description: "Культури з помітним цвітінням, які доречні у квітниках для бджіл, джмелів і метеликів."
  },
  {
    slug: "border-plants",
    tag: "border_plants",
    match: "tag:border_plants",
    title: "Рослини для бордюрів",
    description: "Компактні та середньорослі рослини для краю квітника, доріжок і структурних посадок."
  },
  {
    slug: "low-maintenance",
    tag: "low_maintenance",
    match: "tag:low_maintenance",
    title: "Невибагливі рослини",
    description: "Позиції, які за належного місця посадки підходять для простого догляду і стабільних композицій."
  }
] as const;

export type SelectionDefinition = (typeof selectionDefinitions)[number];

function splitList(value: string): string[] {
  return value
    .split(/[;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function labelsFrom(value: string, dictionary: Record<string, string>): string[] {
  return splitList(value).map((item) => dictionary[item] ?? item);
}

function getKyivWinterHardiness(value: string): { short: string; full: string } {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return {
      short: "Потребує уточнення",
      full: "Зимостійкість в умовах Києва потребує уточнення."
    };
  }

  if (normalized.includes("annual") || normalized.includes("tender")) {
    return {
      short: "Ні · не зимує",
      full: "Не зимостійка у відкритому ґрунті в умовах Києва. Рівень: недостатній; вирощується як однорічна або потребує зимівлі в захищеному приміщенні."
    };
  }

  const zoneMatch = normalized.match(/(?:usda\s*)?(\d+)/);
  const minimumZone = zoneMatch ? Number(zoneMatch[1]) : Number.NaN;

  if (!Number.isFinite(minimumZone)) {
    return {
      short: "Потребує уточнення",
      full: "Зимостійкість в умовах Києва потребує уточнення."
    };
  }

  if (minimumZone <= 4) {
    return {
      short: "Так · високий рівень",
      full: "Зимостійка в умовах Києва. Рівень: високий; доросла рослина зазвичай зимує у відкритому ґрунті без спеціального укриття."
    };
  }

  if (minimumZone <= 5) {
    return {
      short: "Так · достатній рівень",
      full: "Зимостійка в умовах Києва. Рівень: достатній; бажані добре дреноване місце та легке укриття молодих рослин у першу зиму."
    };
  }

  if (minimumZone <= 7) {
    return {
      short: "Ні · низький рівень",
      full: "Не має надійної зимостійкості у відкритому ґрунті в умовах Києва. Рівень: низький; потрібні тепле захищене місце, сухий дренований ґрунт і зимове укриття."
    };
  }

  return {
    short: "Ні · не зимує",
    full: "Не зимостійка у відкритому ґрунті в умовах Києва. Рівень: недостатній; рослину потрібно переносити на захищену зимівлю."
  };
}

function replaceTechnicalWinterHardiness(text: string, publicText: string): string {
  if (!text) {
    return text;
  }

  return text.replace(/Зимостійкість:\s*[^.]+\.?/giu, publicText);
}

function optionIdFrom(container: string, index: number): string {
  const slug = slugify(container);
  return slug || `option-${index + 1}`;
}

function productOptionsFrom(row: Record<string, string>): ProductOption[] {
  const containers = splitList(row.variant_containers || "");
  const prices = splitList(row.variant_prices_uah || "");
  const units = splitList(row.variant_units || "");
  const labels = splitList(row.variant_labels || "");

  if (containers.length === 0) {
    return [
      {
        variant_id: "default",
        container: row.container,
        price_uah: Number(row.price_uah),
        unit: row.unit,
        label: `${row.container} - ${row.price_uah} UAH/${row.unit}`
      }
    ];
  }

  return containers.map((container, index) => {
    const price = Number(prices[index] || row.price_uah);
    const unit = units[index] || row.unit;

    return {
      variant_id: optionIdFrom(container, index),
      container,
      price_uah: price,
      unit,
      label: labels[index] || `${container} - ${price} UAH/${unit}`
    };
  });
}

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
      const imagePaths = row.image_path
        .split(/[;|]/)
        .map((path) => path.trim())
        .filter(Boolean);
      const options = productOptionsFrom(row);
      const primaryOption = options[0];
      const kyivWinterHardiness = getKyivWinterHardiness(row.winter_hardiness);

      return {
        plant_id: row.plant_id,
        name_uk: row.name_uk,
        latin_name: row.latin_name,
        category: row.category,
        container: primaryOption.container,
        price_uah: primaryOption.price_uah,
        unit: primaryOption.unit,
        availability_status: row.availability_status,
        summary: replaceTechnicalWinterHardiness(row.summary, kyivWinterHardiness.full),
        ecology_text: replaceTechnicalWinterHardiness(row.ecology_text, kyivWinterHardiness.full),
        agrotechnics_text: replaceTechnicalWinterHardiness(row.agrotechnics_text, kyivWinterHardiness.full),
        use_text: replaceTechnicalWinterHardiness(row.use_text, kyivWinterHardiness.full),
        full_description: replaceTechnicalWinterHardiness(row.full_description, kyivWinterHardiness.full),
        content_status: row.content_status,
        source_names: row.source_names,
        source_urls: row.source_urls,
        source_confidence: row.source_confidence,
        source_note: row.source_note,
        sun_exposure: row.sun_exposure,
        moisture: row.moisture,
        height_cm_min: Number(row.height_cm_min),
        height_cm_max: Number(row.height_cm_max),
        flowering_months: row.flowering_months,
        flower_color: row.flower_color,
        flower_color_labels: labelsFrom(row.flower_color, flowerColorLabels),
        winter_hardiness: kyivWinterHardiness.full,
        winter_hardiness_short: kyivWinterHardiness.short,
        use_cases: row.use_cases,
        spacing_cm: row.spacing_cm,
        selection_tags: row.selection_tags,
        sun_labels: labelsFrom(row.sun_exposure, sunLabels),
        moisture_labels: labelsFrom(row.moisture, moistureLabels),
        flowering_labels: labelsFrom(row.flowering_months, monthLabels),
        use_case_labels: labelsFrom(row.use_cases, useCaseLabels),
        selection_tag_list: splitList(row.selection_tags),
        seo_title: row.seo_title,
        seo_description: replaceTechnicalWinterHardiness(row.seo_description, kyivWinterHardiness.full),
        image_path: row.image_path,
        image_paths: imagePaths,
        primary_image_path: imagePaths[0] ?? "",
        options,
        has_multiple_options: options.length > 1,
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

export function getSelections(): (SelectionDefinition & { count: number })[] {
  const products = getProducts();

  return selectionDefinitions.map((selection) => ({
    ...selection,
    count: products.filter((product) => productMatchesSelection(product, selection)).length
  }));
}

export function productMatchesSelection(product: Product, selection: SelectionDefinition): boolean {
  if (selection.match.startsWith("sun:")) {
    return splitList(product.sun_exposure).includes(selection.match.replace("sun:", ""));
  }

  if (selection.match.startsWith("tag:")) {
    return product.selection_tag_list.includes(selection.match.replace("tag:", ""));
  }

  return product.selection_tag_list.includes(selection.tag);
}

export function formatHeight(product: Product): string {
  if (!Number.isFinite(product.height_cm_min) || !Number.isFinite(product.height_cm_max)) {
    return "потребує уточнення";
  }

  return `${product.height_cm_min}-${product.height_cm_max} см`;
}

export function formatFlowering(product: Product): string {
  return product.flowering_labels.length > 0 ? product.flowering_labels.join(", ") : "потребує уточнення";
}

export function getPublicAvailabilityLabel(product: Product): string {
  if (product.availability_status === "ready_for_sale") {
    return "Уточнюємо в день відповіді.";
  }

  return "Потребує уточнення оператора.";
}
