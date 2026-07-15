export const ANALYTICS_DATASET = "flora_aroma_site_events";
export const MAX_ANALYTICS_BODY_BYTES = 12_000;

export const ANALYTICS_EVENTS = [
  "page_view",
  "view_plant",
  "catalog_search",
  "filter_used",
  "select_variant",
  "add_to_cart",
  "remove_from_cart",
  "change_cart_quantity",
  "open_cart",
  "copy_order_request",
  "click_phone",
  "click_messenger"
];

const EVENT_SET = new Set(ANALYTICS_EVENTS);

export const ANALYTICS_COLUMN_MAP = {
  indexes: ["session_id"],
  blobs: [
    "event_name",
    "pathname",
    "page_title",
    "plant_id",
    "plant_name",
    "product_option",
    "container",
    "currency",
    "filter_name",
    "filter_value",
    "search_query",
    "referrer_host",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "device_class",
    "occurred_at"
  ],
  doubles: ["quantity", "public_unit_price"]
};

const STRING_LIMITS = {
  event_name: 64,
  session_id: 80,
  occurred_at: 40,
  pathname: 180,
  page_title: 140,
  plant_id: 20,
  plant_name: 140,
  product_option: 120,
  container: 120,
  currency: 8,
  filter_name: 80,
  filter_value: 120,
  search_query: 80,
  referrer_host: 140,
  utm_source: 80,
  utm_medium: 80,
  utm_campaign: 120,
  device_class: 16
};

const DEVICE_CLASSES = new Set(["desktop", "tablet", "mobile", "unknown"]);
const SEARCH_EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/i;

export function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function cleanString(value, maxLength) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function hasPhoneLikeValue(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 7;
}

function hasSensitiveSearchValue(value) {
  return SEARCH_EMAIL_RE.test(value) || hasPhoneLikeValue(value);
}

function safeHostname(value) {
  const cleaned = cleanString(value, STRING_LIMITS.referrer_host).toLowerCase();
  if (!cleaned) return "";
  try {
    return new URL(cleaned.includes("://") ? cleaned : `https://${cleaned}`).hostname.slice(
      0,
      STRING_LIMITS.referrer_host
    );
  } catch {
    return cleaned.replace(/[^a-z0-9.-]/g, "").slice(0, STRING_LIMITS.referrer_host);
  }
}

function safePathname(value) {
  const cleaned = cleanString(value, STRING_LIMITS.pathname);
  if (!cleaned) return "/";
  if (!cleaned.startsWith("/")) return `/${cleaned.replace(/^\/+/, "")}`;
  return cleaned;
}

function safeTimestamp(value, now = new Date()) {
  const parsed = value ? new Date(value) : now;
  if (Number.isNaN(parsed.getTime())) return now.toISOString();

  const delta = Math.abs(now.getTime() - parsed.getTime());
  const maxDelta = 1000 * 60 * 60 * 24;
  if (delta > maxDelta) return now.toISOString();
  return parsed.toISOString();
}

function safeSessionId(value) {
  const cleaned = cleanString(value, STRING_LIMITS.session_id);
  if (!cleaned) return "";
  return /^[a-zA-Z0-9_.:-]{12,80}$/.test(cleaned) ? cleaned : "";
}

function safePlantId(value) {
  const cleaned = cleanString(value, STRING_LIMITS.plant_id).toUpperCase();
  if (!cleaned) return "";
  return /^PLANT-\d{4}$/.test(cleaned) ? cleaned : "";
}

function safeNumber(value, field, errors) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    errors.push(`${field}_invalid`);
    return undefined;
  }

  if (field === "quantity") {
    const rounded = Math.round(number);
    if (rounded < 1 || rounded > 9999) {
      errors.push("quantity_invalid");
      return undefined;
    }
    return rounded;
  }

  if (field === "public_unit_price") {
    if (number < 0 || number > 100_000) {
      errors.push("public_unit_price_invalid");
      return undefined;
    }
    return Math.round(number * 100) / 100;
  }

  return number;
}

