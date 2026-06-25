/* ==========================================================================
   LEGAL-EXPENSE TRACKER - MAIN CONTROLLER (VANILLA JS)
   ========================================================================== */

// 1. VARIABLES GLOBALES Y ESTADO DE LA APLICACIÓN
let supabaseClient = null;
let currentExpenses = [];

// Credenciales de Supabase
// ==========================================
// IMPORTANTE: Sustituye estas credenciales por las de tu proyecto de Supabase
// para conectar la base de datos real y salir del modo demo.
const SUPABASE_URL = "https://nqwimdlgddszuqubdddp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd2ltZGxnZGRzenVxdWJkZGRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDE1MTYsImV4cCI6MjA5Nzk3NzUxNn0.py0opPk4tK4DK5UsZ1wMuss49ANbmeCRpDn_TGru62g";
// ==========================================

// Datos ficticios (Mock Data) para visualización inmediata en Fase 2 y modo Demo
const MOCK_EXPENSES = [
  {
    id: "gasto-1",
    fecha: new Date(new Date().getFullYear(), new Date().getMonth(), 12).toISOString(),
    categoria: "Honorarios",
    detalle_lugar: "Estudio de Abogados Valdez - Consulta penal inicial",
    responsable: "Lima",
    monto: 1500.00,
    url_foto: "https://picsum.photos/seed/receipt-valdez/600/800"
  },
  {
    id: "gasto-2",
    fecha: new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString(),
    categoria: "Notaría y Registros",
    detalle_lugar: "Notaría Paino - Legalización de firmas societarias",
    responsable: "Lima",
    monto: 380.00,
    url_foto: null
  },
  {
    id: "gasto-3",
    fecha: new Date(new Date().getFullYear(), new Date().getMonth(), 18).toISOString(),
    categoria: "Transporte y Viáticos",
    detalle_lugar: "Taxi Aeropuerto Lima-Piura - Traslado de socio",
    responsable: "Piura",
    monto: 120.00,
    url_foto: "https://picsum.photos/seed/receipt-taxi/600/800"
  },
  {
    id: "gasto-4",
    fecha: new Date(new Date().getFullYear(), new Date().getMonth(), 20).toISOString(),
    categoria: "Alimentación y Representación",
    detalle_lugar: "Restaurante El Marqués - Almuerzo con cliente corporativo",
    responsable: "Piura",
    monto: 245.50,
    url_foto: "https://picsum.photos/seed/receipt-food/600/800"
  },
  {
    id: "gasto-5",
    fecha: new Date(new Date().getFullYear(), new Date().getMonth(), 22).toISOString(),
    categoria: "Tasas y Tributos",
    detalle_lugar: "SUNARP - Búsqueda e inscripción de poderes",
    responsable: "Lima",
    monto: 450.00,
    url_foto: null
  },
  {
    id: "gasto-6",
    fecha: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 5).toISOString(), // Mes anterior
    categoria: "Servicios Públicos",
    detalle_lugar: "Luz del Sur - Recibo de oficina de enlace",
    responsable: "Lima",
    monto: 310.00,
    url_foto: "https://picsum.photos/seed/receipt-power/600/800"
  }
];

const CATEGORIAS_VALIDAS = [
  'Honorarios',
  'Tasas y Tributos',
  'Notaría y Registros',
  'Transporte y Viáticos',
  'Alimentación y Representación',
  'Suministros y Oficina',
  'Servicios Públicos',
  'Otros Gastos'
];

// 2. INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  setupNavigation();
  setupMobileMenu();
  setupModalEvents();
  setupFilterEvents();
  setupExportEvent();
  setupFormFileInput();
  setupFormSubmit();
  setupEditFormSubmit();

  // Conectar con Supabase
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      updateDbStatus(true);
      setupAuth();
    } catch (error) {
      console.error("Error al conectar con Supabase:", error);
      setupDemoMode();
    }
  } else {
    // Si no hay claves, forzar modo demo sin bloqueo de Login
    setupDemoMode();
  }

  // Registrar Service Worker para PWA
  registerServiceWorker();
}

