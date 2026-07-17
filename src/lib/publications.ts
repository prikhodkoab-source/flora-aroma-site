import { getCollection, type CollectionEntry } from "astro:content";
import { getProducts } from "./products";
import { selectPublicPublications } from "./publication-policy.mjs";

export type PublicPublication = CollectionEntry<"publications">;

const publicationContentFiles = import.meta.glob("../content/publications/**/*.{md,mdx}");

export async function getApprovedPublications(): Promise<PublicPublication[]> {
  if (Object.keys(publicationContentFiles).length === 0) return [];

  const entries = await getCollection("publications");
  const publicPlantIds = new Set(getProducts().map((product) => product.plant_id));

  return selectPublicPublications(entries, publicPlantIds) as PublicPublication[];
}
