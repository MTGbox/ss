const state = {
  token: localStorage.getItem("crmsToken") || "",
  user: JSON.parse(localStorage.getItem("crmsUser") || "null"),
  currentModule: "dashboard",
  search: "",
  facilityCategory: "",
  facilities: [],
  equipment: [],
  people: [],
  books: [],
  services: [],
  announcements: [],
  recentBookings: []
};

const authShell = document.getElementById("authShell");
const appShell = document.getElementById("appShell");
const toast = document.getElementById("toast");
const actionModal = document.getElementById("actionModal");
const modalTitle = document.getElementById("modalTitle");
const modalForm = document.getElementById("modalForm");

document.querySelectorAll("[data-auth-view]").forEach((button) => {
  button.addEventListener("click", () => switchAuthView(button.dataset.authView));
});

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    showModule(item.dataset.module);
  });
});

document.querySelectorAll(".settings-link").forEach((button) => {
  button.addEventListener("click", () => showSettingsTab(button.dataset.settingsTab));
});

document.getElementById("userLoginForm").addEventListener("submit", (event) => handleLogin(event, "user"));
document.getElementById("adminLoginForm").addEventListener("submit", (event) => handleLogin(event, "admin"));
document.getElementById("registerForm").addEventListener("submit", handleRegister);
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshAdminRequests").addEventListener("click", loadAdminRequests);
document.getElementById("pendingApprovals").addEventListener("click", async () => {
  await loadAdminRequests();
  showModule("adminRequestsModule");
});
document.getElementById("showAddFacilityForm").addEventListener("click", () => {
  document.getElementById("facilityCreateForm").classList.toggle("hidden");
});
document.getElementById("globalSearch").addEventListener("input", (event) => {
  state.search = event.target.value.trim().toLowerCase();
  renderCurrentModule();
});
document.getElementById("showAnnouncementsBtn").addEventListener("click", () => showModule("dashboard"));
document.getElementById("closeModalBtn").addEventListener("click", closeModal);
actionModal.addEventListener("click", (event) => {
  if (event.target === actionModal) {
    closeModal();
  }
});

document.getElementById("facilityCreateForm").addEventListener("submit", (event) => submitAdminForm(event, "/api/admin/facilities", async () => {
  await loadFacilities();
  showModule("facilities");
}));
document.getElementById("equipmentCreateForm").addEventListener("submit", (event) => submitAdminForm(event, "/api/admin/equipment", async () => {
  await loadEquipment();
  showModule("equipment");
}));
document.getElementById("personCreateForm").addEventListener("submit", (event) => submitAdminForm(event, "/api/admin/people", async () => {
  await loadPeople();
  showModule("people");
}));
document.getElementById("bookCreateForm").addEventListener("submit", (event) => submitAdminForm(event, "/api/admin/books", async () => {
  await loadLibrary();
  showModule("library");
}));
document.getElementById("serviceCreateForm").addEventListener("submit", (event) => submitAdminForm(event, "/api/admin/student-services", async () => {
  await loadStudentServices();
  showModule("students");
}));
document.getElementById("announcementCreateForm").addEventListener("submit", (event) => submitAdminForm(event, "/api/admin/announcements", async () => {
  await loadDashboard();
  showModule("dashboard");
}));

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Request failed.");
  }
  return data;
}

function switchAuthView(view) {
  document.querySelectorAll(".auth-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.authView === view));
  document.querySelectorAll(".auth-form").forEach((form) => form.classList.toggle("active", form.dataset.authForm === view));
  setAuthMessage("");
}

function setAuthMessage(message, isError = true) {
  const el = document.getElementById("authMessage");
  el.textContent = message;
  el.classList.toggle("error", isError && Boolean(message));
  el.classList.toggle("success", !isError && Boolean(message));
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.add("show");
  toast.classList.toggle("error", isError);
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

async function handleLogin(event, role) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
        role
      })
    });
    storeSession(data);
    await bootApp();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    storeSession(data);
    await bootApp();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
}

function storeSession(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem("crmsToken", state.token);
  localStorage.setItem("crmsUser", JSON.stringify(state.user));
}

function logout() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("crmsToken");
  localStorage.removeItem("crmsUser");
  closeModal();
  authShell.classList.remove("hidden");
  appShell.classList.add("hidden");
}