export function sanitizeAnalyticsPayload(payload, options = {}) {
  const now = options.now || new Date();
  const errors = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, errors: ["payload_invalid"], event: null };
  }

  const eventName = cleanString(payload.event_name ?? payload.eventName, STRING_LIMITS.event_name);
  if (!EVENT_SET.has(eventName)) {
    errors.push("event_name_not_allowed");
  }

  const sessionId = safeSessionId(payload.session_id);
  if (!sessionId) errors.push("session_id_invalid");

  const event = {
    event_name: eventName,
    session_id: sessionId,
    occurred_at: safeTimestamp(payload.occurred_at, now),
    pathname: safePathname(payload.pathname),
    page_title: cleanString(payload.page_title, STRING_LIMITS.page_title),
    plant_id: safePlantId(payload.plant_id),
    plant_name: cleanString(payload.plant_name, STRING_LIMITS.plant_name),
    product_option: cleanString(payload.product_option, STRING_LIMITS.product_option),
    container: cleanString(payload.container, STRING_LIMITS.container),
    currency: cleanString(payload.currency || "UAH", STRING_LIMITS.currency).toUpperCase(),
    filter_name: cleanString(payload.filter_name, STRING_LIMITS.filter_name),
    filter_value: cleanString(payload.filter_value, STRING_LIMITS.filter_value),
    search_query: cleanString(payload.search_query, STRING_LIMITS.search_query),
    referrer_host: safeHostname(payload.referrer_host),
    utm_source: cleanString(payload.utm_source, STRING_LIMITS.utm_source),
    utm_medium: cleanString(payload.utm_medium, STRING_LIMITS.utm_medium),
    utm_campaign: cleanString(payload.utm_campaign, STRING_LIMITS.utm_campaign),
    device_class: cleanString(payload.device_class || "unknown", STRING_LIMITS.device_class).toLowerCase()
  };

  if (event.search_query && hasSensitiveSearchValue(event.search_query)) {
    errors.push("search_query_sensitive");
  }

  if (event.search_query && event.search_query.length < 2) {
    event.search_query = "";
  }

  if (!DEVICE_CLASSES.has(event.device_class)) {
    event.device_class = "unknown";
  }

  const quantity = safeNumber(payload.quantity, "quantity", errors);
  const publicUnitPrice = safeNumber(payload.public_unit_price, "public_unit_price", errors);
  if (quantity !== undefined) event.quantity = quantity;
  if (publicUnitPrice !== undefined) event.public_unit_price = publicUnitPrice;

  return {
    ok: errors.length === 0,
    errors,
    event
  };
}

export function analyticsDataPoint(event) {
  return {
    indexes: ANALYTICS_COLUMN_MAP.indexes.map((field) => String(event[field] || "")),
    blobs: ANALYTICS_COLUMN_MAP.blobs.map((field) => String(event[field] || "")),
    doubles: ANALYTICS_COLUMN_MAP.doubles.map((field) => Number(event[field] || 0))
  };
}

export function validateAnalyticsOrigin(request, env = {}) {
  const origin = request.headers.get("Origin");
  if (!origin) return { ok: true };

  const requestOrigin = new URL(request.url).origin;
  const allowed = new Set([requestOrigin]);
  if (env.FLORA_SITE_ORIGIN) allowed.add(String(env.FLORA_SITE_ORIGIN).replace(/\/+$/, ""));

  return allowed.has(origin.replace(/\/+$/, ""))
    ? { ok: true }
    : { ok: false, error: "origin_not_allowed" };
}

export async function readJsonRequest(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, error: "content_type_not_supported" };
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_ANALYTICS_BODY_BYTES) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  const text = await request.text();
  if (text.length > MAX_ANALYTICS_BODY_BYTES) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  try {
    return { ok: true, payload: JSON.parse(text || "{}") };
  } catch {
    return { ok: false, status: 400, error: "json_invalid" };
  }
}

