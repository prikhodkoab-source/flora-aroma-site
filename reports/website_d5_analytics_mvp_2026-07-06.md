# Website D5 Analytics MVP

Date: 2026-07-06
Branch: `feature/tilda-style-redesign`
Base SHA before D5 commit: `89dc9fd7f9e27bd7954a81a7c2e3ce28cd3d0411`

## Status

`LOCAL MVP READY; CLOUDFLARE BINDING NOT VERIFIED; ACCESS NOT CONFIGURED; PRODUCTION DATA COLLECTION NOT STARTED`

No production Cloudflare, DNS, Tilda, accounting CSV/workbook, stock, order, reserve, payment or delivery data was changed.

## Architecture

```text
public storefront
  -> src/lib/analytics.ts
  -> POST /api/analytics/event
  -> functions/api/analytics/event.js
  -> FLORA_ANALYTICS Workers Analytics Engine dataset

operator dashboard
  -> /admin/statistics/
  -> GET /api/analytics/summary
  -> functions/api/analytics/summary.js
  -> Cloudflare Analytics Engine SQL API
```

The existing W2 draft site-order flow remains separate and unchanged in behavior.

## Events

Implemented event allowlist:

- `page_view`
- `view_plant`
- `catalog_search`
- `filter_used`
- `select_variant`
- `add_to_cart`
- `remove_from_cart`
- `change_cart_quantity`
- `open_cart`
- `copy_order_request`
- `click_phone`
- `click_messenger`

The client sends only allowlisted fields. The server validates again, strips unknown fields and rejects sensitive search values.

## Analytics Engine Columns

```text
indexes[1] = session_id

blob1  = event_name
blob2  = pathname
blob3  = page_title
blob4  = plant_id
blob5  = plant_name
blob6  = product_option
blob7  = container
blob8  = currency
blob9  = filter_name
blob10 = filter_value
blob11 = search_query
blob12 = referrer_host
blob13 = utm_source
blob14 = utm_medium
blob15 = utm_campaign
blob16 = device_class
blob17 = occurred_at

double1 = quantity
double2 = public_unit_price
```

Event counts use `SUM(_sample_interval)` as required for sampled Analytics Engine data. Session count uses `uniq(index1)` and should be treated as an operational estimate.

## Dashboard Metrics

`/admin/statistics/` renders:

- sessions
- page views
- product views
- add-to-cart events
- draft request submissions to operator
- conversion percentage
- daily page-view series
- top products
- traffic sources
- device classes
- funnel

If Cloudflare variables or secret are missing, the page shows: `Аналітику ще не підключено до Cloudflare. Дані не збираються.`

## Privacy And Safety

Blocked from analytics:

- customer name
- phone
- email
- delivery address
- order comment/message text
- exact internal stock
- IP address from client JavaScript
- fingerprinting fields
- cross-session visitor ID

Analytics uses only a random `sessionStorage` session ID.

## Cloudflare Setup Still Required

Manual operator steps:

1. Verify `FLORA_ANALYTICS` Analytics Engine binding in Cloudflare Pages.
2. Replace `CF_ACCOUNT_ID` placeholder.
3. Add `CF_ANALYTICS_API_TOKEN` as a Cloudflare secret with Account Analytics Read permission.
4. Keep `CF_ANALYTICS_DATASET=flora_aroma_site_events`.
5. Configure Cloudflare Access for:
   - `/admin/statistics*`
   - `/api/analytics/summary*`
6. Leave `/api/analytics/event` public.
7. Verify branch preview write/read before any production approval.

## Checks Run

```text
npm run test:analytics     PASS
npm run build              PASS
npm run test:analytics     PASS after build bundle scan
npm run test:site-order    PASS
npm run verify             PASS
```

`npm run lint` and `npm test` are not configured in `package.json`.

## Modified Files

Site repo:

- `.dev.vars.example`
- `docs/cloudflare-analytics-setup.md`
- `functions/_analytics.js`
- `functions/api/analytics/event.js`
- `functions/api/analytics/summary.js`
- `package.json`
- `public/cart.js`
- `scripts/test-analytics-function.mjs`
- `scripts/verify-site.mjs`
- `src/components/TildaCloneProductCard.astro`
- `src/layouts/BaseLayout.astro`
- `src/lib/analytics.ts`
- `src/pages/admin/statistics.astro`
- `src/pages/plants/[slug].astro`
- `src/styles/global.css`
- `wrangler.jsonc`

Related root docs:

- `PROJECT_STRUCTURE.md`
- `project_roadmap.md`
- `docs/session-log.md`

## External References Used

- Cloudflare Pages Functions bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Cloudflare Pages Wrangler configuration: https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- Workers Analytics Engine get started: https://developers.cloudflare.com/analytics/analytics-engine/get-started/
- Workers Analytics Engine SQL API: https://developers.cloudflare.com/analytics/analytics-engine/sql-api/
- Workers Analytics Engine sampling: https://developers.cloudflare.com/analytics/analytics-engine/sampling/
- Cloudflare Access application paths: https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/

## Remaining Risks

- Cloudflare binding has not been verified against real Pages deployment.
- Access protection is documented but not configured by code.
- Real Analytics Engine SQL response was not tested against Cloudflare because no production token was used.
- The feature branch was not pushed by this task; Cloudflare branch preview will update only after separate operator-approved push.