async function bootApp() {
  try {
    const me = await api("/api/me");
    state.user = me.user;
    localStorage.setItem("crmsUser", JSON.stringify(state.user));
    authShell.classList.add("hidden");
    appShell.classList.remove("hidden");
    hydrateUser();
    await Promise.all([loadDashboard(), loadFacilities(), loadEquipment(), loadPeople(), loadLibrary(), loadStudentServices()]);
    if (state.user.role === "admin") {
      await loadAdminRequests();
    }
    showModule("dashboard");
  } catch (error) {
    logout();
  }
}

function hydrateUser() {
  const initials = getInitials(state.user.full_name);
  document.getElementById("sidebarUserName").textContent = state.user.full_name;
  document.getElementById("sidebarUserRole").textContent = state.user.role === "admin" ? "Administrator" : "Student/Staff";
  document.getElementById("sidebarAvatar").textContent = initials;
  document.getElementById("settingsAvatar").textContent = initials;
  document.getElementById("settingsName").value = state.user.full_name;
  document.getElementById("settingsEmail").value = state.user.email;
  document.getElementById("settingsDepartment").value = state.user.department;
  document.getElementById("settingsRole").value = state.user.role.toUpperCase();

  document.querySelectorAll(".admin-only").forEach((node) => {
    node.classList.toggle("hidden", state.user.role !== "admin");
  });
}

function showModule(moduleId) {
  state.currentModule = moduleId;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.module === moduleId));
  document.querySelectorAll(".module").forEach((module) => module.classList.toggle("active", module.id === moduleId));
  renderCurrentModule();
}

function showSettingsTab(tab) {
  document.querySelectorAll(".settings-link").forEach((link) => link.classList.toggle("active", link.dataset.settingsTab === tab));
  document.getElementById("settingsProfile").classList.toggle("active", tab === "profile");
  document.getElementById("settingsNotifications").classList.toggle("active", tab === "notifications");
  document.getElementById("settingsSecurity").classList.toggle("active", tab === "security");
}

function renderCurrentModule() {
  if (state.currentModule === "facilities") renderFacilities();
  if (state.currentModule === "equipment") renderEquipment();
  if (state.currentModule === "people") renderPeople();
  if (state.currentModule === "library") renderLibrary();
  if (state.currentModule === "students") renderStudentServices();
}

async function loadDashboard() {
  const data = await api("/api/dashboard");
  state.announcements = data.announcements || [];
  state.recentBookings = data.recentBookings || [];

  document.getElementById("statFacilities").textContent = data.stats.totalFacilities;
  document.getElementById("statBookings").textContent = data.stats.activeBookings;
  document.getElementById("statUsers").textContent = data.stats.totalUsers;
  document.getElementById("statEquipment").textContent = data.stats.equipmentItems;
  document.getElementById("pendingApprovals").textContent = `${data.stats.pendingRequests} pending`;

  renderUtilizationChart(data.stats);
  renderRecentBookings();
  renderAnnouncements();
}

function renderUtilizationChart(stats) {
  const chart = document.getElementById("utilizationChart");
  const data = [
    { label: "Facilities", primary: Math.min(100, stats.totalFacilities * 6), secondary: Math.min(100, Math.max(stats.activeBookings * 10, 18)) },
    { label: "Equipment", primary: Math.min(100, stats.equipmentItems * 10), secondary: Math.min(100, stats.activeBookings * 8 + 20) },
    { label: "Users", primary: Math.min(100, stats.totalUsers * 35), secondary: Math.min(100, stats.totalFacilities * 8 + 15) },
    { label: "Approvals", primary: Math.min(100, stats.pendingRequests * 24 + 10), secondary: Math.min(100, stats.activeBookings * 9 + 10) }
  ];

  chart.innerHTML = data.map((item) => `
    <div class="chart-group">
      <div class="chart-bars">
        <div class="chart-bar" style="height:${Math.max(item.primary, 18)}%"></div>
        <div class="chart-bar secondary" style="height:${Math.max(item.secondary, 14)}%"></div>
      </div>
      <span class="chart-label">${item.label}</span>
    </div>
  `).join("");
}

