import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { onRequestPost as postEvent } from "../functions/api/analytics/event.js";
import { onRequestGet as getD5Diagnostics } from "../functions/api/analytics/d5-diagnostics.js";
import { onRequestGet as getSummary } from "../functions/api/analytics/summary.js";
import {
  ANALYTICS_COLUMN_MAP,
  analyticsDataPoint,
  buildSummaryQueries,
  parseAnalyticsPeriod,
  sanitizeAnalyticsPayload
} from "../functions/_analytics.js";

function eventRequest(payload, headers = {}) {
  return new Request("https://flora-aroma.com.ua/api/analytics/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://flora-aroma.com.ua",
      ...headers
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload)
  });
}

const validPayload = {
  event_name: "select_variant",
  session_id: "123e4567-e89b-42d3-a456-426614174000",
  pathname: "/plants/agastakhe-fenkhelne-plant-0084/",
  page_title: "Агастахе фенхельне | Flora & Aroma",
  plant_id: "PLANT-0084",
  plant_name: "Агастахе фенхельне",
  product_option: "kaseta-hiko-v-120ss",
  container: "Касета Hiko V-120ss",
  quantity: 2,
  public_unit_price: 30,
  currency: "UAH",
  exact_stock: 999,
  customer_phone: "+380500000000"
};

const written = [];
const ok = await postEvent({
  request: eventRequest(validPayload),
  env: {
    FLORA_ANALYTICS: {
      writeDataPoint(point) {
        written.push(point);
      }
    }
  }
});
assert.equal(ok.status, 200);
assert.equal((await ok.json()).stored, true);
assert.equal(written.length, 1);
assert.equal(written[0].indexes[0], validPayload.session_id);
assert.equal(written[0].blobs[0], "select_variant");
assert.equal(written[0].blobs[3], "PLANT-0084");
assert.equal(written[0].blobs[5], "kaseta-hiko-v-120ss");
assert.equal(written[0].blobs[6], "Касета Hiko V-120ss");
assert.deepEqual(written[0].doubles, [2, 30]);
assert.equal(JSON.stringify(written[0]).includes("customer_phone"), false);
assert.equal(JSON.stringify(written[0]).includes("exact_stock"), false);

const unknown = await postEvent({
  request: eventRequest({ ...validPayload, event_name: "confirmed_order" }),
  env: { FLORA_ANALYTICS: { writeDataPoint() {} } }
});
assert.equal(unknown.status, 400);

const piiSearch = await postEvent({
  request: eventRequest({
    ...validPayload,
    event_name: "catalog_search",
    search_query: "+380500272882"
  }),
  env: { FLORA_ANALYTICS: { writeDataPoint() {} } }
});
assert.equal(piiSearch.status, 400);

const emailSearch = sanitizeAnalyticsPayload({
  ...validPayload,
  event_name: "catalog_search",
  search_query: "client@example.com"
});
assert.equal(emailSearch.ok, false);
assert.deepEqual(emailSearch.errors, ["search_query_sensitive"]);

const longString = sanitizeAnalyticsPayload({
  ...validPayload,
  plant_name: "А".repeat(300)
});
assert.equal(longString.ok, true);
assert.equal(longString.event.plant_name.length, 140);

for (const badPayload of [
  { ...validPayload, quantity: 0 },
  { ...validPayload, quantity: 10000 },
  { ...validPayload, public_unit_price: -1 },
  { ...validPayload, public_unit_price: 100001 }
]) {
  const response = await postEvent({
    request: eventRequest(badPayload),
    env: { FLORA_ANALYTICS: { writeDataPoint() {} } }
  });
  assert.equal(response.status, 400);
}

const badContentType = await postEvent({
  request: eventRequest("{}", { "Content-Type": "text/plain" }),
  env: { FLORA_ANALYTICS: { writeDataPoint() {} } }
});
assert.equal(badContentType.status, 415);

