import assert from "node:assert/strict";
import { onRequestGet as exportGet, onRequestPost as exportAck } from "../functions/api/site-orders.js";
import { onRequestGet, onRequestPost } from "../functions/api/site-order.js";

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const sentMessages = [];

class MockStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    if (this.sql.includes("WHERE submission_id = ?")) {
      return this.db.orders.find((row) => row.submission_id === this.values[0]) || null;
    }
    throw new Error(`Unsupported first SQL: ${this.sql}`);
  }

  async all() {
    if (!this.sql.includes("FROM site_orders o")) {
      throw new Error(`Unsupported all SQL: ${this.sql}`);
    }
    const pending = this.db.orders
      .filter((order) => order.sync_status === "new")
      .sort((a, b) => a.received_at.localeCompare(b.received_at))
      .slice(0, Number(this.values[0]));
    const ids = new Set(pending.map((order) => order.request_id));
    return {
      results: this.db.items
        .filter((item) => ids.has(item.request_id))
        .map((item) => {
          const order = this.db.orders.find((row) => row.request_id === item.request_id);
          return { ...order, ...item };
        })
    };
  }

  async run() {
    if (this.sql.startsWith("UPDATE site_orders SET telegram_status")) {
      const [telegram_status, telegram_error, request_id] = this.values;
      Object.assign(this.db.orders.find((row) => row.request_id === request_id), {
        telegram_status,
        telegram_error
      });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE site_orders SET sync_status")) {
      const [imported_at, request_id] = this.values;
      const row = this.db.orders.find(
        (order) => order.request_id === request_id && order.sync_status === "new"
      );
      if (!row) return { meta: { changes: 0 } };
      Object.assign(row, { sync_status: "imported", imported_at });
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unsupported run SQL: ${this.sql}`);
  }
}

class MockD1 {
  constructor() {
    this.orders = [];
    this.items = [];
  }

  prepare(sql) {
    return new MockStatement(this, sql);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) {
      if (statement.sql.startsWith("INSERT INTO site_orders")) {
        const [
          request_id,
          submission_id,
          received_at,
          customer_name,
          customer_contact,
          delivery_method,
          delivery_address,
          customer_comment
        ] = statement.values;
        this.orders.push({
          request_id,
          submission_id,
          received_at,
          customer_name,
          customer_contact,
          delivery_method,
          delivery_address,
          customer_comment,
          telegram_status: "pending",
          telegram_error: "",
          sync_status: "new"
        });
        results.push({ meta: { changes: 1 } });
      } else if (statement.sql.startsWith("INSERT INTO site_order_items")) {
        const [request_id, line_no, plant_id, product_name, container, unit, qty, unit_price] =
          statement.values;
        this.items.push({
          request_id,
          line_no,
          plant_id,
          product_name,
          container,
          unit,
          qty,
          unit_price
        });
        results.push({ meta: { changes: 1 } });
      } else {
        results.push(await statement.run());
      }
    }
    return results;
  }
}

globalThis.fetch = async (url, options) => {
  sentMessages.push({ url: String(url), body: JSON.parse(options.body) });
  return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

const db = new MockD1();
const env = {
  TELEGRAM_TOKEN: "test-token",
  TELEGRAM_CHAT_ID: "123456",
  W2_SYNC_TOKEN: "sync-secret",
  SITE_REQUESTS_DB: db
};

function context(payload, overrides = {}) {
  return {
    request: new Request("https://flora-aroma-site.pages.dev/api/site-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://flora-aroma-site.pages.dev"
      },
      body: JSON.stringify(payload)
    }),
    env: { ...env, ...overrides }
  };
}

const validPayload = {
  submissionId: "123e4567-e89b-42d3-a456-426614174000",
  customer: {
    name: "Тестовий клієнт",
    contact: "@test",
    delivery: "Нова пошта",
    address: "Київ, відділення 1"
  },
  comment: "Передзвонити",
  website: "",
  items: [
    {
      plantId: "PLANT-0041",
      name: "Шавлія дібровна",
      container: "Касета Hiko V-120ss",
      qty: 2,
      price: 40,
      unit: "шт."
    }
  ]
};

const success = await onRequestPost(context(validPayload));
const successBody = await success.json();
assert.equal(success.status, 200);
assert.equal(successBody.ok, true);
assert.equal(successBody.stored, true);
assert.equal(successBody.telegramStatus, "sent");
assert.equal(db.orders.length, 1);
assert.equal(db.items.length, 1);
assert.equal(db.orders[0].delivery_method, "Нова пошта");
assert.equal(db.orders[0].delivery_address, "Київ, відділення 1");

const duplicate = await onRequestPost(context(validPayload));
assert.equal((await duplicate.json()).duplicate, true);
assert.equal(db.orders.length, 1);

const noTelegramPayload = {
  ...validPayload,
  submissionId: "123e4567-e89b-42d3-a456-426614174001"
};
const noTelegram = await onRequestPost(
  context(noTelegramPayload, { TELEGRAM_TOKEN: "", TELEGRAM_CHAT_ID: "" })
);
const noTelegramBody = await noTelegram.json();
assert.equal(noTelegram.status, 200);
assert.equal(noTelegramBody.stored, true);
assert.equal(noTelegramBody.telegramStatus, "not_configured");
assert.equal(db.orders.length, 2);

const exportRequest = new Request("https://flora-aroma-site.pages.dev/api/site-orders", {
  headers: { Authorization: "Bearer sync-secret" }
});
const exported = await exportGet({ request: exportRequest, env });
const exportedBody = await exported.json();
assert.equal(exportedBody.rows.length, 2);
assert.equal(exportedBody.rows[0].delivery_method, "Нова пошта");

const ackRequest = new Request("https://flora-aroma-site.pages.dev/api/site-orders", {
  method: "POST",
  headers: {
    Authorization: "Bearer sync-secret",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ requestIds: [successBody.requestId] })
});
const ack = await exportAck({ request: ackRequest, env });
assert.equal((await ack.json()).imported, 1);
assert.equal(db.orders[0].sync_status, "imported");

const unauthorized = await exportGet({
  request: new Request("https://flora-aroma-site.pages.dev/api/site-orders"),
  env
});
assert.equal(unauthorized.status, 401);

const emptyCart = await onRequestPost(context({ ...validPayload, items: [] }));
assert.equal(emptyCart.status, 400);

const forgedPrice = await onRequestPost(
  context({
    ...validPayload,
    submissionId: "123e4567-e89b-42d3-a456-426614174002",
    items: [{ ...validPayload.items[0], price: 1 }]
  })
);
assert.equal(forgedPrice.status, 400);

const getResponse = onRequestGet();
assert.equal(getResponse.status, 405);

globalThis.fetch = originalFetch;
console.error = originalConsoleError;
console.log("Site order function tests passed.");
