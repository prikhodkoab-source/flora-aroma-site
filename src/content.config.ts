import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const publicationStatuses = ["draft", "pending_operator_review", "approved", "suspended", "archived"] as const;
const mediaRightsStatuses = ["pending_operator_review", "approved", "restricted", "rejected", "expired"] as const;
const mediaSourceTypes = ["own", "supplier", "generated", "unknown"] as const;
const mediaPlacements = ["cover", "body", "social"] as const;

const articleMediaItem = z.object({
  mediaAssetId: z.string().trim().min(1),
  src: z.string().trim().min(1),
  alt: z.string().trim().min(1),
  caption: z.string().trim().min(1),
  sourceType: z.enum(mediaSourceTypes),
  placement: z.enum(mediaPlacements),
  sortOrder: z.number().int().nonnegative(),
  rightsStatus: z.enum(mediaRightsStatuses),
  checksum: z.string().trim().regex(/^[0-9a-f]{64}$/).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
  isAiGenerated: z.boolean().optional(),
  originalMediaAssetId: z.string().trim().min(1).optional(),
  derivativeSpec: z.string().trim().optional(),
  relatedPlantIds: z.array(z.string().trim().regex(/^PLANT-\d{4}$/)).default([]),
  targetChannel: z.enum(["site_blog", "facebook"]).optional(),
  approvalStatus: z.enum(["pending_operator_review", "approved", "rejected", "stale"]).optional()
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
      draftRevision: z.string().trim().regex(/^[0-9a-f]{16}$/).optional(),
      mediaManifestHash: z.string().trim().regex(/^[0-9a-f]{64}$/).optional(),
      mediaGateStatus: z.enum(["blocked_waiting_for_photography", "ready_for_operator_review"]).optional(),
      mediaApprovalStatus: z.enum(["pending_operator_review", "blocked_waiting_for_photography"]).optional(),
      approvedRevision: z.string().trim().min(1).optional(),
      approvedPreviewHash: z.string().trim().min(1).optional(),
      slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      language: z.string().trim().min(2).optional(),
      title: z.string().trim().min(1),
      subtitle: z.string().trim().min(1).optional(),
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
