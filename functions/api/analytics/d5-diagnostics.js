import {
  ANALYTICS_COLUMN_MAP,
  ANALYTICS_DATASET,
  buildSummaryQueries,
  jsonResponse,
  parseAnalyticsPeriod,
  parseSqlJson,
  validateDatasetName
} from "../../_analytics.js";

const CONFIRMATION = "D5_READ_ONLY_DIAGNOSTICS";
const TEST_MARKER = "d5-verification-test-20260714-v2";

function hasSqlConfig(env) {
  return [env?.CF_ACCOUNT_ID, env?.CF_ANALYTICS_API_TOKEN, env?.CF_ANALYTICS_DATASET]
    .map((value) => String(value || ""))
    .every((value) => value && !value.startsWith("REPLACE_WITH_"));
}

function sqlString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function safeMessage(message, env) {
  let safe = String(message || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .slice(0, 500);
  const token = String(env?.CF_ANALYTICS_API_TOKEN || "");
  if (token) {
    safe = safe.split(token).join("[redacted]");
  }
  return safe
    .replace(/Authorization\s*:\s*[^\s,;]+/gi, "Authorization: [redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .trim() || null;
}

function cloudflareError(parsed, text, env) {
  const error = Array.isArray(parsed?.errors) ? parsed.errors[0] : null;
  return {
    code: error?.code ?? null,
    message: safeMessage(error?.message || text, env)
  };
}

async function runSql(env, query, fetchFn = fetch) {
  const response = await fetchFn(
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
  let parsed = null;
  try {
    parsed = JSON.parse(text || "{}");
  } catch {
    parsed = null;
  }

  let rows = [];
  try {
    rows = parseSqlJson(text);
  } catch {
    rows = [];
  }

  const error = response.ok ? { code: null, message: null } : cloudflareError(parsed, text, env);
  return {
    http_status: response.status,
    success: response.ok,
    cloudflare_error_code: error.code,
    safe_error_message: error.message,
    rows_count: rows.length,
    columns: rows[0] ? Object.keys(rows[0]) : [],
    rows,
    text
  };
}

function publicProbe(result) {
  return {
    http_status: result?.http_status ?? null,
    success: Boolean(result?.success),
    cloudflare_error_code: result?.cloudflare_error_code ?? null,
    safe_error_message: result?.safe_error_message ?? null,
    rows_count: result?.rows_count ?? 0,
    columns: result?.columns || []
  };
}

function datasetIsPresent(showTablesResult, dataset) {
  if (!showTablesResult?.success) return false;
  return `${JSON.stringify(showTablesResult.rows)}\n${showTablesResult.text || ""}`.includes(dataset);
}

function sessionMarkerColumn() {
  const index = ANALYTICS_COLUMN_MAP.indexes.indexOf("session_id");
  return index >= 0 ? `index${index + 1}` : null;
}

function firstCloudflareCount(rows, key) {
  const value = rows?.[0]?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export async function runD5Diagnostics({ request, env, fetchFn = fetch }) {
  const url = new URL(request.url);
  if (url.searchParams.get("confirm") !== CONFIRMATION) {
    return jsonResponse({ ok: false, error: "not_found" }, 404);
  }

  if (!hasSqlConfig(env)) {
    return jsonResponse({
      ok: false,
      error: "not_configured",
      configured: false
    }, 503);
  }

  const dataset = env.CF_ANALYTICS_DATASET || ANALYTICS_DATASET;
  if (!validateDatasetName(dataset)) {
    return jsonResponse({ ok: false, error: "dataset_invalid" }, 500);
  }

  const result = {
    ok: true,
    current_level_before: 3,
    dataset,
    auth_probe: null,
    show_tables: null,
    minimal_select: null,
    test_marker_column: sessionMarkerColumn(),
    test_event_persisted: false,
    test_event_read_back: false,
    matching_rows: 0,
    summary_queries: [],
    first_failing_query: null,
    first_failing_http_status: null,
    first_failing_error_code: null,
    first_failing_error_message_safe: null,
    root_cause_category: "I. Cause not yet proven",
    root_cause_proven: false,
    token_recreation_required: "unknown",
    code_change_required: "unknown",
    config_change_required: "unknown",
    new_analytics_event_sent: "no",
    production_change: "no",
    secret_exposed: "no",
    authorization_header_exposed: "no",
    env_dump_performed: "no"
  };

  const authProbe = await runSql(env, "SELECT 'Hello Workers Analytics Engine' AS message FORMAT JSON", fetchFn);
  result.auth_probe = publicProbe(authProbe);
  if (!authProbe.success) {
    result.root_cause_category = "A. API token/authentication failure";
    result.root_cause_proven = true;
    result.token_recreation_required = "unknown";
    result.code_change_required = "no";
    result.config_change_required = "yes";
    return jsonResponse(result, 200);
  }

  const showTables = await runSql(env, "SHOW TABLES", fetchFn);
  result.show_tables = {
    ...publicProbe(showTables),
    dataset_present: datasetIsPresent(showTables, dataset),
    dataset_name_match: datasetIsPresent(showTables, dataset)
  };
  if (!showTables.success) {
    result.root_cause_category = "H. Another proven cause";
    result.root_cause_proven = true;
    result.first_failing_query = "SHOW TABLES";
    result.first_failing_http_status = showTables.http_status;
    result.first_failing_error_code = showTables.cloudflare_error_code;
    result.first_failing_error_message_safe = showTables.safe_error_message;
    result.token_recreation_required = "no";
    result.code_change_required = "unknown";
    result.config_change_required = "unknown";
    return jsonResponse(result, 200);
  }
  if (!result.show_tables.dataset_present) {
    result.root_cause_category = "C. Dataset does not exist";
    result.root_cause_proven = true;
    result.token_recreation_required = "no";
    result.code_change_required = "no";
    result.config_change_required = "yes";
    return jsonResponse(result, 200);
  }

  const minimalSelect = await runSql(env, `SELECT * FROM ${dataset} LIMIT 10 FORMAT JSON`, fetchFn);
  result.minimal_select = publicProbe(minimalSelect);
  if (!minimalSelect.success) {
    result.root_cause_category = "H. Another proven cause";
    result.root_cause_proven = true;
    result.first_failing_query = "minimal_select";
    result.first_failing_http_status = minimalSelect.http_status;
    result.first_failing_error_code = minimalSelect.cloudflare_error_code;
    result.first_failing_error_message_safe = minimalSelect.safe_error_message;
    result.token_recreation_required = "no";
    result.code_change_required = "unknown";
    result.config_change_required = "unknown";
    return jsonResponse(result, 200);
  }

  if (result.test_marker_column) {
    const markerQuery = `SELECT count() AS matching_rows FROM ${dataset} WHERE ${result.test_marker_column} = '${sqlString(TEST_MARKER)}' FORMAT JSON`;
    const markerResult = await runSql(env, markerQuery, fetchFn);
    result.test_event_read_back = markerResult.success && firstCloudflareCount(markerResult.rows, "matching_rows") > 0;
    result.matching_rows = markerResult.success ? firstCloudflareCount(markerResult.rows, "matching_rows") : 0;
    result.test_event_persisted = result.test_event_read_back;
    if (!markerResult.success) {
      result.first_failing_query = "test_marker_read_back";
      result.first_failing_http_status = markerResult.http_status;
      result.first_failing_error_code = markerResult.cloudflare_error_code;
      result.first_failing_error_message_safe = markerResult.safe_error_message;
    }
  }

  const range = parseAnalyticsPeriod(`${url.origin}/api/analytics/summary?preset=7d`);
  const queries = buildSummaryQueries(dataset, range);
  for (const [name, query] of Object.entries(queries)) {
    const queryResult = await runSql(env, query, fetchFn);
    result.summary_queries.push({
      query_name: name,
      http_status: queryResult.http_status,
      success: queryResult.success,
      safe_error_code: queryResult.cloudflare_error_code,
      safe_error_message: queryResult.safe_error_message
    });
    if (!queryResult.success && !result.first_failing_query) {
      result.first_failing_query = name;
      result.first_failing_http_status = queryResult.http_status;
      result.first_failing_error_code = queryResult.cloudflare_error_code;
      result.first_failing_error_message_safe = queryResult.safe_error_message;
    }
  }

  if (result.first_failing_query) {
    result.root_cause_category = "F. Specific summary query error";
    result.root_cause_proven = true;
    result.token_recreation_required = "no";
    result.code_change_required = "yes";
    result.config_change_required = "no";
  } else if (!result.test_event_read_back) {
    result.root_cause_category = "G. Ingestion/read availability delay";
    result.root_cause_proven = true;
    result.token_recreation_required = "no";
    result.code_change_required = "no";
    result.config_change_required = "no";
  } else {
    result.root_cause_category = "I. Cause not yet proven";
    result.root_cause_proven = false;
    result.token_recreation_required = "no";
    result.code_change_required = "unknown";
    result.config_change_required = "unknown";
  }

  return jsonResponse(result, 200);
}

export function onRequestGet(context) {
  return runD5Diagnostics(context);
}

export function onRequestPost() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { Allow: "GET" });
}