function renderRecentBookings() {
  const target = document.getElementById("recentBookings");
  const items = applySearch(state.recentBookings, (item) => `${item.resource} ${item.user} ${item.period}`);
  target.innerHTML = items.length ? items.map((item) => `
    <article class="recent-item">
      <div class="recent-top">
        <span class="recent-title">${item.resource}</span>
        <span class="status-chip ${item.status}">${item.status}</span>
      </div>
      <span class="recent-meta"><i class="fa-regular fa-user"></i> ${item.user}</span>
      <span class="recent-time">${item.period}</span>
    </article>
  `).join("") : `<p class="empty-state">No bookings found.</p>`;
}

function renderAnnouncements() {
  const target = document.getElementById("announcements");
  target.innerHTML = state.announcements.length ? state.announcements.map((item) => `
    <article class="announcement-item">
      ${state.user?.role === "admin" ? `<button class="delete-btn" type="button" onclick="deleteResource('/api/admin/announcements/${item.id}', loadDashboard, 'announcement')"><i class="fa-solid fa-trash"></i></button>` : ""}
      <strong>${item.title}</strong>
      <p>${item.body}</p>
      <span class="announcement-meta">By ${item.authorName || "Admin"} · ${formatRelativeDate(item.createdAt)}</span>
    </article>
  `).join("") : `<p class="empty-state">No announcements available.</p>`;
}

async function loadFacilities() {
  const data = await api("/api/facilities");
  state.facilities = data.items;
  const categories = ["All Spaces", ...data.categories];
  if (state.facilityCategory && !categories.includes(state.facilityCategory)) {
    state.facilityCategory = "";
  }
  renderFacilityFilters(categories);
  renderFacilities();
}

function renderFacilityFilters(categories) {
  document.getElementById("facilityFilterChips").innerHTML = categories.map((category) => {
    const active = (category === "All Spaces" && !state.facilityCategory) || category === state.facilityCategory;
    return `<button class="pill-btn ${active ? "active" : ""}" type="button" onclick="setFacilityCategory('${escapeText(category === "All Spaces" ? "" : category)}')">${category}</button>`;
  }).join("");
}

function renderFacilities() {
  const items = applySearch(
    state.facilityCategory ? state.facilities.filter((item) => item.category === state.facilityCategory) : state.facilities,
    (item) => `${item.name} ${item.category} ${item.location} ${item.description}`
  );

  document.getElementById("facilityGrid").innerHTML = items.length ? items.map((item) => `
    <article class="facility-card">
      ${state.user?.role === "admin" ? `<button class="delete-btn" type="button" onclick="deleteResource('/api/admin/facilities/${item.id}', loadFacilities, 'facility')"><i class="fa-solid fa-trash"></i></button>` : ""}
      <div class="facility-head">
        <div class="facility-copy">
          <h3 class="facility-title">${item.name}</h3>
          <p>${item.category}</p>
          <p>${item.description || "No description provided."}</p>
        </div>
        <span class="status-chip ${item.status === "Available" ? "available" : "pending"}">${item.status}</span>
      </div>
      <div class="info-list">
        <div class="info-item"><i class="fa-regular fa-user-group"></i><span>Up to ${item.capacity} people</span></div>
        <div class="info-item"><i class="fa-solid fa-location-dot"></i><span>${item.location}</span></div>
      </div>
      <button class="btn-outline" type="button" onclick="openFacilityBooking('${escapeText(item.id)}', '${escapeText(item.name)}')">
        <i class="fa-regular fa-calendar"></i> Book Space
      </button>
    </article>
  `).join("") : `<p class="empty-state">No facilities matched your search.</p>`;
}

async function loadEquipment() {
  const data = await api("/api/equipment");
  state.equipment = data.items;
  renderEquipment();
}

