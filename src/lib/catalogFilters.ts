import { getOptionDisplayName, slugify, type Product } from "./products";

export type CatalogSortValue = "default" | "name" | "price-asc" | "price-desc";

export type CatalogFilterGroupId =
  | "sun"
  | "moisture"
  | "purpose"
  | "height"
  | "flowering"
  | "category"
  | "format"
  | "price";

export type CatalogFilterState = {
  search: string;
  sort: CatalogSortValue;
  sun: string[];
  moisture: string[];
  purpose: string[];
  height: string[];
  flowering: string[];
  category: string[];
  format: string[];
  price: string[];
};

export type CatalogFilterOption = {
  value: string;
  label: string;
  count: number;
};

export type CatalogFilterSection = {
  id: CatalogFilterGroupId;
  queryKey: CatalogFilterGroupId;
  label: string;
  options: CatalogFilterOption[];
};

export type CatalogQuickPick = {
  id: string;
  label: string;
  count: number;
  filters: Partial<Omit<CatalogFilterState, "search" | "sort">>;
};

export type CatalogActiveChip = {
  group: CatalogFilterGroupId | "search";
  value: string;
  label: string;
};

export type CatalogProductIndex = {
  plantId: string;
  slug: string;
  nameUk: string;
  latinName: string;
  categoryLabel: string;
  categoryValue: string;
  summary: string;
  searchText: string;
  sun: string[];
  sunLabel: string;
  moisture: string[];
  moistureLabel: string;
  purpose: string[];
  purposeLabels: string[];
  heightMin: number | null;
  heightMax: number | null;
  heightLabel: string;
  flowering: string[];
  floweringLabel: string;
  formats: string[];
  formatLabels: string[];
  price: number;
  sortIndex: number;
};

const purposeDefinitions = [
  { value: "pollinator", label: "Для запилювачів" },
  { value: "aromatic", label: "Ароматичні" },
  { value: "culinary", label: "Пряні" },
  { value: "naturalistic", label: "Природний сад" },
  { value: "long-blooming", label: "Довгоквітучі" },
  { value: "medicinal", label: "Лікарські" },
  { value: "border", label: "Бордюрні" }
] as const;

const sunDefinitions = [
  { value: "full-sun", label: "Сонце" },
  { value: "part-sun", label: "Півтінь" },
  { value: "shade", label: "Тінь" }
] as const;

const moistureDefinitions = [
  { value: "dry", label: "Сухо" },
  { value: "medium", label: "Помірно" },
  { value: "moist", label: "Волого" }
] as const;

const monthDefinitions = [
  { value: "04", label: "квітень" },
  { value: "05", label: "травень" },
  { value: "06", label: "червень" },
  { value: "07", label: "липень" },
  { value: "08", label: "серпень" },
  { value: "09", label: "вересень" },
  { value: "10", label: "жовтень" }
] as const;

const heightDefinitions = [
  { value: "0-30", label: "до 30 см" },
  { value: "30-60", label: "30–60 см" },
  { value: "60-100", label: "60–100 см" },
  { value: "100-plus", label: "понад 100 см" }
] as const;

const priceDefinitions = [
  { value: "0-50", label: "до 50 грн" },
  { value: "50-100", label: "50–100 грн" },
  { value: "100-plus", label: "100+ грн" }
] as const;

const sortOptions = [
  { value: "default", label: "За замовчуванням" },
  { value: "name", label: "За назвою" },
  { value: "price-asc", label: "Спочатку дешевші" },
  { value: "price-desc", label: "Спочатку дорожчі" }
] as const;

const romanMonths: Record<string, string> = {
  "04": "IV",
  "05": "V",
  "06": "VI",
  "07": "VII",
  "08": "VIII",
  "09": "IX",
  "10": "X"
};

const formatOrder: Record<string, number> = {
  "V-120": 10,
  "V-265": 20,
  P9: 30,
  P11: 40,
  P13: 50,
  P15: 60,
  P18: 70,
  P19: 80
};

