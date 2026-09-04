// ============================================
// ESTADO GLOBAL
// ============================================
let currentUser = null;
let isSignUpMode = false;
let businesses = [];
let currentBusinessId = null;
let products = [];
let sales = [];
let savingsMovements = [];
let savingType = "deposito";
let suppliers = [];
let supplies = [];
let currentRecipeProductId = null;

const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ============================================
// INIT
// ============================================
window.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("input-sale-date").valueAsDate = new Date();
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    await enterApp();
  } else {
    showAuth();
  }
  bindEvents();
});

// ============================================
// AUTH
// ============================================
function showAuth() {
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("app-shell").classList.add("hidden");
}

async function enterApp() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");
  await loadBusinesses();
  await loadSavings();
  renderSidebar();
  showView("savings");
}

function bindEvents() {
  document.getElementById("auth-toggle").addEventListener("click", () => {
    isSignUpMode = !isSignUpMode;
    document.getElementById("auth-title").textContent = isSignUpMode ? "Crear cuenta" : "Entrar";
    document.getElementById("auth-submit").textContent = isSignUpMode ? "Crear cuenta" : "Entrar";
    document.getElementById("auth-toggle").textContent = isSignUpMode ? "¿Ya tienes cuenta? Entra" : "¿No tienes cuenta? Crea una";
    document.getElementById("auth-error").textContent = "";
  });

  document.getElementById("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const errorEl = document.getElementById("auth-error");
    errorEl.textContent = "";
    try {
      if (isSignUpMode) {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          errorEl.style.color = "var(--accent)";
          errorEl.textContent = "Cuenta creada. Revisa tu correo para confirmar, luego inicia sesión.";
          return;
        }
        currentUser = data.user;
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
      }
      await enterApp();
    } catch (err) {
      errorEl.style.color = "var(--danger)";
      errorEl.textContent = traducirError(err.message);
    }
  });

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    currentUser = null;
    businesses = [];
    currentBusinessId = null;
    showAuth();
  });

  document.getElementById("nav-savings").addEventListener("click", () => showView("savings"));

  document.getElementById("new-business-btn").addEventListener("click", () => openModal("modal-business"));
  document.getElementById("empty-new-business-btn").addEventListener("click", () => openModal("modal-business"));
  document.getElementById("add-product-btn").addEventListener("click", () => openModal("modal-product"));
  document.getElementById("add-sale-btn").addEventListener("click", () => openSaleModal());
  document.getElementById("add-saving-btn").addEventListener("click", () => openModal("modal-saving"));
  document.getElementById("add-supplier-btn").addEventListener("click", () => openModal("modal-supplier"));
  document.getElementById("add-supply-btn").addEventListener("click", () => openSupplyModal());
  document.getElementById("recipe-apply-btn").addEventListener("click", applyRecipeCostToProduct);

  document.querySelectorAll("#business-tabs .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#business-tabs .seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      document.getElementById("tab-ventas").classList.toggle("hidden", tab !== "ventas");
      document.getElementById("tab-insumos").classList.toggle("hidden", tab !== "insumos");
    });
  });

  document.querySelectorAll(".modal-cancel").forEach(btn =>
    btn.addEventListener("click", closeModal)
  );
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });

  document.getElementById("form-business").addEventListener("submit", handleCreateBusiness);
  document.getElementById("form-product").addEventListener("submit", handleCreateProduct);
  document.getElementById("form-sale").addEventListener("submit", handleCreateSale);
  document.getElementById("form-saving").addEventListener("submit", handleCreateSaving);
  document.getElementById("form-supplier").addEventListener("submit", handleCreateSupplier);
  document.getElementById("form-supply").addEventListener("submit", handleCreateSupply);

  document.querySelectorAll(".seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      savingType = btn.dataset.type;
    });
  });
}

