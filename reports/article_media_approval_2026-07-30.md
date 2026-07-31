# Article media approval - 2026-07-30

- Publication ID: `WC-CR-20260712-AROMATIC-BORDER`
- Slug: `aromatnyi-bordiur-priani-zapashni-roslyny`
- Substantive article content changed: no
- Operator media approval: explicit in the 2026-07-30 integration task
- Publication status: `approved`
- Media rights status: `approved`

## Approved media

| Media asset | Placement | Public path | Source type | SHA-256 |
| --- | --- | --- | --- | --- |
| `PHOTO-0334` | cover | `/images/plants/local/plant-0051-format-02.jpg` | own | `ba78cc87cb196b1502cd8a080c88cea0fed60cadbf9c3fe9263464982bfaf69e` |
| `PHOTO-0329` | body | `/images/plants/local/plant-0074-format-01.jpg` | own | `8104e0604d611f9b792e915418d1a05a86f61ba13ef9bf6633b8109020147e0f` |
| `PHOTO-0333` | body | `/images/plants/local/plant-0077-format-02.jpg` | own | `e6091ad539063eebd7d93f55b8153ffa5a0bc78e32d126f36b950e2ca8a83631` |

All three files are operator-supplied Flora & Aroma media. Publication tests verify
the exact hashes and fail closed if any file changes.

## Verification

- `npm run test:publications`: passed
- `npm run test:site-order`: passed
- `npm run test:catalog-filters`: passed
- `npm run build`: passed, approved article route generated
- `npm run verify`: passed
- Desktop article preview: HTTP 200, three media assets loaded, no broken images
- Mobile article preview: HTTP 200, three media assets loaded, no broken images
- Publications index: article listed on desktop and mobile
- Sitemap: canonical `/publications/.../` route included
- Legacy root route: Cloudflare Pages 301 redirect added

Screenshots:

- `reports/article-media-article-desktop.png`
- `reports/article-media-article-mobile.png`
- `reports/article-media-index-desktop.png`
- `reports/article-media-index-mobile.png`

No catalog, stock, price, order, Telegram, or Meta publication data was changed.