// 3. CONFIGURACIÓN DE AUTENTICACIÓN (REAL SUPABASE)
function setupAuth() {
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const loginContainer = document.getElementById("login-container");

  // Escuchar cambios de sesión
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      // Ocultar login overlay
      loginContainer.classList.remove("active");

      // Actualizar perfil del usuario
      const email = session.user.email;
      document.getElementById("user-avatar-initials").textContent = email.substring(0, 2).toUpperCase();
      document.getElementById("user-display-email").textContent = email;

      // Cargar datos reales
      fetchRealExpenses();
    } else {
      // Mostrar login overlay
      loginContainer.classList.add("active");
    }
  });

  // Evento de submit del Login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;
      const btnSubmit = document.getElementById("btn-login-submit");

      loginError.style.display = "none";
      btnSubmit.disabled = true;
      btnSubmit.querySelector("span").textContent = "Verificando...";

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (error) throw error;
      } catch (err) {
        console.error("Fallo de autenticación:", err.message);
        let errMsg = err.message;
        if (errMsg === "Invalid login credentials") {
          errMsg = "Credenciales incorrectas (correo o contraseña inválidos).";
        } else if (errMsg === "Email not confirmed") {
          errMsg = "El correo no ha sido confirmado. Confírmalo o deshabilita 'Confirm email' en Supabase.";
        }
        loginError.textContent = errMsg || "Credenciales incorrectas o usuario no autorizado.";
        loginError.style.display = "block";
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.querySelector("span").textContent = "Iniciar Sesión";
      }
    });
  }

  // Evento Cierre de Sesión
  const btnLogout = document.getElementById("btn-sidebar-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
        await supabaseClient.auth.signOut();
      }
    });
  }
}

// Configuración de Modo Demo
function setupDemoMode() {
  updateDbStatus(false);

  // Ocultar Login para permitir navegación libre
  const loginContainer = document.getElementById("login-container");
  if (loginContainer) loginContainer.classList.remove("active");

  loadMockData();

  // Deshabilitar botón de logout e indicar demo
  const btnLogout = document.getElementById("btn-sidebar-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      alert("En Modo Demo no puedes cerrar sesión.");
    });
  }
}

// Actualiza el badge visual del estado de base de datos
function updateDbStatus(isConnected) {
  const badge = document.getElementById("db-status-badge");
  const text = badge.querySelector(".status-text");

  if (isConnected) {
    badge.className = "status-indicator online";
    text.textContent = "Supabase Conectado";
  } else {
    badge.className = "status-indicator offline";
    text.textContent = "Modo Demo (Offline)";
    document.getElementById("user-avatar-initials").textContent = "DM";
    document.getElementById("user-display-email").textContent = "demo@legaltracker.pe";
  }
}

// Carga de datos de prueba
function loadMockData() {
  currentExpenses = [...MOCK_EXPENSES];
  renderApp();
}

// 4. CONTROLADORES DE RUTA (Sidebar Navigation)
function setupNavigation() {
  const navDashboard = document.getElementById("nav-dashboard");
  const navExpenses = document.getElementById("nav-expenses");
  const navReports = document.getElementById("nav-reports");

  const secDashboard = document.getElementById("section-dashboard");
  const secExpenses = document.getElementById("section-expenses");
  const secReports = document.getElementById("section-reports");

  const pageTitle = document.getElementById("main-page-title");

  const switchSection = (activeNav, activeSec, title) => {
    // Quitar active de navs
    [navDashboard, navExpenses, navReports].forEach(nav => nav.classList.remove("active"));
    // Ocultar secciones
    [secDashboard, secExpenses, secReports].forEach(sec => sec.style.display = "none");

    // Activar seleccionado
    activeNav.classList.add("active");
    activeSec.style.display = "block";
    pageTitle.textContent = title;

    // Si es la sección de reportes, actualizar insights
    if (activeSec === secReports) {
      renderReportInsights();
    }
  };

  if (navDashboard) {
    navDashboard.addEventListener("click", (e) => {
      e.preventDefault();
      switchSection(navDashboard, secDashboard, "Dashboard");
    });
  }

  if (navExpenses) {
    navExpenses.addEventListener("click", (e) => {
      e.preventDefault();
      switchSection(navExpenses, secExpenses, "Gastos");
    });
  }

  if (navReports) {
    navReports.addEventListener("click", (e) => {
      e.preventDefault();
      switchSection(navReports, secReports, "Reportes");
    });
  }
}

