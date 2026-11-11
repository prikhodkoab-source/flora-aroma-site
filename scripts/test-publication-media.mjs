import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  publicationMediaManifestHash,
  selectDraftPreviewPublication,
  selectPublicPublications,
  validatePreviewMediaFiles
} from "../src/lib/publication-policy.mjs";

const contentId = "WC-CR-20260815-GARDEN-FASHION-2026";
const revision = "e596411a75626164";
const publicRoot = mkdtempSync(join(tmpdir(), "flora-publication-media-"));
const imageRoot = join(publicRoot, "images");
mkdirSync(imageRoot);

function imageItem({ id, placement, order, originalId = id, derivativeSpec = "" }) {
  const bytes = Buffer.from(`safe-media-fixture:${id}`, "utf8");
  writeFileSync(join(imageRoot, `${id}.jpg`), bytes);
  return {
    mediaAssetId: id,
    src: `/images/${id}.jpg`,
    alt: `Safe alt ${id}`,
    caption: `Safe caption ${id}`,
    sourceType: "own",
    placement,
    sortOrder: order,
    rightsStatus: "approved",
    checksum: createHash("sha256").update(bytes).digest("hex"),
    width: 2400,
    height: 1600,
    mimeType: "image/jpeg",
    isAiGenerated: false,
    originalMediaAssetId: originalId,
    derivativeSpec,
    relatedPlantIds: placement === "body" ? ["PLANT-0009"] : [],
    targetChannel: placement === "social" ? "facebook" : "site_blog",
    approvalStatus: "pending_operator_review"
  };
}

const entry = {
  id: "garden-fashion.md",
  body: "",
  data: {
    publicationId: contentId,
    draftRevision: revision,
    slug: "sadova-moda-2026-pryrodnyi-sad-speka",
    language: "uk",
    title: "Садова мода 2026: природний сад, що витримує спеку",
    excerpt: "Safe excerpt",
    category: "Садовий дизайн Flora & Aroma",
    coverImage: "/images/hero.jpg",
    coverImageAlt: "Safe alt hero",
    coverMediaAssetId: "hero",
    bodyMediaLayout: "inline",
    articleMedia: [
      imageItem({ id: "hero", placement: "cover", order: 0 }),
      imageItem({ id: "inline-1", placement: "body", order: 10 }),
      imageItem({ id: "inline-2", placement: "body", order: 20 }),
      imageItem({ id: "social", placement: "social", order: 30, originalId: "hero", derivativeSpec: "crop:1200x630:center" })
    ],
    relatedPlantIds: ["PLANT-0009"],
    relatedPlantCards: [],
    seoTitle: "Safe SEO title",
    seoDescription: "Safe SEO description",
    publicationStatus: "draft",
    mediaRightsStatus: "pending_operator_review",
    mediaGateStatus: "ready_for_operator_review",
    mediaApprovalStatus: "pending_operator_review"
  }
};
entry.body = [
  "Exact reviewed candidate body.",
  ...entry.data.articleMedia
    .filter((item) => item.placement === "body")
    .map((item) => `![${item.alt}](${item.src})\n\n*${item.caption}*`)
].join("\n\n");
entry.data.mediaManifestHash = publicationMediaManifestHash(entry);

