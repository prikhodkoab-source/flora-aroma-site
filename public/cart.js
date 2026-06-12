(() => {
  const STORAGE_KEY = "flora_cart_draft_v1";

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

  function updateCount() {
    const total = readCart().reduce((sum, item) => sum + normalizeQty(item.qty), 0);
    document.querySelectorAll("[data-cart-count]").forEach((node) => {
      node.textContent = String(total);
      node.toggleAttribute("hidden", total === 0);
    });
  }

  function addItem(dataset) {
    const plantId = dataset.plantId || "";
    if (!plantId) return;

    const cart = readCart();
    const existing = cart.find((item) => item.plantId === plantId);
    if (existing) {
      existing.qty = normalizeQty(existing.qty + 1);
    } else {
      cart.push({
        plantId,
        name: dataset.name || plantId,
        latin: dataset.latin || "",
        container: dataset.container || "",
        price: Number(dataset.price || 0),
        unit: dataset.unit || "шт.",
        url: dataset.url || "",
        qty: 1
      });
    }

    writeCart(cart);
  }

  function buildMessage(items, comment) {
    const total = items.reduce((sum, item) => sum + normalizeQty(item.qty) * Number(item.price || 0), 0);
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
    const qty = items.reduce((sum, item) => sum + normalizeQty(item.qty), 0);
    const sum = items.reduce((total, item) => total + normalizeQty(item.qty) * Number(item.price || 0), 0);

    if (empty) empty.hidden = items.length > 0;
    if (totalQty) totalQty.textContent = String(qty);
    if (totalSum) totalSum.textContent = money(sum);
    if (itemsRoot) {
      itemsRoot.innerHTML = items
        .map((item) => {
          const itemQty = normalizeQty(item.qty);
          return `
            <article class="cart-item" data-cart-item="${escapeHtml(item.plantId)}">
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(item.plantId)}</span>
                <small>${escapeHtml(item.container)}</small>
              </div>
              <label>
                Кількість
                <input type="number" min="1" max="9999" step="1" value="${itemQty}" data-cart-qty="${escapeHtml(item.plantId)}">
              </label>
              <div>
                <strong>${money(itemQty * Number(item.price || 0))}</strong>
                <span>${escapeHtml(item.price)} UAH/${escapeHtml(item.unit)}</span>
              </div>
              <button class="table-cart-button" type="button" data-cart-remove="${escapeHtml(item.plantId)}">Прибрати</button>
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
      const plantId = target.dataset.cartQty;
      const cart = readCart().map((item) =>
        item.plantId === plantId ? { ...item, qty: normalizeQty(target.value) } : item
      );
      writeCart(cart);
      renderCartPage();
    }

    if (target.matches("[data-cart-comment]")) {
      renderCartPage();
    }
  });

  window.addEventListener("flora-cart-updated", updateCount);
  updateCount();
  renderCartPage();
})();
