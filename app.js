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
let gymSchedule = [];
let gymRoutines = [];
let gymLogs = {}; // { "YYYY-MM-DD": true/false }
let calendarDate = new Date();
let editingProductId = null;
let editingSaleId = null;
let editingSupplierId = null;
let editingSupplyId = null;
let editingSavingId = null;
let profitChartInstance = null;

const WEEKDAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

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
  await loadGymData();
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
  document.getElementById("nav-gym").addEventListener("click", () => showView("gym"));

  document.getElementById("new-business-btn").addEventListener("click", () => openModal("modal-business"));
  document.getElementById("empty-new-business-btn").addEventListener("click", () => openModal("modal-business"));
  document.getElementById("add-product-btn").addEventListener("click", () => openProductModal());
  document.getElementById("add-sale-btn").addEventListener("click", () => openSaleModal());
  document.getElementById("delete-business-btn").addEventListener("click", deleteCurrentBusiness);
  document.getElementById("add-saving-btn").addEventListener("click", () => openSavingModal());
  document.getElementById("add-supplier-btn").addEventListener("click", () => openSupplierModal());
  document.getElementById("add-supply-btn").addEventListener("click", () => openSupplyModal());
  document.getElementById("recipe-apply-btn").addEventListener("click", applyRecipeCostToProduct);
  document.getElementById("add-routine-btn").addEventListener("click", () => openModal("modal-routine"));
  document.getElementById("cal-prev").addEventListener("click", () => changeCalendarMonth(-1));
  document.getElementById("cal-next").addEventListener("click", () => changeCalendarMonth(1));

  document.querySelectorAll(".wday-btn").forEach(btn => {
    btn.addEventListener("click", () => toggleScheduleDay(parseInt(btn.dataset.day, 10)));
  });

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
  document.getElementById("form-product").addEventListener("submit", handleSaveProduct);
  document.getElementById("form-sale").addEventListener("submit", handleSaveSale);
  document.getElementById("form-saving").addEventListener("submit", handleSaveSaving);
  document.getElementById("form-supplier").addEventListener("submit", handleSaveSupplier);
  document.getElementById("form-supply").addEventListener("submit", handleSaveSupply);
  document.getElementById("form-routine").addEventListener("submit", handleCreateRoutine);

  document.querySelectorAll("#saving-type-toggle .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#saving-type-toggle .seg-btn").forEach(b => b.classList.remove("active"));
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
  editingProductId = null;
  editingSaleId = null;
  editingSupplierId = null;
  editingSupplyId = null;
  editingSavingId = null;
  document.getElementById("input-sale-product").disabled = false;
}