try {
  const selected = selectDraftPreviewPublication([entry], new Set(["PLANT-0009"]), {
    enabled: true,
    contentId,
    contentRevision: revision,
    manifestHash: entry.data.mediaManifestHash
  });
  assert.equal(selected, entry);
  assert.equal(selectPublicPublications([entry], new Set(["PLANT-0009"])).length, 0);
  assert.doesNotThrow(() => validatePreviewMediaFiles(entry, publicRoot));
  assert.equal(entry.data.publicationStatus, "draft");
  assert.equal(entry.data.mediaApprovalStatus, "pending_operator_review");
  assert.ok(entry.data.articleMedia.every((item) => item.src.startsWith("/images/")));

  const licensed = structuredClone(entry);
  const photo = licensed.data.articleMedia[0];
  Object.assign(photo, {sourceType: "creative_commons", creator: "Fixture photographer",
    attributionText: "Fixture photograph", originalChecksum: photo.checksum, sourceUrl: "https://example.org/original",
    licenseRef: "https://creativecommons.org/licenses/by-sa/4.0/"});
  const select = () => selectDraftPreviewPublication([licensed], new Set(["PLANT-0009"]), {
    enabled: true, contentId, contentRevision: revision, manifestHash: licensed.data.mediaManifestHash
  });
  licensed.data.mediaManifestHash = publicationMediaManifestHash(licensed);
  assert.equal(select(), licensed);
  photo.attributionText += " edited";
  assert.throws(select, /computed media manifest hash/);
  photo.licenseRef = "https://creativecommons.org/licenses/by-nc/4.0/";
  assert.throws(select, /licensed-media credit/);
  photo.licenseRef = "https://creativecommons.org/licenses/by/4.0/";
  photo.creator = "";
  assert.throws(select, /licensed-media credit/);
  photo.creator = "Fixture photographer";
  licensed.data.articleMedia.forEach((item) => { item.approvalStatus = "approved"; });
  Object.assign(licensed.data, {publicationStatus: "approved", mediaRightsStatus: "approved",
    mediaGateStatus: "approved_for_publication", mediaApprovalStatus: "approved",
    approvedRevision: revision, approvedPreviewHash: "approved-preview-fixture",
    publishedAt: new Date("2026-11-09T08:16:00+02:00")});
  licensed.data.approvedMediaManifestHash = publicationMediaManifestHash(licensed);
  assert.equal(selectPublicPublications([licensed], new Set(["PLANT-0009"]))[0], licensed);
  photo.attributionText += " stale";
  assert.throws(() => selectPublicPublications([licensed], new Set(["PLANT-0009"])), /stale licensed article\/media approval/);

  const publicDomain = structuredClone(licensed);
  const publicDomainPhoto = publicDomain.data.articleMedia[0];
  Object.assign(publicDomainPhoto, {sourceType: "public_domain", attributionText: "CC0 fixture photograph",
    licenseRef: "https://creativecommons.org/publicdomain/zero/1.0/"});
  publicDomain.data.approvedMediaManifestHash = publicationMediaManifestHash(publicDomain);
  assert.equal(selectPublicPublications([publicDomain], new Set(["PLANT-0009"]))[0], publicDomain);

  const stableHash = publicationMediaManifestHash({ ...entry, data: { ...entry.data, articleMedia: [...entry.data.articleMedia].reverse() } });
  assert.equal(stableHash, entry.data.mediaManifestHash);
  const changedAlt = structuredClone(entry);
  changedAlt.data.articleMedia[0].alt = "Changed alt";
  assert.notEqual(publicationMediaManifestHash(changedAlt), entry.data.mediaManifestHash);
  const changedRevision = structuredClone(entry);
  changedRevision.data.draftRevision = "1111111111111111";
  assert.notEqual(publicationMediaManifestHash(changedRevision), entry.data.mediaManifestHash);

  const duplicateInline = structuredClone(entry);
  duplicateInline.data.articleMedia.find((item) => item.mediaAssetId === "inline-2").originalMediaAssetId = "inline-1";
  duplicateInline.data.mediaManifestHash = publicationMediaManifestHash(duplicateInline);
  assert.throws(
    () => selectDraftPreviewPublication([duplicateInline], new Set(["PLANT-0009"]), {
      enabled: true,
      contentId,
      contentRevision: revision,
      manifestHash: duplicateInline.data.mediaManifestHash
    }),
    /inline images must use distinct originals/
  );

  const aiMedia = structuredClone(entry);
  aiMedia.data.articleMedia[0].isAiGenerated = true;
  aiMedia.data.mediaManifestHash = publicationMediaManifestHash(aiMedia);
  assert.throws(
    () => selectDraftPreviewPublication([aiMedia], new Set(["PLANT-0009"]), {
      enabled: true,
      contentId,
      contentRevision: revision,
      manifestHash: aiMedia.data.mediaManifestHash
    }),
    /AI documentary media is blocked/
  );

  const missingInlineEmbed = structuredClone(entry);
  missingInlineEmbed.body = "Exact reviewed candidate body without bound media.";
  assert.throws(
    () => selectDraftPreviewPublication([missingInlineEmbed], new Set(["PLANT-0009"]), {
      enabled: true,
      contentId,
      contentRevision: revision,
      manifestHash: missingInlineEmbed.data.mediaManifestHash
    }),
    /inline preview media must appear in the article body/
  );

  writeFileSync(join(imageRoot, "hero.jpg"), "changed", "utf8");
  assert.throws(() => validatePreviewMediaFiles(entry, publicRoot), /checksum mismatch/);

  const articleFixture = readFileSync("src/content/publications/sadova-moda-2026-pryrodnyi-sad-speka.md", "utf8");
  assert.match(articleFixture, /draftRevision:\s*895f181dd9f3f170/);
  assert.match(articleFixture, /mediaManifestHash:\s*5ca30387d23cbe72859adc6101384d0ab2080869d00df51473a0eac5a8b358f6/);
  assert.match(articleFixture, /approvedMediaManifestHash:\s*5ca30387d23cbe72859adc6101384d0ab2080869d00df51473a0eac5a8b358f6/);
  assert.match(articleFixture, /mediaGateStatus:\s*approved_for_publication/);
  assert.match(articleFixture, /mediaApprovalStatus:\s*approved/);
  assert.match(articleFixture, /publicationStatus:\s*approved/);
  assert.match(articleFixture, /mediaRightsStatus:\s*approved/);
  assert.equal((articleFixture.match(/mediaAssetId:\s*GF26-CC-/g) ?? []).length, 6);

  const pageSource = readFileSync("src/pages/publications/[slug].astro", "utf8");
  const layoutSource = readFileSync("src/layouts/BaseLayout.astro", "utf8");
  assert.match(pageSource, /getDraftPreviewPublication/);
  assert.match(pageSource, /robots=\{previewMode \? "noindex,nofollow,noarchive"/);
  assert.match(pageSource, /canonicalPath=\{previewMode \? null/);
  assert.match(layoutSource, /canonicalUrl && <link rel="canonical"/);
  assert.match(layoutSource, /robots && <meta name="robots"/);

  console.log("Publication media tests passed: exact-revision manifest, rights, checksums, role counts, fail-closed preview, noindex and non-canonical behavior are verified.");
} finally {
  rmSync(publicRoot, { recursive: true, force: true });
}
