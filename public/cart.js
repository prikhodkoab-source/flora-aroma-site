(() => {
  const STORAGE_KEY = "flora_cart_draft_v1";
  const submissionStorageKey = "flora-aroma-site-submission-id";

  function readCart() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((item) => item && item.plantId) : [];
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("flora-cart-updated"));
  }

  function normalizeQty(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 1) return 1;
    return Math.min(Math.round(number), 9999);
  }

  function money(value) {
    return `${Math.round(value)} грн.`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function cartItemKey(item) {
    return item.cartKey || (item.optionId && item.optionId !== "default" ? `${item.plantId}::${item.optionId}` : item.plantId);
  }

  function datasetCartKey(dataset) {
    const optionId = dataset.optionId || "default";
    return optionId && optionId !== "default" ? `${dataset.plantId}::${optionId}` : dataset.plantId;
  }

  function cartTotals(items = readCart()) {
    return items.reduce(
      (totals, item) => {
        const qty = normalizeQty(item.qty);
        totals.qty += qty;
        totals.sum += qty * Number(item.price || 0);
        return totals;
      },
      { qty: 0, sum: 0 }
    );
  }

  function analyticsPayload(item, overrides = {}) {
    return {
      plant_id: item.plantId,
      plant_name: item.name,
      product_option: item.optionId || "default",
      container: item.container,
      quantity: normalizeQty(item.qty),
      public_unit_price: Number(item.price || 0),
      currency: "UAH",
      ...overrides
    };
  }

  function emitAnalytics(eventName, properties = {}) {
    if (window.FloraAnalytics?.trackEvent) {
      window.FloraAnalytics.trackEvent(eventName, properties);
      return;
    }
    window.dispatchEvent(new CustomEvent("flora-analytics-event", { detail: { eventName, properties } }));
  }

  function qtyFromContext(button) {
    const page = button.closest("[data-product-page]");
    const input = page?.querySelector("[data-product-qty]");
    return normalizeQty(input?.value || 1);
  }

  function addItem(button) {
    const dataset = button.dataset;
    const plantId = dataset.plantId || "";
    if (!plantId) return;

    const optionId = dataset.optionId || "default";
    const cartKey = datasetCartKey(dataset);
    const cart = readCart();
    const existing = cart.find((item) => cartItemKey(item) === cartKey);
    const qty = qtyFromContext(button);

    if (existing) {
      existing.qty = normalizeQty(Number(existing.qty || 1) + qty);
      existing.image = existing.image || dataset.image || "";
    } else {
      cart.push({
        plantId,
        optionId,
        cartKey,
        name: dataset.name || plantId,
        latin: dataset.latin || "",
        container: dataset.container || "",
        price: Number(dataset.price || 0),
        unit: dataset.unit || "шт.",
        url: dataset.url || "",
        image: dataset.image || "",
        qty
      });
    }

    writeCart(cart);
    emitAnalytics("add_to_cart", {
      plant_id: plantId,
      plant_name: dataset.name || plantId,
      product_option: optionId,
      container: dataset.container || "",
      quantity: qty,
      public_unit_price: Number(dataset.price || 0),
      currency: dataset.currency || "UAH"
    });
    openCart();
  }

  function setQty(cartKey, qty) {
    const normalizedQty = normalizeQty(qty);
    const next = readCart()
      .map((item) => (cartItemKey(item) === cartKey ? { ...item, qty: normalizedQty } : item))
      .filter((item) => normalizeQty(item.qty) > 0);
    writeCart(next);
    const changed = next.find((item) => cartItemKey(item) === cartKey);
    if (changed) emitAnalytics("change_cart_quantity", analyticsPayload(changed, { quantity: normalizedQty }));
  }

  function removeItem(cartKey) {
    const items = readCart();
    const removed = items.find((item) => cartItemKey(item) === cartKey);
    writeCart(items.filter((item) => cartItemKey(item) !== cartKey));
    if (removed) emitAnalytics("remove_from_cart", analyticsPayload(removed));
  }

  function customerData(root = document) {
    return {
      name: root.querySelector("[data-cart-customer-name]")?.value?.trim() || "",
      email: root.querySelector("[data-cart-customer-email]")?.value?.trim() || "",
      contact: root.querySelector("[data-cart-customer-contact]")?.value?.trim() || "",
      delivery: "Уточнити з оператором",
      address: ""
    };
  }

  function buildMessage(items, comment, customer = {}) {
    const lines = [
      "Доброго дня. Прошу перевірити наявність і можливість резерву:",
      ...items.map((item) => {
        const qty = normalizeQty(item.qty);
        return `- ${item.name}, ${item.container}: ${qty} ${item.unit} x ${item.price} UAH = ${Math.round(qty * Number(item.price || 0))} UAH`;
      }),
      `Попередня сума: ${Math.round(cartTotals(items).sum)} UAH.`,
      "Наявність, формат і можливість резерву підтвердить оператор."
    ];
    if (customer.name) lines.push(`Ім'я: ${customer.name}`);
    if (customer.email) lines.push(`Email: ${customer.email}`);
    if (customer.contact) lines.push(`Контакт: ${customer.contact}`);
    if (comment.trim()) lines.push(`Коментар: ${comment.trim()}`);
    return lines.join("\n");
  }

  function updateCount() {
    const totals = cartTotals();
    document.querySelectorAll("[data-cart-count]").forEach((node) => {
      node.textContent = String(totals.qty);
      node.toggleAttribute("hidden", totals.qty === 0);
    });
    document.querySelectorAll(".tilda-cart-icon").forEach((node) => {
      node.classList.toggle("is-visible", totals.qty > 0);
    });
  }

  function renderCart() {
    const items = readCart();
    const totals = cartTotals(items);
    const modal = document.querySelector("[data-cart-modal]");
    const page = document.querySelector("[data-cart-page]");
    const itemsRoot = document.querySelector("[data-cart-items]");
    const empty = document.querySelector("[data-cart-empty]");
    const totalSum = document.querySelector("[data-cart-total-sum]");
    const message = document.querySelector("[data-cart-message]");
    const comment = document.querySelector("[data-cart-comment]");
    const status = document.querySelector("[data-cart-status]");

    if (empty) empty.hidden = items.length > 0;
    if (totalSum) totalSum.textContent = money(totals.sum);

    if (itemsRoot) {
      itemsRoot.innerHTML = items
        .map((item) => {
          const key = escapeHtml(cartItemKey(item));
          const qty = normalizeQty(item.qty);
          const image = escapeHtml(item.image || "");
          return `
            <article class="tilda-cart-item" data-cart-item="${key}">
              ${image ? `<img src="${image}" alt="">` : `<span></span>`}
              <div>
                <h3>${escapeHtml(item.name)}</h3>
                <p>${escapeHtml(item.container)}</p>
                <p>${money(qty * Number(item.price || 0))}</p>
              </div>
              <div class="tilda-cart-qty">
                <button type="button" data-cart-decrease="${key}" aria-label="Зменшити">−</button>
                <input type="number" min="1" max="9999" value="${qty}" data-cart-qty="${key}">
                <button type="button" data-cart-increase="${key}" aria-label="Збільшити">+</button>
              </div>
              <button class="tilda-cart-remove" type="button" data-cart-remove="${key}" aria-label="Видалити">×</button>
            </article>
          `;
        })
        .join("");
    }

    if (message) {
      message.value = items.length > 0 ? buildMessage(items, comment?.value || "", customerData(page || document)) : "";
    }

    if (status && !modal?.hasAttribute("hidden")) {
      status.textContent = "";
      status.classList.remove("is-success");
    }

    updateCount();
  }

  function openCart() {
    const modal = document.querySelector("[data-cart-modal]");
    if (!(modal instanceof HTMLElement)) return;
    renderCart();
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("tilda-cart-open");
    emitAnalytics("open_cart", { quantity: cartTotals().qty });
  }

  function closeCart() {
    const modal = document.querySelector("[data-cart-modal]");
    if (!(modal instanceof HTMLElement)) return;
    hideSuccessDialog();
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("tilda-cart-open");
  }

  function hasSameSiteReferrer() {
    try {
      if (!document.referrer) return false;
      const referrer = new URL(document.referrer);
      return referrer.origin === window.location.origin && referrer.pathname !== window.location.pathname;
    } catch {
      return false;
    }
  }

  function backFromCart() {
    const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
    if (normalizedPath !== "/cart") {
      closeCart();
      return;
    }
    if (window.history.length > 1 && hasSameSiteReferrer()) {
      window.history.back();
      return;
    }
    window.location.href = "/shop/";
  }

  function showSuccessDialog(requestId) {
    const dialogRoot = document.querySelector("[data-order-success]");
    const dialog = dialogRoot?.querySelector(".tilda-order-success__dialog");
    const idRoot = document.querySelector("[data-order-success-id]");
    if (!(dialogRoot instanceof HTMLElement)) return;

    if (idRoot) idRoot.textContent = requestId || "";
    dialogRoot.hidden = false;
    dialogRoot.setAttribute("aria-hidden", "false");
    if (dialog instanceof HTMLElement) dialog.focus();
  }

  function hideSuccessDialog() {
    const dialogRoot = document.querySelector("[data-order-success]");
    if (!(dialogRoot instanceof HTMLElement)) return;
    dialogRoot.hidden = true;
    dialogRoot.setAttribute("aria-hidden", "true");
  }

  async function submitOrder(button) {
    const page = document.querySelector("[data-cart-page]");
    const status = document.querySelector("[data-cart-status]");
    const items = readCart();
    const customer = customerData(page || document);
    const comment = document.querySelector("[data-cart-comment]")?.value || "";
    const website = document.querySelector("[data-cart-website]")?.value || "";

    if (items.length === 0) {
      if (status) status.textContent = "Кошик порожній.";
      return;
    }
    if (!customer.name) {
      document.querySelector("[data-cart-customer-name]")?.focus();
      if (status) status.textContent = "Вкажіть імʼя.";
      return;
    }
    if (!customer.contact) {
      document.querySelector("[data-cart-customer-contact]")?.focus();
      if (status) status.textContent = "Вкажіть телефон.";
      return;
    }

    button.disabled = true;
    button.textContent = "Надсилаємо...";
    if (status) status.textContent = "Передаємо заявку оператору.";

    try {
      let submissionId = window.localStorage.getItem(submissionStorageKey);
      if (!submissionId) {
        submissionId = window.crypto.randomUUID();
        window.localStorage.setItem(submissionStorageKey, submissionId);
      }
      const response = await fetch("/api/site-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          customer,
          comment,
          website,
          items: items.map((item) => ({
            plantId: item.plantId,
            variantId: item.optionId || "default",
            name: item.name,
            container: item.container,
            price: Number(item.price || 0),
            unit: item.unit || "шт.",
            qty: normalizeQty(item.qty)
          }))
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "Не вдалося передати заявку.");

      emitAnalytics("copy_order_request", { quantity: cartTotals(items).qty });
      writeCart([]);
      window.localStorage.removeItem(submissionStorageKey);
      renderCart();
      if (status) {
        status.textContent = `Дякуємо за замовлення. Заявку ${result.requestId} передано оператору. Очікуйте підтвердження.`;
        status.classList.add("is-success");
      }
      showSuccessDialog(result.requestId);
    } catch (error) {
      if (status) {
        status.textContent = error instanceof Error ? error.message : "Не вдалося передати заявку.";
        status.classList.remove("is-success");
      }
    } finally {
      button.disabled = readCart().length === 0;
      button.textContent = "Оформити замовлення";
    }
  }

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const addButton = target.closest("[data-cart-add]");
    if (addButton instanceof HTMLElement) {
      addItem(addButton);
      return;
    }

    if (target.closest("[data-cart-open]")) {
      openCart();
      return;
    }

    if (target.closest("[data-cart-back]")) {
      backFromCart();
      return;
    }

    if (target.closest("[data-cart-close]")) {
      closeCart();
      return;
    }

    if (target.closest("[data-order-success-return]")) {
      hideSuccessDialog();
      closeCart();
      window.location.href = "/shop/";
      return;
    }

    if (target.closest("[data-order-success-close]")) {
      hideSuccessDialog();
      closeCart();
      return;
    }

    const decrease = target.closest("[data-cart-decrease]");
    if (decrease instanceof HTMLElement) {
      const key = decrease.dataset.cartDecrease;
      const item = readCart().find((cartItem) => cartItemKey(cartItem) === key);
      if (item && normalizeQty(item.qty) <= 1) removeItem(key);
      if (item && normalizeQty(item.qty) > 1) setQty(key, normalizeQty(item.qty) - 1);
      renderCart();
      return;
    }

    const increase = target.closest("[data-cart-increase]");
    if (increase instanceof HTMLElement) {
      const key = increase.dataset.cartIncrease;
      const item = readCart().find((cartItem) => cartItemKey(cartItem) === key);
      if (item) setQty(key, normalizeQty(item.qty) + 1);
      renderCart();
      return;
    }

    const remove = target.closest("[data-cart-remove]");
    if (remove instanceof HTMLElement) {
      removeItem(remove.dataset.cartRemove);
      renderCart();
      return;
    }

    const submit = target.closest("[data-cart-submit]");
    if (submit instanceof HTMLButtonElement) {
      await submitOrder(submit);
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (target.matches("[data-cart-qty]")) {
      setQty(target.dataset.cartQty, target.value);
    }
    if (target.matches("[data-cart-qty], [data-cart-comment], [data-cart-customer-name], [data-cart-customer-email], [data-cart-customer-contact]")) {
      renderCart();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const successDialog = document.querySelector("[data-order-success]");
    if (successDialog instanceof HTMLElement && !successDialog.hidden) {
      hideSuccessDialog();
      closeCart();
      return;
    }
    closeCart();
  });

  window.addEventListener("flora-cart-updated", renderCart);
  updateCount();
  renderCart();
})();