function traducirError(msg) {
  if (msg.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (msg.includes("already registered")) return "Ese correo ya tiene una cuenta.";
  if (msg.includes("Password should be")) return "La contraseña debe tener al menos 6 caracteres.";
  return msg;
}

// ============================================
// MODALES
// ============================================
function openModal(id) {
  document.getElementById("modal-overlay").classList.remove("hidden");
  document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}
function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  document.querySelectorAll(".modal form").forEach(f => f.reset());
}

function openSaleModal() {
  const select = document.getElementById("input-sale-product");
  select.innerHTML = products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} — ${fmt(p.price)}</option>`).join("");
  if (products.length === 0) {
    select.innerHTML = `<option value="">Agrega un producto primero</option>`;
  }
  document.getElementById("input-sale-date").valueAsDate = new Date();
  openModal("modal-sale");
}

// ============================================
// NAVEGACIÓN DE VISTAS
// ============================================
function showView(view, businessId = null) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("view-savings").classList.add("hidden");
  document.getElementById("view-business").classList.add("hidden");
  document.getElementById("view-empty").classList.add("hidden");

  if (view === "savings") {
    document.getElementById("nav-savings").classList.add("active");
    document.getElementById("view-savings").classList.remove("hidden");
    renderSavings();
  } else if (view === "business") {
    currentBusinessId = businessId;
    const navEl = document.querySelector(`[data-business-id="${businessId}"]`);
    if (navEl) navEl.classList.add("active");
    document.getElementById("view-business").classList.remove("hidden");
    loadProductsAndSales(businessId);
  } else if (view === "empty") {
    document.getElementById("view-empty").classList.remove("hidden");
  }
}

// ============================================
// NEGOCIOS
// ============================================
async function loadBusinesses() {
  const { data, error } = await supabaseClient
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) { console.error(error); return; }
  businesses = data || [];
}

function renderSidebar() {
  const list = document.getElementById("business-list");
  list.innerHTML = businesses.map(b => `
    <button class="nav-item" data-business-id="${b.id}">
      <span class="nav-dot" style="background:${b.color}"></span> ${escapeHtml(b.name)}
    </button>
  `).join("");

  list.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => showView("business", btn.dataset.businessId));
  });
}

async function handleCreateBusiness(e) {
  e.preventDefault();
  const name = document.getElementById("input-business-name").value.trim();
  const colors = ["#1F7A5C", "#2F5D8A", "#B3432B", "#6E5A9E", "#B08A2E"];
  const color = colors[businesses.length % colors.length];
  const { data, error } = await supabaseClient
    .from("businesses")
    .insert({ user_id: currentUser.id, name, color })
    .select()
    .single();
  if (error) { alert("No se pudo crear el negocio: " + error.message); return; }
  businesses.push(data);
  renderSidebar();
  closeModal();
  showView("business", data.id);
}

// ============================================
// PRODUCTOS Y VENTAS
// ============================================
async function loadProductsAndSales(businessId) {
  const business = businesses.find(b => b.id === businessId);
  document.getElementById("business-name").textContent = business ? business.name : "Negocio";

  // Vuelve siempre a la pestaña "Ventas" al cambiar de negocio
  document.querySelectorAll("#business-tabs .seg-btn").forEach(b => b.classList.remove("active"));
  document.querySelector('#business-tabs [data-tab="ventas"]').classList.add("active");
  document.getElementById("tab-ventas").classList.remove("hidden");
  document.getElementById("tab-insumos").classList.add("hidden");

  const [
    { data: prodData, error: prodErr },
    { data: saleData, error: saleErr },
    { data: supplierData, error: supplierErr },
    { data: supplyData, error: supplyErr }
  ] = await Promise.all([
    supabaseClient.from("products").select("*").eq("business_id", businessId).order("created_at", { ascending: true }),
    supabaseClient.from("sales").select("*").eq("business_id", businessId).order("sale_date", { ascending: false }).order("created_at", { ascending: false }),
    supabaseClient.from("suppliers").select("*").eq("business_id", businessId).order("created_at", { ascending: true }),
    supabaseClient.from("supplies").select("*, suppliers(name)").eq("business_id", businessId).order("name", { ascending: true })
  ]);

  if (prodErr) console.error(prodErr);
  if (saleErr) console.error(saleErr);
  if (supplierErr) console.error(supplierErr);
  if (supplyErr) console.error(supplyErr);

  products = prodData || [];
  sales = saleData || [];
  suppliers = supplierData || [];
  supplies = supplyData || [];
  renderBusinessView();
  renderSuppliers();
  renderSupplies();
}

function renderBusinessView() {
  const revenue = sales.reduce((sum, s) => sum + s.unit_price * s.quantity, 0);
  const cost = sales.reduce((sum, s) => sum + s.unit_cost * s.quantity, 0);
  const profit = revenue - cost;

  document.getElementById("stat-revenue").textContent = fmt(revenue);
  document.getElementById("stat-cost").textContent = fmt(cost);
  document.getElementById("stat-profit").textContent = fmt(profit);

  const prodBody = document.getElementById("products-table-body");
  document.getElementById("products-empty").classList.toggle("hidden", products.length > 0);
  prodBody.innerHTML = products.map(p => {
    const margin = p.price - p.cost;
    return `<tr>
      <td>${escapeHtml(p.name)}</td>
      <td class="num">${fmt(p.cost)}</td>
      <td class="num">${fmt(p.price)}</td>
      <td class="num ${margin >= 0 ? 'positive' : 'negative'}">${fmt(margin)}</td>
      <td><button class="action-btn" data-recipe-product="${p.id}">Receta</button></td>
    </tr>`;
  }).join("");

  prodBody.querySelectorAll("[data-recipe-product]").forEach(btn => {
    btn.addEventListener("click", () => openRecipeModal(btn.dataset.recipeProduct));
  });

  const saleBody = document.getElementById("sales-table-body");
  document.getElementById("sales-empty").classList.toggle("hidden", sales.length > 0);
  saleBody.innerHTML = sales.map(s => {
    const saleProfit = (s.unit_price - s.unit_cost) * s.quantity;
    return `<tr>
      <td>${formatDate(s.sale_date)}</td>
      <td>${escapeHtml(s.product_name)}</td>
      <td class="num">${s.quantity}</td>
      <td class="num ${saleProfit >= 0 ? 'positive' : 'negative'}">${fmt(saleProfit)}</td>
    </tr>`;
  }).join("");
}

async function handleCreateProduct(e) {
  e.preventDefault();
  const name = document.getElementById("input-product-name").value.trim();
  const cost = parseFloat(document.getElementById("input-product-cost").value);
  const price = parseFloat(document.getElementById("input-product-price").value);

  const { data, error } = await supabaseClient
    .from("products")
    .insert({ business_id: currentBusinessId, name, cost, price })
    .select()
    .single();
  if (error) { alert("No se pudo guardar el producto: " + error.message); return; }
  products.push(data);
  renderBusinessView();
  closeModal();
}

async function handleCreateSale(e) {
  e.preventDefault();
  const productId = document.getElementById("input-sale-product").value;
  const product = products.find(p => p.id === productId);
  if (!product) { alert("Elige un producto válido."); return; }

  const quantity = parseInt(document.getElementById("input-sale-qty").value, 10);
  const saleDate = document.getElementById("input-sale-date").value;
  const note = document.getElementById("input-sale-note").value.trim();

  const { data, error } = await supabaseClient
    .from("sales")
    .insert({
      business_id: currentBusinessId,
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_cost: product.cost,
      unit_price: product.price,
      sale_date: saleDate,
      note
    })
    .select()
    .single();
  if (error) { alert("No se pudo registrar la venta: " + error.message); return; }
  sales.unshift(data);
  renderBusinessView();
  closeModal();
}

// ============================================
// AHORROS
// ============================================
async function loadSavings() {
  const { data, error } = await supabaseClient
    .from("savings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return; }
  savingsMovements = data || [];
}

function renderSavings() {
  const total = savingsMovements.reduce((sum, m) => sum + (m.type === "deposito" ? m.amount : -m.amount), 0);
  document.getElementById("savings-total").textContent = fmt(total);

  const body = document.getElementById("savings-table-body");
  document.getElementById("savings-empty").classList.toggle("hidden", savingsMovements.length > 0);
  body.innerHTML = savingsMovements.map(m => `
    <tr>
      <td>${formatDate(m.created_at)}</td>
      <td>${m.type === "deposito" ? "Depósito" : "Retiro"}</td>
      <td>${escapeHtml(m.note || "—")}</td>
      <td class="num ${m.type === "deposito" ? "positive" : "negative"}">${m.type === "deposito" ? "+" : "−"}${fmt(m.amount)}</td>
    </tr>
  `).join("");
}

async function handleCreateSaving(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById("input-saving-amount").value);
  const note = document.getElementById("input-saving-note").value.trim();

  const { data, error } = await supabaseClient
    .from("savings")
    .insert({ user_id: currentUser.id, amount, type: savingType, note })
    .select()
    .single();
  if (error) { alert("No se pudo guardar el movimiento: " + error.message); return; }
  savingsMovements.unshift(data);
  renderSavings();
  closeModal();
}

// ============================================
// PROVEEDORES
// ============================================
function renderSuppliers() {
  const body = document.getElementById("suppliers-table-body");
  document.getElementById("suppliers-empty").classList.toggle("hidden", suppliers.length > 0);
  body.innerHTML = suppliers.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.contact || "—")}</td>
    </tr>
  `).join("");
}