export function parseAnalyticsPeriod(url, now = new Date()) {
  const params = new URL(url).searchParams;
  const preset = params.get("preset");
  const from = params.get("from");
  const to = params.get("to");

  if (from || to) {
    if (!from || !to) return { ok: false, error: "period_from_to_required" };
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return { ok: false, error: "period_invalid" };
    }
    if (fromDate > toDate) return { ok: false, error: "period_invalid" };
    const days = Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000);
    if (days > 366) return { ok: false, error: "period_too_large" };
    return {
      ok: true,
      preset: "custom",
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      label: labelPeriod(fromDate, toDate)
    };
  }

  const selectedPreset = preset || "30d";
  const todayStart = startOfUtcDay(now);
  const todayEnd = endOfUtcDay(now);

  if (selectedPreset === "today") {
    return periodResult(selectedPreset, todayStart, todayEnd);
  }

  if (selectedPreset === "yesterday") {
    const day = addDays(todayStart, -1);
    return periodResult(selectedPreset, day, endOfUtcDay(day));
  }

  if (selectedPreset === "current_month") {
    return periodResult(selectedPreset, startOfUtcMonth(now), now);
  }

  if (selectedPreset === "previous_month") {
    const currentMonth = startOfUtcMonth(now);
    const previousMonth = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 1, 1));
    return periodResult(selectedPreset, previousMonth, new Date(currentMonth.getTime() - 1));
  }

  const presetDays = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
  if (!Object.hasOwn(presetDays, selectedPreset)) return { ok: false, error: "period_invalid" };

  const toDate = now;
  const fromDate = new Date(toDate.getTime() - presetDays[selectedPreset] * 86_400_000);
  return periodResult(selectedPreset, fromDate, toDate);
}

function startOfUtcDay(value) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfUtcDay(value) {
  const start = startOfUtcDay(value);
  return new Date(start.getTime() + 86_400_000 - 1);
}

function startOfUtcMonth(value) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function addDays(value, days) {
  return new Date(value.getTime() + days * 86_400_000);
}

function periodResult(preset, fromDate, toDate) {
  return {
    ok: true,
    preset,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    label: labelPeriod(fromDate, toDate)
  };
}

function labelPeriod(fromDate, toDate) {
  return `${fromDate.toISOString().slice(0, 10)} - ${toDate.toISOString().slice(0, 10)}`;
}

export function previousAnalyticsPeriod(range) {
  const fromDate = new Date(range.from);
  const toDate = new Date(range.to);
  const duration = Math.max(0, toDate.getTime() - fromDate.getTime());
  const previousTo = new Date(fromDate.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - duration);

  return {
    preset: "previous",
    from: previousFrom.toISOString(),
    to: previousTo.toISOString(),
    label: labelPeriod(previousFrom, previousTo)
  };
}

function sqlString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function sqlDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("datetime_invalid");
  }
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function validateDatasetName(dataset) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(dataset || "");
}

