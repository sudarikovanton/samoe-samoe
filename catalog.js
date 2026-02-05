let allProducts = [];

const CART_KEY = "samoe_cart_v1";

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return (data && typeof data === "object") ? data : {};
  } catch {
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function cartCount(cart) {
  return Object.values(cart).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
}

function moneyKZT(n) {
  const num = Number(String(n).replace(/\s/g, ""));
  if (Number.isNaN(num)) return String(n);
  return new Intl.NumberFormat("ru-KZ").format(num) + " ₸";
}

function toNumber(n) {
  const num = Number(String(n).replace(/[^\d.]/g, ""));
  return Number.isNaN(num) ? 0 : num;
}

async function loadCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Не могу загрузить ${url}: ${res.status}`);
  const text = await res.text();

  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).filter(Boolean).map(line => {
    const cols = line.split(",").map(c => c.trim()); // простой CSV
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i] ?? "");
    return obj;
  });
}

function parseBadges(s) {
  return String(s || "")
    .split("|")
    .map(x => x.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 3);
}

function badgeClass(label) {
  const u = String(label).toUpperCase();
  if (u === "ECO") return "b--eco";
  if (u === "BIO") return "b--bio";
  if (u === "NEW") return "b--new";
  if (u === "HIT") return "b--hit";
  return "b--default";
}

function updateCartBadge() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const cart = loadCart();
  el.textContent = String(cartCount(cart));
}

function addToCart(productName) {
  const cart = loadCart();
  cart[productName] = (Number(cart[productName]) || 0) + 1;
  saveCart(cart);
  updateCartBadge();
  if (window.renderCart) window.renderCart();
}

function decFromCart(productName) {
  const cart = loadCart();
  const cur = Number(cart[productName]) || 0;
  if (cur <= 1) delete cart[productName];
  else cart[productName] = cur - 1;
  saveCart(cart);
  updateCartBadge();
  if (window.renderCart) window.renderCart();
}

function clearCart() {
  saveCart({});
  updateCartBadge();
  if (window.renderCart) window.renderCart();
}
window.clearCart = clearCart;

function findProductByName(name) {
  return allProducts.find(p => String(p.name) === String(name));
}

function calcTotal(cart) {
  let total = 0;
  for (const [name, qty] of Object.entries(cart)) {
    const p = findProductByName(name);
    const price = p ? toNumber(p.price) : 0;
    total += price * (Number(qty) || 0);
  }
  return total;
}

function renderCart() {
  const cart = loadCart();
  const itemsEl = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  const metaEl = document.getElementById("cartMeta");

  if (!itemsEl || !totalEl || !metaEl) return;

  const count = cartCount(cart);
  metaEl.textContent = `${count} ${count === 1 ? "товар" : (count >= 2 && count <= 4 ? "товара" : "товаров")}`;

  if (count === 0) {
    itemsEl.innerHTML = `<div class="card" style="box-shadow:none;border:1px dashed var(--line);background:rgba(255,255,255,.7);">
      Корзина пустая. Добавьте товары из каталога.
    </div>`;
    totalEl.textContent = moneyKZT(0);
    return;
  }

  const rows = Object.entries(cart).map(([name, qty]) => {
    const p = findProductByName(name);
    const priceText = p ? moneyKZT(p.price) : "—";
    return `
      <div class="cart-item">
        <div>
          <div class="cart-item__name">${name}</div>
          <div class="cart-item__meta">${priceText}</div>
        </div>
        <div class="qty">
          <button type="button" onclick="decFromCartUI('${name.replace(/'/g, "\\'")}')">−</button>
          <span>${qty}</span>
          <button type="button" onclick="addToCartUI('${name.replace(/'/g, "\\'")}')">+</button>
        </div>
      </div>
    `;
  }).join("");

  itemsEl.innerHTML = rows;

  totalEl.textContent = moneyKZT(calcTotal(cart));
}
window.renderCart = renderCart;

// UI wrappers to keep global scope clean
window.addToCartUI = (name) => addToCart(name);
window.decFromCartUI = (name) => decFromCart(name);

function sendCartToWhatsApp() {
  const cart = loadCart();
  const count = cartCount(cart);
  if (count === 0) return;

  const name = document.querySelector('input[name="name"]')?.value?.trim() || "";
  const phone = document.querySelector('input[name="phone"]')?.value?.trim() || "";
  const comment = document.querySelector('textarea[name="message"]')?.value?.trim() || "";

  const lines = [];
  lines.push(`Заказ с сайта "Самое-самое"`);
  if (name) lines.push(`Имя: ${name}`);
  if (phone) lines.push(`Телефон: ${phone}`);
  lines.push("");
  lines.push("Состав заказа:");

  for (const [productName, qty] of Object.entries(cart)) {
    const p = findProductByName(productName);
    const price = p ? toNumber(p.price) : 0;
    const sum = price * (Number(qty) || 0);
    const priceText = p ? moneyKZT(p.price) : "—";
    lines.push(`• ${productName} — ${qty} шт × ${priceText} = ${moneyKZT(sum)}`);
  }

  lines.push("");
  lines.push(`Итого: ${moneyKZT(calcTotal(cart))}`);

  if (comment) {
    lines.push("");
    lines.push(`Комментарий: ${comment}`);
  }

  const text = lines.join("\n");
  const url = `https://wa.me/${window.WHATSAPP_PHONE || ""}?text=${encodeURIComponent(text)}`;

  // WHATSAPP_PHONE объявлен в index.html (глобально)
  if (!window.WHATSAPP_PHONE || String(window.WHATSAPP_PHONE).length < 10) {
    alert("Проверьте номер WHATSAPP_PHONE в index.html (формат 7XXXXXXXXXX).");
    return;
  }

  window.open(url, "_blank");
}
window.sendCartToWhatsApp = sendCartToWhatsApp;

