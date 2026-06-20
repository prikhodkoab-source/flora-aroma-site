import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/api/site-order.js";

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const sentMessages = [];

globalThis.fetch = async (url, options) => {
  sentMessages.push({ url: String(url), body: JSON.parse(options.body) });
  return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

function context(payload, env = {}) {
  return {
    request: new Request("https://flora-aroma-site.pages.dev/api/site-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://flora-aroma-site.pages.dev"
      },
      body: JSON.stringify(payload)
    }),
    env: {
      TELEGRAM_TOKEN: "test-token",
      TELEGRAM_CHAT_ID: "123456",
      ...env
    }
  };
}

const validPayload = {
  customer: {
    name: "Тестовий клієнт",
    contact: "@test",
    delivery: "Самовивіз",
    address: ""
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
assert.equal(successBody.status, "draft");
assert.match(successBody.requestId, /^SITE-\d{14}-[A-F0-9]{6}$/);
assert.equal(sentMessages.length, 1);
assert.match(sentMessages[0].body.text, /СТАТУС: draft \/ заявка без резерву/);
assert.match(sentMessages[0].body.text, /Наявність, ціни, резерв і умови отримання має підтвердити оператор/);

const emptyCart = await onRequestPost(context({ ...validPayload, items: [] }));
assert.equal(emptyCart.status, 400);

const forgedPlant = await onRequestPost(
  context({
    ...validPayload,
    items: [{ ...validPayload.items[0], plantId: "UNKNOWN" }]
  })
);
assert.equal(forgedPlant.status, 400);

const forgedPrice = await onRequestPost(
  context({
    ...validPayload,
    items: [{ ...validPayload.items[0], price: 1 }]
  })
);
assert.equal(forgedPrice.status, 400);

console.error = () => {};
const missingSecrets = await onRequestPost(
  context(validPayload, { TELEGRAM_TOKEN: "", TELEGRAM_CHAT_ID: "", TELEGRAM_ALLOWED_USER_IDS: "" })
);
assert.equal(missingSecrets.status, 503);

const getResponse = onRequestGet();
assert.equal(getResponse.status, 405);

globalThis.fetch = originalFetch;
console.error = originalConsoleError;
console.log("Site order function tests passed.");
