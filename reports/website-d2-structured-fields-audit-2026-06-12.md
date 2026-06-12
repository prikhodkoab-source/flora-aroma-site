# Website D2 Structured Fields Audit - 2026-06-12

## Status

Website Design Gate D2 is blocked on structured catalog fields.

Current public export: `data/products.csv`.

Current headers:

- `plant_id`
- `name_uk`
- `latin_name`
- `category`
- `container`
- `price_uah`
- `unit`
- `availability_status`
- `summary`
- `ecology_text`
- `agrotechnics_text`
- `use_text`
- `full_description`
- `content_status`
- `source_names`
- `source_urls`
- `source_confidence`
- `source_note`
- `seo_title`
- `seo_description`
- `image_path`

## Missing D2 Fields

Required before customer-facing filters:

- `sun_exposure`
- `moisture`
- `height_cm_min`
- `height_cm_max`
- `flowering_months`
- `flower_color`
- `winter_hardiness`
- `use_cases`
- `spacing_cm`
- `selection_tags`

## Safety Rule

These fields must be source-backed or operator-approved. Do not infer them only from marketing text, AI text, or memory.

Allowed sources:

- authoritative botanical or horticultural references;
- existing Flora normalized data if the field is already confirmed there;
- explicit operator approval.

## Next Work

1. Create a structured enrichment table for all 40 public products.
2. Fill fields from source-backed plant cards.
3. Mark uncertain values as `needs_review`.
4. Only after all public products have safe values, add catalog filters and attribute chips.

## Public-Site Boundary

D2 must not publish exact stock, reserve status, delivery promises, discounts, or internal accounting fields.