const categoryOrder = [
  "Декоративні багаторічники",
  "Ароматичні рослини",
  "Пряні рослини",
  "Лікарські рослини",
  "Рослини для саду",
  "Дерева",
  "Хвойні рослини"
];

function splitList(value: string): string[] {
  return value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSunValue(value: string): string {
  if (value === "full_sun") return "full-sun";
  if (value === "part_sun") return "part-sun";
  return value.replace(/_/g, "-");
}

function formatSunLabel(values: string[]): string {
  const labels = values
    .map((value) => sunDefinitions.find((option) => option.value === value)?.label)
    .filter(Boolean);
  return labels.join(" / ");
}

function formatMoistureLabel(values: string[]): string {
  const labels = values
    .map((value) => moistureDefinitions.find((option) => option.value === value)?.label)
    .filter(Boolean);
  return labels.join(" / ");
}

function normalizeFormatCode(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!normalized) return "";

  if (/^V-?\d{3}$/.test(normalized)) {
    return `V-${normalized.replace(/^V-?/, "")}`;
  }

  if (/^P-?\d{1,2}$/.test(normalized)) {
    return `P${normalized.replace(/^P-?/, "")}`;
  }

  return value.trim();
}

function formatCodeFromContainer(container: string): string {
  const hikoMatch = container.match(/V[-\s]?(\d{3})/i);
  if (hikoMatch) return `V-${hikoMatch[1]}`;

  const potMatch = container.match(/\bP[-\s]?(\d{1,2})\b/i);
  if (potMatch) return `P${potMatch[1]}`;

  return container.trim();
}

function getFormatLabel(formatCode: string): string {
  return getOptionDisplayName({ container_type_id: "", format_code: formatCode, container: formatCode });
}

function getFormatCodes(product: Product): string[] {
  const codes = product.options
    .map((option) => normalizeFormatCode(option.format_code) || normalizeFormatCode(formatCodeFromContainer(option.container)))
    .filter(Boolean);
  return [...new Set(codes)].sort((left, right) => {
    const leftOrder = formatOrder[left] ?? 999;
    const rightOrder = formatOrder[right] ?? 999;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.localeCompare(right, "uk");
  });
}

function getMonthValues(product: Product): string[] {
  return splitList(product.flowering_months).filter((value) => monthDefinitions.some((item) => item.value === value));
}

function getPurposeValues(product: Product): string[] {
  const useCases = new Set(splitList(product.use_cases));
  const purposeValues: string[] = [];
  const monthValues = getMonthValues(product);
  const normalizedCategory = normalizeText(product.category);

  if (useCases.has("pollinator")) purposeValues.push("pollinator");
  if (useCases.has("aromatic") || normalizedCategory.includes("ароматич")) purposeValues.push("aromatic");
  if (useCases.has("culinary") || normalizedCategory.includes("пряні")) purposeValues.push("culinary");
  if (useCases.has("naturalistic") || useCases.has("meadow")) purposeValues.push("naturalistic");
  if (monthValues.length >= 3) purposeValues.push("long-blooming");
  if (useCases.has("medicinal") || normalizedCategory.includes("лікар")) purposeValues.push("medicinal");
  if (useCases.has("border") || useCases.has("shade_border")) purposeValues.push("border");

  return [...new Set(purposeValues)];
}

function formatPurposeLabels(values: string[]): string[] {
  return values
    .map((value) => purposeDefinitions.find((item) => item.value === value)?.label)
    .filter(Boolean) as string[];
}

function formatHeightLabel(product: Product): string {
  const min = Number(product.height_cm_min);
  const max = Number(product.height_cm_max);

  if (!Number.isFinite(min) && !Number.isFinite(max)) return "";
  if (!Number.isFinite(min)) return `до ${max} см`;
  if (!Number.isFinite(max)) return `понад ${min} см`;
  if (min === max) return `${max} см`;
  return `${min}–${max} см`;
}

function formatFloweringLabel(product: Product): string {
  const months = getMonthValues(product).map((value) => romanMonths[value]).filter(Boolean);
  if (months.length === 0) return "";
  if (months.length === 1) return months[0];
  return `${months[0]}–${months[months.length - 1]}`;
}

