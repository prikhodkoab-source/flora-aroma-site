import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { selectPublicPublications, validatePublicationEntries } from "../src/lib/publication-policy.mjs";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function buildMedia(id, placement, sourceType = "own", rightsStatus = "approved", overrides = {}) {
  return {
    mediaAssetId: id,
    src: `/images/publications/${id.toLowerCase()}.jpg`,
    alt: `Alt ${id}`,
    caption: `Caption ${id}`,
    sourceType,
    placement,
    sortOrder: placement === "cover" ? 0 : Number(id.slice(-1)) * 10,
    rightsStatus,
    ...overrides
  };
}

function defaultArticleMedia() {
  return [
    buildMedia("MEDIA-ASSET-0001", "cover", "own"),
    buildMedia("MEDIA-ASSET-0002", "body", "own"),
    buildMedia("MEDIA-ASSET-0003", "body", "supplier")
  ];
}

function fixture(overrides = {}) {
  const dataOverrides = overrides.data ?? {};
  const articleMedia = dataOverrides.articleMedia ?? defaultArticleMedia();
  const coverMedia = articleMedia.find((item) => item.placement === "cover") ?? articleMedia[0];

  return {
    id: overrides.id ?? "fixture.md",
    body: overrides.body ?? "слово ".repeat(240).trim(),
    data: {
      publicationId: "PUB-TEST-0001",
      approvedRevision: "fixture-revision",
      approvedPreviewHash: "fixture-preview-hash",
      slug: "valid-publication",
      language: "uk",
      title: "Valid publication",
      excerpt: "Valid excerpt",
      category: "Практичні поради",
      coverImage: coverMedia?.src,
      coverImageAlt: coverMedia?.alt,
      coverMediaAssetId: coverMedia?.mediaAssetId,
      articleMedia,
      relatedPlantIds: [],
      seoTitle: "Valid publication — Flora & Aroma",
      seoDescription: "Valid SEO description",
      publishedAt: new Date("2026-07-17T00:00:00Z"),
      updatedAt: new Date("2026-07-17T00:00:00Z"),
      publicationStatus: "approved",
      mediaRightsStatus: "approved",
      ...dataOverrides
    }
  };
}

const publicPlants = new Set(["PLANT-0002"]);

const validShortArticle = fixture();
assert.deepEqual(selectPublicPublications([validShortArticle], publicPlants), [validShortArticle]);

for (const publicationStatus of ["draft", "pending_operator_review", "suspended", "archived"]) {
  const entry = fixture({ data: { publicationStatus } });
  assert.equal(selectPublicPublications([entry], publicPlants).length, 0);
}

for (const mediaRightsStatus of ["pending_operator_review", "restricted", "rejected", "expired"]) {
  const entry = fixture({ data: { mediaRightsStatus } });
  assert.equal(selectPublicPublications([entry], publicPlants).length, 0);
}

assert.throws(
  () => validatePublicationEntries([fixture({ data: { slug: "duplicate-slug" } }), fixture({ id: "dup.md", data: { publicationId: "PUB-TEST-0002", slug: "duplicate-slug" } })], publicPlants),
  /duplicate slug/
);

assert.throws(() => validatePublicationEntries([fixture({ data: { publicationId: "" } })], publicPlants), /missing publicationId/);
assert.throws(() => validatePublicationEntries([fixture({ data: { relatedPlantIds: ["PLANT-9999"] } })], publicPlants), /unknown public relatedPlantId/);
assert.throws(() => validatePublicationEntries([fixture({ data: { coverMediaAssetId: "" } })], publicPlants), /requires coverMediaAssetId/);

assert.throws(
  () =>
    validatePublicationEntries(
      [
        fixture({
          data: {
            articleMedia: [buildMedia("MEDIA-ASSET-0001", "cover", "own"), buildMedia("MEDIA-ASSET-0002", "body", "own")]
          }
        })
      ],
      publicPlants
    ),
  /at least 3 unique images/
);

