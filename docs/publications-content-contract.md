# Publications content contract

## Purpose

The repository site is a read-only consumer of approved publication exports. It does not approve articles, media rights or publication actions.

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
coverImage: /images/publications/approved-image.jpg # optional
coverImageAlt: Approved accessible description # required with coverImage
relatedPlantIds: []
seoTitle: Search title
seoDescription: Search description
publishedAt: 2026-07-17T00:00:00Z
updatedAt: 2026-07-17T00:00:00Z # optional
publicationStatus: approved
mediaRightsStatus: approved
```

No example file is stored in the collection because a valid-looking example could be mistaken for approved public content.

## Stable identity

- `publicationId` is permanent and must not be reassigned.
- `slug` is unique and stable because it defines `/publications/<slug>/`.
- A slug change requires an approved redirect plan.
- `relatedPlantIds` may be empty. Every populated ID must exist in the current public product catalog.

## Allowed statuses

```text
publicationStatus=draft|pending_operator_review|approved|suspended|archived
mediaRightsStatus=pending_operator_review|approved|restricted|rejected|expired
```

The public build selects only:

```text
publicationStatus=approved
AND
mediaRightsStatus=approved
```

Missing fields never mean approved. Draft, pending, suspended, archived, restricted, rejected and expired records do not generate public routes or sitemap entries.

## Fail-closed validation

For every collection entry the build validates:

- non-empty stable `publicationId`;
- unique `publicationId` and `slug`;
- supported statuses;
- title, excerpt and category;
- `coverImageAlt` whenever `coverImage` is present;
- valid `relatedPlantIds` array.

For a public `approved + approved` entry it additionally requires:

- non-empty Markdown body;
- `publishedAt`;
- `seoTitle` and `seoDescription`;
- every related plant to exist in the public site catalog.

Validation errors stop the build. Internal notes, operator comments, source dumps, credentials, customer data, exact stock quantities and internal costs are outside the public contract and must not be exported.

## Media rights

`mediaRightsStatus=approved` must come from future canonical media-rights evidence. A local file, external URL, generated image or existing use on another channel is not proof by itself. The site never promotes a missing or unknown media status to approved.

Cover images are rendered only for public entries that passed the approved media gate. Attribution and license presentation, when required, must be included by the future exporter from canonical evidence.

## Operator boundary

Publication files must never be manually changed to `approved` as a shortcut. The future WebPublisher exporter may generate approved site entries only from the canonical operator-approved revision and approved media evidence.

Pending `WebsiteContent`, social drafts and `WebsitePublishQueue` rows are not imported automatically. The website remains a consumer, not the approval system.

## Deployment boundary

An approved export still requires:

1. deterministic output and drift verification;
2. successful Astro build and publication tests;
3. branch preview verification;
4. operator-approved production publication.

Writing a content file does not by itself authorize production deployment.
