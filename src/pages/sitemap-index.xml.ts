import { getCategories, getProducts } from "../lib/products";

const site = "https://flora-aroma.com.ua";

export function GET() {
  const urls = [
    "/",
    "/catalog/",
    ...getCategories().map((category) => `/categories/${category.slug}/`),
    ...getProducts().map((product) => `/plants/${product.slug}/`)
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${site}${url}</loc></url>`)
    .join("\n")}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}
