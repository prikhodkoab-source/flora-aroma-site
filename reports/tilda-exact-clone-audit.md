# Tilda exact clone audit

Branch: `feature/tilda-style-redesign`

Original:
- `https://flora-aroma.com.ua/`
- `https://flora-aroma.com.ua/shop`

Reference screenshots:
- `reports/screenshots/tilda-reference/home-1440x1000-full.png`
- `reports/screenshots/tilda-reference/home-1280x900-full.png`
- `reports/screenshots/tilda-reference/home-1024x768-full.png`
- `reports/screenshots/tilda-reference/home-768x1024-full.png`
- `reports/screenshots/tilda-reference/home-430x932-full.png`
- `reports/screenshots/tilda-reference/home-390x844-full.png`
- `reports/screenshots/tilda-reference/home-360x800-full.png`
- `reports/screenshots/tilda-reference/shop-1440x1000-full.png`
- `reports/screenshots/tilda-reference/shop-1280x900-full.png`
- `reports/screenshots/tilda-reference/shop-1024x768-full.png`
- `reports/screenshots/tilda-reference/shop-768x1024-full.png`
- `reports/screenshots/tilda-reference/shop-430x932-full.png`
- `reports/screenshots/tilda-reference/shop-390x844-full.png`
- `reports/screenshots/tilda-reference/shop-360x800-full.png`

## Global parameters

- Font: Tilda uses `TildaSans`; clone uses `TildaSans` with local fallback to `Arial` because the Tilda font runtime is not imported.
- Body background: `#ffffff`.
- Main text color: `#000000`.
- Muted text: visually matched near `#666666`.
- Blue action color from inline Tilda styles: `#1f5bff`.
- Hero button background: `#ffffff`, text `#000000`, radius `30px`.
- Tilda service scripts/runtime are not imported.

## Home page

Tilda records:
- `18`: cover hero
- `106`: text block
- `508`: "Як ми вирощуємо"
- `508`: "Що ми вирощуємо"
- `510`: "Як замовити"
- `706`: cart runtime

Hero:
- Height: `100vh`.
- Background: `Mezvidi-drone-5-1024.jpg`.
- Overlay: linear black `rgba(0,0,0,0.70)` to `rgba(0,0,0,0.70)`.
- Alignment: centered horizontally and vertically.
- Uptitle: uppercase, TildaSans, `24px`, `line-height: 22px`, bold.
- H1: Tilda title XL, centered, bold, white.
- Description: centered, white.
- Buttons: two horizontal white pills on desktop, stacked on narrow mobile.
- Arrow: white down chevron near bottom center.

Text block:
- Padding: `60px 0`.
- Content: 8-column centered Tilda container, approximated by `760px`.
- Text: Tilda text medium, black, regular.

List sections:
- Padding: `150px 0` desktop.
- Section title: centered, bold.
- Description: centered, max width `560px`, bottom margin `90px`.
- List content: centered narrow column with icon/circle at left and text at right.
- Mobile: smaller margins and single-column rhythm.

## Shop page

Tilda records:
- `454`: logo/header
- `127`: preface
- `754`: product catalog grid
- `706`: cart page/sidebar runtime
- `473`: payment block
- `473`: delivery block
- `560`: contact block

Header:
- White background.
- Height: `150px`.
- Logo width from inline Tilda style: `150px`.
- No visible navigation links.

Preface:
- Padding bottom: `90px`.
- Centered text.
- Font size from inline media rule at desktop: `28px`.

Catalog:
- Block type: Tilda `t754`.
- Desktop grid: 3 columns.
- Card image: square, cover crop.
- Product text: centered.
- Title: bold, small Tilda name style.
- Description: small muted text.
- Price: numeric value plus `грн.`.
- Hover: second image fades in over first image where available.
- Mobile: one product per row.

Payment and delivery:
- Background: `#f0f0f0`.
- Padding: `30px 0`.
- Title: uppercase, bold, bottom padding `40px`.
- Description font size at desktop: `28px`.

Contact:
- White background.
- Padding: `150px 0`.
- Centered phone, email, social icons.

## Cart

Original Tilda shop includes `t706` with:
- Floating bag icon.
- Red item counter `#ff4a4a`.
- Fullscreen cart page mode on shop.
- Heading: `Ваше замовлення`.
- Fields: `Ваше імʼя`, `Ваш Email`, `Ваш телефон`.
- Payment methods: `Готівкою при отриманні`, `Безготівкова оплата`.
- Submit button: black background, white text, label `Оформити замовлення`.

Clone keeps the safe Flora architecture:
- Browser localStorage draft cart.
- Separate line per `plant_id + option`.
- No live reserve/order/payment/stock movement.
- Submission remains a draft site request through the existing `/api/site-order` endpoint.
- Safety text: `Наявність, формат і можливість резерву підтвердить оператор.`

## Known allowed differences

- Tilda runtime scripts, Tilda closed cart implementation, animation runtime and service dependencies are not imported.
- The clone implements the visual behavior with local Astro/CSS/JS.
- The Tilda copyright/service footer is visually approximated as a static footer strip; no Tilda runtime or platform dependency is used.
- Product data is sourced from the approved public export `data/products.csv`, so exact product order/images can differ from the manual Tilda block until the source catalog is aligned.
