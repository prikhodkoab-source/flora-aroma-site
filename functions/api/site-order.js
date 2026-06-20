import { productCatalog } from "../_product-catalog.js";

const MAX_ITEMS = 50;
const MAX_MESSAGE_LENGTH = 3900;

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
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeQty(value) {
  const qty = Number(value);
  return Number.isInteger(qty) && qty >= 1 && qty <= 999 ? qty : null;
}

function normalizePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 && price <= 100000 ? Math.round(price * 100) / 100 : null;
}

function firstChatId(env) {
  if (env.TELEGRAM_CHAT_ID) return cleanText(env.TELEGRAM_CHAT_ID, 64);
  return cleanText(env.TELEGRAM_ALLOWED_USER_IDS, 200).split(/[,\s;]+/).filter(Boolean)[0] || "";
}

function makeRequestId() {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `SITE-${timestamp}-${suffix}`;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return { error: "Некоректні дані заявки." };
  if (cleanText(payload.website, 100)) return { error: "Заявку відхилено." };

  const name = cleanText(payload.customer?.name, 80);
  const contact = cleanText(payload.customer?.contact, 100);
  const delivery = cleanText(payload.customer?.delivery, 80) || "Не вказано";
  const address = cleanText(payload.customer?.address, 180);
  const comment = cleanText(payload.comment, 500);
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  if (!name) return { error: "Вкажіть ім'я." };
  if (!contact) return { error: "Вкажіть телефон або Telegram/Viber." };
  if (rawItems.length < 1) return { error: "Кошик порожній." };
  if (rawItems.length > MAX_ITEMS) return { error: "У заявці забагато позицій." };

  const items = [];
  for (const raw of rawItems) {
    const plantId = cleanText(raw?.plantId, 40);
    const container = cleanText(raw?.container, 100);
    const qty = normalizeQty(raw?.qty);
    const price = normalizePrice(raw?.price);
    const catalogProduct = productCatalog[plantId];
    const catalogVariant = catalogProduct?.variants.find(
      (variant) => variant.container === container && Number(variant.price) === price
    );

    if (
      !/^PLANT-\d{4}$/.test(plantId) ||
      !catalogProduct ||
      !catalogVariant ||
      !container ||
      qty === null ||
      price === null
    ) {
      return { error: "Одна з позицій не відповідає актуальному публічному каталогу." };
    }

    items.push({
      plantId,
      name: catalogProduct.name,
      container: catalogVariant.container,
      unit: catalogVariant.unit,
      qty,
      price: Number(catalogVariant.price)
    });
  }

  return { value: { name, contact, delivery, address, comment, items } };
}

function buildTelegramMessage(requestId, order) {
  const total = order.items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const lines = [
    "НОВА ЗАЯВКА ІЗ САЙТУ",
    `ID: ${requestId}`,
    "",
    `Клієнт: ${order.name}`,
    `Контакт: ${order.contact}`,
    `Отримання: ${order.delivery}`,
    `Адреса: ${order.address || "не вказана"}`,
    "",
    "Позиції:",
    ...order.items.map(
      (item) =>
        `- ${item.name} (${item.plantId}), ${item.container}: ${item.qty} ${item.unit} x ${item.price} UAH = ${Math.round(item.qty * item.price)} UAH`
    ),
    "",
    `Попередня сума: ${Math.round(total)} UAH`,
    `Коментар: ${order.comment || "немає"}`,
    "",
    "СТАТУС: draft / заявка без резерву.",
    "Наявність, ціни, резерв і умови отримання має підтвердити оператор."
  ];

  return lines.join("\n").slice(0, MAX_MESSAGE_LENGTH);
}

export async function onRequestPost(context) {
  const requestUrl = new URL(context.request.url);
  const origin = context.request.headers.get("Origin");
  if (origin && origin !== requestUrl.origin) {
    return json({ ok: false, error: "Заборонене джерело запиту." }, 403);
  }

  const contentLength = Number(context.request.headers.get("Content-Length") || 0);
  if (contentLength > 30000) {
    return json({ ok: false, error: "Заявка завелика." }, 413);
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ ok: false, error: "Некоректний формат заявки." }, 400);
  }

  const validation = validatePayload(payload);
  if (validation.error) {
    return json({ ok: false, error: validation.error }, 400);
  }

  const token = cleanText(context.env.TELEGRAM_TOKEN, 256);
  const chatId = firstChatId(context.env);
  if (!token || !chatId) {
    console.error("Telegram site-order bindings are not configured.");
    return json({ ok: false, error: "Канал заявок тимчасово не налаштований. Зателефонуйте оператору." }, 503);
  }

  const requestId = makeRequestId();
  const message = buildTelegramMessage(requestId, validation.value);
  const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true
    })
  });

  if (!telegramResponse.ok) {
    console.error("Telegram sendMessage failed.", telegramResponse.status);
    return json({ ok: false, error: "Не вдалося передати заявку оператору. Спробуйте ще раз або зателефонуйте." }, 502);
  }

  return json({
    ok: true,
    requestId,
    status: "draft",
    message: "Заявку передано оператору. Очікуйте підтвердження наявності та резерву."
  });
}

export function onRequestGet() {
  return json({ ok: false, error: "Метод не підтримується." }, 405);
}