function matchesHeightBand(index: CatalogProductIndex, value: string): boolean {
  if (index.heightMin === null || index.heightMax === null) return false;

  if (value === "0-30") return index.heightMax <= 30;
  if (value === "30-60") return index.heightMin <= 60 && index.heightMax >= 30;
  if (value === "60-100") return index.heightMin <= 100 && index.heightMax >= 60;
  if (value === "100-plus") return index.heightMax > 100;
  return false;
}

function matchesPriceBand(index: CatalogProductIndex, value: string): boolean {
  if (!Number.isFinite(index.price)) return false;
  if (value === "0-50") return index.price <= 50;
  if (value === "50-100") return index.price > 50 && index.price <= 100;
  if (value === "100-plus") return index.price > 100;
  return false;
}

function buildOptionCounts<T extends readonly { value: string; label: string }[]>(
  indexes: CatalogProductIndex[],
  definitions: T,
  match: (index: CatalogProductIndex, value: string) => boolean
): CatalogFilterOption[] {
  return definitions
    .map((definition) => ({
      value: definition.value,
      label: definition.label,
      count: indexes.filter((index) => match(index, definition.value)).length
    }))
    .filter((option) => option.count > 0);
}

export function createEmptyCatalogState(): CatalogFilterState {
  return {
    search: "",
    sort: "default",
    sun: [],
    moisture: [],
    purpose: [],
    height: [],
    flowering: [],
    category: [],
    format: [],
    price: []
  };
}

export function getCatalogSortOptions() {
  return [...sortOptions];
}

export function buildProductFilterIndex(product: Product, sortIndex = 0): CatalogProductIndex {
  const sun = splitList(product.sun_exposure).map(normalizeSunValue);
  const moisture = splitList(product.moisture);
  const purpose = getPurposeValues(product);
  const formats = getFormatCodes(product);
  const flowering = getMonthValues(product);
  const categoryValue = slugify(product.category);
  const purposeLabels = formatPurposeLabels(purpose);

  return {
    plantId: product.plant_id,
    slug: product.slug,
    nameUk: product.name_uk,
    latinName: product.latin_name,
    categoryLabel: product.category,
    categoryValue,
    summary: product.summary,
    searchText: normalizeText(
      [
        product.name_uk,
        product.latin_name,
        product.category,
        product.summary,
        purposeLabels.join(" "),
        formatPurposeLabels(getPurposeValues(product)).join(" ")
      ]
        .filter(Boolean)
        .join(" ")
    ),
    sun,
    sunLabel: formatSunLabel(sun),
    moisture,
    moistureLabel: formatMoistureLabel(moisture),
    purpose,
    purposeLabels,
    heightMin: Number.isFinite(product.height_cm_min) ? product.height_cm_min : null,
    heightMax: Number.isFinite(product.height_cm_max) ? product.height_cm_max : null,
    heightLabel: formatHeightLabel(product),
    flowering,
    floweringLabel: formatFloweringLabel(product),
    formats,
    formatLabels: formats.map(getFormatLabel),
    price: product.price_uah,
    sortIndex
  };
}

