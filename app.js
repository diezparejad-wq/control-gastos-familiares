/* ==========================================================================
   LEGAL-EXPENSE TRACKER - MAIN CONTROLLER (VANILLA JS)
   ========================================================================== */

// 1. VARIABLES GLOBALES Y ESTADO DE LA APLICACIÓN
let supabaseClient = null;
let currentExpenses = [];

// Credenciales de Supabase (se configurarán en la Fase 3)
const SUPABASE_URL = ""; 
const SUPABASE_ANON_KEY = "";

// Datos ficticios (Mock Data) para visualización inmediata en Fase 2
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

// 2. INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  setupMobileMenu();
  setupModalEvents();
  setupFilterEvents();
  setupExportEvent();
  
  // Inicializar Supabase si las credenciales están provistas
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      updateDbStatus(true);
      fetchRealExpenses();
    } catch (error) {
      console.error("Error al conectar con Supabase:", error);
      updateDbStatus(false);
      loadMockData();
    }
  } else {
    // Si no hay credenciales, cargamos los datos ficticios inmediatamente
    updateDbStatus(false);
    loadMockData();
  }

  // Registrar Service Worker para PWA
  registerServiceWorker();
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
    // Actualizar initials del usuario demo en el sidebar
    document.getElementById("user-avatar-initials").textContent = "DM";
    document.getElementById("user-display-email").textContent = "demo@legaltracker.pe";
  }
}

// Carga de datos de prueba
function loadMockData() {
  currentExpenses = [...MOCK_EXPENSES];
  renderApp();
}

// 3. RENDERIZACIÓN DE LA INTERFAZ
function renderApp(filteredResponsable = "todos") {
  const filtered = filteredResponsable === "todos" 
    ? currentExpenses 
    : currentExpenses.filter(e => e.responsable === filteredResponsable);

  renderTotals();
  renderTable(filtered);
}

// Cómputo e impresión de totales (Cards superiores en colores pastel)
function renderTotals() {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Filtrar los gastos que pertenecen al mes actual
  const currentMonthExpenses = currentExpenses.filter(expense => {
    const d = new Date(expense.fecha);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  // Sumas por sede y total
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

  // Actualizar DOM
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
        <td colspan="6" class="table-empty">
          <i class="ph ph-warning-circle" style="font-size: 1.5rem; display: block; margin-bottom: 8px;"></i>
          No se encontraron gastos registrados.
        </td>
      </tr>
    `;
    updateTableFooter(0, 0);
    return;
  }

  tbody.innerHTML = "";

  // Ordenar gastos por fecha descendente
  const sortedExpenses = [...expenses].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  sortedExpenses.forEach(expense => {
    const tr = document.createElement("tr");
    
    // Formato de Categoría
    const catClass = getCategoryClass(expense.categoria);
    
    // Configuración del botón de constancia
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
    `;
    
    tbody.appendChild(tr);
  });

  // Asignar eventos de clic a los botones de constancia recién creados
  document.querySelectorAll(".btn-constancia:not(.no-image)").forEach(button => {
    button.addEventListener("click", (e) => {
      const expenseId = e.currentTarget.getAttribute("data-id");
      openReceiptModal(expenseId);
    });
  });

  updateTableFooter(expenses.length, currentExpenses.length);
}

function updateTableFooter(visible, total) {
  document.getElementById("visible-count").textContent = visible;
  document.getElementById("total-count").textContent = total;
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

// 4. CONTROLADORES DE EVENTOS
function setupMobileMenu() {
  const menuBtn = document.getElementById("btn-mobile-menu");
  const sidebar = document.getElementById("app-sidebar");
  
  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      sidebar.classList.toggle("active");
    });
    
    // Cerrar sidebar al hacer clic fuera
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

  // Cerrar con Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      closeModal();
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

// 5. CONEXIÓN REAL CON SUPABASE (FUTURO)
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
    loadMockData(); // Fallback a mock data si hay fallos en base de datos
  }
}

// 6. UTILS (FORMATTERS)
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

// 7. SERVICE WORKER REGISTRATION (PWA)
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker registrado correctamente', reg.scope))
        .catch(err => console.warn('Fallo al registrar el Service Worker', err));
    });
  }
}

// 8. EXPORTACIÓN LEGAL A PDF (jsPDF & jsPDF-AutoTable)
function setupExportEvent() {
  const btnExport = document.getElementById("btn-export-pdf");
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      exportToPDF();
    });
  }
}

