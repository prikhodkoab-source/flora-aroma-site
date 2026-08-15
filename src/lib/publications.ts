import { getCollection, type CollectionEntry } from "astro:content";
import { fileURLToPath } from "node:url";
import { getProducts } from "./products";
import {
  selectDraftPreviewPublication,
  selectPublicPublications,
  validatePreviewMediaFiles
} from "./publication-policy.mjs";

export type PublicPublication = CollectionEntry<"publications">;
export type PublicationMediaItem = PublicPublication["data"]["articleMedia"][number];

const publicationContentFiles = import.meta.glob("../content/publications/**/*.{md,mdx}");
const publicRoot = fileURLToPath(new URL("../../public/", import.meta.url));

export async function getApprovedPublications(): Promise<PublicPublication[]> {
  if (Object.keys(publicationContentFiles).length === 0) return [];

  const entries = await getCollection("publications");
  const publicPlantIds = new Set(getProducts().map((product) => product.plant_id));

  return selectPublicPublications(entries, publicPlantIds) as PublicPublication[];
}

export async function getDraftPreviewPublication(): Promise<PublicPublication | null> {
  const enabled = process.env.PUBLICATION_PREVIEW_MODE === "draft";
  if (!enabled) return null;

  const entries = await getCollection("publications");
  const publicPlantIds = new Set(getProducts().map((product) => product.plant_id));
  const entry = selectDraftPreviewPublication(entries, publicPlantIds, {
    enabled,
    contentId: process.env.PUBLICATION_PREVIEW_CONTENT_ID,
    contentRevision: process.env.PUBLICATION_PREVIEW_REVISION,
    manifestHash: process.env.PUBLICATION_PREVIEW_MANIFEST_HASH
  }) as PublicPublication;
  validatePreviewMediaFiles(entry, publicRoot);
  return entry;
}

export function getCoverMedia(publication: PublicPublication): PublicationMediaItem | undefined {
  const coverMediaId = publication.data.coverMediaAssetId;
  if (!coverMediaId) return undefined;
  return publication.data.articleMedia.find((item) => item.mediaAssetId === coverMediaId);
}

export function getBodyMedia(publication: PublicPublication): PublicationMediaItem[] {
  return publication.data.articleMedia
    .filter((item) => item.placement === "body")
    .sort((left, right) => left.sortOrder - right.sortOrder);
}