function openSaleModal(sale = null) {
  const select = document.getElementById("input-sale-product");
  select.innerHTML = products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} — ${fmt(p.price)}</option>`).join("");
  if (products.length === 0) {
    select.innerHTML = `<option value="">Agrega un producto primero</option>`;
  }

  if (sale) {
    editingSaleId = sale.id;
    document.getElementById("modal-sale-title").textContent = "Editar venta";
    select.value = sale.product_id || "";
    select.disabled = true; // el producto de una venta ya pasada no se cambia, solo cantidad/fecha/nota
    document.getElementById("input-sale-qty").value = sale.quantity;
    document.getElementById("input-sale-date").value = sale.sale_date;
    document.getElementById("input-sale-note").value = sale.note || "";
  } else {
    editingSaleId = null;
    document.getElementById("modal-sale-title").textContent = "Registrar venta";
    select.disabled = false;
    document.getElementById("input-sale-date").valueAsDate = new Date();
  }
  openModal("modal-sale");
}

// ============================================
// NAVEGACIÓN DE VISTAS
// ============================================
function showView(view, businessId = null) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("view-savings").classList.add("hidden");
  document.getElementById("view-gym").classList.add("hidden");
  document.getElementById("view-business").classList.add("hidden");
  document.getElementById("view-empty").classList.add("hidden");

  if (view === "savings") {
    document.getElementById("nav-savings").classList.add("active");
    document.getElementById("view-savings").classList.remove("hidden");
    renderSavings();
  } else if (view === "gym") {
    document.getElementById("nav-gym").classList.add("active");
    document.getElementById("view-gym").classList.remove("hidden");
    renderGym();
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

async function deleteCurrentBusiness() {
  const business = businesses.find(b => b.id === currentBusinessId);
  if (!business) return;
  if (!confirm(`¿Eliminar "${business.name}" junto con todos sus productos, ventas, proveedores e insumos? Esto no se puede deshacer.`)) return;

  const { error } = await supabaseClient.from("businesses").delete().eq("id", currentBusinessId);
  if (error) { alert("No se pudo eliminar el negocio: " + error.message); return; }

  businesses = businesses.filter(b => b.id !== currentBusinessId);
  currentBusinessId = null;
  renderSidebar();
  if (businesses.length > 0) {
    showView("business", businesses[0].id);
  } else {
    showView("empty");
  }
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
      <td>
        <div class="row-actions">
          <button class="action-btn" data-recipe-product="${p.id}">Receta</button>
          <button class="icon-action" data-edit-product="${p.id}" title="Editar">✏️</button>
          <button class="icon-action danger" data-delete-product="${p.id}" title="Eliminar">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  prodBody.querySelectorAll("[data-recipe-product]").forEach(btn => {
    btn.addEventListener("click", () => openRecipeModal(btn.dataset.recipeProduct));
  });
  prodBody.querySelectorAll("[data-edit-product]").forEach(btn => {
    btn.addEventListener("click", () => openProductModal(products.find(p => p.id === btn.dataset.editProduct)));
  });
  prodBody.querySelectorAll("[data-delete-product]").forEach(btn => {
    btn.addEventListener("click", () => deleteProduct(btn.dataset.deleteProduct));
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
      <td>
        <div class="row-actions">
          <button class="icon-action" data-edit-sale="${s.id}" title="Editar">✏️</button>
          <button class="icon-action danger" data-delete-sale="${s.id}" title="Eliminar">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  saleBody.querySelectorAll("[data-edit-sale]").forEach(btn => {
    btn.addEventListener("click", () => openSaleModal(sales.find(s => s.id === btn.dataset.editSale)));
  });
  saleBody.querySelectorAll("[data-delete-sale]").forEach(btn => {
    btn.addEventListener("click", () => deleteSale(btn.dataset.deleteSale));
  });

  renderProfitChart();
}

function renderProfitChart() {
  const canvas = document.getElementById("profit-chart");
  document.getElementById("chart-empty").classList.toggle("hidden", sales.length > 0);
  canvas.classList.toggle("hidden", sales.length === 0);
  if (sales.length === 0) {
    if (profitChartInstance) { profitChartInstance.destroy(); profitChartInstance = null; }
    return;
  }

  // Agrupa ganancia por mes (YYYY-MM)
  const monthly = {};
  sales.forEach(s => {
    const key = s.sale_date.slice(0, 7); // "2026-09"
    const p = (s.unit_price - s.unit_cost) * s.quantity;
    monthly[key] = (monthly[key] || 0) + p;
  });
  const sortedKeys = Object.keys(monthly).sort();
  const labels = sortedKeys.map(k => {
    const [y, m] = k.split("-");
    return new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "short", year: "2-digit" });
  });
  const data = sortedKeys.map(k => monthly[k]);

  if (profitChartInstance) profitChartInstance.destroy();
  profitChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Ganancia",
        data,
        backgroundColor: "#2E9E7B",
        borderRadius: 6,
        maxBarThickness: 40
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: (v) => "$" + v } }
      }
    }
  });
}

function openProductModal(product = null) {
  if (product) {
    editingProductId = product.id;
    document.getElementById("modal-product-title").textContent = "Editar producto";
    document.getElementById("input-product-name").value = product.name;
    document.getElementById("input-product-cost").value = product.cost;
    document.getElementById("input-product-price").value = product.price;
  } else {
    editingProductId = null;
    document.getElementById("modal-product-title").textContent = "Nuevo producto";
  }
  openModal("modal-product");
}

async function handleSaveProduct(e) {
  e.preventDefault();
  const name = document.getElementById("input-product-name").value.trim();
  const cost = parseFloat(document.getElementById("input-product-cost").value);
  const price = parseFloat(document.getElementById("input-product-price").value);

  if (editingProductId) {
    const { data, error } = await supabaseClient
      .from("products").update({ name, cost, price }).eq("id", editingProductId).select().single();
    if (error) { alert("No se pudo actualizar el producto: " + error.message); return; }
    const idx = products.findIndex(p => p.id === editingProductId);
    if (idx !== -1) products[idx] = data;
  } else {
    const { data, error } = await supabaseClient
      .from("products").insert({ business_id: currentBusinessId, name, cost, price }).select().single();
    if (error) { alert("No se pudo guardar el producto: " + error.message); return; }
    products.push(data);
  }
  renderBusinessView();
  closeModal();
}

async function deleteProduct(id) {
  const product = products.find(p => p.id === id);
  if (!confirm(`¿Eliminar "${product ? product.name : 'este producto'}"? También se borra su receta.`)) return;
  const { error } = await supabaseClient.from("products").delete().eq("id", id);
  if (error) { alert("No se pudo eliminar: " + error.message); return; }
  products = products.filter(p => p.id !== id);
  renderBusinessView();
}

async function handleSaveSale(e) {
  e.preventDefault();
  const quantity = parseInt(document.getElementById("input-sale-qty").value, 10);
  const saleDate = document.getElementById("input-sale-date").value;
  const note = document.getElementById("input-sale-note").value.trim();

  if (editingSaleId) {
    const { data, error } = await supabaseClient
      .from("sales").update({ quantity, sale_date: saleDate, note }).eq("id", editingSaleId).select().single();
    if (error) { alert("No se pudo actualizar la venta: " + error.message); return; }
    const idx = sales.findIndex(s => s.id === editingSaleId);
    if (idx !== -1) sales[idx] = data;
  } else {
    const productId = document.getElementById("input-sale-product").value;
    const product = products.find(p => p.id === productId);
    if (!product) { alert("Elige un producto válido."); return; }

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
  }
  renderBusinessView();
  closeModal();
}

async function deleteSale(id) {
  if (!confirm("¿Eliminar esta venta?")) return;
  const { error } = await supabaseClient.from("sales").delete().eq("id", id);
  if (error) { alert("No se pudo eliminar: " + error.message); return; }
  sales = sales.filter(s => s.id !== id);
  renderBusinessView();
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
      <td>
        <div class="row-actions">
          <button class="icon-action" data-edit-saving="${m.id}" title="Editar">✏️</button>
          <button class="icon-action danger" data-delete-saving="${m.id}" title="Eliminar">🗑</button>
        </div>
      </td>
    </tr>
  `).join("");

  body.querySelectorAll("[data-edit-saving]").forEach(btn => {
    btn.addEventListener("click", () => openSavingModal(savingsMovements.find(m => m.id === btn.dataset.editSaving)));
  });
  body.querySelectorAll("[data-delete-saving]").forEach(btn => {
    btn.addEventListener("click", () => deleteSaving(btn.dataset.deleteSaving));
  });
}

