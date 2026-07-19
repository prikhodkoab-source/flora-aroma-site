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

const CONTAINER_VOLUMES_L = {
  "CASSETTE-HIKO-V120SS": 0.12,
  "CASSETTE-HIKO-V265": 0.265,
  "POT-P9": 0.4,
  "POT-P10": 0.5,
  "POT-P11": 0.6,
  "POT-P12": 0.7,
  "POT-P13": 1.0,
  "POT-P15": 1.5,
  "POT-P18": 2.4,
  "POT-P19": 3.0,
  "POT-P23": 5.0
};

function formatVolumeLabel(volume) {
  return `${Number(volume).toFixed(3).replace(/\.?0+$/, "")} л`;
}

function publicContainerLabel(variant) {
  const containerTypeId = cleanText(variant?.container_type_id, 80).toUpperCase();
  const directVolume = CONTAINER_VOLUMES_L[containerTypeId];
  if (directVolume) {
    return formatVolumeLabel(directVolume);
  }

  const formatCode = cleanText(variant?.format_code, 40).toUpperCase();
  const cassetteMatch = formatCode.match(/^V-?(\d{3})$/);
  if (cassetteMatch) {
    return formatVolumeLabel(Number(cassetteMatch[1]) / 1000);
  }

  return cleanText(variant?.container, 100);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") return { error: "Некоректні дані заявки." };
  if (cleanText(payload.website, 100)) return { error: "Заявку відхилено." };

  const name = cleanText(payload.customer?.name, 80);
  const contact = cleanText(payload.customer?.contact, 100);
  const delivery = cleanText(payload.customer?.delivery, 80) || "Не вказано";
  const address = cleanText(payload.customer?.address, 180);
  const comment = cleanText(payload.comment, 500);
  const submissionId = cleanText(payload.submissionId, 64);
  const rawItems = Array.isArray(payload.items) ? payload.items : [];

  if (!name) return { error: "Вкажіть ім'я." };
  if (!contact) return { error: "Вкажіть телефон або Telegram/Viber." };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) {
    return { error: "Некоректний ідентифікатор заявки." };
  }
  if (rawItems.length < 1) return { error: "Кошик порожній." };
  if (rawItems.length > MAX_ITEMS) return { error: "У заявці забагато позицій." };

  const items = [];
  for (const raw of rawItems) {
    const plantId = cleanText(raw?.plantId, 40);
    const variantId = cleanText(raw?.variantId, 80);
    const container = cleanText(raw?.container, 100);
    const qty = normalizeQty(raw?.qty);
    const price = normalizePrice(raw?.price);
    const catalogProduct = productCatalog[plantId];
    const catalogVariant = catalogProduct?.variants.find(
      (variant) => {
        if (Number(variant.price) !== price) {
          return false;
        }

        if (variantId) {
          return !variant.variant_id || variant.variant_id === variantId;
        }

        return variant.container === container;
      }
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
      variantId: catalogVariant.variant_id || variantId,
      name: catalogProduct.name,
      container: container || publicContainerLabel(catalogVariant),
      unit: catalogVariant.unit,
      qty,
      price: Number(catalogVariant.price)
    });
  }

  return { value: { submissionId, name, contact, delivery, address, comment, items } };
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
        `- ${item.name} (${item.plantId}${item.variantId ? `, ${item.variantId}` : ""}), ${item.container}: ${item.qty} ${item.unit} x ${item.price} UAH = ${Math.round(item.qty * item.price)} UAH`
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

  if (!context.env.SITE_REQUESTS_DB) {
    console.error("SITE_REQUESTS_DB binding is not configured.");
    return json({ ok: false, error: "Сховище заявок тимчасово не налаштоване." }, 503);
  }

  const existing = await context.env.SITE_REQUESTS_DB.prepare(
    "SELECT request_id, telegram_status FROM site_orders WHERE submission_id = ?"
  )
    .bind(validation.value.submissionId)
    .first();
  if (existing) {
    return json({
      ok: true,
      requestId: existing.request_id,
      status: "draft",
      stored: true,
      duplicate: true,
      message: "Заявку вже збережено. Очікуйте підтвердження оператора."
    });
  }

  const requestId = makeRequestId();
  const receivedAt = new Date().toISOString();
  const statements = [
    context.env.SITE_REQUESTS_DB.prepare(
      `INSERT INTO site_orders (
         request_id, submission_id, received_at, customer_name, customer_contact,
         delivery_method, delivery_address, customer_comment
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      requestId,
      validation.value.submissionId,
      receivedAt,
      validation.value.name,
      validation.value.contact,
      validation.value.delivery,
      validation.value.address,
      validation.value.comment
    ),
    ...validation.value.items.map((item, index) =>
      context.env.SITE_REQUESTS_DB.prepare(
        `INSERT INTO site_order_items (
           request_id, line_no, plant_id, product_name, container, unit, qty, unit_price
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        requestId,
        index + 1,
        item.plantId,
        item.name,
        item.container,
        item.unit,
        item.qty,
        item.price
      )
    )
  ];
  await context.env.SITE_REQUESTS_DB.batch(statements);

  const token = cleanText(context.env.TELEGRAM_TOKEN, 256);
  const chatId = firstChatId(context.env);
  const message = buildTelegramMessage(requestId, validation.value);
  let telegramStatus = "not_configured";
  let telegramError = "";
  if (token && chatId) {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: true
      })
    });
    telegramStatus = telegramResponse.ok ? "sent" : "failed";
    telegramError = telegramResponse.ok ? "" : `HTTP ${telegramResponse.status}`;
  } else {
    telegramError = "Telegram bindings are not configured.";
  }
  await context.env.SITE_REQUESTS_DB.prepare(
    "UPDATE site_orders SET telegram_status = ?, telegram_error = ? WHERE request_id = ?"
  )
    .bind(telegramStatus, telegramError, requestId)
    .run();

  return json({
    ok: true,
    requestId,
    status: "draft",
    stored: true,
    telegramStatus,
    message:
      telegramStatus === "sent"
        ? "Заявку збережено та передано оператору. Очікуйте підтвердження."
        : "Заявку збережено. Оператор опрацює її після синхронізації."
  });
}

export function onRequestGet() {
  return json({ ok: false, error: "Метод не підтримується." }, 405);
}
