import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const publicationStatuses = ["draft", "pending_operator_review", "approved", "suspended", "archived"] as const;
const mediaRightsStatuses = ["pending_operator_review", "approved", "restricted", "rejected", "expired"] as const;

const publications = defineCollection({
  loader: glob({
    pattern: "**/*.{md,mdx}",
    base: "./src/content/publications",
    retainBody: true
  }),
  schema: z
    .object({
      publicationId: z.string().trim().min(1),
      slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      title: z.string().trim().min(1),
      excerpt: z.string().trim().min(1),
      category: z.string().trim().min(1),
      coverImage: z.string().trim().min(1).optional(),
      coverImageAlt: z.string().trim().min(1).optional(),
      relatedPlantIds: z.array(z.string().trim().regex(/^PLANT-\d{4}$/)).default([]),
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
