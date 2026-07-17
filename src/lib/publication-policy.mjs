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

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function publicationLabel(entry, index) {
  return entry?.data?.publicationId || entry?.id || `entry-${index + 1}`;
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

    if (!isPublicPublication(entry)) return;

    if (!(data.publishedAt instanceof Date) || Number.isNaN(data.publishedAt.valueOf())) {
      errors.push(`${label}: approved publication requires publishedAt`);
    }
    if (!hasText(data.seoTitle)) errors.push(`${label}: approved publication requires seoTitle`);
    if (!hasText(data.seoDescription)) errors.push(`${label}: approved publication requires seoDescription`);
    if (!hasText(entry.body)) errors.push(`${label}: approved publication requires body`);

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