function openSavingModal(saving = null) {
  if (saving) {
    editingSavingId = saving.id;
    savingType = saving.type;
    document.getElementById("modal-saving-title").textContent = "Editar movimiento";
    document.getElementById("input-saving-amount").value = saving.amount;
    document.getElementById("input-saving-note").value = saving.note || "";
    document.querySelectorAll("#saving-type-toggle .seg-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.type === saving.type);
    });
  } else {
    editingSavingId = null;
    savingType = "deposito";
    document.getElementById("modal-saving-title").textContent = "Movimiento de ahorro";
    document.querySelectorAll("#saving-type-toggle .seg-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.type === "deposito");
    });
  }
  openModal("modal-saving");
}

async function handleSaveSaving(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById("input-saving-amount").value);
  const note = document.getElementById("input-saving-note").value.trim();

  if (editingSavingId) {
    const { data, error } = await supabaseClient
      .from("savings").update({ amount, type: savingType, note }).eq("id", editingSavingId).select().single();
    if (error) { alert("No se pudo actualizar el movimiento: " + error.message); return; }
    const idx = savingsMovements.findIndex(m => m.id === editingSavingId);
    if (idx !== -1) savingsMovements[idx] = data;
  } else {
    const { data, error } = await supabaseClient
      .from("savings")
      .insert({ user_id: currentUser.id, amount, type: savingType, note })
      .select()
      .single();
    if (error) { alert("No se pudo guardar el movimiento: " + error.message); return; }
    savingsMovements.unshift(data);
  }
  renderSavings();
  closeModal();
}