const badOrigin = await postEvent({
  request: eventRequest(validPayload, { Origin: "https://example.com" }),
  env: { FLORA_ANALYTICS: { writeDataPoint() {} } }
});
assert.equal(badOrigin.status, 403);

const noBinding = await postEvent({ request: eventRequest(validPayload), env: {} });
assert.equal(noBinding.status, 503);
assert.equal((await noBinding.json()).error, "analytics_not_configured");

const noSummaryConfig = await getSummary({
  request: new Request("https://flora-aroma.com.ua/api/analytics/summary?preset=30d"),
  env: {}
});
assert.equal(noSummaryConfig.status, 503);
assert.equal((await noSummaryConfig.json()).configured, false);

const placeholderSummaryConfig = await getSummary({
  request: new Request("https://flora-aroma.com.ua/api/analytics/summary?preset=30d"),
  env: {
    CF_ACCOUNT_ID: "REPLACE_WITH_CLOUDFLARE_ACCOUNT_ID",
    CF_ANALYTICS_API_TOKEN: "REPLACE_WITH_TOKEN",
    CF_ANALYTICS_DATASET: "flora_aroma_site_events"
  }
});
assert.equal(placeholderSummaryConfig.status, 503);

const invalidPeriod = await getSummary({
  request: new Request("https://flora-aroma.com.ua/api/analytics/summary?preset=90d"),
  env: {}
});
assert.equal(invalidPeriod.status, 400);

assert.throws(
  () => buildSummaryQueries("flora;drop", { from: new Date().toISOString(), to: new Date().toISOString() }),
  /dataset_invalid/
);

const summaryQueries = buildSummaryQueries("flora_aroma_analytics_preview", {
  from: "2026-07-08T19:45:32.833Z",
  to: "2026-07-15T19:45:32.833Z"
});
assert.equal(summaryQueries.sessions.includes("uniq("), false);
assert.equal(summaryQueries.sessions.includes("count(DISTINCT index1)"), true);
assert.match(summaryQueries.sessions, /toDateTime\('2026-07-08 19:45:32'\)/);
assert.match(summaryQueries.sessions, /toDateTime\('2026-07-15 19:45:32'\)/);
for (const query of Object.values(summaryQueries)) {
  assert.equal(query.includes("T19:45:32"), false);
  assert.equal(query.includes(".833Z"), false);
  assert.equal(query.includes("Z'"), false);
}

const presetPeriod = parseAnalyticsPeriod(
  "https://flora-aroma.com.ua/api/analytics/summary?preset=7d",
  new Date("2026-07-15T19:45:32.833Z")
);
assert.equal(presetPeriod.ok, true);
assert.equal(presetPeriod.preset, "7d");
const presetQueries = buildSummaryQueries("flora_aroma_analytics_preview", presetPeriod);
assert.match(presetQueries.sessions, /toDateTime\('2026-07-08 19:45:32'\)/);
assert.match(presetQueries.sessions, /toDateTime\('2026-07-15 19:45:32'\)/);

const customPeriod = parseAnalyticsPeriod(
  "https://flora-aroma.com.ua/api/analytics/summary?from=2026-07-01&to=2026-07-14"
);
assert.equal(customPeriod.ok, true);
assert.equal(customPeriod.preset, "custom");
const customQueries = buildSummaryQueries("flora_aroma_analytics_preview", customPeriod);
assert.match(customQueries.sessions, /toDateTime\('2026-07-01 00:00:00'\)/);
assert.match(customQueries.sessions, /toDateTime\('2026-07-14 23:59:59'\)/);

const mapped = analyticsDataPoint(sanitizeAnalyticsPayload(validPayload).event);
assert.equal(mapped.indexes.length, ANALYTICS_COLUMN_MAP.indexes.length);
assert.equal(mapped.blobs.length, ANALYTICS_COLUMN_MAP.blobs.length);
assert.equal(mapped.doubles.length, ANALYTICS_COLUMN_MAP.doubles.length);

