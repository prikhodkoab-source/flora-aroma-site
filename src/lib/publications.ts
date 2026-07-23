import { getCollection, type CollectionEntry } from "astro:content";
import { getProducts } from "./products";
import { selectPublicPublications } from "./publication-policy.mjs";

export type PublicPublication = CollectionEntry<"publications">;
export type PublicationMediaItem = PublicPublication["data"]["articleMedia"][number];

const publicationContentFiles = import.meta.glob("../content/publications/**/*.{md,mdx}");

export async function getApprovedPublications(): Promise<PublicPublication[]> {
  if (Object.keys(publicationContentFiles).length === 0) return [];

  const entries = await getCollection("publications");
  const publicPlantIds = new Set(getProducts().map((product) => product.plant_id));

  return selectPublicPublications(entries, publicPlantIds) as PublicPublication[];
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