function renderEquipment() {
  const items = applySearch(state.equipment, (item) => `${item.name} ${item.category} ${item.description}`);
  document.getElementById("equipmentGrid").innerHTML = items.length ? items.map((item) => `
    <article class="equipment-card">
      ${state.user?.role === "admin" ? `<button class="delete-btn" type="button" onclick="deleteResource('/api/admin/equipment/${item.id}', loadEquipment, 'equipment')"><i class="fa-solid fa-trash"></i></button>` : ""}
      <div class="equipment-head">
        <div class="equipment-icon"><i class="fa-solid fa-cube"></i></div>
      </div>
      <h3 class="equipment-title">${item.name}</h3>
      <p class="equipment-type">${item.category}</p>
      <p class="equipment-desc">${item.description || "Shared campus equipment available for request."}</p>
      <div class="stock-grid">
        <div class="stock-box"><strong>${item.available_quantity}</strong><span>Available</span></div>
        <div class="stock-box"><strong>${item.total_quantity}</strong><span>Total</span></div>
      </div>
      <button class="btn-primary" type="button" onclick="openEquipmentBooking('${escapeText(item.id)}', '${escapeText(item.name)}')">Borrow</button>
    </article>
  `).join("") : `<p class="empty-state">No equipment matched your search.</p>`;
}

async function loadPeople() {
  const data = await api("/api/people");
  state.people = data.items;
  renderPeople();
}

function renderPeople() {
  const items = applySearch(state.people, (item) => `${item.name} ${item.title} ${item.department} ${item.email} ${item.phone}`);
  document.getElementById("peopleList").innerHTML = items.length ? items.map((item) => `
    <article class="person-card">
      ${state.user?.role === "admin" ? `<button class="delete-btn" type="button" onclick="deleteResource('/api/admin/people/${item.id}', loadPeople, 'person')"><i class="fa-solid fa-trash"></i></button>` : ""}
      <div class="person-top">
        <div class="person-avatar">${getInitials(item.name)}</div>
        <div>
          <h3 class="person-name">${item.name}</h3>
          <p class="person-role">${item.title}</p>
          <p class="person-dept">${item.department}</p>
        </div>
      </div>
      <div class="person-contact">
        <div><i class="fa-regular fa-envelope"></i><span>${item.email}</span></div>
        <div><i class="fa-solid fa-phone"></i><span>${item.phone}</span></div>
        <div><i class="fa-solid fa-location-dot"></i><span>${item.office}</span></div>
      </div>
    </article>
  `).join("") : `<p class="empty-state">No directory entries matched your search.</p>`;
}

async function loadLibrary() {
  const data = await api("/api/library");
  state.books = data.items;
  renderLibrary();
}

function renderLibrary() {
  const items = applySearch(state.books, (item) => `${item.title} ${item.author} ${item.isbn}`);
  document.getElementById("libraryGrid").innerHTML = items.length ? items.map((item) => `
    <article class="book-card">
      ${state.user?.role === "admin" ? `<button class="delete-btn" type="button" onclick="deleteResource('/api/admin/books/${item.id}', loadLibrary, 'book')"><i class="fa-solid fa-trash"></i></button>` : ""}
      <span class="library-badge">${item.available_quantity} left</span>
      <div class="book-cover"><i class="fa-solid fa-book-open"></i></div>
      <h3 class="book-title">${item.title}</h3>
      <p class="book-author">${item.author}</p>
      <button class="btn-primary" type="button" onclick="openBookBorrow('${escapeText(item.id)}', '${escapeText(item.title)}')">Borrow</button>
    </article>
  `).join("") : `<p class="empty-state">No books matched your search.</p>`;
}

async function loadStudentServices() {
  const data = await api("/api/student-services");
  state.services = data.items.filter((item) => ["hotel", "hostel"].includes(String(item.service_type).toLowerCase()));
  renderStudentServices();
}

function renderStudentServices() {
  const items = applySearch(state.services, (item) => `${item.name} ${item.service_type} ${item.description}`);
  document.getElementById("studentServiceGrid").innerHTML = items.length ? items.map((item) => `
    <article class="student-card">
      ${state.user?.role === "admin" ? `<button class="delete-btn" type="button" onclick="deleteResource('/api/admin/student-services/${item.id}', loadStudentServices, 'service')"><i class="fa-solid fa-trash"></i></button>` : ""}
      <div class="student-head">
        <div class="student-icon"><i class="fa-solid fa-bed"></i></div>
      </div>
      <div class="student-copy">
        <h3 class="student-name">${item.name}</h3>
        <p class="student-type">${item.service_type}</p>
        <p>${item.description || "Accommodation booking is available for this service."}</p>
      </div>
      <div class="student-metrics">
        <div class="student-metric"><strong>${item.available_quantity}</strong><span>Available</span></div>
        <div class="student-metric"><strong>${getServicePrice(item)}</strong><span>Price / Night</span></div>
      </div>
      <button class="btn-primary" type="button" onclick="openServiceBooking('${escapeText(item.id)}', '${escapeText(item.name)}')">Reserve Room</button>
    </article>
  `).join("") : `<p class="empty-state">No accommodation services matched your search.</p>`;
}