export function buildSummaryQueries(dataset, range, options = {}) {
  if (!validateDatasetName(dataset)) {
    throw new Error("dataset_invalid");
  }

  const includeDetails = options.includeDetails !== false;
  const from = sqlString(sqlDateTime(range.from));
  const to = sqlString(sqlDateTime(range.to));
  const where = `timestamp >= toDateTime('${from}') AND timestamp <= toDateTime('${to}')`;
  const keyEvents =
    "'page_view','view_plant','add_to_cart','open_cart','copy_order_request','catalog_search','select_variant','click_phone','click_messenger'";

  const queries = {
    overall: `SELECT count(DISTINCT index1) AS sessions, SUM(_sample_interval) AS events FROM ${dataset} WHERE ${where} FORMAT JSON`,
    eventTotals: `SELECT blob1 AS event_name, SUM(_sample_interval) AS event_count, count(DISTINCT index1) AS unique_sessions, MAX(timestamp) AS last_seen FROM ${dataset} WHERE ${where} GROUP BY event_name ORDER BY event_count DESC FORMAT JSON`
  };

  if (!includeDetails) return queries;

  return {
    ...queries,
    dailySessions: `SELECT toDate(timestamp) AS day, count(DISTINCT index1) AS sessions FROM ${dataset} WHERE ${where} GROUP BY day ORDER BY day ASC FORMAT JSON`,
    dailyMetrics: `SELECT toDate(timestamp) AS day, blob1 AS event_name, SUM(_sample_interval) AS event_count, count(DISTINCT index1) AS unique_sessions FROM ${dataset} WHERE ${where} AND blob1 IN (${keyEvents}) GROUP BY day, event_name ORDER BY day ASC FORMAT JSON`,
    topProducts: `SELECT blob4 AS plant_id, blob5 AS plant_name, blob6 AS product_option, blob7 AS container, blob1 AS event_name, SUM(_sample_interval) AS event_count, count(DISTINCT index1) AS unique_sessions FROM ${dataset} WHERE ${where} AND blob4 != '' AND blob1 IN ('view_plant','add_to_cart','copy_order_request') GROUP BY plant_id, plant_name, product_option, container, event_name ORDER BY event_count DESC LIMIT 300 FORMAT JSON`,
    popularPages: `SELECT blob2 AS pathname, blob3 AS page_title, SUM(_sample_interval) AS views, count(DISTINCT index1) AS unique_sessions FROM ${dataset} WHERE ${where} AND blob1 = 'page_view' AND blob2 != '' GROUP BY pathname, page_title ORDER BY views DESC LIMIT 200 FORMAT JSON`,
    sourceEvents: `SELECT blob12 AS referrer_host, blob13 AS utm_source, blob14 AS utm_medium, blob15 AS utm_campaign, blob1 AS event_name, SUM(_sample_interval) AS event_count, count(DISTINCT index1) AS unique_sessions FROM ${dataset} WHERE ${where} AND blob1 IN (${keyEvents}) GROUP BY referrer_host, utm_source, utm_medium, utm_campaign, event_name ORDER BY event_count DESC LIMIT 400 FORMAT JSON`,
    deviceEvents: `SELECT if(blob16 = '', 'unknown', blob16) AS device_class, blob1 AS event_name, SUM(_sample_interval) AS event_count, count(DISTINCT index1) AS unique_sessions FROM ${dataset} WHERE ${where} AND blob1 IN (${keyEvents}) GROUP BY device_class, event_name ORDER BY event_count DESC FORMAT JSON`
  };
}

export function parseSqlJson(text) {
  const parsed = JSON.parse(text || "{}");
  if (!Array.isArray(parsed.data)) return [];
  return parsed.data;
}

export function emptyAnalyticsSummary(range, reason = "not_configured") {
  return {
    configured: false,
    reason,
    range,
    metrics: {
      sessions: 0,
      page_views: 0,
      product_views: 0,
      add_to_cart: 0,
      open_cart: 0,
      copied_requests: 0,
      conversions: 0,
      session_to_cart_conversion: 0,
      session_to_copy_conversion: 0
    },
    kpis: [],
    daily_series: [],
    daily_table: [],
    top_products: [],
    popular_pages: [],
    traffic_sources: [],
    source_quality: [],
    device_classes: [],
    event_table: [],
    funnel: [],
    commercial: commercialPlaceholder(),
    geography: geographyStatus(),
    search_analytics: searchAnalyticsStatus(),
    meta: {
      generated_at: new Date().toISOString(),
      query_count: 0,
      dashboard_api_request_count: 1,
      p95_estimate_available: false
    }
  };
}

function valueFor(row, field) {
  return Math.round(Number(row?.[field] || 0));
}

function percent(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((Number(numerator || 0) / Number(denominator)) * 10_000) / 100;
}