assert.throws(
  () =>
    validatePublicationEntries(
      [
        fixture({
          data: {
            articleMedia: [
              buildMedia("MEDIA-ASSET-0001", "cover", "own"),
              buildMedia("MEDIA-ASSET-0002", "body", "supplier"),
              buildMedia("MEDIA-ASSET-0003", "body", "generated")
            ]
          }
        })
      ],
      publicPlants
    ),
  /at least 2 own images/
);

assert.throws(
  () =>
    validatePublicationEntries(
      [
        fixture({
          body: "слово ".repeat(1301).trim(),
          data: {
            articleMedia: [
              buildMedia("MEDIA-ASSET-0001", "cover", "own"),
              buildMedia("MEDIA-ASSET-0002", "body", "own"),
              buildMedia("MEDIA-ASSET-0003", "body", "own"),
              buildMedia("MEDIA-ASSET-0004", "body", "supplier")
            ]
          }
        })
      ],
      publicPlants
    ),
  /at least 5 unique images/
);

assert.throws(
  () =>
    validatePublicationEntries(
      [
        fixture({
          data: {
            articleMedia: [
              buildMedia("MEDIA-ASSET-0001", "cover", "own"),
              buildMedia("MEDIA-ASSET-0002", "body", "own"),
              buildMedia("MEDIA-ASSET-0002", "body", "supplier"),
              buildMedia("MEDIA-ASSET-0003", "body", "supplier")
            ]
          }
        })
      ],
      publicPlants
    ),
  /duplicate article media MEDIA-ASSET-0002/
);

assert.throws(
  () =>
    validatePublicationEntries(
      [
        fixture({
          data: {
            articleMedia: [
              buildMedia("MEDIA-ASSET-0001", "cover", "own"),
              buildMedia("MEDIA-ASSET-0002", "body", "unknown"),
              buildMedia("MEDIA-ASSET-0003", "body", "own")
            ]
          }
        })
      ],
      publicPlants
    ),
  /cannot include unknown media source/
);

assert.throws(
  () =>
    validatePublicationEntries(
      [
        fixture({
          data: {
            articleMedia: [
              buildMedia("MEDIA-ASSET-0001", "cover", "own"),
              buildMedia("MEDIA-ASSET-0002", "body", "own", "pending_operator_review"),
              buildMedia("MEDIA-ASSET-0003", "body", "own")
            ]
          }
        })
      ],
      publicPlants
    ),
  /must have rightsStatus=approved/
);

const pendingContent = read("src/content/publications/aromatnyi-bordiur-priani-zapashni-roslyny.md");
assert.match(pendingContent, /publicationStatus:\s*pending_operator_review/);
assert.match(pendingContent, /mediaRightsStatus:\s*pending_operator_review/);

assert.equal(existsSync(join(root, "src/pages/publications/[slug].astro")), true);
assert.equal(existsSync(join(root, "src/pages/[slug].astro")), false);
assert.equal(existsSync(join(root, "src/components/TildaCloneShopHeader.astro")), false);

const layoutSource = read("src/layouts/BaseLayout.astro");
assert.match(layoutSource, /import SiteHeader from "\.\.\/components\/SiteHeader\.astro";/);
assert.match(layoutSource, /import type \{ SiteNavKey \} from "\.\.\/config\/siteNavigation";/);
assert.match(layoutSource, /<SiteHeader /);
assert.doesNotMatch(layoutSource, /TildaCloneShopHeader/);

const navConfigSource = read("src/config/siteNavigation.ts");
assert.match(navConfigSource, /label:\s*"Про нас"/);
assert.match(navConfigSource, /href:\s*"\/"/);
assert.match(navConfigSource, /label:\s*"Асортимент"/);
assert.match(navConfigSource, /label:\s*"Поради та ідеї"/);
assert.match(navConfigSource, /label:\s*"Контакти"/);
const homeIndex = navConfigSource.indexOf('label: "Про нас"');
const catalogIndex = navConfigSource.indexOf('label: "Асортимент"');
const publicationsNavIndex = navConfigSource.indexOf('label: "Поради та ідеї"');
const contactsIndex = navConfigSource.indexOf('label: "Контакти"');
assert.ok(homeIndex < catalogIndex && catalogIndex < publicationsNavIndex && publicationsNavIndex < contactsIndex, "Navigation order must match the approved sequence.");

