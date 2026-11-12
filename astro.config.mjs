import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { readSiteReceipts } from "./scripts/editorial-site-receipts.mjs";

const astroPrerenderEntry = fileURLToPath(new URL("./node_modules/astro/dist/entrypoints/prerender.js", import.meta.url));

export default defineConfig({
  output: "static",
  site: "https://flora-aroma-site.pages.dev",
  vite: {
    define: {
      __FLORA_SIGNED_SITE_ARTICLES__: JSON.stringify(Object.fromEntries(readSiteReceipts(process.cwd())))
    },
    resolve: {
      alias: {
        "astro/entrypoints/prerender": astroPrerenderEntry
      }
    }
  }
});