async function loadAdminRequests() {
  if (state.user?.role !== "admin") return;
  const data = await api("/api/admin/requests");
  renderApprovalQueue("facilityRequests", data.facilityRequests, "facility-bookings");
  renderApprovalQueue("equipmentRequests", data.equipmentRequests, "equipment-bookings");
  renderApprovalQueue("serviceRequests", data.serviceRequests, "service-bookings");
}

function renderApprovalQueue(targetId, rows, endpoint) {
  document.getElementById(targetId).innerHTML = rows.length ? rows.map((row) => `
    <article class="queue-item">
      <strong>${row.resource_name}${row.quantity ? ` (${row.quantity})` : ""}</strong>
      <span class="queue-meta">${row.user_name}</span>
      <span class="queue-meta">${row.start_date} to ${row.end_date}</span>
      <span class="queue-meta">${row.purpose || row.details || row.admin_note || "-"}</span>
      <span class="status-chip ${row.status}">${row.status}</span>
      ${row.status === "pending" ? `
        <div class="queue-actions">
          <button class="action-btn approve" type="button" onclick="reviewRequest('${endpoint}', '${escapeText(row.id)}', 'approved')">Approve</button>
          <button class="action-btn reject" type="button" onclick="reviewRequest('${endpoint}', '${escapeText(row.id)}', 'rejected')">Reject</button>
        </div>
      ` : ""}
    </article>
  `).join("") : `<p class="empty-state">No requests available.</p>`;
}

async function reviewRequest(endpoint, id, statusValue) {
  const note = window.prompt(`Optional note for ${statusValue}:`, "") || "";
  try {
    const data = await api(`/api/admin/${endpoint}/${id}`, {
      method: "POST",
      body: JSON.stringify({ status: statusValue, admin_note: note })
    });
    showToast(data.message);
    await Promise.all([loadDashboard(), loadFacilities(), loadEquipment(), loadStudentServices(), loadAdminRequests()]);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function submitAdminForm(event, path, onSuccess) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const data = await api(path, { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    showToast(data.message);
    await onSuccess();
    await loadDashboard();
  } catch (error) {
    showToast(error.message, true);
  }
}

function openModal({ title, fields, submitLabel, onSubmit }) {
  modalTitle.textContent = title;
  modalForm.innerHTML = `
    ${fields.map(renderModalField).join("")}
    <div class="modal-actions">
      <button class="btn-outline" type="button" id="cancelModalBtn">Cancel</button>
      <button class="modal-submit" type="submit">${submitLabel}</button>
    </div>
  `;

  modalForm.onsubmit = async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(modalForm).entries());
    await onSubmit(payload);
  };

  modalForm.querySelector("#cancelModalBtn").addEventListener("click", closeModal);
  actionModal.classList.remove("hidden");
}

function closeModal() {
  actionModal.classList.add("hidden");
  modalForm.innerHTML = "";
  modalForm.onsubmit = null;
}

function renderModalField(field) {
  if (field.type === "textarea") {
    return `<textarea name="${field.name}" placeholder="${field.placeholder}" ${field.required ? "required" : ""}>${field.value || ""}</textarea>`;
  }
  if (field.type === "hidden") {
    return `<input type="hidden" name="${field.name}" value="${field.value || ""}">`;
  }
  return `<div class="${field.group ? "modal-grid-item" : ""}"><input name="${field.name}" type="${field.type || "text"}" placeholder="${field.placeholder}" value="${field.value || ""}" ${field.required ? "required" : ""} ${field.min ? `min="${field.min}"` : ""}></div>`;
}

