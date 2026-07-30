import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ProductOption = {
  variant_id: string;
  container_type_id: string;
  format_code: string;
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

const FORMAT_SORT_ORDER: Record<string, number> = {
  "V-120": 10,
  "V-265": 15,
  P9: 20,
  P10: 30,
  P11: 40,
  P12: 50,
  P13: 60,
  P15: 70,
  P18: 80,
  P19: 90,
  P23: 100
};

const FORMAT_VOLUME_LITERS: Record<string, number> = {
  "V-120": 0.12,
  "V-265": 0.265,
  P9: 0.4,
  P10: 0.5,
  P11: 0.6,
  P12: 0.7,
  P13: 1.0,
  P15: 1.5,
  P18: 2.4,
  P19: 3.0,
  P23: 5.0
};

const CONTAINER_TYPE_VOLUME_LITERS: Record<string, number> = {
  "CASSETTE-HIKO-V120SS": 0.12,
  "CASSETTE-HIKO-V265": 0.265,
  "POT-P9": 0.4,
  "POT-P10": 0.5,
  "POT-P11": 0.6,
  "POT-P12": 0.7,
  "POT-P13": 1.0,
  "POT-P15": 1.5,
  "POT-P18": 2.4,
  "POT-P19": 3.0,
  "POT-P23": 5.0
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
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function labelsFrom(value: string, dictionary: Record<string, string>): string[] {
  return splitList(value).map((item) => dictionary[item] ?? item);
}

function normalizeWinterHardinessReference(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "зона зимостійкості не вказана";
  }

  if (/^usda\b/i.test(trimmed)) {
    return trimmed.replace(/^usda\b\s*/i, "USDA ");
  }

  return trimmed;
}

function getUkraineWinterHardiness(value: string): { short: string; full: string } {
  const normalized = value.trim().toLowerCase();
  const winterReference = normalizeWinterHardinessReference(value);

  if (!normalized) {
    return {
      short: "Потребує уточнення",
      full: `Зимостійкість в умовах України залежить від регіону та умов ділянки (${winterReference}).`
    };
  }

  if (normalized.includes("annual") || normalized.includes("tender")) {
    return {
      short: `Вирощується як сезонна культура (${winterReference})`,
      full: `У відкритому ґрунті в Україні зазвичай вирощується як сезонна культура або потребує безморозної зимівлі (${winterReference}).`
    };
  }

  const zoneMatch = normalized.match(/(?:usda\s*)?(\d+)/);
  const minimumZone = zoneMatch ? Number(zoneMatch[1]) : Number.NaN;

  if (!Number.isFinite(minimumZone)) {
    return {
      short: "Потребує уточнення",
      full: `Зимостійкість в умовах України залежить від регіону та умов ділянки (${winterReference}).`
    };
  }

  if (minimumZone <= 4) {
    return {
      short: `Зимує в більшості регіонів України (${winterReference})`,
      full: `Зимостійка в більшості регіонів України за умови дренованого ґрунту (${winterReference}).`
    };
  }

  if (minimumZone <= 5) {
    return {
      short: `Добра зимостійкість для більшості регіонів України (${winterReference})`,
      full: `Загалом зимостійка в Україні; у холодніших регіонах і в перші зими бажане легке укриття (${winterReference}).`
    };
  }

  if (minimumZone <= 7) {
    return {
      short: `Потребує укриття в холодніших регіонах України (${winterReference})`,
      full: `У відкритому ґрунті в Україні зимостійкість обмежена; у холодніших регіонах потребує захищеного місця та зимового укриття (${winterReference}).`
    };
  }

  return {
    short: `Потребує захищеної зимівлі в Україні (${winterReference})`,
    full: `У більшості регіонів України у відкритому ґрунті не зимує або потребує дуже надійного укриття та захищеної зимівлі (${winterReference}).`
  };
}

function replaceTechnicalWinterHardiness(text: string, publicText: string): string {
  if (!text) {
    return text;
  }

  const winterPatterns = [
    /Зимостійкість:\s*[^.]+\.?/giu,
    /Зимостійкість в умовах Києва потребує уточнення\.?/giu,
    /(?:Зимостійка|Добре зимує) в умовах Києва[^.]*\.?/giu,
    /Не має надійної зимостійкості у відкритому ґрунті в умовах Києва[^.]*\.?/giu,
    /Не зимостійка у відкритому ґрунті в умовах Києва[^.]*\.?/giu,
    /У Києві вирощується як однорічна культура[^.]*\.?/giu
  ];

  let normalized = text;
  for (const pattern of winterPatterns) {
    normalized = normalized.replace(pattern, publicText);
  }

  return normalized.replace(/\s+/g, " ").replace(/\.\s*\./g, ".").trim();
}

function buildPublicOptionSentence(options: ProductOption[]): string {
  if (options.length === 0) {
    return "";
  }

  const summary = options.map((option) => formatOptionSummary(option)).join("; ");
  const suffix = summary.endsWith(".") ? "" : ".";
  return options.length > 1 ? `Доступні об'єми: ${summary}${suffix}` : `Об'єм: ${summary}${suffix}`;
}

function buildPublicSeoDescription(nameUk: string, latinName: string, summary: string, options: ProductOption[]): string {
  const parts: string[] = [];
  const title = [nameUk.trim(), latinName.trim() ? `(${latinName.trim()})` : ""].filter(Boolean).join(" ");

  if (title) {
    parts.push(title.endsWith(".") ? title : `${title}.`);
  }

  const normalizedSummary = summary.trim();
  if (normalizedSummary) {
    parts.push(normalizedSummary.endsWith(".") ? normalizedSummary : `${normalizedSummary}.`);
  }

  const optionSentence = buildPublicOptionSentence(options);
  if (optionSentence) {
    parts.push(optionSentence);
  }

  parts.push("Наявність уточнюємо при замовленні.");
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function sanitizeSeoDescription(
  text: string,
  nameUk: string,
  latinName: string,
  summary: string,
  options: ProductOption[],
  publicWinterHardiness: string
): string {
  const fallback = buildPublicSeoDescription(nameUk, latinName, summary, options);

  if (!text) {
    return fallback;
  }

  const optionSentence = buildPublicOptionSentence(options);
  const normalized = replaceTechnicalWinterHardiness(text, publicWinterHardiness)
    .replace(/(?:Типорозміри|Типорозмір|Варіанти|Варіант):\s*[^.]+\.?/giu, optionSentence)
    .replace(/\s+/g, " ")
    .trim();

  if (/(?:CASSETTE-HIKO|POT-P\d|Горщик P\d|(?:^|\s)V-?\d{3}\b|(?:^|\s)P\d{1,2}\b)/iu.test(normalized)) {
    return fallback;
  }

  return normalized;
}

function normalizeFormatCode(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");

  if (!normalized) {
    return "";
  }

  if (/^V-?\d{3}$/.test(normalized)) {
    return `V-${normalized.replace(/^V-?/, "")}`;
  }

  if (/^P-?\d{1,2}$/.test(normalized)) {
    return `P${normalized.replace(/^P-?/, "")}`;
  }

  return value.trim();
}

function formatCodeFromContainer(container: string): string {
  const normalized = container.trim();
  const hikoMatch = normalized.match(/V[-\s]?(\d{3})/i);
  if (hikoMatch) {
    return `V-${hikoMatch[1]}`;
  }

  const potMatch = normalized.match(/\bP[-\s]?(\d{1,2})\b/i);
  if (potMatch) {
    return `P${potMatch[1]}`;
  }

  return normalized;
}

function optionDisplayNameValue(formatCode: string, container: string): string {
  return normalizeFormatCode(formatCode) || formatCodeFromContainer(container);
}

function formatLitersLabel(volumeLiters: number): string {
  const normalized = volumeLiters.toFixed(3).replace(/\.?0+$/, "");
  return `${normalized.replace(".", ",")} л`;
}

function optionVolumeLitersValue(option: Pick<ProductOption, "container_type_id" | "format_code" | "container">): number | null {
  const containerTypeId = option.container_type_id.trim().toUpperCase();
  if (containerTypeId && containerTypeId in CONTAINER_TYPE_VOLUME_LITERS) {
    return CONTAINER_TYPE_VOLUME_LITERS[containerTypeId];
  }

  const formatCode = normalizeFormatCode(option.format_code).toUpperCase();
  if (formatCode && formatCode in FORMAT_VOLUME_LITERS) {
    return FORMAT_VOLUME_LITERS[formatCode];
  }

  const containerCode = formatCodeFromContainer(option.container).toUpperCase();
  if (containerCode && containerCode in FORMAT_VOLUME_LITERS) {
    return FORMAT_VOLUME_LITERS[containerCode];
  }

  const cassetteMatch = (formatCode || containerCode).match(/^V-(\d{3})$/);
  if (cassetteMatch) {
    return Number(cassetteMatch[1]) / 1000;
  }

  return null;
}

function compareProductOptions(left: ProductOption, right: ProductOption): number {
  const leftName = optionDisplayNameValue(left.format_code, left.container).toUpperCase();
  const rightName = optionDisplayNameValue(right.format_code, right.container).toUpperCase();
  const leftOrder = FORMAT_SORT_ORDER[leftName] ?? 999;
  const rightOrder = FORMAT_SORT_ORDER[rightName] ?? 999;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  if (left.price_uah !== right.price_uah) {
    return left.price_uah - right.price_uah;
  }

  return leftName.localeCompare(rightName, "uk");
}

function optionIdFrom(container: string, index: number): string {
  const slug = slugify(container);
  return slug || `option-${index + 1}`;
}

function productOptionsFrom(row: Record<string, string>): ProductOption[] {
  const variantIds = splitList(row.variant_ids || "");
  const containerTypeIds = splitList(row.variant_container_type_ids || "");
  const formatCodes = splitList(row.variant_format_codes || "");
  const containers = splitList(row.variant_containers || "");
  const prices = splitList(row.variant_prices_uah || "");
  const units = splitList(row.variant_units || "");
  const labels = splitList(row.variant_labels || "");

  if (containers.length === 0) {
    return [
      {
        variant_id: row.variant_id || "default",
        container_type_id: row.container_type_id || "",
        format_code: row.format_code || "",
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
      variant_id: variantIds[index] || optionIdFrom(container, index),
      container_type_id: containerTypeIds[index] || "",
      format_code: formatCodes[index] || "",
      container,
      price_uah: price,
      unit,
      label: labels[index] || `${container} - ${price} UAH/${unit}`
    };
  });
}

export function getOptionDisplayName(option: Pick<ProductOption, "container_type_id" | "format_code" | "container">): string {
  const volumeLiters = optionVolumeLitersValue(option);
  if (volumeLiters !== null) {
    return formatLitersLabel(volumeLiters);
  }

  return optionDisplayNameValue(option.format_code, option.container);
}

export function getProductFormatDisplayNames(product: Pick<Product, "options" | "container">): string[] {
  const sourceOptions =
    product.options.length > 0
      ? product.options
      : [{ container_type_id: "", format_code: "", container: product.container }];

  return [...new Set(sourceOptions.map((option) => getOptionDisplayName(option)).filter(Boolean))];
}

export function formatOptionPrice(option: Pick<ProductOption, "price_uah" | "unit">): string {
  return `${option.price_uah} грн/${option.unit}`;
}

export function formatOptionSummary(option: ProductOption): string {
  return `${getOptionDisplayName(option)} — ${formatOptionPrice(option)}`;
}

export function formatProductStartingPrice(product: Pick<Product, "options" | "has_multiple_options">): string {
  const primaryOption = product.options[0];

  if (!primaryOption) {
    return "";
  }

  const priceLabel = formatOptionPrice(primaryOption);
  return product.has_multiple_options ? `від ${priceLabel}` : priceLabel;
}

export function formatProductOptionSummary(product: Pick<Product, "options">, limit?: number): string {
  const visibleOptions = typeof limit === "number" && limit > 0 ? product.options.slice(0, limit) : product.options;
  const summary = visibleOptions.map((option) => formatOptionSummary(option)).join("; ");

  if (product.options.length > visibleOptions.length) {
    return `${summary}; ...`;
  }

  return summary;
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
      const options = productOptionsFrom(row)
        .sort(compareProductOptions)
        .map((option) => ({
          ...option,
          label: formatOptionSummary(option)
        }));
      const primaryOption = options[0];
      const ukraineWinterHardiness = getUkraineWinterHardiness(row.winter_hardiness);

      return {
        plant_id: row.plant_id,
        name_uk: row.name_uk,
        latin_name: row.latin_name,
        category: row.category,
        container: primaryOption ? getOptionDisplayName(primaryOption) : row.container,
        price_uah: primaryOption.price_uah,
        unit: primaryOption.unit,
        availability_status: row.availability_status,
        summary: replaceTechnicalWinterHardiness(row.summary, ukraineWinterHardiness.full),
        ecology_text: replaceTechnicalWinterHardiness(row.ecology_text, ukraineWinterHardiness.full),
        agrotechnics_text: replaceTechnicalWinterHardiness(row.agrotechnics_text, ukraineWinterHardiness.full),
        use_text: replaceTechnicalWinterHardiness(row.use_text, ukraineWinterHardiness.full),
        full_description: replaceTechnicalWinterHardiness(row.full_description, ukraineWinterHardiness.full),
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
        winter_hardiness: ukraineWinterHardiness.full,
        winter_hardiness_short: ukraineWinterHardiness.short,
        use_cases: row.use_cases,
        spacing_cm: row.spacing_cm,
        selection_tags: row.selection_tags,
        sun_labels: labelsFrom(row.sun_exposure, sunLabels),
        moisture_labels: labelsFrom(row.moisture, moistureLabels),
        flowering_labels: labelsFrom(row.flowering_months, monthLabels),
        use_case_labels: labelsFrom(row.use_cases, useCaseLabels),
        selection_tag_list: splitList(row.selection_tags),
        seo_title: row.seo_title,
        seo_description: sanitizeSeoDescription(
          row.seo_description,
          row.name_uk,
          row.latin_name,
          replaceTechnicalWinterHardiness(row.summary, ukraineWinterHardiness.full),
          options,
          ukraineWinterHardiness.full
        ),
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
