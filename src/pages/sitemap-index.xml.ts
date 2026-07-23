import { getCategories, getProducts, getSelections } from "../lib/products";
import { getApprovedPublications } from "../lib/publications";

const fallbackSite = "https://flora-aroma-site.pages.dev";

export async function GET({ site }: { site?: URL }) {
  const siteBase = site?.origin ?? fallbackSite;
  const publications = await getApprovedPublications();
  const urls = [
    "/",
    "/catalog/",
    "/cart/",
    "/price/",
    "/how-to-order/",
    "/contacts/",
    "/publications/",
    ...getCategories().map((category) => `/categories/${category.slug}/`),
    ...getSelections().map((selection) => `/selections/${selection.slug}/`),
    ...getProducts().map((product) => `/plants/${product.slug}/`),
    ...publications.map((publication) => `/publications/${publication.data.slug}/`)
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${siteBase}${url}</loc></url>`)
    .join("\n")}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}
