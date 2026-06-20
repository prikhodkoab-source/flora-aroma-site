(() => {
  const STORAGE_KEY = "flora_cart_draft_v1";
  let toastTimer;

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

  function money(value) {
    return `${Math.round(value)} UAH`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function normalizeQty(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 1) return 1;
    return Math.min(Math.round(number), 9999);
  }

  function cartItemKey(item) {
    if (item.cartKey) return item.cartKey;
    if (item.optionId && item.optionId !== "default") return `${item.plantId}::${item.optionId}`;
    return item.plantId;
  }

  function datasetCartKey(dataset) {
    const plantId = dataset.plantId || "";
    const optionId = dataset.optionId || "default";
    return optionId && optionId !== "default" ? `${plantId}::${optionId}` : plantId;
  }

  function cartTotals(items = readCart()) {
    return items.reduce(
      (totals, item) => {
        const qty = normalizeQty(item.qty);
        const price = Number(item.price || 0);
        totals.qty += qty;
        totals.sum += qty * price;
        return totals;
      },
      { qty: 0, sum: 0 }
    );
  }

  function updateCount() {
    const total = cartTotals().qty;
    document.querySelectorAll("[data-cart-count]").forEach((node) => {
      node.textContent = String(total);
      node.toggleAttribute("hidden", total === 0);
    });
  }

  function showToast(item) {
    const toast = document.querySelector("[data-cart-toast]");
    if (!(toast instanceof HTMLElement)) return;

    const title = toast.querySelector("[data-cart-toast-title]");
    const text = toast.querySelector("[data-cart-toast-text]");
    if (title) title.textContent = "Додано до кошика";
    if (text) text.textContent = item.name || item.plantId;

    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3600);
  }

  function addItem(dataset) {
    const plantId = dataset.plantId || "";
    if (!plantId) return;

    const optionId = dataset.optionId || "default";
    const cartKey = datasetCartKey(dataset);
    const cart = readCart();
    const existing = cart.find((item) => cartItemKey(item) === cartKey);
    if (existing) {
      existing.qty = normalizeQty(Number(existing.qty) + 1);
      existing.image = existing.image || dataset.image || "";
      showToast(existing);
    } else {
      const item = {
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
        qty: 1
      };
      cart.push(item);
      showToast(item);
    }

    writeCart(cart);
  }

  function setQty(cartKey, qty) {
    const next = readCart()
      .map((item) => (cartItemKey(item) === cartKey ? { ...item, qty: normalizeQty(qty) } : item))
      .filter((item) => normalizeQty(item.qty) > 0);
    writeCart(next);
  }

  function customerData(page = document) {
    return {
      name: page.querySelector("[data-cart-customer-name]")?.value?.trim() || "",
      contact: page.querySelector("[data-cart-customer-contact]")?.value?.trim() || "",
      delivery: page.querySelector("[data-cart-delivery]")?.value || "Самовивіз",
      address: page.querySelector("[data-cart-address]")?.value?.trim() || ""
    };
  }

  function buildMessage(items, comment, customer = {}) {
    const total = cartTotals(items).sum;
    const lines = [
      "Добрий день. Прошу перевірити наявність і можливість резерву:",
      ...items.map((item) => {
        const qty = normalizeQty(item.qty);
        return `- ${item.name} (${item.plantId}), ${item.container}: ${qty} ${item.unit} x ${item.price} UAH = ${money(qty * Number(item.price || 0))}`;
      }),
      `Попередня сума за публічним прайсом: ${money(total)}.`,
      "Розумію, що це чернетка заявки: наявність, формат і резерв підтверджує оператор."
    ];

    if (customer.name) lines.push(`Ім'я: ${customer.name}`);
    if (customer.contact) lines.push(`Контакт: ${customer.contact}`);
    if (customer.delivery) lines.push(`Отримання: ${customer.delivery}`);
    if (customer.address) lines.push(`Адреса: ${customer.address}`);
    if (comment.trim()) {
      lines.push(`Коментар: ${comment.trim()}`);
    }

    return lines.join("\n");
  }

  function renderCartPage() {
    const page = document.querySelector("[data-cart-page]");
    if (!page) return;

    const itemsRoot = page.querySelector("[data-cart-items]");
    const empty = page.querySelector("[data-cart-empty]");
    const totalQty = page.querySelector("[data-cart-total-qty]");
    const totalSum = page.querySelector("[data-cart-total-sum]");
    const message = page.querySelector("[data-cart-message]");
    const comment = page.querySelector("[data-cart-comment]");
    const status = page.querySelector("[data-cart-status]");
    const submit = page.querySelector("[data-cart-submit]");
    const items = readCart();
    const totals = cartTotals(items);

    if (empty) empty.hidden = items.length > 0;
    if (totalQty) totalQty.textContent = String(totals.qty);
    if (totalSum) totalSum.textContent = money(totals.sum);
    if (itemsRoot) {
      itemsRoot.innerHTML = items
        .map((item) => {
          const itemQty = normalizeQty(item.qty);
          const url = escapeHtml(item.url || "");
          const name = escapeHtml(item.name);
          const image = escapeHtml(item.image || "");
          const plantId = escapeHtml(item.plantId);
          const key = escapeHtml(cartItemKey(item));
          const imageMarkup = image
            ? `<a class="cart-item-image" href="${url || "#"}"><img src="${image}" alt="" loading="lazy"></a>`
            : `<div class="cart-item-image cart-item-image-empty" aria-hidden="true"></div>`;

          return `
            <article class="cart-item" data-cart-item="${key}">
              ${imageMarkup}
              <div class="cart-item-main">
                <strong>${url ? `<a href="${url}">${name}</a>` : name}</strong>
                <span>${plantId}</span>
                <small>${escapeHtml(item.container)}</small>
              </div>
              <div class="quantity-control" aria-label="Кількість">
                <button type="button" data-cart-decrease="${key}" aria-label="Зменшити кількість">−</button>
                <input type="number" min="1" max="9999" step="1" value="${itemQty}" data-cart-qty="${key}">
                <button type="button" data-cart-increase="${key}" aria-label="Збільшити кількість">+</button>
              </div>
              <div class="cart-item-price">
                <strong>${money(itemQty * Number(item.price || 0))}</strong>
                <span>${escapeHtml(item.price)} UAH/${escapeHtml(item.unit)}</span>
              </div>
              <button class="table-cart-button" type="button" data-cart-remove="${key}">Прибрати</button>
            </article>
          `;
        })
        .join("");
    }

    if (message) {
      message.value = items.length > 0 ? buildMessage(items, comment?.value || "", customerData(page)) : "";
    }
    if (submit instanceof HTMLButtonElement) submit.disabled = items.length === 0;
    if (status) {
      status.textContent = "";
      status.classList.remove("is-success");
    }
  }

  async function submitOrder(button) {
    const page = document.querySelector("[data-cart-page]");
    if (!page) return;

    const status = page.querySelector("[data-cart-status]");
    const items = readCart();
    const customer = customerData(page);
    const comment = page.querySelector("[data-cart-comment]")?.value || "";
    const website = page.querySelector("[data-cart-website]")?.value || "";

    if (items.length === 0) {
      if (status) status.textContent = "Кошик порожній.";
      return;
    }
    if (!customer.name) {
      page.querySelector("[data-cart-customer-name]")?.focus();
      if (status) status.textContent = "Вкажіть ім'я.";
      return;
    }
    if (!customer.contact) {
      page.querySelector("[data-cart-customer-contact]")?.focus();
      if (status) status.textContent = "Вкажіть телефон або Telegram/Viber.";
      return;
    }

    button.disabled = true;
    button.textContent = "Надсилаємо...";
    if (status) status.textContent = "Передаємо заявку оператору.";

    try {
      const submissionStorageKey = "flora-aroma-site-submission-id";
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
            name: item.name,
            container: item.container,
            price: Number(item.price || 0),
            unit: item.unit || "шт.",
            qty: normalizeQty(item.qty)
          }))
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не вдалося передати заявку.");
      }

      writeCart([]);
      window.localStorage.removeItem(submissionStorageKey);
      renderCartPage();
      if (status) {
        status.textContent = `Заявку ${result.requestId} передано оператору. Очікуйте підтвердження.`;
        status.classList.add("is-success");
      }
    } catch (error) {
      if (status) {
        status.textContent = error instanceof Error ? error.message : "Не вдалося передати заявку.";
        status.classList.remove("is-success");
      }
    } finally {
      button.disabled = readCart().length === 0;
      button.textContent = "Надіслати заявку оператору";
    }
  }

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const addButton = target.closest("[data-cart-add]");
    if (addButton instanceof HTMLElement) {
      addItem(addButton.dataset);
      addButton.textContent = "Додано";
      window.setTimeout(() => {
        addButton.textContent = addButton.classList.contains("table-cart-button") ? "Додати" : "Додати в кошик";
      }, 1200);
      return;
    }

    const decreaseButton = target.closest("[data-cart-decrease]");
    if (decreaseButton instanceof HTMLElement) {
      const key = decreaseButton.dataset.cartDecrease;
      const item = readCart().find((cartItem) => cartItemKey(cartItem) === key);
      if (item) {
        if (normalizeQty(item.qty) <= 1) {
          writeCart(readCart().filter((cartItem) => cartItemKey(cartItem) !== key));
        } else {
          setQty(key, normalizeQty(item.qty) - 1);
        }
        renderCartPage();
      }
      return;
    }

    const increaseButton = target.closest("[data-cart-increase]");
    if (increaseButton instanceof HTMLElement) {
      const key = increaseButton.dataset.cartIncrease;
      const item = readCart().find((cartItem) => cartItemKey(cartItem) === key);
      if (item) {
        setQty(key, normalizeQty(item.qty) + 1);
        renderCartPage();
      }
      return;
    }

    const removeButton = target.closest("[data-cart-remove]");
    if (removeButton instanceof HTMLElement) {
      const key = removeButton.dataset.cartRemove;
      writeCart(readCart().filter((item) => cartItemKey(item) !== key));
      renderCartPage();
      return;
    }

    if (target.closest("[data-cart-clear]")) {
      writeCart([]);
      renderCartPage();
      return;
    }

    if (target.closest("[data-cart-toast-close]")) {
      const toast = document.querySelector("[data-cart-toast]");
      if (toast instanceof HTMLElement) toast.hidden = true;
      return;
    }

    if (target.closest("[data-cart-copy]")) {
      const message = document.querySelector("[data-cart-message]");
      const status = document.querySelector("[data-cart-status]");
      if (message && message.value) {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(message.value);
        } else {
          message.focus();
          message.select();
          document.execCommand("copy");
        }
        if (status) status.textContent = "Заявку скопійовано.";
      } else if (status) {
        status.textContent = "Кошик порожній.";
      }
      return;
    }

    const submitButton = target.closest("[data-cart-submit]");
    if (submitButton instanceof HTMLButtonElement) {
      await submitOrder(submitButton);
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
    ) {
      return;
    }

    if (target.matches("[data-cart-qty]")) {
      setQty(target.dataset.cartQty, target.value);
      renderCartPage();
    }

    if (
      target.matches(
        "[data-cart-comment], [data-cart-customer-name], [data-cart-customer-contact], [data-cart-delivery], [data-cart-address]"
      )
    ) {
      renderCartPage();
    }
  });

  document.addEventListener("focus", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.matches("[data-cart-qty]")) {
      target.select();
    }
  }, true);

  window.addEventListener("flora-cart-updated", updateCount);
  updateCount();
  renderCartPage();
})();