async function handleCreateSupplier(e) {
  e.preventDefault();
  const name = document.getElementById("input-supplier-name").value.trim();
  const contact = document.getElementById("input-supplier-contact").value.trim();
  const notes = document.getElementById("input-supplier-notes").value.trim();

  const { data, error } = await supabaseClient
    .from("suppliers")
    .insert({ business_id: currentBusinessId, name, contact, notes })
    .select()
    .single();
  if (error) { alert("No se pudo guardar el proveedor: " + error.message); return; }
  suppliers.push(data);
  renderSuppliers();
  closeModal();
}

// ============================================
// INSUMOS (con comparación de proveedores)
// ============================================
function openSupplyModal() {
  const select = document.getElementById("input-supply-supplier");
  select.innerHTML = `<option value="">Sin proveedor asignado</option>` +
    suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  openModal("modal-supply");
}

function renderSupplies() {
  const body = document.getElementById("supplies-table-body");
  document.getElementById("supplies-empty").classList.toggle("hidden", supplies.length > 0);

  // Para marcar el más barato, agrupamos por nombre de insumo (sin importar mayúsculas)
  const cheapestByName = {};
  supplies.forEach(s => {
    const key = s.name.trim().toLowerCase();
    if (!cheapestByName[key] || s.unit_cost < cheapestByName[key]) {
      cheapestByName[key] = s.unit_cost;
    }
  });

  // Ordenamos para que insumos con el mismo nombre queden juntos (fácil de comparar)
  const sorted = [...supplies].sort((a, b) => a.name.localeCompare(b.name) || a.unit_cost - b.unit_cost);

  body.innerHTML = sorted.map(s => {
    const key = s.name.trim().toLowerCase();
    const sameNameCount = supplies.filter(x => x.name.trim().toLowerCase() === key).length;
    const isCheapest = sameNameCount > 1 && s.unit_cost === cheapestByName[key];
    const supplierName = s.suppliers ? s.suppliers.name : "—";
    return `<tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(supplierName)}</td>
      <td class="num">${fmt(s.unit_cost)} <span class="ink-soft">/ ${escapeHtml(s.unit)}</span>${isCheapest ? '<span class="badge-cheapest">✓ más barato</span>' : ''}</td>
    </tr>`;
  }).join("");
}

