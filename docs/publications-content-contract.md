# Publications content contract

## Purpose

The repository site is a read-only consumer of approved publication exports. It does not approve articles, media rights, or publication actions.

Target flow:

```text
WebPublisher
-> operator review
-> canonical approval
-> deterministic export
-> site content collection
-> Astro build
-> preview verification
-> production publish
```

The current implementation starts at the site content collection boundary. Canonical WebPublisher integration remains a separate task after publication and media schemas are approved.

## Expected output

The future deterministic exporter writes one Markdown or MDX file per publication to:

```text
src/content/publications/<slug>.md
```

The Markdown body is the `body` field. Public frontmatter contract:

```yaml
publicationId: stable-publication-id
slug: stable-public-slug
title: Public title
excerpt: Public introduction
category: Public category
coverImage: /images/publications/approved-image.jpg
coverImageAlt: Approved accessible description
coverMediaAssetId: MEDIA-ASSET-0001
bodyMediaLayout: gallery
articleMedia:
  - mediaAssetId: MEDIA-ASSET-0001
    src: /images/publications/approved-image.jpg
    alt: Approved accessible description
    caption: Public caption
    sourceType: own
    placement: cover
    sortOrder: 0
    rightsStatus: approved
  - mediaAssetId: MEDIA-ASSET-0002
    src: /images/publications/approved-detail.jpg
    alt: Supporting photo
    caption: Public caption
    sourceType: own
    placement: body
    sortOrder: 10
    rightsStatus: approved
relatedPlantIds:
  - PLANT-0001
relatedPlantCards:
  - mediaAssetId: P1-CARD-PLANT-0001
    plantId: PLANT-0001
    src: /images/plant-cards/plant-0001-p1.png
    alt: Approved plant card
    sourceType: generated
    rightsStatus: approved
seoTitle: Search title
seoDescription: Search description
publishedAt: 2026-07-17T00:00:00Z
updatedAt: 2026-07-17T00:00:00Z
publicationStatus: approved
mediaRightsStatus: approved
```

No example file is stored as an approved public entry unless it has passed operator review and media approval. A valid-looking draft must not be mistaken for approved public content.

## Stable identity

- `publicationId` is permanent and must not be reassigned.
- `slug` is unique and stable because it defines the article URL.
- A slug change requires an approved redirect plan.
- `coverMediaAssetId` must reference one item in `articleMedia`.
- `bodyMediaLayout=gallery` renders approved body media after the Markdown body; `bodyMediaLayout=inline` requires every body media item to appear in the body with the exact registered `src`, `alt`, and `caption`.
- An approved publication must have at least one `relatedPlantIds` value, and every populated ID must exist in the current public product catalog.
- When `relatedPlantCards` is populated, every card must reference one `relatedPlantIds` value and use a unique `plantId` and `mediaAssetId`.

## Allowed statuses

```text
publicationStatus=draft|pending_operator_review|approved|suspended|archived
mediaRightsStatus=pending_operator_review|approved|restricted|rejected|expired
articleMedia[].rightsStatus=pending_operator_review|approved|restricted|rejected|expired
articleMedia[].sourceType=own|supplier|generated|unknown
articleMedia[].placement=cover|body
relatedPlantCards[].rightsStatus=pending_operator_review|approved|restricted|rejected|expired
relatedPlantCards[].sourceType=own|supplier|generated|unknown
```

The public build selects only:

```text
publicationStatus=approved
AND
mediaRightsStatus=approved
```

Missing fields never mean approved. Draft, pending, suspended, archived, restricted, rejected, and expired records do not generate public routes or sitemap entries.

## Fail-closed validation

For every collection entry the build validates:

- non-empty stable `publicationId`;
- unique `publicationId` and `slug`;
- supported statuses;
- title, excerpt, and category;
- `coverImageAlt` whenever `coverImage` is present;
- valid `relatedPlantIds` array;
- `articleMedia` unique by `mediaAssetId`;
- every media object has `src`, `alt`, `caption`, `sourceType`, `placement`, `sortOrder`, and `rightsStatus`.
- every related plant card has `mediaAssetId`, `plantId`, `src`, `alt`, `sourceType`, and `rightsStatus`.

For a public `approved + approved` entry it additionally requires:

- non-empty Markdown body;
- `publishedAt`;
- `seoTitle` and `seoDescription`;
- `approvedRevision`, `approvedPreviewHash`, and `language`;
- `coverMediaAssetId`;
- `coverImage` and `coverImageAlt`;
- cover image path and alt must match the approved cover media item;
- inline body media must keep the exact registered path, accessible text, and caption in the article body;
- all media items must have `rightsStatus=approved`;
- no media item may use `sourceType=unknown`;
- a short article (up to 1200 words) must have at least 3 unique approved images, at least 2 controlled (`own` or `generated`), and at least 2 body images;
- a long article (over 1200 words) must have at least 5 unique approved images, at least 3 controlled (`own` or `generated`), and at least 4 body images;
- duplicate `mediaAssetId` values do not increase image counts;
- every approved article must include generated or copied site-local visualizations that satisfy the controlled-media threshold;
- every approved article must have at least one related public plant card or link;
- every related plant must exist in the public site catalog so the renderer can link to `/plants/<slug>/`;
- if `relatedPlantCards` is used, every related plant must have exactly one approved non-unknown card; otherwise the renderer must show a link-only plant entry and must not invent a placeholder image.

Validation errors stop the build. Internal notes, operator comments, source dumps, credentials, customer data, exact stock quantities, and internal costs are outside the public contract and must not be exported.

## Media rules

- A greenhouse placeholder cannot be reused as the cover for an unrelated article about a plant, pollinators, or a naturalistic planting theme.
- `generated` media may count as controlled media only after exact operator approval and must be described publicly as an illustration or AI visualization.
- Controlled generated or copied (`own`) visualizations count only when they are stored as site-local `/images/` assets.
- Generated composition images do not replace real product evidence; related plant cards must remain based on approved plant media and exact Flora catalog identity.
- `supplier` media may be approved, but it does not count toward the minimum controlled-media requirement.
- `unknown` media is forbidden for public articles.
- Every public image must resolve through an approved media registry item and keep a stable `mediaAssetId`.

## Operator boundary

Publication files must never be manually changed to `approved` as a shortcut. The future WebPublisher exporter may generate approved site entries only from the canonical operator-approved revision and approved media evidence.

Pending `WebsiteContent`, social drafts, and `WebsitePublishQueue` rows are not imported automatically. The website remains a consumer, not the approval system.

## Deployment boundary

An approved export still requires:

1. deterministic output and drift verification;
2. successful Astro build and publication tests;
3. branch preview verification;
4. operator-approved production publication.

Writing a content file does not by itself authorize production deployment.