function openFacilityBooking(id, name) {
  openModal({
    title: `Book ${name}`,
    submitLabel: "Send Request",
    fields: [
      { name: "facility_id", type: "hidden", value: id },
      { name: "start_date", type: "date", required: true },
      { name: "end_date", type: "date", required: true },
      { name: "purpose", type: "textarea", placeholder: "Purpose of booking", required: true }
    ],
    onSubmit: async (payload) => {
      try {
        const data = await api("/api/facilities/bookings", { method: "POST", body: JSON.stringify(payload) });
        closeModal();
        showToast(data.message);
        await Promise.all([loadDashboard(), loadAdminRequests().catch(() => {})]);
      } catch (error) {
        showToast(error.message, true);
      }
    }
  });
}

function openEquipmentBooking(id, name) {
  openModal({
    title: `Borrow ${name}`,
    submitLabel: "Request Equipment",
    fields: [
      { name: "equipment_id", type: "hidden", value: id },
      { name: "quantity", type: "number", placeholder: "Quantity", value: "1", min: "1", required: true },
      { name: "start_date", type: "date", required: true },
      { name: "end_date", type: "date", required: true },
      { name: "purpose", type: "textarea", placeholder: "Purpose of request", required: true }
    ],
    onSubmit: async (payload) => {
      try {
        const data = await api("/api/equipment/bookings", { method: "POST", body: JSON.stringify(payload) });
        closeModal();
        showToast(data.message);
        await Promise.all([loadDashboard(), loadEquipment(), loadAdminRequests().catch(() => {})]);
      } catch (error) {
        showToast(error.message, true);
      }
    }
  });
}

function openBookBorrow(id, title) {
  openModal({
    title: `Borrow ${title}`,
    submitLabel: "Borrow Book",
    fields: [
      { name: "book_id", type: "hidden", value: id },
      { name: "quantity", type: "number", placeholder: "Copies", value: "1", min: "1", required: true },
      { name: "start_date", type: "date", required: true },
      { name: "end_date", type: "date", required: true }
    ],
    onSubmit: async (payload) => {
      try {
        const data = await api("/api/library/borrowings", { method: "POST", body: JSON.stringify(payload) });
        closeModal();
        showToast(data.message);
        await Promise.all([loadDashboard(), loadLibrary()]);
      } catch (error) {
        showToast(error.message, true);
      }
    }
  });
}

function openServiceBooking(id, name) {
  openModal({
    title: `Reserve ${name}`,
    submitLabel: "Reserve Room",
    fields: [
      { name: "service_item_id", type: "hidden", value: id },
      { name: "start_date", type: "date", required: true },
      { name: "end_date", type: "date", required: true },
      { name: "details", type: "textarea", placeholder: "Guest or accommodation details", required: true }
    ],
    onSubmit: async (payload) => {
      try {
        const data = await api("/api/student-services/bookings", { method: "POST", body: JSON.stringify(payload) });
        closeModal();
        showToast(data.message);
        await Promise.all([loadDashboard(), loadStudentServices(), loadAdminRequests().catch(() => {})]);
      } catch (error) {
        showToast(error.message, true);
      }
    }
  });
}

function applySearch(items, mapper) {
  if (!state.search) return items;
  return items.filter((item) => mapper(item).toLowerCase().includes(state.search));
}

function getInitials(value) {
  return String(value)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function getServicePrice(item) {
  const type = String(item.service_type).toLowerCase();
  if (type === "hotel") return "$800";
  if (type === "hostel") return "$150";
  return "$300";
}

async function deleteResource(path, reloadFn, label) {
  if (!window.confirm(`Do you want to remove this ${label}?`)) return;
  try {
    const data = await api(path, { method: "DELETE" });
    showToast(data.message);
    await reloadFn();
    await loadDashboard();
  } catch (error) {
    showToast(error.message, true);
  }
}

function formatRelativeDate(value) {
  const created = new Date(value);
  const diffHours = Math.max(1, Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60)));
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function escapeText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function setFacilityCategory(category) {
  state.facilityCategory = category || "";
  renderFacilityFilters(["All Spaces", ...new Set(state.facilities.map((item) => item.category))]);
  renderFacilities();
}

window.openFacilityBooking = openFacilityBooking;
window.openEquipmentBooking = openEquipmentBooking;
window.openBookBorrow = openBookBorrow;
window.openServiceBooking = openServiceBooking;
window.reviewRequest = reviewRequest;
window.setFacilityCategory = setFacilityCategory;
window.deleteResource = deleteResource;

if (state.token) {
  bootApp();
}
