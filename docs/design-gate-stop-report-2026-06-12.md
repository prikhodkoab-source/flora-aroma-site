# Website Design Gate Stop Report - 2026-06-12

## Applied Now

- Added Design Gates D1-D3 to the project roadmap.
- Added real local nursery photos to the website as optimized public assets.
- Rebuilt the homepage hero around a real nursery production image.
- Added homepage trust points and clearer catalog/order CTAs.
- Converted `/catalog/` from table-first to card-first browsing.
- Kept the table view in `/price/`, where plant IDs are useful for operator/customer reference.
- Strengthened product pages with a commercial order panel: format, price, public availability wording, attributes, and CTA.
- Added nursery media blocks to `Як замовити` and `Контакти`.

## Stops

- Full plant-condition filters are blocked because `data/products.csv` does not yet contain structured fields for all products: sun, water/moisture, height, flowering period, flower color, spacing, and use-case tags.
- Attribute chips are partial: category, container, and USDA zone can be shown now; true sun/water/height/flowering chips need structured catalog enrichment.
- Downloadable PDF price is not implemented in this pass; it should be generated from the same approved product export to avoid price drift.
- Telegram/Viber public buttons are not added because official public contact links are not confirmed.
- Some product cards still need exact local photos, especially `Lavandula latifolia`, `Agastache foeniculum`, `Nepeta cataria`, and `Ruta graveolens`.

## Data Safety

- No stock, order, reservation, payment, or delivery data was changed.
- The site still uses public availability wording and does not publish exact internal stock.
- Website requests remain outside live write workflows and must continue through draft/order preview rules.
