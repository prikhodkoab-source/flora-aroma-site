import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ImageSource = {
  plant_id: string;
  image_path: string;
  source: string;
  source_page: string;
  title: string;
  author: string;
  license: string;
  license_url: string;
  reviewed_status: string;
};

const projectRoot = process.cwd();
const imageSourcesCsvPath = join(projectRoot, "data", "plant-image-sources.csv");

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

export function getImageSources(): ImageSource[] {
  if (!existsSync(imageSourcesCsvPath)) {
    return [];
  }

  const csv = readFileSync(imageSourcesCsvPath, "utf8").trim();
  if (!csv) {
    return [];
  }

  const [headerLine, ...lines] = csv.split(/\r?\n/);
  const headers = parseCsvLine(headerLine).map((header) => header.replace(/^\uFEFF/, "").trim());

  return lines
    .filter(Boolean)
    .map((line) => {
      const values = parseCsvLine(line);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
      return {
        plant_id: row.plant_id,
        image_path: row.image_path,
        source: row.source,
        source_page: row.source_page,
        title: row.title,
        author: row.author,
        license: row.license,
        license_url: row.license_url,
        reviewed_status: row.reviewed_status
      };
    })
    .sort((a, b) => a.plant_id.localeCompare(b.plant_id));
}
