import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";

export const PUBLICATION_STATUSES = new Set([
  "draft",
  "pending_operator_review",
  "approved",
  "suspended",
  "archived"
]);

export const MEDIA_RIGHTS_STATUSES = new Set([
  "pending_operator_review",
  "approved",
  "restricted",
  "rejected",
  "expired"
]);

export const MEDIA_SOURCE_TYPES = new Set(["own", "supplier", "generated", "unknown"]);
export const MEDIA_PLACEMENTS = new Set(["cover", "body", "social"]);
export const BODY_MEDIA_LAYOUTS = new Set(["gallery", "inline"]);
export const PREVIEW_MEDIA_GATE_STATUSES = new Set(["blocked_waiting_for_photography", "ready_for_operator_review"]);
export const CONTENT_MEDIA_APPROVAL_STATUSES = new Set(["pending_operator_review", "approved", "rejected", "stale"]);
export const PREVIEW_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function publicationLabel(entry, index) {
  return entry?.data?.publicationId || entry?.id || `entry-${index + 1}`;
}

function articleWordCount(entry) {
  const body = typeof entry?.body === "string" ? entry.body.trim() : "";
  if (!body) return 0;
  return body.split(/\s+/u).filter(Boolean).length;
}

function uniqueMediaItems(data = {}) {
  const items = Array.isArray(data.articleMedia) ? data.articleMedia : [];
  const mediaMap = new Map();

  for (const item of items) {
    if (!mediaMap.has(item.mediaAssetId)) {
      mediaMap.set(item.mediaAssetId, item);
    }
  }

  return mediaMap;
}

function mediaThresholds(entry) {
  const longArticle = articleWordCount(entry) > 1200;
  return longArticle
    ? { minImages: 5, minControlledImages: 3, minBodyImages: 4 }
    : { minImages: 3, minControlledImages: 2, minBodyImages: 2 };
}