async function deleteSaving(id) {
  if (!confirm("¿Eliminar este movimiento de ahorro?")) return;
  const { error } = await supabaseClient.from("savings").delete().eq("id", id);
  if (error) { alert("No se pudo eliminar: " + error.message); return; }
  savingsMovements = savingsMovements.filter(m => m.id !== id);
  renderSavings();
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
      <td>
        <div class="row-actions">
          <button class="icon-action" data-edit-supplier="${s.id}" title="Editar">✏️</button>
          <button class="icon-action danger" data-delete-supplier="${s.id}" title="Eliminar">🗑</button>
        </div>
      </td>
    </tr>
  `).join("");

  body.querySelectorAll("[data-edit-supplier]").forEach(btn => {
    btn.addEventListener("click", () => openSupplierModal(suppliers.find(s => s.id === btn.dataset.editSupplier)));
  });
  body.querySelectorAll("[data-delete-supplier]").forEach(btn => {
    btn.addEventListener("click", () => deleteSupplier(btn.dataset.deleteSupplier));
  });
}

function openSupplierModal(supplier = null) {
  if (supplier) {
    editingSupplierId = supplier.id;
    document.getElementById("modal-supplier-title").textContent = "Editar proveedor";
    document.getElementById("input-supplier-name").value = supplier.name;
    document.getElementById("input-supplier-contact").value = supplier.contact || "";
    document.getElementById("input-supplier-notes").value = supplier.notes || "";
  } else {
    editingSupplierId = null;
    document.getElementById("modal-supplier-title").textContent = "Nuevo proveedor";
  }
  openModal("modal-supplier");
}

async function handleSaveSupplier(e) {
  e.preventDefault();
  const name = document.getElementById("input-supplier-name").value.trim();
  const contact = document.getElementById("input-supplier-contact").value.trim();
  const notes = document.getElementById("input-supplier-notes").value.trim();

  if (editingSupplierId) {
    const { data, error } = await supabaseClient
      .from("suppliers").update({ name, contact, notes }).eq("id", editingSupplierId).select().single();
    if (error) { alert("No se pudo actualizar el proveedor: " + error.message); return; }
    const idx = suppliers.findIndex(s => s.id === editingSupplierId);
    if (idx !== -1) suppliers[idx] = data;
  } else {
    const { data, error } = await supabaseClient
      .from("suppliers").insert({ business_id: currentBusinessId, name, contact, notes }).select().single();
    if (error) { alert("No se pudo guardar el proveedor: " + error.message); return; }
    suppliers.push(data);
  }
  renderSuppliers();
  closeModal();
}

async function deleteSupplier(id) {
  if (!confirm("¿Eliminar este proveedor? Los insumos que le asignaste se quedan sin proveedor (no se borran).")) return;
  const { error } = await supabaseClient.from("suppliers").delete().eq("id", id);
  if (error) { alert("No se pudo eliminar: " + error.message); return; }
  suppliers = suppliers.filter(s => s.id !== id);
  supplies.forEach(s => { if (s.supplier_id === id) { s.supplier_id = null; s.suppliers = null; } });
  renderSuppliers();
  renderSupplies();
}

// ============================================
// INSUMOS (con comparación de proveedores)
// ============================================
function openSupplyModal(supply = null) {
  const select = document.getElementById("input-supply-supplier");
  select.innerHTML = `<option value="">Sin proveedor asignado</option>` +
    suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");

  if (supply) {
    editingSupplyId = supply.id;
    document.getElementById("modal-supply-title").textContent = "Editar insumo";
    document.getElementById("input-supply-name").value = supply.name;
    document.getElementById("input-supply-unit").value = supply.unit;
    document.getElementById("input-supply-cost").value = supply.unit_cost;
    select.value = supply.supplier_id || "";
  } else {
    editingSupplyId = null;
    document.getElementById("modal-supply-title").textContent = "Nuevo insumo";
  }
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

    let costDisplay = `${fmt(s.unit_cost)} <span class="ink-soft">/ ${escapeHtml(s.unit)}</span>`;
    if (s.unit === "kg" || s.unit === "l") {
      const smallUnit = s.unit === "kg" ? "g" : "ml";
      costDisplay += `<br><span class="ink-soft">≈ ${fmt(s.unit_cost / 1000)} / ${smallUnit}</span>`;
    }

    return `<tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(supplierName)}</td>
      <td class="num">${costDisplay}${isCheapest ? '<span class="badge-cheapest">✓ más barato</span>' : ''}</td>
      <td>
        <div class="row-actions">
          <button class="icon-action" data-edit-supply="${s.id}" title="Editar">✏️</button>
          <button class="icon-action danger" data-delete-supply="${s.id}" title="Eliminar">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join("");

  body.querySelectorAll("[data-edit-supply]").forEach(btn => {
    btn.addEventListener("click", () => openSupplyModal(supplies.find(s => s.id === btn.dataset.editSupply)));
  });
  body.querySelectorAll("[data-delete-supply]").forEach(btn => {
    btn.addEventListener("click", () => deleteSupply(btn.dataset.deleteSupply));
  });
}