// 5. RENDERIZACIÓN DE LA INTERFAZ
function renderApp(filteredResponsable = "todos") {
  const filtered = filteredResponsable === "todos"
    ? currentExpenses
    : currentExpenses.filter(e => e.responsable === filteredResponsable);

  renderTotals();
  renderTable(filtered);
}

// Cómputo de totales (Cards superiores)
function renderTotals() {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const currentMonthExpenses = currentExpenses.filter(expense => {
    const d = new Date(expense.fecha);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  let totalMes = 0;
  let totalLima = 0;
  let totalPiura = 0;

  let countMes = 0;
  let countLima = 0;
  let countPiura = 0;

  currentMonthExpenses.forEach(expense => {
    const monto = Number(expense.monto);
    totalMes += monto;
    countMes++;

    if (expense.responsable === "Lima") {
      totalLima += monto;
      countLima++;
    } else if (expense.responsable === "Piura") {
      totalPiura += monto;
      countPiura++;
    }
  });

  document.getElementById("stat-total-mes").textContent = formatCurrency(totalMes);
  document.getElementById("stat-subtext-mes").textContent = `${countMes} transacciones`;

  document.getElementById("stat-total-lima").textContent = formatCurrency(totalLima);
  document.getElementById("stat-subtext-lima").textContent = `${countLima} transacciones`;

  document.getElementById("stat-total-piura").textContent = formatCurrency(totalPiura);
  document.getElementById("stat-subtext-piura").textContent = `${countPiura} transacciones`;
}

// Pintar la tabla de gastos
function renderTable(expenses) {
  const tbody = document.getElementById("expenses-table-body");

  if (expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">
          <i class="ph ph-warning-circle" style="font-size: 1.5rem; display: block; margin-bottom: 8px;"></i>
          No se encontraron gastos registrados.
        </td>
      </tr>
    `;
    updateTableFooter(0, 0);
    return;
  }

  tbody.innerHTML = "";

  const sortedExpenses = [...expenses].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  sortedExpenses.forEach(expense => {
    const tr = document.createElement("tr");

    const catClass = getCategoryClass(expense.categoria);
    const hasPhoto = expense.url_foto && expense.url_foto.trim() !== "";
    const buttonHtml = hasPhoto
      ? `<button class="btn-constancia" data-id="${expense.id}">
           <i class="ph ph-image"></i> Ver Constancia
         </button>`
      : `<button class="btn-constancia no-image" disabled>
           <i class="ph ph-image-square"></i> Sin foto
         </button>`;

    tr.innerHTML = `
      <td>${formatDate(expense.fecha)}</td>
      <td><span class="category-badge ${catClass}">${expense.categoria}</span></td>
      <td>${expense.detalle_lugar}</td>
      <td>
        <span class="sede-badge sede-badge-${expense.responsable.toLowerCase()}">
          ${expense.responsable}
        </span>
      </td>
      <td class="expense-amount">${formatCurrency(expense.monto)}</td>
      <td>${buttonHtml}</td>
      <td>
        <div class="table-actions">
          <button class="btn-edit" data-id="${expense.id}" title="Editar gasto">
            <i class="ph ph-pencil-simple"></i>
          </button>
          <button class="btn-delete" data-id="${expense.id}" title="Eliminar gasto">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  document.querySelectorAll(".btn-constancia:not(.no-image)").forEach(button => {
    button.addEventListener("click", (e) => {
      const expenseId = e.currentTarget.getAttribute("data-id");
      openReceiptModal(expenseId);
    });
  });

  document.querySelectorAll(".btn-edit").forEach(button => {
    button.addEventListener("click", (e) => {
      const expenseId = e.currentTarget.getAttribute("data-id");
      openEditModal(expenseId);
    });
  });

  document.querySelectorAll(".btn-delete").forEach(button => {
    button.addEventListener("click", (e) => {
      const expenseId = e.currentTarget.getAttribute("data-id");
      deleteExpense(expenseId);
    });
  });

  updateTableFooter(expenses.length, currentExpenses.length);
}

function updateTableFooter(visible, total) {
  document.getElementById("visible-count").textContent = visible;
  document.getElementById("total-count").textContent = total;
}

// Pintar datos del panel de Reportes
function renderReportInsights() {
  const totalGeneral = currentExpenses.reduce((sum, e) => sum + Number(e.monto), 0);
  const countWithReceipt = currentExpenses.filter(e => e.url_foto && e.url_foto.trim() !== "").length;

  document.getElementById("report-total-general").textContent = formatCurrency(totalGeneral);
  document.getElementById("report-total-with-receipt").textContent = countWithReceipt;
}

// Helper para asignar clase CSS a las categorías
function getCategoryClass(categoria) {
  switch (categoria) {
    case 'Honorarios': return 'badge-honorarios';
    case 'Tasas y Tributos': return 'badge-tasas';
    case 'Notaría y Registros': return 'badge-notaria';
    case 'Transporte y Viáticos': return 'badge-transporte';
    case 'Alimentación y Representación': return 'badge-alimentacion';
    case 'Suministros y Oficina': return 'badge-suministros';
    case 'Servicios Públicos': return 'badge-servicios';
    case 'Otros Gastos': return 'badge-otros';
    default: return 'badge-otros';
  }
}

// 6. CONTROLADORES DE EVENTOS
function setupMobileMenu() {
  const menuBtn = document.getElementById("btn-mobile-menu");
  const sidebar = document.getElementById("app-sidebar");

  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      sidebar.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (sidebar.classList.contains("active") && !sidebar.contains(e.target) && e.target !== menuBtn) {
        sidebar.classList.remove("active");
      }
    });
  }
}

