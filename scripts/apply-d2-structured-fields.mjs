import { readFileSync, writeFileSync } from "node:fs";

const csvPath = "data/products.csv";

const fields = [
  "sun_exposure",
  "moisture",
  "height_cm_min",
  "height_cm_max",
  "flowering_months",
  "flower_color",
  "winter_hardiness",
  "use_cases",
  "spacing_cm",
  "selection_tags"
];

const attributes = {
  "PLANT-0084": ["full_sun;part_sun", "dry;medium", "60", "120", "07;08;09", "lavender;purple", "USDA 5-9", "aromatic;pollinator;border;dry_site", "30-45", "aromatic_garden;pollinator_plants;drought_tolerant;border_plants;low_maintenance"],
  "PLANT-0058": ["part_sun;full_sun", "medium", "20", "60", "05;06", "mixed", "USDA 3-8", "border;pollinator;cut_flower", "25-30", "border_plants;pollinator_plants"],
  "PLANT-0050": ["full_sun", "medium;moist", "20", "40", "07;08;09", "yellow;red", "tender perennial / annual", "edible;ornamental;medicinal", "25-30", "aromatic_garden;border_plants"],
  "PLANT-0088": ["full_sun;part_sun", "dry;medium", "10", "20", "04;05", "white", "USDA 4-7", "rock_garden;groundcover;border", "25-30", "drought_tolerant;border_plants;low_maintenance"],
  "PLANT-0089": ["full_sun", "medium;moist", "30", "60", "07;08;09", "white", "tender annual", "culinary;aromatic;container", "25-30", "aromatic_garden"],
  "PLANT-0002": ["full_sun", "dry", "15", "30", "07;08;09", "yellow", "USDA 4-8", "medicinal;dry_site;rock_garden", "20-30", "drought_tolerant;low_maintenance"],
  "PLANT-0052": ["full_sun", "dry;medium", "90", "180", "07;08;09;10", "purple", "USDA 7-11 / often annual", "pollinator;border;cut_flower", "30-45", "pollinator_plants;border_plants"],
  "PLANT-0064": ["full_sun", "dry;medium", "30", "60", "06;07;08", "blue;mixed", "annual", "meadow;cut_flower;pollinator", "20-30", "pollinator_plants;border_plants"],
  "PLANT-0048": ["full_sun", "dry;medium", "20", "30", "05;06", "green;tan", "USDA 4-8", "ornamental_grass;border;groundcover;rock_garden", "25-30", "drought_tolerant;border_plants;low_maintenance"],
  "PLANT-0004": ["full_sun;part_sun", "medium", "30", "60", "05;06;07", "mixed", "USDA 3-9", "border;cut_flower;pollinator", "20-30", "border_plants;pollinator_plants"],
  "PLANT-0063": ["full_sun", "medium", "1500", "2500", "04;05", "green;inconspicuous", "USDA 4-8", "tree;shade;landscape", "600-1000", "low_maintenance"],
  "PLANT-0045": ["full_sun", "dry;medium", "50", "100", "06;07", "red", "USDA 4-8", "pollinator;dry_site;naturalistic", "30-45", "drought_tolerant;pollinator_plants;border_plants"],
  "PLANT-0086": ["full_sun;part_sun", "dry;medium", "30", "90", "06;07;08", "yellow", "USDA 3-8", "medicinal;naturalistic;pollinator", "30-45", "drought_tolerant;pollinator_plants;low_maintenance"],
  "PLANT-0051": ["full_sun", "dry;medium", "30", "45", "07;08;09", "white;lilac", "USDA 5-9", "aromatic;pollinator;border", "30-40", "aromatic_garden;pollinator_plants;drought_tolerant;border_plants;low_maintenance"],
  "PLANT-0042": ["full_sun", "medium", "90", "120", "06;07;08;09", "orange;yellow;red", "USDA 5-9", "accent;border;pollinator", "45-60", "border_plants;pollinator_plants"],
  "PLANT-0085": ["full_sun;part_sun", "dry;medium", "15", "25", "05;06", "green;tan", "USDA 4-8", "ornamental_grass;groundcover;rock_garden", "25-30", "drought_tolerant;border_plants;low_maintenance"],
  "PLANT-0014": ["full_sun", "dry;medium", "60", "90", "06;07;08;09", "white;lilac", "USDA 3-9", "aromatic;pollinator;medicinal", "30-45", "aromatic_garden;pollinator_plants;drought_tolerant;low_maintenance"],
  "PLANT-0055": ["full_sun", "dry", "60", "90", "07;08;09", "violet;blue", "USDA 7-10", "aromatic;pollinator;dry_site", "45-60", "aromatic_garden;pollinator_plants;drought_tolerant"],
  "PLANT-0027": ["full_sun;part_sun", "medium", "30", "90", "06;07;08;09", "mixed", "tender perennial / often annual", "border;cut_flower;container", "20-30", "border_plants"],
  "PLANT-0011": ["full_sun;part_sun", "medium", "60", "120", "05;06;07", "mixed", "USDA 4-8", "border;pollinator;naturalistic", "40-50", "border_plants;pollinator_plants"],
  "PLANT-0037": ["full_sun;part_sun", "medium", "60", "90", "07;08;09", "pale_pink;white", "USDA 4-8", "aromatic;pollinator;rain_garden", "45-60", "aromatic_garden;pollinator_plants;low_maintenance"],
  "PLANT-0044": ["full_sun", "dry;medium", "30", "60", "07;08;09", "white;pink", "tender perennial / annual", "culinary;aromatic;container", "25-30", "aromatic_garden"],
  "PLANT-0081": ["full_sun;part_sun", "medium;moist", "30", "90", "07;08", "lilac", "USDA 5-9", "culinary;aromatic;moist_site", "45-60", "aromatic_garden"],
  "PLANT-0016": ["full_sun", "medium", "60", "90", "06;07;08", "white", "USDA 5-9", "border;cut_flower;pollinator", "30-45", "border_plants;pollinator_plants"],
  "PLANT-0012": ["full_sun", "dry;medium", "30", "50", "06;07;08", "mixed", "annual", "border;cut_flower;dried_flower", "20-25", "border_plants;low_maintenance"],
  "PLANT-0077": ["full_sun", "dry;medium", "30", "60", "07;08;09;10", "pink;purple;white", "USDA 4-9", "culinary;aromatic;pollinator;groundcover", "30-45", "aromatic_garden;pollinator_plants;drought_tolerant;low_maintenance"],
  "PLANT-0003": ["full_sun", "dry;medium", "60", "100", "08;09;10", "tan;cream", "USDA 5-9", "ornamental_grass;border;mass_planting", "60-90", "drought_tolerant;border_plants;low_maintenance"],
  "PLANT-0024": ["full_sun;part_sun", "dry;medium", "60", "120", "07;08;09", "yellow", "USDA 3-8", "medicinal;naturalistic;pollinator", "45-60", "drought_tolerant;pollinator_plants;low_maintenance"],
  "PLANT-0079": ["full_sun;part_sun", "dry;medium", "50", "100", "06;07;08", "white", "USDA 4-8", "naturalistic;pollinator;border", "40-50", "pollinator_plants;border_plants;low_maintenance"],
  "PLANT-0039": ["full_sun;part_sun", "dry;medium", "10", "15", "05;06", "white", "USDA 4-8", "groundcover;rock_garden;border", "25-30", "drought_tolerant;border_plants;low_maintenance"],
  "PLANT-0066": ["full_sun", "dry", "60", "120", "04;05;06", "blue;white", "USDA 8-10", "culinary;aromatic;container;dry_site", "45-60", "aromatic_garden;drought_tolerant"],
  "PLANT-0074": ["full_sun", "dry;medium", "45", "75", "06;07", "yellow", "USDA 4-8", "aromatic;medicinal;border", "45-60", "aromatic_garden;drought_tolerant;low_maintenance"],
  "PLANT-0049": ["part_sun;full_sun", "medium;moist", "45", "75", "05;06;07", "blue", "USDA 3-8", "border;shade_border;pollinator", "30-45", "border_plants;pollinator_plants"],
  "PLANT-0032": ["full_sun", "dry;medium", "1500", "3000", "05;06", "inconspicuous", "USDA 2-7", "tree;windbreak;landscape", "1500-2500", "drought_tolerant;low_maintenance"],
  "PLANT-0033": ["full_sun", "dry;medium", "20", "45", "07;08;09", "white;pink", "annual", "culinary;aromatic;border", "20-25", "aromatic_garden;drought_tolerant"],
  "PLANT-0087": ["full_sun", "dry", "5", "15", "06;07;08", "pink;purple", "USDA 4-8", "groundcover;aromatic;pollinator;dry_site", "20-30", "aromatic_garden;pollinator_plants;drought_tolerant;low_maintenance"],
  "PLANT-0061": ["full_sun", "dry;medium", "50", "80", "05;06;07", "white;pale_yellow", "USDA 5-8", "pollinator;border;dry_site", "35-45", "drought_tolerant;pollinator_plants;border_plants"],
  "PLANT-0041": ["full_sun", "dry;medium", "30", "60", "06;07;08;09", "violet;blue", "USDA 4-8", "pollinator;border;aromatic", "30-45", "aromatic_garden;pollinator_plants;drought_tolerant;border_plants;low_maintenance"],
  "PLANT-0082": ["full_sun", "dry;medium", "45", "75", "06;07", "blue;violet", "USDA 4-8", "culinary;medicinal;aromatic;pollinator", "45-60", "aromatic_garden;pollinator_plants;drought_tolerant;low_maintenance"],
  "PLANT-0078": ["full_sun", "dry;medium", "60", "120", "06;07;08", "pink;lilac;white", "USDA 5-9", "aromatic;pollinator;border", "45-60", "aromatic_garden;pollinator_plants;border_plants"]
};

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

function serializeCsvValue(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

const lines = readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
const currentHeaders = parseCsvLine(lines[0]).map((header) => header.replace(/^\uFEFF/, ""));
const rows = lines.slice(1).filter(Boolean).map((line) => {
  const values = parseCsvLine(line);
  return Object.fromEntries(currentHeaders.map((header, index) => [header, values[index] ?? ""]));
});

const missing = rows.filter((row) => !attributes[row.plant_id]);
if (missing.length > 0) {
  throw new Error(`Missing D2 attributes for: ${missing.map((row) => row.plant_id).join(", ")}`);
}

const targetHeaders = [
  ...currentHeaders.filter((header) => !fields.includes(header)),
  ...fields
];

for (const row of rows) {
  const values = attributes[row.plant_id];
  fields.forEach((field, index) => {
    row[field] = values[index];
  });
}

writeFileSync(
  csvPath,
  `${targetHeaders.map(serializeCsvValue).join(",")}\n${rows
    .map((row) => targetHeaders.map((header) => serializeCsvValue(row[header])).join(","))
    .join("\n")}\n`,
  "utf8"
);
