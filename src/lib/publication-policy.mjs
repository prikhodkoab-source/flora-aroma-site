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
export const MEDIA_PLACEMENTS = new Set(["cover", "body"]);

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
    ? { minImages: 5, minOwnImages: 3, minBodyImages: 4 }
    : { minImages: 3, minOwnImages: 2, minBodyImages: 2 };
}

export function isPublicPublication(entry) {
  return entry?.data?.publicationStatus === "approved" && entry?.data?.mediaRightsStatus === "approved";
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
    const mediaIds = new Map();

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

    const { minImages, minOwnImages, minBodyImages } = mediaThresholds(entry);
    const uniqueMedia = uniqueMediaItems(data);
    const coverMediaId = hasText(data.coverMediaAssetId) ? data.coverMediaAssetId.trim() : "";
    const coverMedia = coverMediaId ? uniqueMedia.get(coverMediaId) : null;
    const ownMediaCount = [...uniqueMedia.values()].filter((item) => item.sourceType === "own").length;
    const bodyMediaCount = [...uniqueMedia.values()].filter((item) => item.placement === "body").length;

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
    if (ownMediaCount < minOwnImages) {
      errors.push(`${label}: approved publication requires at least ${minOwnImages} own images`);
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

    for (const plantId of data.relatedPlantIds ?? []) {
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