function setupModalEvents() {
  const modal = document.getElementById("receipt-modal");
  const closeBtn = document.getElementById("btn-close-modal");
  const backdrop = document.getElementById("modal-close-backdrop");

  const closeModal = () => {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (backdrop) backdrop.addEventListener("click", closeModal);

  // Configuración de modal de edición
  const editModal = document.getElementById("edit-expense-modal");
  const closeEditBtn = document.getElementById("btn-close-edit-modal");
  const closeEditCancel = document.getElementById("btn-cancel-edit");
  const editBackdrop = document.getElementById("edit-modal-close-backdrop");

  const closeEditModal = () => {
    editModal.classList.remove("active");
    editModal.setAttribute("aria-hidden", "true");
  };

  if (closeEditBtn) closeEditBtn.addEventListener("click", closeEditModal);
  if (closeEditCancel) closeEditCancel.addEventListener("click", closeEditModal);
  if (editBackdrop) editBackdrop.addEventListener("click", closeEditModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (modal.classList.contains("active")) closeModal();
      if (editModal.classList.contains("active")) closeEditModal();
    }
  });
}

function setupFilterEvents() {
  const filter = document.getElementById("filter-responsable");
  if (filter) {
    filter.addEventListener("change", (e) => {
      renderApp(e.target.value);
    });
  }
}

// Interacción del cargador de archivos del formulario
function setupFormFileInput() {
  const fileInput = document.getElementById("exp-foto");
  const uploadText = document.getElementById("file-upload-text");

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        uploadText.textContent = `Archivo seleccionado: ${e.target.files[0].name}`;
      } else {
        uploadText.textContent = "Arrastra o haz clic para subir una foto";
      }
    });
  }
}

