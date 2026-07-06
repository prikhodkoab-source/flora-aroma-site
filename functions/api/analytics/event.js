import {
  analyticsDataPoint,
  jsonResponse,
  readJsonRequest,
  sanitizeAnalyticsPayload,
  validateAnalyticsOrigin
} from "../../_analytics.js";

export function onRequestGet() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { Allow: "POST" });
}

export async function onRequestPost({ request, env }) {
  const origin = validateAnalyticsOrigin(request, env);
  if (!origin.ok) {
    return jsonResponse({ ok: false, error: origin.error }, 403);
  }

  const parsed = await readJsonRequest(request);
  if (!parsed.ok) {
    return jsonResponse({ ok: false, error: parsed.error }, parsed.status);
  }

  const sanitized = sanitizeAnalyticsPayload(parsed.payload);
  if (!sanitized.ok) {
    return jsonResponse({ ok: false, error: "payload_rejected", details: sanitized.errors }, 400);
  }

  if (!env?.FLORA_ANALYTICS || typeof env.FLORA_ANALYTICS.writeDataPoint !== "function") {
    return jsonResponse({ ok: false, error: "analytics_not_configured" }, 503);
  }

  try {
    env.FLORA_ANALYTICS.writeDataPoint(analyticsDataPoint(sanitized.event));
    return jsonResponse({ ok: true, stored: true });
  } catch {
    return jsonResponse({ ok: false, error: "analytics_write_failed" }, 503);
  }
}
