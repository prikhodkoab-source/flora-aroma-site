import { readFileSync, writeFileSync } from "node:fs";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some(Boolean)) rows.push(row);
  const [headers, ...body] = rows;
  return body.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, ""), values[index] ?? ""]))
  );
}

function split(value) {
  return String(value || "")
    .split(/[;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const rows = parseCsv(readFileSync("data/products.csv", "utf8"));
const catalog = {};

for (const row of rows) {
  const containers = split(row.variant_containers);
  const prices = split(row.variant_prices_uah);
  const units = split(row.variant_units);
  const variants = containers.length
    ? containers.map((container, index) => ({
        container,
        price: Number(prices[index] || row.price_uah),
        unit: units[index] || row.unit
      }))
    : [{ container: row.container, price: Number(row.price_uah), unit: row.unit }];

  catalog[row.plant_id] = {
    name: row.name_uk,
    variants
  };
}

writeFileSync(
  "functions/_product-catalog.js",
  `// Generated from data/products.csv. Do not edit manually.\nexport const productCatalog = ${JSON.stringify(catalog, null, 2)};\n`,
  "utf8"
);

console.log(`Generated site-order catalog for ${Object.keys(catalog).length} plants.`);
