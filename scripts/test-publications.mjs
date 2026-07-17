import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { selectPublicPublications, validatePublicationEntries } from "../src/lib/publication-policy.mjs";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function fixture(overrides = {}) {
  return {
    id: overrides.id ?? "fixture.md",
    body: overrides.body ?? "Valid public body.",
    data: {
      publicationId: "PUB-TEST-0001",
      slug: "valid-publication",
      title: "Valid publication",
      excerpt: "Valid excerpt",
      category: "Практичні поради",
      coverImage: "/images/publications/valid.jpg",
      coverImageAlt: "Approved cover",
      relatedPlantIds: [],
      seoTitle: "Valid publication — Flora & Aroma",
      seoDescription: "Valid SEO description",
      publishedAt: new Date("2026-07-17T00:00:00Z"),
      updatedAt: new Date("2026-07-17T00:00:00Z"),
      publicationStatus: "approved",
      mediaRightsStatus: "approved",
      ...overrides.data
    }
  };
}

const publicPlants = new Set(["PLANT-0002"]);
const approved = fixture();
assert.deepEqual(selectPublicPublications([approved], publicPlants), [approved]);

for (const publicationStatus of ["draft", "pending_operator_review", "suspended", "archived"]) {
  const entry = fixture({ data: { publicationStatus } });
  assert.equal(selectPublicPublications([entry], publicPlants).length, 0);
}

for (const mediaRightsStatus of ["pending_operator_review", "restricted", "rejected", "expired"]) {
  const entry = fixture({ data: { mediaRightsStatus } });
  assert.equal(selectPublicPublications([entry], publicPlants).length, 0);
}

assert.throws(
  () => validatePublicationEntries([fixture(), fixture({ id: "duplicate.md", data: { publicationId: "PUB-TEST-0002" } })], publicPlants),
  /duplicate slug/
);
assert.throws(
  () => validatePublicationEntries([fixture({ data: { publicationId: "" } })], publicPlants),
  /missing publicationId/
);
assert.throws(
  () => validatePublicationEntries([fixture({ data: { relatedPlantIds: ["PLANT-9999"] } })], publicPlants),
  /unknown public relatedPlantId PLANT-9999/
);
assert.throws(
  () => validatePublicationEntries([fixture({ data: { seoTitle: "" } })], publicPlants),
  /requires seoTitle/
);

const related = fixture({ data: { relatedPlantIds: ["PLANT-0002"] } });
assert.deepEqual(selectPublicPublications([related], publicPlants), [related]);

const indexSource = read("src/pages/index.astro");
const buttonBlock = indexSource.match(/<div class="tilda-hero-buttons">([\s\S]*?)<\/div>/)?.[1] ?? "";
const heroLinks = [...buttonBlock.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map((match) => ({ href: match[1], text: match[2] }));
assert.deepEqual(heroLinks, [
  { href: "/shop/", text: "Перейти до асортименту" },
  { href: "/publications/", text: "Поради та ідеї" },
  {
    href: "https://t.me/+380500272882?text=Доброго%20дня,%20цікавлять%20рослини",
    text: "Отримати консультацію"
  }
]);

const publicationsIndex = read("src/pages/publications/index.astro");
assert.match(publicationsIndex, /Матеріали готуються/);
assert.match(publicationsIndex, /Ми готуємо практичні матеріали про вирощування рослин, природні сади та використання ароматичних культур\./);
assert.match(publicationsIndex, /href="\/shop\/"/);
assert.match(publicationsIndex, /getApprovedPublications/);

const detailSource = read("src/pages/publications/[slug].astro");
assert.match(detailSource, /getApprovedPublications/);
assert.match(detailSource, /relatedPlantIds/);
assert.match(detailSource, /Рослини з цієї публікації/);

const notFoundSource = read("src/pages/404.astro");
assert.match(notFoundSource, /Сторінку не знайдено/);
assert.match(notFoundSource, /href="\/publications\/"/);

const sitemapSource = read("src/pages/sitemap-index.xml.ts");
assert.match(sitemapSource, /"\/publications\/"/);
assert.match(sitemapSource, /getApprovedPublications/);
assert.doesNotMatch(sitemapSource, /\/admin\//);
assert.doesNotMatch(sitemapSource, /\/api\//);

const styles = read("src/styles/global.css");
assert.match(styles, /\.tilda-hero-buttons\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.tilda-hero-buttons\s*\{[\s\S]*?flex-direction:\s*column;/);
assert.match(styles, /\.publications-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/);
assert.match(styles, /@media \(max-width: 960px\)[\s\S]*?\.publications-grid\s*\{[\s\S]*?repeat\(2,/);
assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.publications-grid\s*\{[\s\S]*?minmax\(0, 1fr\)/);

const baseLayout = read("src/layouts/BaseLayout.astro");
assert.equal((baseLayout.match(/initializeAnalytics\(\)/g) ?? []).length, 1);
assert.doesNotMatch(publicationsIndex, /initializeAnalytics|page_view/);
assert.doesNotMatch(detailSource, /initializeAnalytics|page_view/);

const contentFiles = readdirSync(join(root, "src/content/publications")).filter((name) => /\.mdx?$/.test(name));
assert.deepEqual(contentFiles, []);

console.log("Publications tests passed: approved-only policy, validation, hero order, empty state, sitemap source, responsive CSS and single BaseLayout analytics initialization are correct.");