function delta(current, previous) {
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);
  return {
    absolute: Math.round((currentValue - previousValue) * 100) / 100,
    percent: previousValue > 0 ? Math.round(((currentValue - previousValue) / previousValue) * 10_000) / 100 : null
  };
}

function eventRow(rowsByQuery, eventName) {
  return (rowsByQuery.eventTotals || []).find((row) => row.event_name === eventName) || {};
}

function baseMetrics(rowsByQuery) {
  const sessions = valueFor(rowsByQuery.overall?.[0], "sessions");
  const pageViews = valueFor(eventRow(rowsByQuery, "page_view"), "event_count");
  const productViews = valueFor(eventRow(rowsByQuery, "view_plant"), "event_count");
  const addToCart = valueFor(eventRow(rowsByQuery, "add_to_cart"), "event_count");
  const openCart = valueFor(eventRow(rowsByQuery, "open_cart"), "event_count");
  const copiedRequests = valueFor(eventRow(rowsByQuery, "copy_order_request"), "event_count");

  return {
    sessions,
    visitors: sessions,
    page_views: pageViews,
    product_views: productViews,
    add_to_cart: addToCart,
    open_cart: openCart,
    copied_requests: copiedRequests,
    conversions: percent(copiedRequests, pageViews),
    session_to_cart_conversion: percent(valueFor(eventRow(rowsByQuery, "add_to_cart"), "unique_sessions"), sessions),
    session_to_copy_conversion: percent(valueFor(eventRow(rowsByQuery, "copy_order_request"), "unique_sessions"), sessions)
  };
}

function kpiRows(current, previous) {
  return [
    ["sessions", "Сесії", current.sessions, previous.sessions, "number"],
    ["visitors", "Відвідувачі (за сесіями)", current.visitors, previous.visitors, "number"],
    ["page_views", "Перегляди сторінок", current.page_views, previous.page_views, "number"],
    ["product_views", "Перегляди рослин", current.product_views, previous.product_views, "number"],
    ["add_to_cart", "Додавання в кошик", current.add_to_cart, previous.add_to_cart, "number"],
    ["open_cart", "Відкриття кошика", current.open_cart, previous.open_cart, "number"],
    ["copied_requests", "Скопійовано заявок", current.copied_requests, previous.copied_requests, "number"],
    [
      "session_to_cart_conversion",
      "Конверсія сесія -> кошик",
      current.session_to_cart_conversion,
      previous.session_to_cart_conversion,
      "percent"
    ],
    [
      "session_to_copy_conversion",
      "Конверсія сесія -> заявка",
      current.session_to_copy_conversion,
      previous.session_to_copy_conversion,
      "percent"
    ]
  ].map(([key, label, currentValue, previousValue, format]) => ({
    key,
    label,
    current: currentValue,
    previous: previousValue,
    delta_absolute: delta(currentValue, previousValue).absolute,
    delta_percent: delta(currentValue, previousValue).percent,
    format
  }));
}