export function buildCatalogFilterSections(products: Product[]): CatalogFilterSection[] {
  const indexes = products.map((product, index) => buildProductFilterIndex(product, index));

  const dynamicCategories = Array.from(
    indexes.reduce((map, item) => {
      const current = map.get(item.categoryValue) ?? { value: item.categoryValue, label: item.categoryLabel, count: 0 };
      current.count += 1;
      map.set(item.categoryValue, current);
      return map;
    }, new Map<string, CatalogFilterOption>())
      .values()
  ).sort((left, right) => {
    const leftOrder = categoryOrder.indexOf(left.label);
    const rightOrder = categoryOrder.indexOf(right.label);
    if (leftOrder !== rightOrder) {
      return (leftOrder === -1 ? 999 : leftOrder) - (rightOrder === -1 ? 999 : rightOrder);
    }
    return left.label.localeCompare(right.label, "uk");
  });

  const dynamicFormats = Array.from(
    indexes.reduce((map, item) => {
      for (const format of item.formats) {
        const current = map.get(format) ?? { value: format, label: getFormatLabel(format), count: 0 };
        current.count += 1;
        map.set(format, current);
      }
      return map;
    }, new Map<string, CatalogFilterOption>())
      .values()
  ).sort((left, right) => {
    const leftOrder = formatOrder[left.value] ?? 999;
    const rightOrder = formatOrder[right.value] ?? 999;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.label.localeCompare(right.label, "uk");
  });

  return [
    {
      id: "sun",
      queryKey: "sun",
      label: "Освітлення",
      options: buildOptionCounts(indexes, sunDefinitions, (index, value) => index.sun.includes(value))
    },
    {
      id: "moisture",
      queryKey: "moisture",
      label: "Вологість",
      options: buildOptionCounts(indexes, moistureDefinitions, (index, value) => index.moisture.includes(value))
    },
    {
      id: "purpose",
      queryKey: "purpose",
      label: "Призначення",
      options: buildOptionCounts(indexes, purposeDefinitions, (index, value) => index.purpose.includes(value))
    },
    {
      id: "height",
      queryKey: "height",
      label: "Висота",
      options: buildOptionCounts(indexes, heightDefinitions, matchesHeightBand)
    },
    {
      id: "flowering",
      queryKey: "flowering",
      label: "Цвітіння",
      options: buildOptionCounts(indexes, monthDefinitions, (index, value) => index.flowering.includes(value))
    },
    {
      id: "category",
      queryKey: "category",
      label: "Категорія",
      options: dynamicCategories
    },
    {
      id: "format",
      queryKey: "format",
      label: "Формат",
      options: dynamicFormats
    },
    {
      id: "price",
      queryKey: "price",
      label: "Ціна",
      options: buildOptionCounts(indexes, priceDefinitions, matchesPriceBand)
    }
  ].filter((section) => section.options.length > 0);
}

export function buildCatalogQuickPicks(products: Product[]): CatalogQuickPick[] {
  const indexes = products.map((product, index) => buildProductFilterIndex(product, index));
  const emptyState = createEmptyCatalogState();
  const categories = buildCatalogFilterSections(products)
    .find((section) => section.id === "category")
    ?.options.reduce((map, option) => map.set(option.label, option.value), new Map<string, string>());

  const spicyCategory = categories?.get("Пряні рослини");
  const medicinalCategory = categories?.get("Лікарські рослини");
  const grassCategory = Array.from(categories?.entries() ?? []).find(([label]) => /злак/i.test(label))?.[1];

  const definitions: Omit<CatalogQuickPick, "count">[] = [
    { id: "sunny", label: "Для сонця", filters: { sun: ["full-sun"] } },
    { id: "part-shade", label: "Для півтіні", filters: { sun: ["part-sun"] } },
    { id: "dry-sites", label: "Для сухих місць", filters: { moisture: ["dry"] } },
    { id: "pollinators", label: "Для запилювачів", filters: { purpose: ["pollinator"] } },
    { id: "aromatic-garden", label: "Ароматичний сад", filters: { purpose: ["aromatic"] } },
    ...(grassCategory ? [{ id: "ornamental-grasses", label: "Декоративні злаки", filters: { category: [grassCategory] } }] : []),
    { id: "long-blooming", label: "Довгоквітучі", filters: { purpose: ["long-blooming"] } },
    ...(spicyCategory ? [{ id: "culinary-herbs", label: "Пряні трави", filters: { category: [spicyCategory] } }] : []),
    ...(medicinalCategory ? [{ id: "medicinal-plants", label: "Лікарські рослини", filters: { category: [medicinalCategory] } }] : [])
  ];

  return definitions
    .map((definition) => ({
      ...definition,
      count: indexes.filter((index) => matchesCatalogFilters(index, { ...emptyState, ...definition.filters })).length
    }))
    .filter((definition) => definition.count > 0);
}

