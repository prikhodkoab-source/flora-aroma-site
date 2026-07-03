# Tilda exact clone report

Branch: `feature/tilda-style-redesign`

Preview URL: `https://feature-tilda-style-redesign.flora-aroma-site.pages.dev`

Local verification URL used: `http://127.0.0.1:4323/`

## Copied pages and blocks

- Home `/`: Tilda cover hero, centered heading, two pill CTA buttons, down arrow, about text, "Як ми вирощуємо", "Що ми вирощуємо", "Як замовити", static Tilda-like footer strip.
- Shop `/shop/`: logo header, centered preface, Tilda-like 3-column product grid, payment block, delivery block, contact block, footer strip.
- Catalog `/catalog/`: compatible route rendering the same Tilda-like shop page.
- Product pages `/plants/<slug>/`: own Astro implementation of a Tilda-like product detail view with gallery, title, price, option picker, quantity and add-to-cart.
- Cart `/cart/` and global cart overlay: fullscreen Tilda-like cart/request page with item list, customer fields, payment method radios and black submit button.

## Interactive states

- Product card hover switches to second image when a second image exists.
- Product page option radio updates selected price and cart payload.
- Quantity input affects the cart line quantity.
- Floating cart icon appears only when the browser cart has items.
- Cart supports open, close, Escape close, item increase/decrease, remove, localStorage persistence and draft request submit.
- Cart does not create live order, reserve, payment, sale or stock movement.

## Build and verification

- `npm run build`: passed.
- `npm run verify`: passed.
- `npm run lint`: not available in `package.json`.
- `npm test`: not available in `package.json`.

Verification summary:
- 42 product rows checked.
- Required public images checked.
- Tilda clone shell, shop grid, product pages, safe draft cart and SEO markers checked.
- Forbidden public technical phrases checked.

## Screenshots

Reference screenshots:
- `reports/screenshots/tilda-reference/`

Result screenshots:
- `reports/screenshots/tilda-clone-result/`
- Home: 1440, 1280, 1024, 768, 430, 390, 360 widths.
- Shop: 1440, 1280, 1024, 768, 430, 390, 360 widths.
- Product: `product-shavliia-likarska-1440x1000-full.png`.
- Cart empty: `cart-empty-390x844-full.png`.

Comparison screenshots:
- `reports/screenshots/tilda-clone-comparison/`
- Side-by-side pairs for home and shop at all required viewport sizes.

## Remaining visual differences

- Product order differs from the current Tilda manual block. The clone intentionally uses `data/products.csv` as the public product export, while Tilda `/shop` is a manually authored Tilda catalog block with its own order.
- Some product images differ from Tilda. The clone uses local approved product images from the repository, while the Tilda page still uses Tilda CDN assets and several blurred/lazy placeholder appearances in screenshots.
- The home page includes the lower Tilda sections visible from the published HTML (`Як ми вирощуємо`, `Що ми вирощуємо`, `Як замовити`). Some reference full-page screenshots show a large blank area after the first text block; this appears to be a Tilda rendering/lazy-load artifact, not missing HTML content.
- Tilda runtime scripts, Tilda cart runtime, Tilda animation runtime and service mechanisms are not imported by design.
- Filled-cart browser screenshot was not captured with a separate automation script because Playwright is not a project dependency and the CLI screenshot command cannot preseed localStorage. Cart behavior is verified through `public/cart.js`, static markup and build/verify checks.

## Commits

- `27688a5 docs: capture exact Tilda reference and measurements`
- `e04c6ef feat: reproduce Tilda storefront shell and homepage`
- `5a27f77 feat: reproduce Tilda catalog and product pages`
- `0ac3b01 feat: reproduce Tilda cart and request form`
- `77c9292 fix: align responsive layout with Tilda reference`

## Changed files

- `public/cart.js`
- `public/images/tilda-clone/hero-greenhouse.jpg`
- `public/images/tilda-clone/tilda-logo.png`
- `scripts/verify-site.mjs`
- `src/components/TildaCloneCart.astro`
- `src/components/TildaCloneFooter.astro`
- `src/components/TildaCloneProductCard.astro`
- `src/components/TildaCloneShopHeader.astro`
- `src/layouts/BaseLayout.astro`
- `src/pages/cart.astro`
- `src/pages/catalog.astro`
- `src/pages/index.astro`
- `src/pages/plants/[slug].astro`
- `src/pages/shop.astro`
- `src/styles/global.css`
- `reports/tilda-exact-clone-audit.md`
- `reports/tilda-exact-clone-report.md`
- `reports/screenshots/tilda-reference/`
- `reports/screenshots/tilda-clone-result/`
- `reports/screenshots/tilda-clone-comparison/`

## Safety status

- `main`: unchanged.
- Production Cloudflare branch: unchanged.
- Tilda runtime: not imported.
- Site cart: draft request only.
- Accounting CSV/workbook: not touched.

## Readiness

Status: ready for operator visual acceptance on the branch preview.
