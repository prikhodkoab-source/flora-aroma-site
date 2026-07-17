import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

const siteRoot = process.cwd();
const projectRoot = resolve(siteRoot, "..");
const scriptPath = join(projectRoot, "scripts", "reprice_catalog_fixed_grid.py");
const python = process.env.PYTHON || "python";

execFileSync(python, [scriptPath], { stdio: "inherit" });