async function exportToPDF() {
  // A. Obtener datos filtrados visibles en pantalla
  const filterVal = document.getElementById("filter-responsable").value;
  const dataToExport = filterVal === "todos" 
    ? currentExpenses 
    : currentExpenses.filter(e => e.responsable === filterVal);

  if (dataToExport.length === 0) {
    alert("No hay gastos registrados para exportar.");
    return;
  }

  // Ordenar cronológicamente ascendente para el reporte formal
  const sortedData = [...dataToExport].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // B. CONFIGURACIONES GENERALES DEL PDF (Fuentes y Colores)
  const colorPrimary = [15, 23, 42];    // Gris Oscuro (#0F172A)
  const colorSecondary = [71, 85, 105]; // Gris Slate (#475569)
  const colorAccent = [3, 105, 161];    // Azul Fintech (#0369A1)
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Helper para dibujar la cabecera en cada página
  const drawHeader = (pageNum) => {
    // Línea divisoria superior
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(14, 20, pageWidth - 14, 20);

    // Texto de cabecera formal
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colorSecondary);
    doc.text("LEGAL-EXPENSE TRACKER — REPORTE OFICIAL DE AUDITORÍA", 14, 15);
    doc.text(`Página ${pageNum}`, pageWidth - 25, 15);
  };

  // Helper para dibujar el pie de página en cada página
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

  // ==========================================
  // PÁGINA 1: RESUMEN GENERAL & AUDITORÍA POR CATEGORÍA
  // ==========================================
  drawHeader(1);

  // Título Principal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...colorPrimary);
  doc.text("REPORTE DE AUDITORÍA FINANCIERA", 14, 35);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...colorSecondary);
  doc.text("Consolidado legal de gastos y constancias digitales de representación.", 14, 41);

  // Recuadro de Metadatos del Reporte
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, 48, pageWidth - 28, 28, 3, 3, "F");
  doc.rect(14, 48, pageWidth - 28, 28, "S"); // Borde sutil

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
  doc.text("demo@legaltracker.pe (Usuario Autenticado)", 55, 70);

  // Monto acumulado destacado
  const totalGeneral = sortedData.reduce((sum, item) => sum + Number(item.monto), 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...colorSecondary);
  doc.text("MONTO TOTAL ACUMULADO:", pageWidth - 75, 56);
  doc.setFontSize(18);
  doc.setTextColor(...colorAccent);
  doc.text(formatCurrency(totalGeneral), pageWidth - 75, 64);

  // Sección 1: Sumarización por Categorías Legales
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...colorPrimary);
  doc.text("1. Resumen Consolidado por Categoría Gasto", 14, 90);

  // Cómputo de totales agrupados por categoría
  const totalesCategoria = {};
  CATEGORIAS_VALIDAS.forEach(cat => totalesCategoria[cat] = 0);
  sortedData.forEach(item => {
    if (totalesCategoria[item.categoria] !== undefined) {
      totalesCategoria[item.categoria] += Number(item.monto);
    } else {
      totalesCategoria['Otros Gastos'] += Number(item.monto);
    }
  });

  // Filtrar categorías que tienen monto mayor a cero para la tabla resumen
  const resumenFilas = Object.keys(totalesCategoria)
    .filter(cat => totalesCategoria[cat] > 0)
    .map(cat => {
      const monto = totalesCategoria[cat];
      const porcentaje = ((monto / totalGeneral) * 100).toFixed(1) + "%";
      return [cat, formatCurrency(monto), porcentaje];
    });

  // Tabla Resumen Categorías
  doc.autoTable({
    startY: 95,
    head: [['Categoría Legal de Gasto', 'Monto Total Consolidado', 'Porcentaje']],
    body: resumenFilas,
    theme: 'grid',
    headStyles: {
      fillColor: [71, 85, 105], // Gris slate
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

  // ==========================================
  // PÁGINA 2: DETALLE GENERAL DE LAS TRANSACCIONES
  // ==========================================
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
      fillColor: [15, 23, 42], // Gris oscuro Fintech
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

  // ==========================================
  // SECCIÓN: ANEXO DE CONSTANCIAS DIGITALES
  // ==========================================
  // Obtener gastos que cuentan con archivo de foto
  const gastosConFoto = sortedData.filter(item => item.url_foto && item.url_foto.trim() !== "");
  
  let currentY = doc.lastAutoTable.finalY + 15;

  // Si queda muy poco espacio en la página, agregamos otra página
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
    doc.text("A continuación se listan los enlaces directos a los comprobantes digitales almacenados en Supabase Storage:", 14, currentY);
    currentY += 10;

    // Resolver las URLs firmadas de larga duración de forma secuencial y asíncrona
    const resolvedGastosConFoto = [];
    for (const item of gastosConFoto) {
      let resolvedUrl = item.url_foto;
      if (!resolvedUrl.startsWith("http") && supabaseClient) {
        try {
          const { data, error } = await supabaseClient.storage
            .from('fotos-gastos')
            .createSignedUrl(resolvedUrl, 31536000); // URL firmada con validez de 1 año (31,536,000 segundos)
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
      // Si nos pasamos del límite inferior de la página
      if (currentY > pageHeight - 25) {
        doc.addPage();
        drawHeader(doc.internal.getNumberOfPages());
        currentY = 30;
      }

      // Información básica del gasto
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

      // Enlace cliqueable
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...colorAccent);
      
      const linkText = "Abrir Recibo Digital (Supabase Storage Link)";
      doc.text(linkText, 14, currentY, {
        link: { url: item.url_foto_firmada }
      });

      // Dibujar línea debajo del link para denotar que es un hipervínculo
      const textWidth = doc.getTextWidth(linkText);
      doc.setDrawColor(...colorAccent);
      doc.setLineWidth(0.2);
      doc.line(14, currentY + 0.5, 14 + textWidth, currentY + 0.5);

      currentY += 10; // Espaciado entre comprobantes
    });
  }

  // Imprimir pie de página en todas las páginas creadas
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter();
  }

  // D. Descargar el archivo
  const fechaStr = new Date().toISOString().split('T')[0];
  doc.save(`Reporte_Gastos_Legal_${fechaStr}.pdf`);
}