function uniqueCategories(products) {
  const set = new Set(products.map(p => (p.category || "").trim()).filter(Boolean));
  return ["Все", ...Array.from(set).sort((a,b) => a.localeCompare(b, "ru"))];
}

function applyFilterAndSort() {
  const catSel = document.getElementById("categoryFilter");
  const sortSel = document.getElementById("sortSelect");

  const cat = catSel ? catSel.value : "Все";
  const sort = sortSel ? sortSel.value : "default";

  let filtered = allProducts.slice();

  if (cat && cat !== "Все") {
    filtered = filtered.filter(p => (p.category || "").trim() === cat);
  }

  if (sort === "price_asc") filtered.sort((a,b) => toNumber(a.price) - toNumber(b.price));
  else if (sort === "price_desc") filtered.sort((a,b) => toNumber(b.price) - toNumber(a.price));
  else if (sort === "name_asc") filtered.sort((a,b) => String(a.name).localeCompare(String(b.name), "ru"));

  renderProducts(filtered);
}

function initControls() {
  const catSel = document.getElementById("categoryFilter");
  const sortSel = document.getElementById("sortSelect");
  if (!catSel || !sortSel) return;

  const cats = uniqueCategories(allProducts);
  catSel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join("");

  catSel.addEventListener("change", applyFilterAndSort);
  sortSel.addEventListener("change", applyFilterAndSort);

  applyFilterAndSort();
}

function renderProducts(products) {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  grid.innerHTML = products.map(p => {
    const priceText = moneyKZT(p.price);

    const badges = parseBadges(p.badges);
    const badgesHtml = badges.length
      ? `<div class="badges-on-card">
          ${badges.map(b => `<span class="pbadge ${badgeClass(b)}">${b}</span>`).join("")}
        </div>`
      : "";

    return `
      <article class="product">
        <div class="product__img">
          ${badgesHtml}
          <img
            src="${p.image}"
            alt="${p.name}"
            class="product__photo"
            onerror="this.style.display='none';"
          />
        </div>

        <div class="product__body">
          <div class="product__name">${p.name}</div>
          <div class="product__price">${priceText}</div>
          <div class="muted small">${p.category ?? ""}</div>

          <button class="btn btn--small" type="button" onclick="addToCartUI('${String(p.name).replace(/'/g,"\\'")}')">
            В корзину
          </button>
        </div>
      </article>
    `;
  }).join("");
}

async function initCatalog() {
  try {
    allProducts = await loadCSV("products.csv");
    initControls();
    updateCartBadge();
    renderCart();
  } catch (e) {
    console.error(e);
    const grid = document.getElementById("productsGrid");
    if (grid) grid.innerHTML = `<div class="card">Ошибка загрузки каталога: ${e.message}</div>`;
  }
}

initCatalog();
