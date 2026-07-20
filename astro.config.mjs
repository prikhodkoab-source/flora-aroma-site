import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

const astroPrerenderEntry = fileURLToPath(new URL("./node_modules/astro/dist/entrypoints/prerender.js", import.meta.url));

export default defineConfig({
  output: "static",
  site: "https://flora-aroma-site.pages.dev",
  vite: {
    resolve: {
      alias: {
        "astro/entrypoints/prerender": astroPrerenderEntry
      }
    }
  }
});