function normalizePathname(pathname) {
  const value = String(pathname || "/").split("?")[0].split("#")[0].trim();
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function pageType(pathname) {
  const path = normalizePathname(pathname);
  if (path === "/") return "home";
  if (path === "/shop" || path === "/catalog") return "catalog";
  if (path.startsWith("/plants/")) return "plant";
  if (path.startsWith("/categories/")) return "category";
  if (path.startsWith("/selections/")) return "selection";
  if (path.startsWith("/cart")) return "cart";
  if (path.startsWith("/contacts")) return "contacts";
  if (path.startsWith("/how-to-order")) return "how-to-order";
  if (path.startsWith("/price")) return "price";
  return "other";
}

function sourceInfo(row) {
  const referrer = String(row.referrer_host || "").toLowerCase();
  const utmSource = String(row.utm_source || "").toLowerCase();
  const utmMedium = String(row.utm_medium || "").toLowerCase();
  const utmCampaign = String(row.utm_campaign || "").toLowerCase();
  const marker = `${referrer} ${utmSource} ${utmMedium} ${utmCampaign}`;

  if (utmSource || utmMedium || utmCampaign) {
    if (/facebook|instagram|threads|tiktok|telegram|t\.me/.test(marker)) {
      return { channel: "Social", source: utmSource || referrer || "social" };
    }
    return { channel: "Campaign", source: utmSource || utmCampaign || utmMedium || "campaign" };
  }

  if (!referrer) return { channel: "Direct", source: "direct" };
  if (/flora-aroma|flora_aroma|pages\.dev/.test(referrer)) return { channel: "Internal", source: referrer };
  if (/google|bing|duckduckgo|yahoo|yandex/.test(referrer)) return { channel: "Search", source: referrer };
  if (/facebook|instagram|threads|tiktok|telegram|t\.me/.test(referrer)) return { channel: "Social", source: referrer };
  return { channel: "Referral", source: referrer };
}

function addEventMetric(target, eventName, eventCount, uniqueSessions) {
  if (eventName === "page_view") {
    target.page_views += eventCount;
    target.sessions = Math.max(target.sessions, uniqueSessions);
  }
  if (eventName === "view_plant") {
    target.plant_views += eventCount;
    target.plant_view_sessions = Math.max(target.plant_view_sessions, uniqueSessions);
  }
  if (eventName === "add_to_cart") {
    target.add_to_cart += eventCount;
    target.add_to_cart_sessions = Math.max(target.add_to_cart_sessions, uniqueSessions);
  }
  if (eventName === "open_cart") target.open_cart += eventCount;
  if (eventName === "copy_order_request") {
    target.copied_requests += eventCount;
    target.copy_request_sessions = Math.max(target.copy_request_sessions, uniqueSessions);
  }
}

function dailyRows(rowsByQuery) {
  const days = new Map();
  for (const row of rowsByQuery.dailySessions || []) {
    const day = String(row.day || "");
    if (!day) continue;
    days.set(day, {
      day,
      sessions: valueFor(row, "sessions"),
      visitors: valueFor(row, "sessions"),
      page_views: 0,
      product_views: 0,
      add_to_cart: 0,
      copied_requests: 0,
      conversion: 0
    });
  }

  for (const row of rowsByQuery.dailyMetrics || []) {
    const day = String(row.day || "");
    if (!day) continue;
    const current = days.get(day) || {
      day,
      sessions: 0,
      visitors: 0,
      page_views: 0,
      product_views: 0,
      add_to_cart: 0,
      copied_requests: 0,
      conversion: 0
    };
    const count = valueFor(row, "event_count");
    if (row.event_name === "page_view") current.page_views += count;
    if (row.event_name === "view_plant") current.product_views += count;
    if (row.event_name === "add_to_cart") current.add_to_cart += count;
    if (row.event_name === "copy_order_request") current.copied_requests += count;
    days.set(day, current);
  }

  return Array.from(days.values())
    .map((row) => ({ ...row, conversion: percent(row.copied_requests, row.sessions) }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

function plantRows(rowsByQuery) {
  const products = new Map();
  for (const row of rowsByQuery.topProducts || []) {
    const plantId = row.plant_id || "";
    if (!plantId) continue;
    const current = products.get(plantId) || {
      plant_id: plantId,
      plant_name: row.plant_name || plantId,
      product_option: row.product_option || "",
      container: row.container || "",
      views: 0,
      unique_sessions: 0,
      add_to_cart: 0,
      add_to_cart_sessions: 0,
      copied_requests: 0,
      copy_request_sessions: 0
    };
    if (row.event_name === "view_plant") {
      current.views += Number(row.event_count || 0);
      current.unique_sessions += Number(row.unique_sessions || 0);
    }
    if (row.event_name === "add_to_cart") {
      current.add_to_cart += Number(row.event_count || 0);
      current.add_to_cart_sessions += Number(row.unique_sessions || 0);
    }
    if (row.event_name === "copy_order_request") {
      current.copied_requests += Number(row.event_count || 0);
      current.copy_request_sessions += Number(row.unique_sessions || 0);
    }
    products.set(plantId, current);
  }

  return Array.from(products.values())
    .map((item) => ({
      ...item,
      views: Math.round(item.views),
      unique_sessions: Math.round(item.unique_sessions),
      add_to_cart: Math.round(item.add_to_cart),
      copied_requests: Math.round(item.copied_requests),
      view_to_cart_conversion: percent(item.add_to_cart_sessions, item.unique_sessions),
      cart_to_copy_conversion: percent(item.copy_request_sessions, item.add_to_cart_sessions)
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 30);
}

function pageRows(rowsByQuery, pageViews) {
  return (rowsByQuery.popularPages || [])
    .map((row) => {
      const pathname = normalizePathname(row.pathname);
      const views = valueFor(row, "views");
      return {
        pathname,
        page_title: String(row.page_title || pathname),
        page_type: pageType(pathname),
        views,
        unique_sessions: valueFor(row, "unique_sessions"),
        share_of_views: percent(views, pageViews)
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 50);
}

function sourceRows(rowsByQuery) {
  const grouped = new Map();
  for (const row of rowsByQuery.sourceEvents || []) {
    const { channel, source } = sourceInfo(row);
    const key = `${channel}|${source}`;
    const current = grouped.get(key) || {
      channel,
      source,
      sessions: 0,
      page_views: 0,
      plant_views: 0,
      plant_view_sessions: 0,
      add_to_cart: 0,
      add_to_cart_sessions: 0,
      open_cart: 0,
      copied_requests: 0,
      copy_request_sessions: 0
    };
    addEventMetric(current, row.event_name, valueFor(row, "event_count"), valueFor(row, "unique_sessions"));
    grouped.set(key, current);
  }

  const totalSessions = Array.from(grouped.values()).reduce((sum, row) => sum + row.sessions, 0);
  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      share: percent(row.sessions, totalSessions),
      session_to_cart_conversion: percent(row.add_to_cart_sessions, row.sessions),
      session_to_copy_conversion: percent(row.copy_request_sessions, row.sessions)
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 50);
}

function deviceRows(rowsByQuery) {
  const grouped = new Map();
  for (const row of rowsByQuery.deviceEvents || []) {
    const device = String(row.device_class || "unknown");
    const current = grouped.get(device) || {
      device_class: device,
      sessions: 0,
      page_views: 0,
      plant_views: 0,
      plant_view_sessions: 0,
      add_to_cart: 0,
      add_to_cart_sessions: 0,
      open_cart: 0,
      copied_requests: 0,
      copy_request_sessions: 0
    };
    addEventMetric(current, row.event_name, valueFor(row, "event_count"), valueFor(row, "unique_sessions"));
    grouped.set(device, current);
  }
  const total = Array.from(grouped.values()).reduce((sum, row) => sum + row.sessions, 0);
  return Array.from(grouped.values())
    .map((row) => ({
      ...row,
      share: percent(row.sessions, total),
      copy_request_conversion: percent(row.copy_request_sessions, row.sessions)
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

function eventTable(rowsByQuery) {
  const events = rowsByQuery.eventTotals || [];
  const total = events.reduce((sum, row) => sum + valueFor(row, "event_count"), 0);
  return events.map((row) => ({
    event_name: String(row.event_name || "unknown"),
    event_count: valueFor(row, "event_count"),
    unique_sessions: valueFor(row, "unique_sessions"),
    share: percent(valueFor(row, "event_count"), total),
    last_seen: row.last_seen ? String(row.last_seen) : ""
  }));
}

function funnelRows(rowsByQuery, metrics) {
  const steps = [
    ["sessions", "Сесії", metrics.sessions, metrics.sessions],
    ["view_plant", "Перегляд рослини", valueFor(eventRow(rowsByQuery, "view_plant"), "event_count"), valueFor(eventRow(rowsByQuery, "view_plant"), "unique_sessions")],
    ["add_to_cart", "Додавання в кошик", valueFor(eventRow(rowsByQuery, "add_to_cart"), "event_count"), valueFor(eventRow(rowsByQuery, "add_to_cart"), "unique_sessions")],
    ["open_cart", "Відкриття кошика", valueFor(eventRow(rowsByQuery, "open_cart"), "event_count"), valueFor(eventRow(rowsByQuery, "open_cart"), "unique_sessions")],
    ["copy_order_request", "Скопійовано заявку", valueFor(eventRow(rowsByQuery, "copy_order_request"), "event_count"), valueFor(eventRow(rowsByQuery, "copy_order_request"), "unique_sessions")]
  ];

  return steps.map(([key, label, eventCount, uniqueSessions], index) => {
    const previousSessions = index === 0 ? uniqueSessions : steps[index - 1][3];
    const conversionFromPrevious = index === 0 ? 100 : percent(uniqueSessions, previousSessions);
    const conversionFromSession = index === 0 ? 100 : percent(uniqueSessions, metrics.sessions);
    return {
      key,
      step: label,
      event_count: eventCount,
      unique_sessions: uniqueSessions,
      conversion_from_previous: conversionFromPrevious,
      conversion_from_session: conversionFromSession,
      drop_off: index === 0 ? 0 : Math.max(0, Math.round((100 - conversionFromPrevious) * 100) / 100),
      value: eventCount
    };
  });
}

function commercialPlaceholder() {
  return {
    connected: false,
    status: "ORDER_SOURCE_NOT_CONNECTED",
    message: "Confirmed order analytics not connected.",
    fake_order_metrics_created: false
  };
}

function geographyStatus() {
  return {
    country_analytics_available: false,
    city_analytics_available: false,
    privacy_safe: true,
    reason: "Current event schema does not store Cloudflare country code, and the dashboard does not store IP addresses."
  };
}

function searchAnalyticsStatus() {
  return {
    deferred: true,
    reason: "Search terms need a separate privacy review before they are shown in admin reports."
  };
}

export function assembleAnalyticsSummary(range, rowsByQuery, options = {}) {
  const previousRows = options.previousRowsByQuery || {};
  const previousRange = options.previousRange || previousAnalyticsPeriod(range);
  const metrics = baseMetrics(rowsByQuery);
  const previousMetrics = baseMetrics(previousRows);
  const topProducts = plantRows(rowsByQuery);
  const popularPages = pageRows(rowsByQuery, metrics.page_views);
  const sources = sourceRows(rowsByQuery);
  const devices = deviceRows(rowsByQuery);

  return {
    configured: true,
    range: {
      ...range,
      previous: previousRange
    },
    metrics,
    previous_metrics: previousMetrics,
    kpis: kpiRows(metrics, previousMetrics),
    daily_series: (rowsByQuery.dailyMetrics || []).map((row) => ({
      day: String(row.day || ""),
      event_name: String(row.event_name || ""),
      count: valueFor(row, "event_count"),
      unique_sessions: valueFor(row, "unique_sessions")
    })),
    daily_table: dailyRows(rowsByQuery),
    top_products: topProducts,
    popular_pages: popularPages,
    traffic_sources: sources,
    source_quality: sources,
    device_classes: devices,
    event_table: eventTable(rowsByQuery),
    funnel: funnelRows(rowsByQuery, metrics),
    commercial: commercialPlaceholder(),
    geography: geographyStatus(),
    search_analytics: searchAnalyticsStatus(),
    meta: {
      generated_at: new Date().toISOString(),
      query_count: options.queryCount || 0,
      dashboard_api_request_count: 1,
      p95_estimate_available: false,
      summary_response_size: options.responseSize || null
    }
  };
}