for (const file of [
  "functions/_analytics.js",
  "functions/api/analytics/event.js",
  "functions/api/analytics/summary.js",
  "src/lib/analytics.ts",
  "public/cart.js"
]) {
  const text = readFileSync(join(process.cwd(), file), "utf8");
  assert.equal(text.includes("data/normalized"), false, `${file} must not touch Flora accounting CSVs`);
  assert.equal(text.includes("StockMovements"), false, `${file} must not write stock movements`);
}

function readDistText(directory) {
  let combined = "";
  if (!existsSync(directory)) return combined;
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) combined += readDistText(path);
    if (stats.isFile() && /\.(html|js|css)$/.test(entry)) {
      combined += readFileSync(path, "utf8");
    }
  }
  return combined;
}

const distText = readDistText(join(process.cwd(), "dist"));
if (distText) {
  assert.equal(distText.includes("CF_ANALYTICS_API_TOKEN"), false);
  assert.equal(distText.includes("replace_with_account_analytics_read_token"), false);
}

const blockedDiagnostic = await getD5Diagnostics({
  request: new Request("https://flora-aroma.com.ua/api/analytics/d5-diagnostics"),
  env: {}
});
assert.equal(blockedDiagnostic.status, 404);

const diagnosticCalls = [];
async function diagnosticFetch(_url, options) {
  diagnosticCalls.push(options.body);
  assert.equal(String(options.headers.Authorization).includes("SECRET_TOKEN_VALUE"), true);
  const response = (body, status = 200) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  if (options.body.includes("Hello Workers Analytics Engine")) {
    return response({ data: [{ message: "Hello Workers Analytics Engine" }] });
  }
  if (options.body === "SHOW TABLES") {
    return response("name\nflora_aroma_analytics_preview\n");
  }
  if (options.body.includes("SELECT * FROM flora_aroma_analytics_preview LIMIT 10")) {
    return response({ data: [{ timestamp: "2026-07-14 12:00:00", index1: "other-session", blob1: "page_view" }] });
  }
  if (options.body.includes("d5-verification-test-20260714-v2")) {
    return response({ data: [{ matching_rows: 1 }] });
  }
  if (options.body.includes("count(DISTINCT index1)")) {
    return response({ data: [{ sessions: 1 }] });
  }
  if (options.body.includes("GROUP BY event_name FORMAT JSON")) {
    return response({ data: [{ event_name: "page_view", count: 1 }] });
  }
  return response({ errors: [{ code: 9200, message: "Safe test SQL error for diagnostic route" }] }, 400);
}

const diagnostic = await getD5Diagnostics({
  request: new Request("https://flora-aroma.com.ua/api/analytics/d5-diagnostics?confirm=D5_READ_ONLY_DIAGNOSTICS"),
  env: {
    CF_ACCOUNT_ID: "ACCOUNT_ID",
    CF_ANALYTICS_API_TOKEN: "SECRET_TOKEN_VALUE",
    CF_ANALYTICS_DATASET: "flora_aroma_analytics_preview"
  },
  fetchFn: diagnosticFetch
});
assert.equal(diagnostic.status, 200);
const diagnosticBody = await diagnostic.json();
assert.equal(JSON.stringify(diagnosticBody).includes("SECRET_TOKEN_VALUE"), false);
assert.equal(JSON.stringify(diagnosticBody).includes("Authorization"), false);
assert.equal(diagnosticBody.auth_probe.success, true);
assert.equal(diagnosticBody.show_tables.dataset_present, true);
assert.equal(diagnosticBody.minimal_select.success, true);
assert.equal(diagnosticBody.test_marker_column, "index1");
assert.equal(diagnosticBody.test_event_read_back, true);
assert.equal(diagnosticBody.matching_rows, 1);
assert.equal(diagnosticBody.first_failing_query, "dailySeries");
assert.equal(diagnosticBody.first_failing_error_code, 9200);
assert.equal(diagnosticBody.root_cause_category, "F. Specific summary query error");
assert.equal(diagnosticBody.new_analytics_event_sent, "no");
assert.ok(diagnosticCalls.length >= 6);

console.log("Analytics function tests passed.");