async function handleCreateSupply(e) {
  e.preventDefault();
  const name = document.getElementById("input-supply-name").value.trim();
  const unit = document.getElementById("input-supply-unit").value;
  const unit_cost = parseFloat(document.getElementById("input-supply-cost").value);
  const supplierId = document.getElementById("input-supply-supplier").value || null;

  const { data, error } = await supabaseClient
    .from("supplies")
    .insert({ business_id: currentBusinessId, supplier_id: supplierId, name, unit, unit_cost })
    .select("*, suppliers(name)")
    .single();
  if (error) { alert("No se pudo guardar el insumo: " + error.message); return; }
  supplies.push(data);
  renderSupplies();
  closeModal();
}

// ============================================
// RECETA DE PRODUCTO (composición y costo automático)
// ============================================
async function openRecipeModal(productId) {
  currentRecipeProductId = productId;
  const product = products.find(p => p.id === productId);
  document.getElementById("recipe-product-name").textContent = product ? product.name : "";

  const listEl = document.getElementById("recipe-list");
  const emptyEl = document.getElementById("recipe-empty");

  if (supplies.length === 0) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    document.getElementById("recipe-total-cost").textContent = fmt(0);
    openModal("modal-recipe");
    return;
  }
  emptyEl.classList.add("hidden");

  const { data: existing, error } = await supabaseClient
    .from("product_supplies")
    .select("*")
    .eq("product_id", productId);
  if (error) console.error(error);

  const existingMap = {};
  (existing || []).forEach(r => { existingMap[r.supply_id] = r.quantity; });

  listEl.innerHTML = supplies.map(s => `
    <div class="recipe-row" data-supply-id="${s.id}" data-unit-cost="${s.unit_cost}">
      <div class="recipe-row-info">
        <span class="rname">${escapeHtml(s.name)}</span>
        <span class="rmeta">${fmt(s.unit_cost)} / ${escapeHtml(s.unit)}</span>
      </div>
      <input type="number" step="0.001" min="0" class="recipe-qty" value="${existingMap[s.id] || 0}">
    </div>
  `).join("");

  listEl.querySelectorAll(".recipe-qty").forEach(input => {
    input.addEventListener("input", updateRecipeTotal);
  });

  updateRecipeTotal();
  openModal("modal-recipe");
}