const headerSource = read("src/components/SiteHeader.astro");
assert.match(headerSource, /siteNavigationItems/);
assert.match(headerSource, /data-site-menu-toggle/);
assert.match(headerSource, /data-site-menu-backdrop/);
assert.match(headerSource, /data-site-mobile-menu/);
assert.match(headerSource, /aria-expanded/);
assert.match(headerSource, /site-menu-open/);
assert.match(headerSource, /Escape/);
assert.match(headerSource, /data-cart-open/);
const menuToggleIndex = headerSource.indexOf("site-menu-toggle");
const logoIndex = headerSource.indexOf("site-header__logo");
const cartIndex = headerSource.indexOf("site-cart-button");
assert.ok(menuToggleIndex >= 0 && logoIndex >= 0 && cartIndex >= 0, "Header controls must exist.");
assert.ok(menuToggleIndex < logoIndex && logoIndex < cartIndex, "Mobile header order must stay hamburger -> logo -> cart.");

const heroSource = read("src/pages/index.astro");
assert.match(heroSource, /navKey="home"/);
const shopLinkIndex = heroSource.indexOf('href="/shop/"');
const publicationsLinkIndex = heroSource.indexOf('href="/publications/"');
const telegramLinkIndex = heroSource.indexOf("siteContacts.consultationTelegramUrl");
assert.ok(shopLinkIndex >= 0 && publicationsLinkIndex >= 0 && telegramLinkIndex >= 0, "Hero links must exist.");
assert.ok(shopLinkIndex < publicationsLinkIndex && publicationsLinkIndex < telegramLinkIndex, "Hero links must keep the approved order.");

const publicationsIndexSource = read("src/pages/publications/index.astro");
assert.match(publicationsIndexSource, /Матеріали готуються/);
assert.match(publicationsIndexSource, /publication-catalog-cta/);
assert.doesNotMatch(publicationsIndexSource, /hero-greenhouse\.jpg/);

const contactsSource = read("src/pages/contacts.astro");
assert.match(contactsSource, /navKey="contacts"/);
assert.match(contactsSource, /siteContacts\.consultationTelegramUrl/);
assert.match(contactsSource, /siteContacts\.phoneHref/);
assert.match(contactsSource, /flora-aroma\.com\.ua/);
assert.doesNotMatch(contactsSource, /Що написати/);
assert.doesNotMatch(contactsSource, /nursery-irrigation\.jpg/);

const footerSource = read("src/components/TildaCloneFooter.astro");
assert.match(footerSource, /siteNavigationItems/);

const cardSource = read("src/components/PublicationCard.astro");
assert.match(cardSource, /\/publications\/\$\{data\.slug\}\//);

const detailSource = read("src/pages/publications/[slug].astro");
assert.match(detailSource, /Рослини з цієї публікації/);
assert.match(detailSource, /href="\/publications\/"/);
assert.match(detailSource, /href="\/shop\/"/);
assert.match(detailSource, /publication-detail__gallery/);

const sitemapSource = read("src/pages/sitemap-index.xml.ts");
assert.match(sitemapSource, /\/publications\/\$\{publication\.data\.slug\}\//);
assert.doesNotMatch(sitemapSource, /`\/\$\{publication\.data\.slug\}\/`/);

const notFoundSource = read("src/pages/404.astro");
assert.match(notFoundSource, /Поради та ідеї/);

const contractSource = read("docs/publications-content-contract.md");
assert.match(contractSource, /coverMediaAssetId/);
assert.match(contractSource, /articleMedia/);
assert.match(contractSource, /at least 3 unique approved images/i);
assert.match(contractSource, /at least 5 unique approved images/i);
assert.match(contractSource, /unknown.+forbidden/i);

console.log(
  "Publications tests passed: shared navigation is wired through BaseLayout, mobile header order stays hamburger/logo/cart, pending content stays private, and approved-only media thresholds fail closed."
);