export function isPublicPublication(entry) {
  return entry?.data?.publicationStatus === "approved" && entry?.data?.mediaRightsStatus === "approved";
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function previewMediaRole(item) {
  if (item.placement === "cover") return "hero";
  if (item.placement === "body") return "inline";
  return item.placement;
}

export function publicationMediaManifestHash(entry) {
  const data = entry?.data ?? {};
  const items = (Array.isArray(data.articleMedia) ? data.articleMedia : [])
    .map((item) => ({
      approval_status: item.approvalStatus ?? data.mediaApprovalStatus ?? "",
      alt_text: item.alt ?? "",
      caption: item.caption ?? "",
      checksum: (item.checksum ?? "").toLowerCase(),
      derivative_spec: item.derivativeSpec ?? "",
      media_asset_id: item.mediaAssetId ?? "",
      media_role: previewMediaRole(item),
      original_media_asset_id: item.originalMediaAssetId || item.mediaAssetId || "",
      related_plant_ids: [...new Set(item.relatedPlantIds ?? [])].sort(),
      rights_status: item.rightsStatus ?? "",
      sort_order: Number.isInteger(item.sortOrder) ? item.sortOrder : 0,
      target_channel: item.targetChannel ?? (item.placement === "social" ? "facebook" : "site_blog")
    }))
    .sort(
      (left, right) =>
        left.media_role.localeCompare(right.media_role) ||
        left.sort_order - right.sort_order ||
        left.media_asset_id.localeCompare(right.media_asset_id)
    );
  const payload = canonicalJson({
    content_id: data.publicationId ?? "",
    content_revision_hash: data.draftRevision ?? "",
    items
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function selectDraftPreviewPublication(entries, publicPlantIds, expected) {
  if (!expected?.enabled) return null;
  for (const field of ["contentId", "contentRevision", "manifestHash"]) {
    if (!hasText(expected[field])) throw new Error(`Draft preview configuration missing ${field}`);
  }

  validatePublicationEntries(entries, publicPlantIds);
  const entry = entries.find((candidate) => candidate.data.publicationId === expected.contentId);
  if (!entry) throw new Error(`Draft preview content not found: ${expected.contentId}`);
  const { data } = entry;
  const errors = [];

  if (isPublicPublication(entry)) errors.push("preview target must remain non-public");
  if (data.publicationStatus !== "draft") errors.push("preview target must remain draft");
  if (data.mediaRightsStatus !== "pending_operator_review") {
    errors.push("preview target mediaRightsStatus must remain pending_operator_review");
  }
  if (data.draftRevision !== expected.contentRevision) errors.push("draft revision does not match preview configuration");
  if (data.mediaManifestHash !== expected.manifestHash) errors.push("manifest hash does not match preview configuration");
  if (data.mediaGateStatus !== "ready_for_operator_review") errors.push("article media gate is not ready_for_operator_review");
  if (data.mediaApprovalStatus !== "pending_operator_review") {
    errors.push("media approval status must remain pending_operator_review");
  }

  const media = Array.isArray(data.articleMedia) ? data.articleMedia : [];
  const roleCounts = { hero: 0, inline: 0, social: 0 };
  const inlineOriginals = new Set();
  for (const item of media) {
    const role = previewMediaRole(item);
    if (role in roleCounts) roleCounts[role] += 1;
    if (role === "inline") inlineOriginals.add(item.originalMediaAssetId || item.mediaAssetId);
    if (item.rightsStatus !== "approved") errors.push(`media rights are not approved: ${item.mediaAssetId}`);
    if (item.sourceType === "unknown") errors.push(`media source is unknown: ${item.mediaAssetId}`);
    if (!/^[0-9a-f]{64}$/u.test(item.checksum ?? "")) errors.push(`media checksum is invalid: ${item.mediaAssetId}`);
    if (!Number.isInteger(item.width) || item.width <= 0 || !Number.isInteger(item.height) || item.height <= 0) {
      errors.push(`media dimensions are invalid: ${item.mediaAssetId}`);
    }
    if (!PREVIEW_IMAGE_MIME_TYPES.has(item.mimeType)) errors.push(`media MIME type is invalid: ${item.mediaAssetId}`);
    if (item.isAiGenerated !== false) errors.push(`AI documentary media is blocked: ${item.mediaAssetId}`);
    if (!hasText(item.alt)) errors.push(`media alt is missing: ${item.mediaAssetId}`);
    if (!hasText(item.caption)) errors.push(`media caption is missing: ${item.mediaAssetId}`);
    if (!hasText(item.src) || !item.src.startsWith("/images/")) errors.push(`media path is not site-local: ${item.mediaAssetId}`);
    if (!CONTENT_MEDIA_APPROVAL_STATUSES.has(item.approvalStatus)) {
      errors.push(`media binding approval status is invalid: ${item.mediaAssetId}`);
    } else if (item.approvalStatus !== "pending_operator_review") {
      errors.push(`media binding must remain pending_operator_review: ${item.mediaAssetId}`);
    }
  }
  if (roleCounts.hero < 1) errors.push("preview requires one hero image");
  if (roleCounts.inline < 2) errors.push("preview requires two inline images");
  if (roleCounts.social < 1) errors.push("preview requires one social image");
  if (roleCounts.inline >= 2 && inlineOriginals.size < 2) errors.push("inline images must use distinct originals");
  if ((data.bodyMediaLayout ?? "gallery") === "inline") {
    const body = typeof entry.body === "string" ? entry.body : "";
    for (const item of media.filter((candidate) => candidate.placement === "body")) {
      if (![item.src, item.alt, item.caption].every((value) => body.includes(value))) {
        errors.push(`inline preview media must appear in the article body: ${item.mediaAssetId}`);
      }
    }
  }
  for (const plantId of data.relatedPlantIds ?? []) {
    if (!publicPlantIds.has(plantId)) errors.push(`unknown public relatedPlantId ${plantId}`);
  }
  if (!hasText(data.coverMediaAssetId) || !media.some((item) => item.mediaAssetId === data.coverMediaAssetId && item.placement === "cover")) {
    errors.push("preview cover media is missing");
  }

  const computedManifestHash = publicationMediaManifestHash(entry);
  if (computedManifestHash !== expected.manifestHash) errors.push("computed media manifest hash does not match preview configuration");

  if (errors.length > 0) throw new Error(`Draft preview validation failed:\n- ${errors.join("\n- ")}`);
  return entry;
}

export function validatePreviewMediaFiles(entry, publicRoot) {
  const root = resolve(publicRoot);
  for (const item of entry?.data?.articleMedia ?? []) {
    const relativePath = item.src.startsWith("/") ? item.src.slice(1) : item.src;
    const filePath = resolve(root, relativePath);
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
      throw new Error(`Draft preview media escapes public root: ${item.mediaAssetId}`);
    }
    let bytes;
    try {
      bytes = readFileSync(filePath);
    } catch {
      throw new Error(`Draft preview media file is missing: ${item.mediaAssetId}`);
    }
    const actualChecksum = createHash("sha256").update(bytes).digest("hex");
    if (actualChecksum !== item.checksum) {
      throw new Error(`Draft preview media checksum mismatch: ${item.mediaAssetId}`);
    }
  }
}

export function validatePublicationEntries(entries, publicPlantIds = new Set()) {
  const errors = [];
  const publicationIds = new Map();
  const slugs = new Map();

  entries.forEach((entry, index) => {
    const data = entry?.data ?? {};
    const label = publicationLabel(entry, index);
    const publicationId = hasText(data.publicationId) ? data.publicationId.trim() : "";
    const slug = hasText(data.slug) ? data.slug.trim() : "";
    const mediaItems = Array.isArray(data.articleMedia) ? data.articleMedia : [];
    const relatedPlantIds = Array.isArray(data.relatedPlantIds) ? data.relatedPlantIds : [];
    const relatedPlantCards = Array.isArray(data.relatedPlantCards) ? data.relatedPlantCards : [];
    const mediaIds = new Map();
    const relatedPlantCardIds = new Map();
    const relatedPlantCardMediaIds = new Map();

    if (!publicationId) {
      errors.push(`${label}: missing publicationId`);
    } else if (publicationIds.has(publicationId)) {
      errors.push(`${label}: duplicate publicationId ${publicationId}`);
    } else {
      publicationIds.set(publicationId, label);
    }

    if (!slug) {
      errors.push(`${label}: missing slug`);
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      errors.push(`${label}: malformed slug ${slug}`);
    } else if (slugs.has(slug)) {
      errors.push(`${label}: duplicate slug ${slug}`);
    } else {
      slugs.set(slug, label);
    }

    if (!PUBLICATION_STATUSES.has(data.publicationStatus)) {
      errors.push(`${label}: unsupported publicationStatus`);
    }
    if (!MEDIA_RIGHTS_STATUSES.has(data.mediaRightsStatus)) {
      errors.push(`${label}: unsupported mediaRightsStatus`);
    }
    if (!BODY_MEDIA_LAYOUTS.has(data.bodyMediaLayout ?? "gallery")) {
      errors.push(`${label}: unsupported bodyMediaLayout`);
    }

    for (const field of ["title", "excerpt", "category"]) {
      if (!hasText(data[field])) errors.push(`${label}: missing ${field}`);
    }

    if (data.coverImage && !hasText(data.coverImageAlt)) {
      errors.push(`${label}: coverImageAlt is required when coverImage is set`);
    }

    if (!Array.isArray(data.relatedPlantIds)) {
      errors.push(`${label}: relatedPlantIds must be an array`);
    }

    if (!Array.isArray(mediaItems)) {
      errors.push(`${label}: articleMedia must be an array`);
    }
    if (!Array.isArray(relatedPlantCards)) {
      errors.push(`${label}: relatedPlantCards must be an array`);
    }

    for (const item of mediaItems) {
      if (!hasText(item.mediaAssetId)) {
        errors.push(`${label}: articleMedia item is missing mediaAssetId`);
        continue;
      }
      if (mediaIds.has(item.mediaAssetId)) {
        errors.push(`${label}: duplicate article media ${item.mediaAssetId}`);
      } else {
        mediaIds.set(item.mediaAssetId, item);
      }
      if (!MEDIA_SOURCE_TYPES.has(item.sourceType)) {
        errors.push(`${label}: unsupported media sourceType ${item.sourceType}`);
      }
      if (!MEDIA_PLACEMENTS.has(item.placement)) {
        errors.push(`${label}: unsupported media placement ${item.placement}`);
      }
      if (!MEDIA_RIGHTS_STATUSES.has(item.rightsStatus)) {
        errors.push(`${label}: unsupported media rightsStatus ${item.rightsStatus}`);
      }
      if (!hasText(item.src)) errors.push(`${label}: articleMedia ${item.mediaAssetId} missing src`);
      if (!hasText(item.alt)) errors.push(`${label}: articleMedia ${item.mediaAssetId} missing alt`);
      if (!hasText(item.caption)) errors.push(`${label}: articleMedia ${item.mediaAssetId} missing caption`);
    }

    for (const card of relatedPlantCards) {
      if (!hasText(card.mediaAssetId)) {
        errors.push(`${label}: related plant card is missing mediaAssetId`);
      } else if (relatedPlantCardMediaIds.has(card.mediaAssetId)) {
        errors.push(`${label}: duplicate related plant card media ${card.mediaAssetId}`);
      } else {
        relatedPlantCardMediaIds.set(card.mediaAssetId, card);
      }
      if (!hasText(card.plantId)) {
        errors.push(`${label}: related plant card is missing plantId`);
      } else if (relatedPlantCardIds.has(card.plantId)) {
        errors.push(`${label}: duplicate related plant card ${card.plantId}`);
      } else {
        relatedPlantCardIds.set(card.plantId, card);
      }
      if (!MEDIA_SOURCE_TYPES.has(card.sourceType)) {
        errors.push(`${label}: unsupported related plant card sourceType ${card.sourceType}`);
      }
      if (!MEDIA_RIGHTS_STATUSES.has(card.rightsStatus)) {
        errors.push(`${label}: unsupported related plant card rightsStatus ${card.rightsStatus}`);
      }
      if (!hasText(card.src)) errors.push(`${label}: related plant card ${card.plantId} missing src`);
      if (!hasText(card.alt)) errors.push(`${label}: related plant card ${card.plantId} missing alt`);
      if (hasText(card.plantId) && !(data.relatedPlantIds ?? []).includes(card.plantId)) {
        errors.push(`${label}: related plant card ${card.plantId} is not listed in relatedPlantIds`);
      }
    }

    if (hasText(data.coverMediaAssetId) && !mediaIds.has(data.coverMediaAssetId)) {
      errors.push(`${label}: coverMediaAssetId ${data.coverMediaAssetId} not found in articleMedia`);
    }

    if (!isPublicPublication(entry)) return;

    if (!(data.publishedAt instanceof Date) || Number.isNaN(data.publishedAt.valueOf())) {
      errors.push(`${label}: approved publication requires publishedAt`);
    }
    if (!hasText(data.seoTitle)) errors.push(`${label}: approved publication requires seoTitle`);
    if (!hasText(data.seoDescription)) errors.push(`${label}: approved publication requires seoDescription`);
    if (!hasText(data.approvedRevision)) errors.push(`${label}: approved publication requires approvedRevision`);
    if (!hasText(data.approvedPreviewHash)) errors.push(`${label}: approved publication requires approvedPreviewHash`);
    if (!hasText(data.language)) errors.push(`${label}: approved publication requires language`);
    if (!hasText(entry.body)) errors.push(`${label}: approved publication requires body`);
    if (relatedPlantIds.length === 0) {
      errors.push(`${label}: approved publication requires at least one related public plant card or link`);
    }

    const { minImages, minControlledImages, minBodyImages } = mediaThresholds(entry);
    const uniqueMedia = uniqueMediaItems(data);
    const coverMediaId = hasText(data.coverMediaAssetId) ? data.coverMediaAssetId.trim() : "";
    const coverMedia = coverMediaId ? uniqueMedia.get(coverMediaId) : null;
    const controlledMediaCount = [...uniqueMedia.values()].filter(
      (item) => ["own", "generated"].includes(item.sourceType) && item.src.startsWith("/images/")
    ).length;
    const bodyMediaCount = [...uniqueMedia.values()].filter((item) => item.placement === "body").length;

    if ((data.bodyMediaLayout ?? "gallery") === "inline") {
      const body = typeof entry.body === "string" ? entry.body : "";
      for (const item of uniqueMedia.values()) {
        if (item.placement !== "body") continue;
        if (![item.src, item.alt, item.caption].every((value) => body.includes(value))) {
          errors.push(`${label}: inline body media ${item.mediaAssetId} must appear in the article with matching src, alt, and caption`);
        }
      }
    }

    if (!coverMediaId) {
      errors.push(`${label}: approved publication requires coverMediaAssetId`);
    }
    if (!hasText(data.coverImage)) {
      errors.push(`${label}: approved publication requires coverImage`);
    }
    if (!hasText(data.coverImageAlt)) {
      errors.push(`${label}: approved publication requires coverImageAlt`);
    }
    if (!coverMedia) {
      errors.push(`${label}: approved publication cover media is missing`);
    } else {
      if (coverMedia.placement !== "cover") {
        errors.push(`${label}: cover media must use placement=cover`);
      }
      if (coverMedia.sourceType === "unknown") {
        errors.push(`${label}: cover media cannot use sourceType=unknown`);
      }
      if (coverMedia.rightsStatus !== "approved") {
        errors.push(`${label}: cover media must have rightsStatus=approved`);
      }
      if (hasText(data.coverImage) && data.coverImage !== coverMedia.src) {
        errors.push(`${label}: coverImage must match cover media src`);
      }
      if (hasText(data.coverImageAlt) && data.coverImageAlt !== coverMedia.alt) {
        errors.push(`${label}: coverImageAlt must match cover media alt`);
      }
    }

    if (uniqueMedia.size < minImages) {
      errors.push(`${label}: approved publication requires at least ${minImages} unique images`);
    }
    if (controlledMediaCount < minControlledImages) {
      errors.push(
        `${label}: approved publication requires at least ${minControlledImages} controlled images (own/generated site-local visualizations)`
      );
    }
    if (bodyMediaCount < minBodyImages) {
      errors.push(`${label}: approved publication requires at least ${minBodyImages} body images`);
    }

    for (const item of uniqueMedia.values()) {
      if (item.sourceType === "unknown") {
        errors.push(`${label}: approved publication cannot include unknown media source`);
      }
      if (item.rightsStatus !== "approved") {
        errors.push(`${label}: approved publication media ${item.mediaAssetId} must have rightsStatus=approved`);
      }
    }

    if (relatedPlantCards.length > 0) {
      for (const plantId of relatedPlantIds) {
        if (!relatedPlantCardIds.has(plantId)) {
          errors.push(`${label}: approved publication is missing related plant card ${plantId}`);
        }
      }
      for (const card of relatedPlantCards) {
        if (card.sourceType === "unknown") {
          errors.push(`${label}: approved publication cannot include unknown related plant card source`);
        }
        if (card.rightsStatus !== "approved") {
          errors.push(`${label}: related plant card ${card.plantId} must have rightsStatus=approved`);
        }
      }
    }

    for (const plantId of relatedPlantIds) {
      if (!publicPlantIds.has(plantId)) {
        errors.push(`${label}: unknown public relatedPlantId ${plantId}`);
      }
    }
  });

  if (errors.length > 0) {
    throw new Error(`Publication validation failed:\n- ${errors.join("\n- ")}`);
  }

  return entries;
}

export function selectPublicPublications(entries, publicPlantIds = new Set()) {
  validatePublicationEntries(entries, publicPlantIds);
  return entries
    .filter(isPublicPublication)
    .sort((left, right) => {
      const dateDifference = right.data.publishedAt.valueOf() - left.data.publishedAt.valueOf();
      return dateDifference || left.data.slug.localeCompare(right.data.slug, "uk");
    });
}