function updateRecipeTotal() {
  let total = 0;
  document.querySelectorAll("#recipe-list .recipe-row").forEach(row => {
    const unitCost = parseFloat(row.dataset.unitCost);
    const qty = parseFloat(row.querySelector(".recipe-qty").value) || 0;
    total += unitCost * qty;
  });
  document.getElementById("recipe-total-cost").textContent = fmt(total);
}

async function applyRecipeCostToProduct() {
  const rows = document.querySelectorAll("#recipe-list .recipe-row");
  const toSave = [];
  let total = 0;
  rows.forEach(row => {
    const qty = parseFloat(row.querySelector(".recipe-qty").value) || 0;
    const unitCost = parseFloat(row.dataset.unitCost);
    if (qty > 0) {
      toSave.push({ product_id: currentRecipeProductId, supply_id: row.dataset.supplyId, quantity: qty });
      total += unitCost * qty;
    }
  });

  // Reemplaza la receta anterior de este producto por la nueva
  const { error: delErr } = await supabaseClient.from("product_supplies").delete().eq("product_id", currentRecipeProductId);
  if (delErr) { alert("No se pudo actualizar la receta: " + delErr.message); return; }

  if (toSave.length > 0) {
    const { error: insErr } = await supabaseClient.from("product_supplies").insert(toSave);
    if (insErr) { alert("No se pudo guardar la receta: " + insErr.message); return; }
  }

  const { data: updated, error: updErr } = await supabaseClient
    .from("products")
    .update({ cost: total })
    .eq("id", currentRecipeProductId)
    .select()
    .single();
  if (updErr) { alert("No se pudo actualizar el costo del producto: " + updErr.message); return; }

  const idx = products.findIndex(p => p.id === currentRecipeProductId);
  if (idx !== -1) products[idx] = updated;
  renderBusinessView();
  closeModal();
}

// ============================================
// UTILIDADES
// ============================================
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