export function parseCatalogStateFromSearch(
  searchParams: URLSearchParams,
  sections: CatalogFilterSection[]
): CatalogFilterState {
  const sectionMap = new Map(sections.map((section) => [section.queryKey, new Set(section.options.map((option) => option.value))]));
  const nextState = createEmptyCatalogState();

  nextState.search = searchParams.get("q")?.trim() ?? "";
  const sort = searchParams.get("sort") as CatalogSortValue | null;
  nextState.sort = sortOptions.some((option) => option.value === sort) ? (sort as CatalogSortValue) : "default";

  for (const key of ["sun", "moisture", "purpose", "height", "flowering", "category", "format", "price"] as const) {
    const raw = searchParams.getAll(key).flatMap((value) => value.split(","));
    const allowed = sectionMap.get(key);
    nextState[key] = raw
      .map((value) => value.trim())
      .filter((value) => value && allowed?.has(value));
  }

  return nextState;
}

export function serializeCatalogStateToSearch(state: CatalogFilterState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.search.trim()) {
    params.set("q", state.search.trim());
  }

  if (state.sort !== "default") {
    params.set("sort", state.sort);
  }

  for (const key of ["sun", "moisture", "purpose", "height", "flowering", "category", "format", "price"] as const) {
    if (state[key].length > 0) {
      params.set(key, state[key].join(","));
    }
  }

  return params;
}

export function matchesCatalogFilters(index: CatalogProductIndex, state: CatalogFilterState): boolean {
  const normalizedSearch = normalizeText(state.search);

  if (normalizedSearch && !index.searchText.includes(normalizedSearch)) {
    return false;
  }

  if (state.sun.length > 0 && !state.sun.some((value) => index.sun.includes(value))) return false;
  if (state.moisture.length > 0 && !state.moisture.some((value) => index.moisture.includes(value))) return false;
  if (state.purpose.length > 0 && !state.purpose.some((value) => index.purpose.includes(value))) return false;
  if (state.height.length > 0 && !state.height.some((value) => matchesHeightBand(index, value))) return false;
  if (state.flowering.length > 0 && !state.flowering.some((value) => index.flowering.includes(value))) return false;
  if (state.category.length > 0 && !state.category.includes(index.categoryValue)) return false;
  if (state.format.length > 0 && !state.format.some((value) => index.formats.includes(value))) return false;
  if (state.price.length > 0 && !state.price.some((value) => matchesPriceBand(index, value))) return false;

  return true;
}

export function sortCatalogProducts(products: CatalogProductIndex[], sort: CatalogSortValue): CatalogProductIndex[] {
  const sorted = [...products];

  if (sort === "price-asc") {
    return sorted.sort((left, right) => left.price - right.price || left.nameUk.localeCompare(right.nameUk, "uk"));
  }

  if (sort === "price-desc") {
    return sorted.sort((left, right) => right.price - left.price || left.nameUk.localeCompare(right.nameUk, "uk"));
  }

  if (sort === "name") {
    return sorted.sort((left, right) => left.nameUk.localeCompare(right.nameUk, "uk"));
  }

  return sorted.sort((left, right) => left.sortIndex - right.sortIndex);
}

export function getActiveCatalogChips(state: CatalogFilterState, sections: CatalogFilterSection[]): CatalogActiveChip[] {
  const chips: CatalogActiveChip[] = [];
  const labelMap = new Map<string, string>();

  for (const section of sections) {
    for (const option of section.options) {
      labelMap.set(`${section.queryKey}:${option.value}`, option.label);
    }
  }

  for (const key of ["sun", "moisture", "purpose", "height", "flowering", "category", "format", "price"] as const) {
    for (const value of state[key]) {
      const label = labelMap.get(`${key}:${value}`);
      if (!label) continue;
      chips.push({ group: key, value, label });
    }
  }

  return chips;
}

export function getCatalogActiveFilterCount(state: CatalogFilterState): number {
  let count = 0;

  for (const key of ["sun", "moisture", "purpose", "height", "flowering", "category", "format", "price"] as const) {
    count += state[key].length;
  }

  return count;
}
