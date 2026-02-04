let allProducts = [];

async function loadCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Не могу загрузить ${url}: ${res.status}`);
  const text = await res.text();

  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).filter(Boolean).map(line => {
    // простой CSV: без запятых внутри полей
    const cols = line.split(",").map(c => c.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i] ?? "");
    return obj;
  });
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

function parseBadges(s) {
  return String(s || "")
    .split("|")
    .map(x => x.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 3); // максимум 3, чтобы не захламлять
}

function badgeClass(label) {
  const u = String(label).toUpperCase();
  if (u === "ECO") return "b--eco";
  if (u === "BIO") return "b--bio";
  if (u === "NEW") return "b--new";
  if (u === "HIT") return "b--hit";
  return "b--default";
}

function renderProducts(products) {
  const grid = document.getElementById("productsGrid");
  if (!grid) throw new Error("Не найден контейнер #productsGrid в index.html");

  grid.innerHTML = products.map(p => {
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
            onerror="this.style.display='none'; this.parentElement.classList.add('noimg');"
          />

          <div class="noimg__text">Нет фото</div>
        </div>

        <div class="product__body">
          <div class="product__name">${p.name}</div>
          <div class="product__price">${moneyKZT(p.price)}</div>
          <div class="muted small">${p.category ?? ""}</div>
          <button class="btn btn--small" onclick="alert('Корзину добавим следующим шагом')">В корзину</button>
        </div>
      </article>
    `;
  }).join("");
}

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

  if (sort === "price_asc") {
    filtered.sort((a,b) => toNumber(a.price) - toNumber(b.price));
  } else if (sort === "price_desc") {
    filtered.sort((a,b) => toNumber(b.price) - toNumber(a.price));
  } else if (sort === "name_asc") {
    filtered.sort((a,b) => String(a.name).localeCompare(String(b.name), "ru"));
  }

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

async function initCatalog() {
  try {
    allProducts = await loadCSV("products.csv");
    initControls();
    if (!document.getElementById("categoryFilter")) renderProducts(allProducts);
  } catch (e) {
    console.error(e);
    const grid = document.getElementById("productsGrid");
    if (grid) grid.innerHTML = `<div class="card">Ошибка загрузки каталога: ${e.message}</div>`;
  }
}

initCatalog();
