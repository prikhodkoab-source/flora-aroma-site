# Website D2 Source-Backed Attributes - 2026-06-12

## Scope

Added structured plant-selection fields for the 40 public products in `data/products.csv`.

Fields added:

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

## Source Rule

Values were filled from the source families already attached to product rows and checked against authoritative horticultural references:

- Royal Horticultural Society plant profiles and growing guides.
- Missouri Botanical Garden Plant Finder profiles.
- NC State Extension Gardener Plant Toolbox profiles.
- Plants of the World Online / Kew for taxonomic grounding.

The values are public selection attributes, not internal production instructions and not stock promises.

## Normalization Choices

- Sun values use stable tokens: `full_sun`, `part_sun`, `shade`.
- Moisture values use stable tokens: `dry`, `medium`, `moist`.
- Flowering months use two-digit month tokens, for example `06;07;08`.
- Use cases and selection tags use semicolon-separated tokens so the static catalog can filter without a database.
- Height is stored as public range fields in centimeters.

## Caution

Several tender or annual crops have hardiness expressed as `annual`, `tender annual`, or `tender perennial / annual` rather than a strict USDA perennial zone because that is the honest customer-facing status for local sales.

The fields should be reviewed after local field observations and sales feedback accumulate.

## Website Safety Boundary

This change does not publish exact stock, does not create a reserve, does not accept payment, and does not write to Flora accounting data.
