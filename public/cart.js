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

    const cart = readCart();
    const existing = cart.find((item) => item.plantId === plantId);
    if (existing) {
      existing.qty = normalizeQty(Number(existing.qty) + 1);
      existing.image = existing.image || dataset.image || "";
      showToast(existing);
    } else {
      const item = {
        plantId,
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

  function setQty(plantId, qty) {
    const next = readCart()
      .map((item) => (item.plantId === plantId ? { ...item, qty: normalizeQty(qty) } : item))
      .filter((item) => normalizeQty(item.qty) > 0);
    writeCart(next);
  }

  function buildMessage(items, comment) {
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
          const imageMarkup = image
            ? `<a class="cart-item-image" href="${url || "#"}"><img src="${image}" alt="" loading="lazy"></a>`
            : `<div class="cart-item-image cart-item-image-empty" aria-hidden="true"></div>`;

          return `
            <article class="cart-item" data-cart-item="${plantId}">
              ${imageMarkup}
              <div class="cart-item-main">
                <strong>${url ? `<a href="${url}">${name}</a>` : name}</strong>
                <span>${plantId}</span>
                <small>${escapeHtml(item.container)}</small>
              </div>
              <div class="quantity-control" aria-label="Кількість">
                <button type="button" data-cart-decrease="${plantId}" aria-label="Зменшити кількість">−</button>
                <input type="number" min="1" max="9999" step="1" value="${itemQty}" data-cart-qty="${plantId}">
                <button type="button" data-cart-increase="${plantId}" aria-label="Збільшити кількість">+</button>
              </div>
              <div class="cart-item-price">
                <strong>${money(itemQty * Number(item.price || 0))}</strong>
                <span>${escapeHtml(item.price)} UAH/${escapeHtml(item.unit)}</span>
              </div>
              <button class="table-cart-button" type="button" data-cart-remove="${plantId}">Прибрати</button>
            </article>
          `;
        })
        .join("");
    }

    if (message) {
      message.value = items.length > 0 ? buildMessage(items, comment?.value || "") : "";
    }
    if (status) status.textContent = "";
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
      const plantId = decreaseButton.dataset.cartDecrease;
      const item = readCart().find((cartItem) => cartItem.plantId === plantId);
      if (item) {
        if (normalizeQty(item.qty) <= 1) {
          writeCart(readCart().filter((cartItem) => cartItem.plantId !== plantId));
        } else {
          setQty(plantId, normalizeQty(item.qty) - 1);
        }
        renderCartPage();
      }
      return;
    }

    const increaseButton = target.closest("[data-cart-increase]");
    if (increaseButton instanceof HTMLElement) {
      const plantId = increaseButton.dataset.cartIncrease;
      const item = readCart().find((cartItem) => cartItem.plantId === plantId);
      if (item) {
        setQty(plantId, normalizeQty(item.qty) + 1);
        renderCartPage();
      }
      return;
    }

    const removeButton = target.closest("[data-cart-remove]");
    if (removeButton instanceof HTMLElement) {
      const plantId = removeButton.dataset.cartRemove;
      writeCart(readCart().filter((item) => item.plantId !== plantId));
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
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

    if (target.matches("[data-cart-qty]")) {
      setQty(target.dataset.cartQty, target.value);
      renderCartPage();
    }

    if (target.matches("[data-cart-comment]")) {
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
