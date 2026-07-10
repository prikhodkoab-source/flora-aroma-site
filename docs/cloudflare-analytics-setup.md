# Cloudflare Analytics Setup

Website Gate D5 adds first-party site statistics for Flora & Aroma.

Status after this implementation:

- Local MVP is ready in code.
- Cloudflare Analytics Engine is not enabled for the Cloudflare account yet.
- `FLORA_ANALYTICS` must not be declared in `wrangler.jsonc` until Analytics Engine is enabled, because Cloudflare rejects the Pages deployment with `You need to enable Analytics Engine`.
- Cloudflare Access for `/admin/statistics/` and `/api/analytics/summary` is not configured by code.
- Production data collection must not be considered started until Cloudflare preview is checked by the operator.

## Architecture

```text
Browser events
  -> POST /api/analytics/event
  -> Cloudflare Pages Function
  -> FLORA_ANALYTICS Analytics Engine dataset

Operator dashboard
  -> /admin/statistics/
  -> GET /api/analytics/summary
  -> Analytics Engine SQL API
```

The public storefront never sends customer name, phone, email, delivery address, order comment, exact stock, IP address, or accounting identifiers.

## Event Fields

Allowed event names:

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

Allowed payload fields:

- `event_name`
- `occurred_at`
- `session_id`
- `pathname`
- `page_title`
- `plant_id`
- `plant_name`
- `product_option`
- `container`
- `quantity`
- `public_unit_price`
- `currency`
- `filter_name`
- `filter_value`
- `search_query`
- `referrer_host`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `device_class`

`search_query` is rejected if it looks like a phone number or email address.

## Analytics Engine Column Map

Cloudflare Workers Analytics Engine stores one index array, blob columns, and double columns.

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

Aggregate event counts use `SUM(_sample_interval)`.

## Cloudflare Binding

After Analytics Engine is enabled in the Cloudflare account, add this Analytics Engine binding to `wrangler.jsonc` or configure the same binding in the Cloudflare dashboard:

```jsonc
"analytics_engine_datasets": [
  {
    "binding": "FLORA_ANALYTICS",
    "dataset": "flora_aroma_site_events"
  }
]
```

Cloudflare must apply this binding in a new Pages deployment before collection works. Until then,
`POST /api/analytics/event` degrades to `503 analytics_not_configured`.

Do not commit this binding before the account-level Analytics Engine product is enabled. A preview deployment with the binding was tested on 2026-07-10 and failed at the Function publish step because the account had not enabled Analytics Engine.

## Required Secrets And Variables

Variables:

```text
CF_ACCOUNT_ID=<Cloudflare account id>
CF_ANALYTICS_DATASET=flora_aroma_site_events
FLORA_SITE_ORIGIN=https://flora-aroma.com.ua
```

Secret:

```text
CF_ANALYTICS_API_TOKEN=<Cloudflare Account Analytics Read token>
```

The API token must have account analytics read permission. Do not commit it.

## Cloudflare Access

Protect these paths before using the dashboard with real data:

```text
/admin/statistics*
/api/analytics/summary*
```

Leave public:

```text
/api/analytics/event
```

The site code does not configure Access automatically. Configure it in Cloudflare Zero Trust and verify that an anonymous browser cannot open `/admin/statistics/` or `/api/analytics/summary`.

## Local Checks

Run from `flora-aroma-site/`:

```bash
npm install
npm run build
npm run test:analytics
npm run test:site-order
npm run verify
```

Local expected behavior without Cloudflare config:

- `POST /api/analytics/event` returns `503 analytics_not_configured` if the binding is missing.
- `/admin/statistics/` shows that analytics is not connected.
- The storefront continues working.

## Safety Invariants

- No fingerprinting.
- No cross-session user tracking.
- No customer contacts or order text in analytics events.
- No exact stock quantity in analytics events.
- No writes to Flora accounting CSV/workbook.
- No live order, reservation, payment, delivery, or stock movement is created by analytics.
