import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

function buildPlantCard(plantId, rightsStatus = "approved", overrides = {}) {
  return {
    mediaAssetId: `P1-CARD-${plantId}`,
    plantId,
    src: `/images/plant-cards/${plantId.toLowerCase()}.png`,
    alt: `Plant card ${plantId}`,
    sourceType: "generated",
    rightsStatus,
    ...overrides
  };
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
      bodyMediaLayout: "gallery",
      relatedPlantIds: ["PLANT-0002"],
      relatedPlantCards: [],
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
assert.throws(
  () => validatePublicationEntries([fixture({ data: { relatedPlantIds: [], relatedPlantCards: [] } })], publicPlants),
  /requires at least one related public plant card or link/
);
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
              buildMedia("MEDIA-ASSET-0003", "body", "supplier")
            ]
          }
        })
      ],
      publicPlants
    ),
  /at least 2 controlled images/
);

const generatedMediaArticle = fixture({
  data: {
    articleMedia: [
      buildMedia("MEDIA-ASSET-0001", "cover", "generated"),
      buildMedia("MEDIA-ASSET-0002", "body", "generated"),
      buildMedia("MEDIA-ASSET-0003", "body", "generated")
    ]
  }
});
assert.doesNotThrow(() => validatePublicationEntries([generatedMediaArticle], publicPlants));

const inlineArticleMedia = defaultArticleMedia();
const inlineArticleBody = [
  "слово ".repeat(240).trim(),
  ...inlineArticleMedia
    .filter((item) => item.placement === "body")
    .map(
      (item) =>
        `<figure class="publication-inline-media"><img src="${item.src}" alt="${item.alt}" /><figcaption>${item.caption}</figcaption></figure>`
    )
].join("\n");
assert.doesNotThrow(() =>
  validatePublicationEntries(
    [fixture({ body: inlineArticleBody, data: { articleMedia: inlineArticleMedia, bodyMediaLayout: "inline" } })],
    publicPlants
  )
);
assert.throws(
  () => validatePublicationEntries([fixture({ data: { bodyMediaLayout: "inline" } })], publicPlants),
  /inline body media MEDIA-ASSET-0002 must appear/
);

