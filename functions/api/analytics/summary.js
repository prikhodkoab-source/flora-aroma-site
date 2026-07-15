import {
  ANALYTICS_DATASET,
  assembleAnalyticsSummary,
  buildSummaryQueries,
  emptyAnalyticsSummary,
  jsonResponse,
  parseAnalyticsPeriod,
  parseSqlJson,
  previousAnalyticsPeriod,
  validateDatasetName
} from "../../_analytics.js";

function hasSummaryConfig(env) {
  const values = [env?.CF_ACCOUNT_ID, env?.CF_ANALYTICS_API_TOKEN, env?.CF_ANALYTICS_DATASET].map((value) =>
    String(value || "")
  );
  return values.every((value) => value && !value.startsWith("REPLACE_WITH_"));
}

async function runSql(env, query) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CF_ANALYTICS_API_TOKEN}`,
        "Content-Type": "text/plain"
      },
      body: query
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`analytics_sql_${response.status}`);
  }
  return parseSqlJson(text);
}

export async function onRequestGet({ request, env }) {
  const range = parseAnalyticsPeriod(request.url);
  if (!range.ok) {
    return jsonResponse({ ok: false, error: range.error }, 400);
  }

  if (!hasSummaryConfig(env)) {
    return jsonResponse({
      ok: false,
      ...emptyAnalyticsSummary(range, "not_configured"),
      message: "Аналітику ще не підключено до Cloudflare. Дані не збираються."
    }, 503);
  }

  const dataset = env.CF_ANALYTICS_DATASET || ANALYTICS_DATASET;
  if (!validateDatasetName(dataset)) {
    return jsonResponse({ ok: false, error: "dataset_invalid" }, 500);
  }

  try {
    const previousRange = previousAnalyticsPeriod(range);
    const queries = buildSummaryQueries(dataset, range);
    const previousQueries = buildSummaryQueries(dataset, previousRange, { includeDetails: false });
    const rowsByQuery = {};
    for (const [name, query] of Object.entries(queries)) {
      rowsByQuery[name] = await runSql(env, query);
    }

    const previousRowsByQuery = {};
    for (const [name, query] of Object.entries(previousQueries)) {
      previousRowsByQuery[name] = await runSql(env, query);
    }

    return jsonResponse({
      ok: true,
      ...assembleAnalyticsSummary(range, rowsByQuery, {
        previousRange,
        previousRowsByQuery,
        queryCount: Object.keys(queries).length + Object.keys(previousQueries).length
      })
    });
  } catch {
    return jsonResponse({
      ok: false,
      ...emptyAnalyticsSummary(range, "query_failed"),
      message: "Не вдалося отримати статистику Cloudflare Analytics Engine."
    }, 502);
  }
}

export function onRequestPost() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { Allow: "GET" });
}
