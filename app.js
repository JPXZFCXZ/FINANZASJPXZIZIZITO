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

  const [{ data: prodData, error: prodErr }, { data: saleData, error: saleErr }] = await Promise.all([
    supabaseClient.from("products").select("*").eq("business_id", businessId).order("created_at", { ascending: true }),
    supabaseClient.from("sales").select("*").eq("business_id", businessId).order("sale_date", { ascending: false }).order("created_at", { ascending: false })
  ]);

  if (prodErr) console.error(prodErr);
  if (saleErr) console.error(saleErr);

  products = prodData || [];
  sales = saleData || [];
  renderBusinessView();
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
    </tr>`;
  }).join("");

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