assert.throws(
  () =>
    validatePublicationEntries(
      [
        fixture({
          data: {
            articleMedia: [
              buildMedia("MEDIA-ASSET-0001", "cover", "generated", "approved", { src: "https://example.com/cover.jpg" }),
              buildMedia("MEDIA-ASSET-0002", "body", "generated", "approved", { src: "https://example.com/body.jpg" }),
              buildMedia("MEDIA-ASSET-0003", "body", "supplier")
            ]
          }
        })
      ],
      publicPlants
    ),
  /own\/generated site-local visualizations/
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

assert.doesNotThrow(() =>
  validatePublicationEntries(
    [fixture({ data: { relatedPlantIds: ["PLANT-0002"], relatedPlantCards: [buildPlantCard("PLANT-0002")] } })],
    publicPlants
  )
);
assert.throws(
  () =>
    validatePublicationEntries(
      [
        fixture({
          data: {
            relatedPlantIds: ["PLANT-0002"],
            relatedPlantCards: [buildPlantCard("PLANT-0002", "pending_operator_review")]
          }
        })
      ],
      publicPlants
    ),
  /related plant card PLANT-0002 must have rightsStatus=approved/
);

const approvedContent = read("src/content/publications/aromatnyi-bordiur-priani-zapashni-roslyny.md");
assert.match(approvedContent, /publicationStatus:\s*approved/);
assert.match(approvedContent, /mediaRightsStatus:\s*approved/);
assert.match(approvedContent, /coverMediaAssetId:\s*GEN-AROMATIC-BORDER-01/);
assert.match(approvedContent, /bodyMediaLayout:\s*inline/);
assert.equal((approvedContent.match(/<figure class="publication-inline-media">/g) ?? []).length, 4);

const gardenFashionDraft = read("src/content/publications/sadova-moda-2026-pryrodnyi-sad-speka.md");
assert.match(gardenFashionDraft, /publicationId:\s*WC-CR-20260815-GARDEN-FASHION-2026/);
assert.match(gardenFashionDraft, /slug:\s*sadova-moda-2026-pryrodnyi-sad-speka/);
assert.match(
  gardenFashionDraft,
  /subtitle:\s*"Чому природні композиції зі злаками, ароматичними травами, посухостійкими багаторічниками та рослинами для запилювачів стають дедалі помітнішими"/
);
assert.match(gardenFashionDraft, /publicationStatus:\s*draft/);
assert.match(gardenFashionDraft, /mediaRightsStatus:\s*pending_operator_review/);
assert.match(gardenFashionDraft, /articleMedia:\s*\[\]/);
assert.doesNotMatch(gardenFashionDraft, /approvedRevision:/);
assert.doesNotMatch(gardenFashionDraft, /approvedPreviewHash:/);
assert.doesNotMatch(gardenFashionDraft, /publishedAt:/);
assert.doesNotMatch(gardenFashionDraft, /coverImage:/);
for (const plantId of ["PLANT-0003", "PLANT-0009", "PLANT-0085", "PLANT-0087"]) {
  assert.match(gardenFashionDraft, new RegExp(`relatedPlantIds:[\\s\\S]*${plantId}`));
}
for (const route of [
  "/plants/penisetum-lysokhvostyi-plant-0003/",
  "/plants/ekhinatseia-purpurova-plant-0009/",
  "/plants/kostrytsia-hotie-plant-0085/",
  "/plants/chebrets-povzuchyi-plant-0087/",
  "/shop/"
]) {
  assert.match(gardenFashionDraft, new RegExp(route.replaceAll("/", "\\/")));
}
assert.doesNotMatch(
  gardenFashionDraft,
  /у поточному підтвердженому асортименті|за підтвердженою карткою|за даними картки|water-wise|lower-input/iu
);
assert.doesNotMatch(gardenFashionDraft, /\b(?:UAH|грн)\b/u);
for (const mediaAssetId of [
  "GEN-AROMATIC-BORDER-01",
  "GEN-AROMATIC-BORDER-02",
  "GEN-AROMATIC-BORDER-03",
  "GEN-AROMATIC-BORDER-04",
  "GEN-AROMATIC-BORDER-05"
]) {
  assert.match(approvedContent, new RegExp(`mediaAssetId:\\s*${mediaAssetId}`));
}
for (const plantId of [
  "PLANT-0084",
  "PLANT-0051",
  "PLANT-0055",
  "PLANT-0037",
  "PLANT-0044",
  "PLANT-0081",
  "PLANT-0077",
  "PLANT-0066",
  "PLANT-0074",
  "PLANT-0082",
  "PLANT-0098",
  "PLANT-0089",
  "PLANT-0033"
]) {
  assert.match(approvedContent, new RegExp(`mediaAssetId:\\s*P1-CARD-${plantId}`));
}

const approvedMediaHashes = new Map([
  ["public/images/publications/aromatic-border/01-dry-aromatic-border.png", "3843dc21eb32121178b02b1bd8659939057cc2e40ad45e30e285466d2c5853c4"],
  ["public/images/publications/aromatic-border/02-terrace-aromatic-border.png", "11c58260c5257526c66636531b3417105557cc7532a69c6aaec8f3417da94e50"],
  ["public/images/publications/aromatic-border/03-kitchen-herb-garden.png", "627f51e1f2cb617aa93e9da9b7922937c72e2fc34576549056151f1ee522ff92"],
  ["public/images/publications/aromatic-border/04-decorative-aromatic-border.png", "b9dbd8447b9131aea5bd755331bbea78bd992838e8f77756ce523d92a0f5b29e"],
  ["public/images/publications/aromatic-border/05-mixed-aromatic-border.png", "1dbe39aa1705804d0c2ee8b28110c929e30c0cd15fe96216a9fe60fbe52e631d"],
  ["public/images/plant-cards/aromatic-border/plant-0033-p1.png", "b74c15d237589eb19e398daf241d4a38fff318ad69038b7ea1a70fb9661791d2"],
  ["public/images/plant-cards/aromatic-border/plant-0037-p1.jpg", "9cec1caf8344e3a68335bc61cc4702f95e22cde934783b29996c5424e4f2cf46"],
  ["public/images/plant-cards/aromatic-border/plant-0044-p1.png", "31ff6983646465ec379df0a2be8d73f6a715d46ca88104851b81b30c9615bc21"],
  ["public/images/plant-cards/aromatic-border/plant-0051-p1.png", "0e3f58692d74baafc11ea78c83b42c353fae3026da06a409c72bdc45fc2a6c0a"],
  ["public/images/plant-cards/aromatic-border/plant-0055-p1.jpg", "74f4a44bdcd71b27c92817c4322e089ac54a90643f56ceb89288776c08e004c2"],
  ["public/images/plant-cards/aromatic-border/plant-0066-p1.png", "84be96f79458c25fa19f7aea6fa2ddc0d66e814fd725f6c7a6773e37c6a5e27e"],
  ["public/images/plant-cards/aromatic-border/plant-0074-p1.png", "b6041cbe5afaebf999c6582a424e06411d030d17ed4f2288136b2f97a43b202f"],
  ["public/images/plant-cards/aromatic-border/plant-0077-p1.png", "d121ce66d1daa3c1cb77de78bba6ba3794d3600afee96eae2465b9ba1e91dbfd"],
  ["public/images/plant-cards/aromatic-border/plant-0081-p1.png", "a606eb3bf07b40984f3d15025d0b4f019cc07fdfdbbed3e543014b1f956288ce"],
  ["public/images/plant-cards/aromatic-border/plant-0082-p1.png", "bdbcdabf2a7d5e6f9342b3579014efa8cae4715f859b7811bc356c90478062ab"],
  ["public/images/plant-cards/aromatic-border/plant-0084-p1.png", "c35c7f493808a285801e5b9c61db69638942cdd39535ce2f67e59864dc9580fe"],
  ["public/images/plant-cards/aromatic-border/plant-0089-p1.png", "cf2c68ed927cb92b435466c87d8bec38fa9cdddd6a3c6a5eaa65759549250fae"],
  ["public/images/plant-cards/aromatic-border/plant-0098-p1.png", "2f07f79a7b1d7311615fc760205c591e9f42e8c0d3133a80c8ad967373438039"]
]);
for (const [mediaPath, expectedHash] of approvedMediaHashes) {
  assert.equal(existsSync(join(root, mediaPath)), true, `${mediaPath} must exist`);
  const actualHash = createHash("sha256").update(readFileSync(join(root, mediaPath))).digest("hex");
  assert.equal(actualHash, expectedHash, `${mediaPath} must match the operator-approved SHA-256`);
}

const redirectsSource = read("public/_redirects");
assert.match(
  redirectsSource,
  /\/aromatnyi-bordiur-priani-zapashni-roslyny\/\s+\/publications\/aromatnyi-bordiur-priani-zapashni-roslyny\/\s+301/
);

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
assert.match(contactsSource, /siteContacts\.emailHref/);
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
assert.match(detailSource, /data\.bodyMediaLayout !== "inline"/);
assert.match(detailSource, /publication-inline-media/);
assert.match(detailSource, /return product \? \[\{ product, card \}\] : \[\];/);
assert.match(detailSource, /\{card && <img/);
assert.match(detailSource, /collection-plant-card--link-only/);

const sitemapSource = read("src/pages/sitemap-index.xml.ts");
assert.match(sitemapSource, /\/publications\/\$\{publication\.data\.slug\}\//);
assert.doesNotMatch(sitemapSource, /`\/\$\{publication\.data\.slug\}\/`/);

const notFoundSource = read("src/pages/404.astro");
assert.match(notFoundSource, /Поради та ідеї/);

const contractSource = read("docs/publications-content-contract.md");
assert.match(contractSource, /coverMediaAssetId/);
assert.match(contractSource, /articleMedia/);
assert.match(contractSource, /bodyMediaLayout=inline/);
assert.match(contractSource, /at least 3 unique approved images/i);
assert.match(contractSource, /at least 5 unique approved images/i);
assert.match(contractSource, /unknown.+forbidden/i);
assert.match(contractSource, /at least one related public plant card or link/i);
assert.match(contractSource, /generated or copied.+visualizations/i);

console.log(
  "Publications tests passed: shared navigation is wired through BaseLayout, approved media hashes match, and publication thresholds fail closed."
);
