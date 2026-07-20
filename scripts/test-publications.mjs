import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
      approvedRevision: "fixture-revision",
      approvedPreviewHash: "fixture-preview-hash",
      slug: "valid-publication",
      language: "uk",
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

function frontmatterValue(markdown, key) {
  const match = markdown.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?\\s*$`, "m"));
  return match?.[1]?.trim();
}

function frontmatterArray(markdown, key) {
  const match = markdown.match(new RegExp(`^${key}:\\n((?:\\s+-\\s+[^\\n]+\\n?)+)`, "m"));
  return match ? [...match[1].matchAll(/-\s+([A-Z]+-\d{4})/g)].map((item) => item[1]) : [];
}

function markdownBody(markdown) {
  return markdown.replace(/^---[\s\S]*?---\s*/, "").trim();
}

function normalizedBody(markdown) {
  return markdownBody(markdown).replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
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
assert.throws(
  () => validatePublicationEntries([fixture({ data: { approvedRevision: "" } })], publicPlants),
  /requires approvedRevision/
);
assert.throws(
  () => validatePublicationEntries([fixture({ data: { language: "" } })], publicPlants),
  /requires language/
);

const related = fixture({ data: { relatedPlantIds: ["PLANT-0002"] } });
assert.deepEqual(selectPublicPublications([related], publicPlants), [related]);

const publicationSlug = "aromatnyi-bordiur-priani-zapashni-roslyny";
const publicationPath = `src/content/publications/${publicationSlug}.md`;
const publicationSource = read(publicationPath);
const publicationBody = normalizedBody(publicationSource);

assert.equal(frontmatterValue(publicationSource, "publicationId"), "WC-CR-20260712-AROMATIC-BORDER");
assert.equal(frontmatterValue(publicationSource, "approvedRevision"), "1ee002dd9a0005fe");
assert.equal(frontmatterValue(publicationSource, "approvedPreviewHash"), "e6f5ca0584cdbcc1");
assert.equal(frontmatterValue(publicationSource, "slug"), publicationSlug);
assert.equal(frontmatterValue(publicationSource, "language"), "uk");
assert.equal(frontmatterValue(publicationSource, "publicationStatus"), "approved");
assert.equal(frontmatterValue(publicationSource, "mediaRightsStatus"), "approved");
assert.equal(frontmatterArray(publicationSource, "relatedPlantIds").length, 13);
assert.doesNotMatch(publicationBody, /^#\s/m);
assert.match(publicationBody, /Ароматний бордюр — це посадка/);
assert.match(publicationBody, /## Що таке ароматний бордюр/);
assert.match(publicationBody, /## Як замовити/);
assert.equal(createHash("sha256").update(publicationBody).digest("hex"), "e18a11c6dc4cb199d52a227bf4150a6e129ae38eaaf39f115e1c567ad3518878");

const contentFiles = readdirSync(join(root, "src/content/publications")).filter((name) => /\.mdx?$/.test(name));
assert.deepEqual(contentFiles, [`${publicationSlug}.md`]);
assert.equal(existsSync(join(root, "src/data/aromaticBorderContent.ts")), false);
assert.equal(existsSync(join(root, "src/pages/aromatnyi-bordiur-priani-zapashni-roslyny.astro")), false);
assert.equal(existsSync(join(root, "src/pages/publications/[slug].astro")), false);

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
assert.match(indexSource, /homepage-publications/);
assert.match(indexSource, /PublicationCard/);

const headerSource = read("src/components/TildaCloneShopHeader.astro");
assert.match(headerSource, /href="\/publications\/"/);
assert.match(headerSource, /tilda-shop-nav/);

const footerSource = read("src/components/TildaCloneFooter.astro");
assert.match(footerSource, /href="\/publications\/"/);
assert.match(footerSource, /tilda-footer-nav/);

const cardSource = read("src/components/PublicationCard.astro");
assert.match(cardSource, /const href = `\/\$\{data\.slug\}\/`;/);
assert.doesNotMatch(cardSource, /\/publications\/\$\{data\.slug\}/);

const publicationsIndex = read("src/pages/publications/index.astro");
assert.match(publicationsIndex, /getApprovedPublications/);
assert.match(publicationsIndex, /PublicationCard/);

const detailSource = read("src/pages/[slug].astro");
assert.match(detailSource, /getApprovedPublications/);
assert.match(detailSource, /relatedPlantIds/);
assert.match(detailSource, /collection-plants/);
assert.match(detailSource, /href="\/publications\/"/);
assert.match(detailSource, /href="\/contacts\/"/);

const notFoundSource = read("src/pages/404.astro");
assert.match(notFoundSource, /Сторінку не знайдено/);
assert.match(notFoundSource, /href="\/publications\/"/);

const sitemapSource = read("src/pages/sitemap-index.xml.ts");
assert.match(sitemapSource, /"\/publications\/"/);
assert.match(sitemapSource, /getApprovedPublications/);
assert.match(sitemapSource, /\/\$\{publication\.data\.slug\}\//);
assert.doesNotMatch(sitemapSource, /flora-aroma\.com\.ua/);
assert.doesNotMatch(sitemapSource, /\/publications\/\$\{publication\.data\.slug\}/);
assert.doesNotMatch(sitemapSource, /\/admin\//);
assert.doesNotMatch(sitemapSource, /\/api\//);

const astroConfig = read("astro.config.mjs");
assert.match(astroConfig, /site:\s*"https:\/\/flora-aroma-site\.pages\.dev"/);

const robots = read("public/robots.txt");
assert.match(robots, /Allow: \//);
assert.match(robots, /https:\/\/flora-aroma-site\.pages\.dev\/sitemap-index\.xml/);
assert.doesNotMatch(robots, /flora-aroma\.com\.ua/);
assert.doesNotMatch(robots, /noindex/i);

const styles = read("src/styles/global.css");
assert.match(styles, /\.tilda-hero-buttons\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.tilda-hero-buttons\s*\{[\s\S]*?flex-direction:\s*column;/);
assert.match(styles, /\.tilda-shop-nav\s*\{/);
assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.tilda-shop-nav\s*\{[\s\S]*?justify-content:\s*center;/);
assert.match(styles, /\.tilda-footer-nav\s*\{/);
assert.match(styles, /\.homepage-publications\s*\{/);
assert.match(styles, /\.publications-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/);
assert.match(styles, /@media \(max-width: 960px\)[\s\S]*?\.publications-grid\s*\{[\s\S]*?repeat\(2,/);
assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.publications-grid\s*\{[\s\S]*?minmax\(0, 1fr\)/);

const baseLayout = read("src/layouts/BaseLayout.astro");
assert.equal((baseLayout.match(/initializeAnalytics\(\)/g) ?? []).length, 1);
assert.doesNotMatch(publicationsIndex, /initializeAnalytics|page_view/);
assert.doesNotMatch(detailSource, /initializeAnalytics|page_view/);

const draftFixture = fixture({ data: { publicationStatus: "draft" } });
assert.equal(selectPublicPublications([draftFixture], publicPlants).length, 0);

console.log("Publications tests passed: approved article is in content collection, root route links are canonical, drafts are excluded, sitemap/robots use active Pages base, UI discoverability is present, and the article body snapshot is unchanged.");
