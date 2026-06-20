const MAX_EXPORT_ORDERS = 100;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function authorized(request, env) {
  const expected = cleanText(env.W2_SYNC_TOKEN, 256);
  const header = request.headers.get("Authorization") || "";
  return expected && header === `Bearer ${expected}`;
}

export async function onRequestGet(context) {
  if (!authorized(context.request, context.env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }
  if (!context.env.SITE_REQUESTS_DB) {
    return json({ ok: false, error: "Site request storage is not configured." }, 503);
  }

  const result = await context.env.SITE_REQUESTS_DB.prepare(
    `SELECT
       o.request_id,
       o.received_at,
       o.customer_name,
       o.customer_contact,
       o.delivery_method,
       o.delivery_address,
       o.customer_comment,
       o.telegram_status,
       i.line_no,
       i.plant_id,
       i.product_name,
       i.container,
       i.unit,
       i.qty,
       i.unit_price
     FROM site_orders o
     JOIN site_order_items i ON i.request_id = o.request_id
     WHERE o.request_id IN (
       SELECT request_id
       FROM site_orders
       WHERE sync_status = 'new'
       ORDER BY received_at, request_id
       LIMIT ?
     )
     ORDER BY o.received_at, o.request_id, i.line_no
    `
  )
    .bind(MAX_EXPORT_ORDERS)
    .all();

  return json({ ok: true, rows: result.results || [] });
}

export async function onRequestPost(context) {
  if (!authorized(context.request, context.env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }
  if (!context.env.SITE_REQUESTS_DB) {
    return json({ ok: false, error: "Site request storage is not configured." }, 503);
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON." }, 400);
  }
  const requestIds = Array.isArray(payload?.requestIds)
    ? [...new Set(payload.requestIds.map((value) => cleanText(value, 80)).filter(Boolean))]
    : [];
  if (requestIds.length < 1 || requestIds.length > 100) {
    return json({ ok: false, error: "requestIds must contain 1-100 IDs." }, 400);
  }

  const now = new Date().toISOString();
  const statements = requestIds.map((requestId) =>
    context.env.SITE_REQUESTS_DB.prepare(
      `UPDATE site_orders
       SET sync_status = 'imported', imported_at = ?
       WHERE request_id = ? AND sync_status = 'new'`
    ).bind(now, requestId)
  );
  const results = await context.env.SITE_REQUESTS_DB.batch(statements);
  const imported = results.reduce(
    (sum, result) => sum + Number(result.meta?.changes || 0),
    0
  );
  return json({ ok: true, imported });
}
