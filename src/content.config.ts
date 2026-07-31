import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const publicationStatuses = ["draft", "pending_operator_review", "approved", "suspended", "archived"] as const;
const mediaRightsStatuses = ["pending_operator_review", "approved", "restricted", "rejected", "expired"] as const;
const mediaSourceTypes = ["own", "supplier", "generated", "unknown"] as const;
const mediaPlacements = ["cover", "body"] as const;

const articleMediaItem = z.object({
  mediaAssetId: z.string().trim().min(1),
  src: z.string().trim().min(1),
  alt: z.string().trim().min(1),
  caption: z.string().trim().min(1),
  sourceType: z.enum(mediaSourceTypes),
  placement: z.enum(mediaPlacements),
  sortOrder: z.number().int().nonnegative(),
  rightsStatus: z.enum(mediaRightsStatuses)
});

const relatedPlantCardItem = z.object({
  mediaAssetId: z.string().trim().min(1),
  plantId: z.string().trim().regex(/^PLANT-\d{4}$/),
  src: z.string().trim().min(1),
  alt: z.string().trim().min(1),
  sourceType: z.enum(mediaSourceTypes),
  rightsStatus: z.enum(mediaRightsStatuses)
});

const publications = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/content/publications",
    retainBody: true
  }),
  schema: z
    .object({
      publicationId: z.string().trim().min(1),
      approvedRevision: z.string().trim().min(1).optional(),
      approvedPreviewHash: z.string().trim().min(1).optional(),
      slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      language: z.string().trim().min(2).optional(),
      title: z.string().trim().min(1),
      excerpt: z.string().trim().min(1),
      category: z.string().trim().min(1),
      coverImage: z.string().trim().min(1).optional(),
      coverImageAlt: z.string().trim().min(1).optional(),
      coverMediaAssetId: z.string().trim().min(1).optional(),
      articleMedia: z.array(articleMediaItem).default([]),
      bodyMediaLayout: z.enum(["gallery", "inline"]).default("gallery"),
      relatedPlantIds: z.array(z.string().trim().regex(/^PLANT-\d{4}$/)).default([]),
      relatedPlantCards: z.array(relatedPlantCardItem).default([]),
      seoTitle: z.string().trim().min(1).optional(),
      seoDescription: z.string().trim().min(1).optional(),
      publishedAt: z.coerce.date().optional(),
      updatedAt: z.coerce.date().optional(),
      publicationStatus: z.enum(publicationStatuses),
      mediaRightsStatus: z.enum(mediaRightsStatuses)
    })
    .superRefine((publication, context) => {
      if (publication.coverImage && !publication.coverImageAlt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["coverImageAlt"],
          message: "coverImageAlt is required when coverImage is set"
        });
      }
    })
});

export const collections = { publications };