// Enviar formulario manual a Supabase o Demo
function setupFormSubmit() {
  const form = document.getElementById("expense-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const categoria = document.getElementById("exp-categoria").value;
    const monto = parseFloat(document.getElementById("exp-monto").value);
    const fecha = document.getElementById("exp-fecha").value;
    const responsable = document.getElementById("exp-responsable").value;
    const detalle = document.getElementById("exp-detalle").value.trim();
    const fileFile = document.getElementById("exp-foto").files[0];
    const btnSubmit = document.getElementById("btn-save-expense");

    btnSubmit.disabled = true;
    btnSubmit.querySelector("span").textContent = "Guardando gasto...";

    try {
      let urlFoto = null;

      // A. SUBIR FOTO A STORAGE
      if (fileFile) {
        if (supabaseClient) {
          const fileExt = fileFile.name.split('.').pop();
          const fileName = `${Date.now()}_web_${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('fotos-gastos')
            .upload(fileName, fileFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;
          urlFoto = fileName; // Guarda ruta relativa en bucket privado
        } else {
          // Fallback demo local (URL temporal de objeto)
          urlFoto = URL.createObjectURL(fileFile);
        }
      }

      // B. REGISTRAR EN BASE DE DATOS
      const nuevoGasto = {
        fecha: new Date(fecha).toISOString(),
        categoria,
        detalle_lugar: detalle,
        responsable,
        monto,
        url_foto: urlFoto
      };

      if (supabaseClient) {
        const { error } = await supabaseClient
          .from('gastos')
          .insert([nuevoGasto]);

        if (error) throw error;

        // Recargar desde base de datos
        await fetchRealExpenses();
      } else {
        // Modo demo
        nuevoGasto.id = `demo-${Date.now()}`;
        currentExpenses.push(nuevoGasto);
        renderApp();
      }

      alert("🎉 Gasto registrado exitosamente.");
      form.reset();
      document.getElementById("file-upload-text").textContent = "Arrastra o haz clic para subir una foto";

      // Redirigir al Dashboard
      document.getElementById("nav-dashboard").click();

    } catch (err) {
      console.error("Error al guardar gasto:", err.message);
      alert(`Error al registrar gasto: ${err.message}`);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.querySelector("span").textContent = "Guardar Gasto en Supabase";
    }
  });
}

// Configurar submit de edición de gasto
function setupEditFormSubmit() {
  const form = document.getElementById("edit-expense-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const expenseId = document.getElementById("edit-exp-id").value;
    const categoria = document.getElementById("edit-exp-categoria").value;
    const monto = parseFloat(document.getElementById("edit-exp-monto").value);
    const fecha = document.getElementById("edit-exp-fecha").value;
    const responsable = document.getElementById("edit-exp-responsable").value;
    const detalle = document.getElementById("edit-exp-detalle").value.trim();
    
    const btnSubmit = document.querySelector("#edit-expense-modal .btn-save-edit");
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Guardando...";

    try {
      const gastoActualizado = {
        fecha: new Date(fecha).toISOString(),
        categoria,
        detalle_lugar: detalle,
        responsable,
        monto
      };

      if (supabaseClient) {
        const { error } = await supabaseClient
          .from('gastos')
          .update(gastoActualizado)
          .eq('id', expenseId);

        if (error) throw error;

        // Recargar datos
        await fetchRealExpenses();
      } else {
        // Modo demo
        const idx = currentExpenses.findIndex(e => e.id === expenseId);
        if (idx !== -1) {
          currentExpenses[idx] = { ...currentExpenses[idx], ...gastoActualizado };
          renderApp();
        }
      }

      alert("🎉 Gasto actualizado con éxito.");
      
      // Cerrar modal
      const editModal = document.getElementById("edit-expense-modal");
      editModal.classList.remove("active");
      editModal.setAttribute("aria-hidden", "true");

    } catch (err) {
      console.error("Error al actualizar gasto:", err.message);
      alert(`Error al actualizar gasto: ${err.message}`);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Guardar Cambios";
    }
  });
}

// Abrir modal de edición
function openEditModal(expenseId) {
  const expense = currentExpenses.find(e => e.id === expenseId);
  if (!expense) return;

  const modal = document.getElementById("edit-expense-modal");
  
  // Rellenar formulario
  document.getElementById("edit-exp-id").value = expense.id;
  document.getElementById("edit-exp-categoria").value = expense.categoria;
  document.getElementById("edit-exp-monto").value = expense.monto;
  
  // Formatear fecha para el input (YYYY-MM-DD)
  const d = new Date(expense.fecha);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  document.getElementById("edit-exp-fecha").value = `${year}-${month}-${day}`;
  
  document.getElementById("edit-exp-responsable").value = expense.responsable;
  document.getElementById("edit-exp-detalle").value = expense.detalle_lugar;

  // Mostrar modal
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

// Eliminar un gasto de Supabase y del Storage si tiene constancia
async function deleteExpense(expenseId) {
  const expense = currentExpenses.find(e => e.id === expenseId);
  if (!expense) return;

  const confirmacion = confirm(`¿Estás seguro de que deseas eliminar el gasto por S/ ${Number(expense.monto).toFixed(2)} (${expense.categoria})?`);
  if (!confirmacion) return;

  try {
    if (supabaseClient) {
      // A. Si tiene foto en Storage, eliminar el archivo
      if (expense.url_foto && expense.url_foto.trim() !== "" && !expense.url_foto.startsWith("http")) {
        const { error: storageError } = await supabaseClient.storage
          .from('fotos-gastos')
          .remove([expense.url_foto]);

        if (storageError) {
          console.warn("No se pudo eliminar el archivo del Storage (puede haber sido ya borrado):", storageError.message);
        }
      }

      // B. Eliminar registro en base de datos
      const { error: dbError } = await supabaseClient
        .from('gastos')
        .delete()
        .eq('id', expenseId);

      if (dbError) throw dbError;

      // Recargar datos
      await fetchRealExpenses();
    } else {
      // Modo demo
      currentExpenses = currentExpenses.filter(e => e.id !== expenseId);
      renderApp();
    }

    alert("🗑️ Gasto eliminado correctamente.");
  } catch (err) {
    console.error("Error al eliminar gasto:", err.message);
    alert(`Error al eliminar gasto: ${err.message}`);
  }
}

// Abrir el modal de imagen de recibo (Soporta URLs firmadas de Supabase Storage)
async function openReceiptModal(expenseId) {
  const expense = currentExpenses.find(e => e.id === expenseId);
  if (!expense) return;

  const modal = document.getElementById("receipt-modal");
  const modalImg = document.getElementById("modal-receipt-img");
  const noImgPlaceholder = document.getElementById("modal-no-image");

  // Poblado de textos
  document.getElementById("modal-summary-category").textContent = expense.categoria;
  document.getElementById("modal-summary-detail").textContent = expense.detalle_lugar;
  document.getElementById("modal-summary-amount").textContent = formatCurrency(expense.monto);
  document.getElementById("modal-summary-date").textContent = formatDate(expense.fecha);

  // Poblado de imagen
  if (expense.url_foto && expense.url_foto.trim() !== "") {
    let imageUrl = expense.url_foto;

    // Si no es un enlace absoluto (mock) y tenemos cliente de Supabase, generamos URL firmada
    if (!imageUrl.startsWith("http") && supabaseClient) {
      try {
        const { data, error } = await supabaseClient.storage
          .from('fotos-gastos')
          .createSignedUrl(imageUrl, 3600); // 1 hora de expiración para el modal

        if (error) throw error;
        imageUrl = data.signedUrl;
      } catch (err) {
        console.error("Error al obtener URL firmada para visor:", err.message);
        imageUrl = ""; // Fallback
      }
    }

    if (imageUrl) {
      modalImg.src = imageUrl;
      modalImg.style.display = "block";
      noImgPlaceholder.style.display = "none";
    } else {
      modalImg.src = "";
      modalImg.style.display = "none";
      noImgPlaceholder.style.display = "flex";
    }
  } else {
    modalImg.src = "";
    modalImg.style.display = "none";
    noImgPlaceholder.style.display = "flex";
  }

  // Activar modal
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

// 7. CONEXIÓN REAL CON SUPABASE
async function fetchRealExpenses() {
  if (!supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from('gastos')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) throw error;

    currentExpenses = data || [];
    renderApp();
  } catch (error) {
    console.error("Error al cargar gastos de Supabase:", error.message);
    loadMockData(); // Fallback a mock data
  }
}

// 8. UTILS (FORMATTERS)
function formatCurrency(amount) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(amount);
}

function formatDate(dateString) {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;

  return d.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// 9. SERVICE WORKER REGISTRATION (PWA)
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker registrado correctamente', reg.scope))
        .catch(err => console.warn('Fallo al registrar el Service Worker', err));
    });
  }
}

// 10. EXPORTACIÓN LEGAL A PDF (jsPDF & jsPDF-AutoTable)
function setupExportEvent() {
  const btnExport = document.getElementById("btn-export-pdf");
  const btnExportReports = document.getElementById("btn-export-pdf-reports");

  const handleExport = () => {
    exportToPDF();
  };

  if (btnExport) btnExport.addEventListener("click", handleExport);
  if (btnExportReports) btnExportReports.addEventListener("click", handleExport);
}

async function exportToPDF() {
  const filterVal = document.getElementById("filter-responsable").value;
  const dataToExport = filterVal === "todos"
    ? currentExpenses
    : currentExpenses.filter(e => e.responsable === filterVal);

  if (dataToExport.length === 0) {
    alert("No hay gastos registrados para exportar.");
    return;
  }

  const sortedData = [...dataToExport].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const colorPrimary = [15, 23, 42];    // Gris Oscuro (#0F172A)
  const colorSecondary = [71, 85, 105]; // Gris Slate (#475569)
  const colorAccent = [3, 105, 161];    // Azul Fintech (#0369A1)

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const drawHeader = (pageNum) => {
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(14, 20, pageWidth - 14, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colorSecondary);
    doc.text("LEGAL-EXPENSE TRACKER — REPORTE OFICIAL DE AUDITORÍA", 14, 15);
    doc.text(`Página ${pageNum}`, pageWidth - 25, 15);
  };

  const drawFooter = () => {
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(14, pageHeight - 20, pageWidth - 14, pageHeight - 20);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...colorSecondary);
    doc.text("Documento confidencial generado automáticamente por el sistema financiero LegalExpense.", 14, pageHeight - 15);
    doc.text(`Fecha de emisión: ${new Date().toLocaleString('es-PE')}`, pageWidth - 75, pageHeight - 15);
  };

  // PÁGINA 1: RESUMEN GENERAL
  drawHeader(1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...colorPrimary);
  doc.text("REPORTE DE AUDITORÍA FINANCIERA", 14, 35);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...colorSecondary);
  doc.text("Consolidado legal de gastos y constancias digitales de representación.", 14, 41);

  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, 48, pageWidth - 28, 28, 3, 3, "F");
  doc.rect(14, 48, pageWidth - 28, 28, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...colorPrimary);
  doc.text("DATOS DEL REPORTE:", 18, 54);

  doc.setFont("helvetica", "normal");
  doc.text(`Filtro Responsable:`, 18, 60);
  doc.text(`Total Transacciones:`, 18, 65);
  doc.text(`Generado Por:`, 18, 70);

  doc.setFont("helvetica", "bold");
  doc.text(filterVal === "todos" ? "Todos (Sedes Lima y Piura)" : `Sede ${filterVal}`, 55, 60);
  doc.text(`${sortedData.length} registros`, 55, 65);
  doc.text(supabaseClient && supabaseClient.auth.getUser() ? "Socio Autenticado" : "demo@legaltracker.pe (Modo Demo)", 55, 70);

  const totalGeneral = sortedData.reduce((sum, item) => sum + Number(item.monto), 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...colorSecondary);
  doc.text("MONTO TOTAL ACUMULADO:", pageWidth - 75, 56);
  doc.setFontSize(18);
  doc.setTextColor(...colorAccent);
  doc.text(formatCurrency(totalGeneral), pageWidth - 75, 64);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...colorPrimary);
  doc.text("1. Resumen Consolidado por Categoría Gasto", 14, 90);

  const totalesCategoria = {};
  CATEGORIAS_VALIDAS.forEach(cat => totalesCategoria[cat] = 0);
  sortedData.forEach(item => {
    if (totalesCategoria[item.categoria] !== undefined) {
      totalesCategoria[item.categoria] += Number(item.monto);
    } else {
      totalesCategoria['Otros Gastos'] += Number(item.monto);
    }
  });

  const resumenFilas = Object.keys(totalesCategoria)
    .filter(cat => totalesCategoria[cat] > 0)
    .map(cat => {
      const monto = totalesCategoria[cat];
      const porcentaje = ((monto / totalGeneral) * 100).toFixed(1) + "%";
      return [cat, formatCurrency(monto), porcentaje];
    });

  doc.autoTable({
    startY: 95,
    head: [['Categoría Gasto', 'Monto Total Consolidado', 'Porcentaje']],
    body: resumenFilas,
    theme: 'grid',
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    columnStyles: {
      0: { fontStyle: 'bold', fontSize: 9 },
      1: { halign: 'right', fontSize: 9 },
      2: { halign: 'center', fontSize: 9 }
    },
    margin: { left: 14, right: 14 }
  });

  drawFooter();

  // PÁGINA 2: DETALLE GENERAL
  doc.addPage();
  drawHeader(2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...colorPrimary);
  doc.text("2. Desglose Detallado de Gastos Registrados", 14, 30);

  const detalleFilas = sortedData.map(item => [
    formatDate(item.fecha),
    item.categoria,
    item.detalle_lugar,
    item.responsable,
    formatCurrency(item.monto)
  ]);

  doc.autoTable({
    startY: 35,
    head: [['Fecha', 'Categoría', 'Detalle / Lugar', 'Sede', 'Monto']],
    body: detalleFilas,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 25, fontSize: 8 },
      1: { cellWidth: 35, fontSize: 8 },
      2: { fontSize: 8 },
      3: { cellWidth: 20, halign: 'center', fontSize: 8 },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold', fontSize: 8 }
    },
    margin: { left: 14, right: 14 }
  });

  // ANEXO DE CONSTANCIAS
  const gastosConFoto = sortedData.filter(item => item.url_foto && item.url_foto.trim() !== "");
  let currentY = doc.lastAutoTable.finalY + 15;

  if (currentY > pageHeight - 45) {
    doc.addPage();
    drawHeader(doc.internal.getNumberOfPages());
    currentY = 30;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...colorPrimary);
  doc.text("3. Anexo: Constancias Digitales e Imágenes de Respaldo", 14, currentY);
  currentY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colorSecondary);

  if (gastosConFoto.length === 0) {
    doc.text("No se registraron imágenes de constancia digital para los gastos en este reporte.", 14, currentY);
  } else {
    doc.text("Enlaces directos a los comprobantes digitales almacenados en Supabase Storage:", 14, currentY);
    currentY += 10;

    const resolvedGastosConFoto = [];
    for (const item of gastosConFoto) {
      let resolvedUrl = item.url_foto;
      if (!resolvedUrl.startsWith("http") && supabaseClient) {
        try {
          const { data, error } = await supabaseClient.storage
            .from('fotos-gastos')
            .createSignedUrl(resolvedUrl, 31536000); // 1 año de duración
          if (!error) {
            resolvedUrl = data.signedUrl;
          }
        } catch (err) {
          console.error("Error al obtener URL firmada para PDF:", err.message);
        }
      }
      resolvedGastosConFoto.push({
        ...item,
        url_foto_firmada: resolvedUrl
      });
    }

    resolvedGastosConFoto.forEach((item, index) => {
      if (currentY > pageHeight - 25) {
        doc.addPage();
        drawHeader(doc.internal.getNumberOfPages());
        currentY = 30;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...colorPrimary);
      doc.text(`Comprobante #${index + 1}: ${item.categoria} (${formatCurrency(item.monto)}) - Sede ${item.responsable}`, 14, currentY);
      currentY += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...colorSecondary);
      doc.text(`Detalle: ${item.detalle_lugar} | Fecha: ${formatDate(item.fecha)}`, 14, currentY);
      currentY += 4.5;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...colorAccent);

      const linkText = "Abrir Recibo Digital (Supabase Storage Link)";
      doc.text(linkText, 14, currentY, {
        link: { url: item.url_foto_firmada }
      });

      const textWidth = doc.getTextWidth(linkText);
      doc.setDrawColor(...colorAccent);
      doc.setLineWidth(0.2);
      doc.line(14, currentY + 0.5, 14 + textWidth, currentY + 0.5);

      currentY += 10;
    });
  }

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter();
  }

  const fechaStr = new Date().toISOString().split('T')[0];
  doc.save(`Reporte_Gastos_Legal_${fechaStr}.pdf`);
}
