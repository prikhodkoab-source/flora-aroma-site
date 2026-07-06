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
  const presetDays = { "7d": 7, "30d": 30, "365d": 365 };

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
      to: toDate.toISOString()
    };
  }

  const selectedPreset = preset || "30d";
  if (!Object.hasOwn(presetDays, selectedPreset)) {
    return { ok: false, error: "period_invalid" };
  }

  const toDate = now;
  const fromDate = new Date(toDate.getTime() - presetDays[selectedPreset] * 86_400_000);
  return {
    ok: true,
    preset: selectedPreset,
    from: fromDate.toISOString(),
    to: toDate.toISOString()
  };
}

function sqlString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function validateDatasetName(dataset) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(dataset || "");
}

export function buildSummaryQueries(dataset, range) {
  if (!validateDatasetName(dataset)) {
    throw new Error("dataset_invalid");
  }

  const from = sqlString(range.from);
  const to = sqlString(range.to);
  const where = `timestamp >= toDateTime('${from}') AND timestamp <= toDateTime('${to}')`;

  return {
    sessions: `SELECT uniq(index1) AS sessions FROM ${dataset} WHERE ${where} FORMAT JSON`,
    eventCounts: `SELECT blob1 AS event_name, SUM(_sample_interval) AS count FROM ${dataset} WHERE ${where} GROUP BY event_name FORMAT JSON`,
    dailySeries: `SELECT toDate(timestamp) AS day, blob1 AS event_name, SUM(_sample_interval) AS count FROM ${dataset} WHERE ${where} AND blob1 IN ('page_view','view_plant','add_to_cart','copy_order_request') GROUP BY day, event_name ORDER BY day ASC FORMAT JSON`,
    topProducts: `SELECT blob4 AS plant_id, blob5 AS plant_name, blob1 AS event_name, SUM(_sample_interval) AS count FROM ${dataset} WHERE ${where} AND blob4 != '' AND blob1 IN ('view_plant','add_to_cart','copy_order_request') GROUP BY plant_id, plant_name, event_name ORDER BY count DESC LIMIT 200 FORMAT JSON`,
    trafficSources: `SELECT if(blob12 = '', 'direct', blob12) AS source, SUM(_sample_interval) AS page_views FROM ${dataset} WHERE ${where} AND blob1 = 'page_view' GROUP BY source ORDER BY page_views DESC LIMIT 20 FORMAT JSON`,
    deviceClasses: `SELECT if(blob16 = '', 'unknown', blob16) AS device_class, SUM(_sample_interval) AS sessions FROM ${dataset} WHERE ${where} AND blob1 = 'page_view' GROUP BY device_class ORDER BY sessions DESC FORMAT JSON`
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
      copied_requests: 0,
      conversions: 0
    },
    daily_series: [],
    top_products: [],
    traffic_sources: [],
    device_classes: [],
    funnel: []
  };
}

function countFor(eventCounts, eventName) {
  const row = eventCounts.find((item) => item.event_name === eventName);
  return Math.round(Number(row?.count || 0));
}

export function assembleAnalyticsSummary(range, rowsByQuery) {
  const eventCounts = rowsByQuery.eventCounts || [];
  const sessions = Math.round(Number(rowsByQuery.sessions?.[0]?.sessions || 0));
  const pageViews = countFor(eventCounts, "page_view");
  const productViews = countFor(eventCounts, "view_plant");
  const addToCart = countFor(eventCounts, "add_to_cart");
  const copiedRequests = countFor(eventCounts, "copy_order_request");
  const conversions = pageViews > 0 ? Math.round((copiedRequests / pageViews) * 10_000) / 100 : 0;

  const products = new Map();
  for (const row of rowsByQuery.topProducts || []) {
    const plantId = row.plant_id || "";
    if (!plantId) continue;
    const current = products.get(plantId) || {
      plant_id: plantId,
      plant_name: row.plant_name || plantId,
      views: 0,
      add_to_cart: 0,
      copied_requests: 0
    };
    if (row.event_name === "view_plant") current.views += Number(row.count || 0);
    if (row.event_name === "add_to_cart") current.add_to_cart += Number(row.count || 0);
    if (row.event_name === "copy_order_request") current.copied_requests += Number(row.count || 0);
    products.set(plantId, current);
  }

  const topProducts = Array.from(products.values())
    .map((item) => ({
      ...item,
      views: Math.round(item.views),
      add_to_cart: Math.round(item.add_to_cart),
      copied_requests: Math.round(item.copied_requests)
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return {
    configured: true,
    range,
    metrics: {
      sessions,
      page_views: pageViews,
      product_views: productViews,
      add_to_cart: addToCart,
      copied_requests: copiedRequests,
      conversions
    },
    daily_series: (rowsByQuery.dailySeries || []).map((row) => ({
      day: String(row.day || ""),
      event_name: String(row.event_name || ""),
      count: Math.round(Number(row.count || 0))
    })),
    top_products: topProducts,
    traffic_sources: (rowsByQuery.trafficSources || []).map((row) => ({
      source: String(row.source || "direct"),
      page_views: Math.round(Number(row.page_views || 0))
    })),
    device_classes: (rowsByQuery.deviceClasses || []).map((row) => ({
      device_class: String(row.device_class || "unknown"),
      sessions: Math.round(Number(row.sessions || 0))
    })),
    funnel: [
      { step: "Перегляди сторінок", value: pageViews },
      { step: "Перегляди рослин", value: productViews },
      { step: "Додавання в кошик", value: addToCart },
      { step: "Заявки оператору", value: copiedRequests }
    ]
  };
}