async function handleSaveSupply(e) {
  e.preventDefault();
  const name = document.getElementById("input-supply-name").value.trim();
  const unit = document.getElementById("input-supply-unit").value;
  const unit_cost = parseFloat(document.getElementById("input-supply-cost").value);
  const supplierId = document.getElementById("input-supply-supplier").value || null;

  if (editingSupplyId) {
    const { data, error } = await supabaseClient
      .from("supplies").update({ name, unit, unit_cost, supplier_id: supplierId })
      .eq("id", editingSupplyId).select("*, suppliers(name)").single();
    if (error) { alert("No se pudo actualizar el insumo: " + error.message); return; }
    const idx = supplies.findIndex(s => s.id === editingSupplyId);
    if (idx !== -1) supplies[idx] = data;
  } else {
    const { data, error } = await supabaseClient
      .from("supplies")
      .insert({ business_id: currentBusinessId, supplier_id: supplierId, name, unit, unit_cost })
      .select("*, suppliers(name)")
      .single();
    if (error) { alert("No se pudo guardar el insumo: " + error.message); return; }
    supplies.push(data);
  }
  renderSupplies();
  closeModal();
}

async function deleteSupply(id) {
  if (!confirm("¿Eliminar este insumo? También se quita de las recetas que lo usaban.")) return;
  const { error } = await supabaseClient.from("supplies").delete().eq("id", id);
  if (error) { alert("No se pudo eliminar: " + error.message); return; }
  supplies = supplies.filter(s => s.id !== id);
  renderSupplies();
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

  listEl.innerHTML = supplies.map(s => {
    const showDetail = s.unit === "kg" || s.unit === "l";
    const smallUnit = s.unit === "kg" ? "g" : "ml";
    const existingQty = existingMap[s.id] || 0;
    return `
    <div class="recipe-row" data-supply-id="${s.id}" data-unit-cost="${s.unit_cost}">
      <div class="recipe-row-info">
        <span class="rname">${escapeHtml(s.name)}</span>
        <span class="rmeta">${fmt(s.unit_cost)} / ${escapeHtml(s.unit)}</span>
      </div>
      <div>
        <input type="number" step="0.001" min="0" class="recipe-qty" value="${existingQty}" title="Cantidad en ${escapeHtml(s.unit)}">
        ${showDetail ? `
          <input type="number" step="1" min="0" class="recipe-detail-input" data-factor="1000" placeholder="${smallUnit}" title="O escribe en ${smallUnit}">
          <div class="recipe-detail-label">${escapeHtml(s.unit)} u ${smallUnit}</div>
        ` : ""}
      </div>
    </div>`;
  }).join("");

  listEl.querySelectorAll(".recipe-qty").forEach(input => {
    input.addEventListener("input", updateRecipeTotal);
  });

  // Sincroniza el campo "en gramos/ml" con el campo principal (en kg/l)
  listEl.querySelectorAll(".recipe-detail-input").forEach(detailInput => {
    const row = detailInput.closest(".recipe-row");
    const mainInput = row.querySelector(".recipe-qty");
    const factor = parseFloat(detailInput.dataset.factor);
    if (parseFloat(mainInput.value) > 0) {
      detailInput.value = (parseFloat(mainInput.value) * factor).toString();
    }
    detailInput.addEventListener("input", () => {
      mainInput.value = detailInput.value ? (parseFloat(detailInput.value) / factor).toFixed(4) : 0;
      updateRecipeTotal();
    });
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
// GYM: horario, rutinas y calendario
// ============================================
async function loadGymData() {
  const [{ data: scheduleData }, { data: routineData }, { data: logData }] = await Promise.all([
    supabaseClient.from("gym_schedule").select("*").eq("user_id", currentUser.id).maybeSingle(),
    supabaseClient.from("gym_routines").select("*").eq("user_id", currentUser.id).order("weekday", { ascending: true }),
    supabaseClient.from("gym_logs").select("*").eq("user_id", currentUser.id)
  ]);
  gymSchedule = (scheduleData && scheduleData.days) || [];
  gymRoutines = routineData || [];
  gymLogs = {};
  (logData || []).forEach(l => { gymLogs[l.log_date] = l.attended; });
}

function renderGym() {
  document.querySelectorAll(".wday-btn").forEach(btn => {
    const day = parseInt(btn.dataset.day, 10);
    btn.classList.toggle("active", gymSchedule.includes(day));
  });
  renderRoutines();
  renderCalendar();
}

async function toggleScheduleDay(day) {
  if (gymSchedule.includes(day)) {
    gymSchedule = gymSchedule.filter(d => d !== day);
  } else {
    gymSchedule.push(day);
  }
  document.querySelector(`.wday-btn[data-day="${day}"]`).classList.toggle("active");
  renderCalendar();

  const { error } = await supabaseClient
    .from("gym_schedule")
    .upsert({ user_id: currentUser.id, days: gymSchedule, updated_at: new Date().toISOString() });
  if (error) console.error(error);
}

function renderRoutines() {
  const list = document.getElementById("routines-list");
  document.getElementById("routines-empty").classList.toggle("hidden", gymRoutines.length > 0);
  list.innerHTML = gymRoutines.map(r => `
    <div class="routine-item">
      <div>
        <span class="rname">${escapeHtml(r.title)}</span>
        ${r.notes ? `<span class="rnotes">${escapeHtml(r.notes)}</span>` : ""}
      </div>
      <span class="routine-day-tag">${WEEKDAY_NAMES[r.weekday]}</span>
    </div>
  `).join("");
}

async function handleCreateRoutine(e) {
  e.preventDefault();
  const weekday = parseInt(document.getElementById("input-routine-day").value, 10);
  const title = document.getElementById("input-routine-title").value.trim();
  const notes = document.getElementById("input-routine-notes").value.trim();

  const { data, error } = await supabaseClient
    .from("gym_routines")
    .upsert({ user_id: currentUser.id, weekday, title, notes }, { onConflict: "user_id,weekday" })
    .select()
    .single();
  if (error) { alert("No se pudo guardar la rutina: " + error.message); return; }

  const idx = gymRoutines.findIndex(r => r.weekday === weekday);
  if (idx !== -1) gymRoutines[idx] = data; else gymRoutines.push(data);
  gymRoutines.sort((a, b) => a.weekday - b.weekday);
  renderRoutines();
  renderCalendar();
  closeModal();
}

function changeCalendarMonth(delta) {
  calendarDate.setMonth(calendarDate.getMonth() + delta);
  renderCalendar();
}

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthLabel = calendarDate.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  document.getElementById("calendar-title").textContent = monthLabel;

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0=domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(new Date());

  const grid = document.getElementById("calendar-grid");
  let html = "";

  for (let i = 0; i < startOffset; i++) {
    html += `<div class="cal-day empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d);
    const key = dateKey(cellDate);
    const weekday = cellDate.getDay();
    const isScheduled = gymSchedule.includes(weekday);
    const attended = gymLogs[key];
    const isToday = key === todayKey;

    let cls = "cal-day";
    if (!isScheduled) cls += " not-scheduled";
    if (isToday) cls += " today";
    if (isScheduled) cls += " scheduled";
    if (attended === true) cls += " done";
    else if (attended === false) cls += " missed";

    html += `<div class="${cls}" data-date="${key}" data-scheduled="${isScheduled}">${d}${isScheduled ? '<span class="cal-dot"></span>' : ''}</div>`;
  }

  grid.innerHTML = html;
  // Solo los días programados (que marcaste que sí vas) se pueden marcar como cumplido/faltaste
  grid.querySelectorAll('.cal-day[data-scheduled="true"]').forEach(cell => {
    cell.addEventListener("click", () => toggleAttendance(cell.dataset.date));
  });
}

async function toggleAttendance(dateStr) {
  // Ciclo de 3 estados: sin marcar (programado) -> cumplí -> falté -> sin marcar de nuevo
  const current = gymLogs[dateStr];
  if (current === undefined) {
    gymLogs[dateStr] = true;
  } else if (current === true) {
    gymLogs[dateStr] = false;
  } else {
    delete gymLogs[dateStr];
  }
  renderCalendar();

  if (gymLogs[dateStr] === undefined) {
    const { error } = await supabaseClient.from("gym_logs").delete().eq("user_id", currentUser.id).eq("log_date", dateStr);
    if (error) console.error(error);
  } else {
    const { error } = await supabaseClient
      .from("gym_logs")
      .upsert({ user_id: currentUser.id, log_date: dateStr, attended: gymLogs[dateStr] }, { onConflict: "user_id,log_date" });
    if (error) console.error(error);
  }
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
