type AnalyticsEventName =
  | "page_view"
  | "view_plant"
  | "catalog_search"
  | "filter_used"
  | "select_variant"
  | "add_to_cart"
  | "remove_from_cart"
  | "change_cart_quantity"
  | "open_cart"
  | "copy_order_request"
  | "click_phone"
  | "click_messenger";

type AnalyticsProperties = Record<string, string | number | undefined | null>;

declare global {
  interface Window {
    FloraAnalytics?: {
      trackEvent: (eventName: AnalyticsEventName, properties?: AnalyticsProperties) => void;
    };
  }
}

const SESSION_KEY = "flora_analytics_session_id";
const ENDPOINT = "/api/analytics/event";
const ALLOWED_EVENTS = new Set<AnalyticsEventName>([
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
]);

const ALLOWED_FIELDS = new Set([
  "plant_id",
  "plant_name",
  "product_option",
  "container",
  "quantity",
  "public_unit_price",
  "currency",
  "filter_name",
  "filter_value",
  "search_query"
]);

function sessionId(): string {
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const next = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

function deviceClass(): string {
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  if (width <= 640) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}

function referrerHost(): string {
  if (!document.referrer) return "";
  try {
    const url = new URL(document.referrer);
    return url.hostname === window.location.hostname ? "" : url.hostname;
  } catch {
    return "";
  }
}

function stringValue(value: unknown, maxLength = 140): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function searchHasPrivateData(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return /[^\s@]+@[^\s@]+\.[^\s@]+/i.test(value) || digits.length >= 7;
}

function utm(name: string): string {
  return stringValue(new URLSearchParams(window.location.search).get(name), 120);
}

function basePayload() {
  return {
    session_id: sessionId(),
    occurred_at: new Date().toISOString(),
    pathname: window.location.pathname,
    page_title: document.title,
    referrer_host: referrerHost(),
    utm_source: utm("utm_source"),
    utm_medium: utm("utm_medium"),
    utm_campaign: utm("utm_campaign"),
    device_class: deviceClass()
  };
}

function sanitizeProperties(properties: AnalyticsProperties = {}) {
  const sanitized: AnalyticsProperties = {};

  for (const [field, rawValue] of Object.entries(properties)) {
    if (!ALLOWED_FIELDS.has(field) || rawValue === undefined || rawValue === null) continue;

    if (field === "quantity" || field === "public_unit_price") {
      const number = Number(rawValue);
      if (Number.isFinite(number)) sanitized[field] = number;
      continue;
    }

    const value = stringValue(rawValue, field === "search_query" ? 80 : 140);
    if (!value) continue;
    if (field === "search_query" && searchHasPrivateData(value)) continue;
    sanitized[field] = value;
  }

  if (!sanitized.currency && properties.public_unit_price !== undefined) {
    sanitized.currency = "UAH";
  }

  return sanitized;
}

function send(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: "application/json" });

  if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, blob)) {
    return;
  }

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: true
  }).catch(() => {
    // Analytics must never break storefront behavior.
  });
}

export function trackEvent(eventName: AnalyticsEventName, properties: AnalyticsProperties = {}) {
  if (!ALLOWED_EVENTS.has(eventName)) return;
  if (window.location.pathname.startsWith("/admin/")) return;

  send({
    event_name: eventName,
    ...basePayload(),
    ...sanitizeProperties(properties)
  });
}

function productPageProperties(root: Element): AnalyticsProperties {
  const element = root as HTMLElement;
  return {
    plant_id: element.dataset.analyticsPlantId,
    plant_name: element.dataset.analyticsPlantName
  };
}

function trackInitialPage() {
  trackEvent("page_view");

  const productPage = document.querySelector("[data-product-page][data-analytics-plant-id]");
  if (productPage) {
    trackEvent("view_plant", productPageProperties(productPage));
  }
}

function trackCatalogInputs() {
  let searchTimer = 0;
  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches("[data-catalog-search], input[type='search']")) return;

    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      const query = stringValue(target.value, 80);
      if (query.length >= 2 && !searchHasPrivateData(query)) {
        trackEvent("catalog_search", { search_query: query });
      }
    }, 700);
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

    if (target.matches("[data-product-option]")) {
      const productPage = target.closest("[data-product-page]");
      trackEvent("select_variant", {
        ...((productPage && productPageProperties(productPage)) || {}),
        product_option: target.dataset.optionId,
        container: target.dataset.container,
        public_unit_price: target.dataset.price,
        currency: "UAH"
      });
      return;
    }

    if (!target.matches("[data-catalog-filter]")) return;
    trackEvent("filter_used", {
      filter_name: target.name || target.id || target.dataset.catalogFilter,
      filter_value: target.value
    });
  });
}

function trackContactClicks() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const href = anchor.href.toLowerCase();

    if (href.startsWith("tel:")) {
      trackEvent("click_phone");
      return;
    }

    if (href.includes("t.me") || href.includes("telegram") || href.includes("facebook.com")) {
      trackEvent("click_messenger", {
        filter_name: "channel",
        filter_value: href.includes("facebook.com") ? "facebook" : "telegram"
      });
    }
  });
}

function listenForCartEvents() {
  window.addEventListener("flora-analytics-event", (event) => {
    if (!(event instanceof CustomEvent)) return;
    const { eventName, properties } = event.detail || {};
    trackEvent(eventName, properties);
  });
}

export function initializeAnalytics() {
  if (typeof window === "undefined") return;
  window.FloraAnalytics = { trackEvent };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", trackInitialPage, { once: true });
  } else {
    trackInitialPage();
  }

  trackCatalogInputs();
  trackContactClicks();
  listenForCartEvents();
}
