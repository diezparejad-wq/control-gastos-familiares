/* ==========================================================================
   LEGAL-EXPENSE TRACKER - TELEGRAM BOT SERVICE (NODE.JS)
   ========================================================================== */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

// 1. VALIDAR CONFIGURACIÓN
const {
  TELEGRAM_BOT_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TELEGRAM_ALLOWED_USERS,
  TELEGRAM_USER_LIMA,
  TELEGRAM_USER_PIURA
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ ERROR: Falta configurar variables críticas en el archivo .env");
  console.error("Asegúrate de copiar .env.example a .env y llenar los campos.");
  process.exit(1);
}

// 2. INICIALIZAR CLIENTES
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

console.log("🚀 Bot de Telegram iniciado correctamente y escuchando...");

// Parser de lista de usuarios autorizados (se eliminan espacios y comillas accidentales)
const allowedUsers = TELEGRAM_ALLOWED_USERS 
  ? TELEGRAM_ALLOWED_USERS.split(',').map(id => id.trim().replace(/['"]/g, '')) 
  : [];

// Mapeo estricto del Enum de la Base de Datos
const CATEGORIAS_VALIDAS = [
  'Honorarios',
  'Tasas y Tributos',
  'Notaría y Registros',
  'Transporte y Viáticos',
  'Alimentación y Representación',
  'Suministros y Oficina',
  'Servicios Públicos',
  'Alquiler',
  'Mantenimiento',
  'Otros Gastos'
];

// 3. CONTROLADOR DE MENSAJES
bot.on('message', async (msg) => {
  const chatId = msg.chat.id.toString(); // Destinatario (puede ser chat personal o ID de grupo)
  const userId = msg.from ? msg.from.id.toString() : ''; // Remitente real
  const username = msg.from ? (msg.from.username || "sin_usuario") : "sin_usuario";
  const firstName = msg.from ? (msg.from.first_name || "Socio") : "Socio";
  const chatType = msg.chat.type; // 'private', 'group', or 'supergroup'

  // Mostrar información en consola para ayudar a conocer los IDs
  console.log(`📩 Mensaje recibido en Chat ID: ${chatId} (${chatType}) | De User ID: ${userId} | Usuario: @${username}`);

  // Ignorar mensajes del propio bot o mensajes sin remitente (por seguridad)
  if (!userId) return;

  // Seguridad: Validar si el remitente está en la lista blanca
  if (allowedUsers.length > 0 && !allowedUsers.includes(userId)) {
    console.warn(`🔒 Acceso denegado a User ID: ${userId} en Chat ID: ${chatId}`);
    return bot.sendMessage(
      chatId, 
      `⛔ *Acceso Denegado*\nNo estás autorizado para registrar gastos en este bot.\n\n🔑 *Tu Telegram User ID es:* \`${userId}\`\nPídele al administrador que lo agregue a la variable \`TELEGRAM_ALLOWED_USERS\` en el archivo \`.env\`.`,
      { parse_mode: 'Markdown' }
    );
  }

  // Comando /start para bienvenida e información (soporta /start y /start@bot_username)
  if (msg.text && msg.text.startsWith('/start')) {
    return bot.sendMessage(
      chatId,
      `👋 ¡Hola, *${firstName}*! Bienvenido al *Legal-Expense Bot*\n\n` +
      `Conmigo puedes registrar tus gastos enviándome una foto del recibo/constancia y escribiendo en el *pie de foto* (caption) los detalles en este formato:\n\n` +
      `\`Categoría, Monto, Fecha, Detalle\`\n\n` +
      `💡 *Ejemplo:*\n` +
      `\`Alimentación, 150.50, 2026-06-25, Almuerzo de trabajo con Notario\`\n\n` +
      `🔍 *Categorías válidas:*\n` +
      CATEGORIAS_VALIDAS.map(c => `• _${c}_`).join('\n') + `\n\n` +
      `Sede asignada a tu cuenta: *${detectSede(userId)}*`,
      { parse_mode: 'Markdown' }
    );
  }

  // Validar si el mensaje es una foto
  if (msg.photo) {
    await procesarGastoConFoto(msg, chatId, username);
  } else if (chatType === 'private' && msg.text && !msg.text.startsWith('/')) {
    // Si mandó solo texto sin foto en chat privado, le recordamos el formato
    bot.sendMessage(
      chatId,
      `⚠️ *Para registrar un gasto debes enviar la foto del recibo/constancia.*\n\n` +
      `Asegúrate de adjuntar la imagen y en el cuadro de texto de abajo (*pie de foto*) escribir los detalles separados por comas:\n` +
      `\`Categoría, Monto, Fecha, Detalle\``,
      { parse_mode: 'Markdown' }
    );
  }
  // En grupos o supergrupos ignoramos los textos planos para no spamear la conversación grupal
});

// 4. LÓGICA DE PROCESAMIENTO DE GASTO
async function procesarGastoConFoto(msg, chatId, username) {
  const caption = msg.caption;

  if (!caption) {
    return bot.sendMessage(
      chatId,
      `⚠️ *Falta el pie de foto (caption)*\n\n` +
      `Debes enviar la foto del recibo y escribir los detalles en el cuadro de texto del mensaje con este formato:\n` +
      `\`Categoría, Monto, Fecha, Detalle\`\n\n` +
      `*Ejemplo:* \`Alimentación, 85.00, 2026-06-25, Cena de negocios\``,
      { parse_mode: 'Markdown' }
    );
  }

  // Enviar mensaje de estado para calmar al usuario
  const statusMsg = await bot.sendMessage(chatId, `⏳ Procesando recibo y guardando en Supabase...`);

  try {
    // A. Parsear caption (esperado: Categoria, Monto, Fecha, Detalle)
    const parts = caption.split(',').map(p => p.trim());
    
    if (parts.length < 4) {
      throw new Error(
        `El pie de foto no tiene el formato correcto de 4 partes.\n` +
        `Formato: \`Categoría, Monto, Fecha, Detalle\`\n` +
        `Tu mensaje: \`${caption}\``
      );
    }

    const rawCategoria = parts[0];
    const rawMonto = parts[1];
    const rawFecha = parts[2];
    const detalleLugar = parts.slice(3).join(', '); // Manejar comas en el detalle

    // B. Validar y normalizar categoría
    const categoria = normalizarCategoria(rawCategoria);

    // C. Validar monto
    const monto = parseFloat(rawMonto);
    if (isNaN(monto) || monto <= 0) {
      throw new Error(`El monto \`${rawMonto}\` no es válido. Debe ser un número mayor a 0.`);
    }

    // D. Validar y formatear fecha
    const fecha = normalizarFecha(rawFecha);

    // E. Determinar sede (Lima o Piura)
    const userId = msg.from.id.toString();
    const responsable = detectSede(userId);

    // F. Descargar la foto de los servidores de Telegram
    // La foto de mayor resolución está al final del array msg.photo
    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;
    
    const fileLink = await bot.getFileLink(fileId);
    
    // Descarga el archivo usando fetch de Node.js
    const imgResponse = await fetch(fileLink);
    if (!imgResponse.ok) throw new Error("Fallo al descargar la imagen de los servidores de Telegram.");
    
    const arrayBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // G. Subir foto a Supabase Storage
    const fileExt = "jpg"; // Telegram convierte fotos a JPG por defecto
    const uniqueFileName = `${Date.now()}_${username}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('fotos-gastos')
      .upload(uniqueFileName, buffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error("Error al subir a storage:", uploadError);
      throw new Error(`Error al subir la constancia a Supabase Storage: ${uploadError.message}`);
    }

    // H. Guardar únicamente el nombre del archivo (ruta relativa en el bucket privado)
    const urlFoto = uniqueFileName;

    // I. Insertar registro en la base de datos
    const { data: insertData, error: dbError } = await supabase
      .from('gastos')
      .insert([
        {
          fecha: fecha, // YYYY-MM-DD string — sin zona horaria, evita desfase UTC
          categoria,
          detalle_lugar: detalleLugar,
          responsable,
          monto,
          url_foto: urlFoto // Se guarda la ruta relativa del storage
        }
      ])
      .select();

    if (dbError) {
      console.error("Error en la Base de Datos:", dbError);
      throw new Error(`Error al guardar en la base de datos: ${dbError.message}`);
    }

    // J. Responder al usuario con la confirmación de éxito
    bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
    
    // Formatear la fecha YYYY-MM-DD para mostrar bonito en el mensaje
    const [anio, mes, dia] = fecha.split('-');
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const fechaBonita = `${dia} ${meses[parseInt(mes, 10) - 1]} ${anio}`;

    bot.sendMessage(
      chatId,
      `✅ *¡Gasto registrado con éxito!*\n\n` +
      `📂 *Categoría:* ${categoria}\n` +
      `💰 *Monto:* S/ ${monto.toFixed(2)}\n` +
      `📅 *Fecha:* ${fechaBonita}\n` +
      `📍 *Detalle/Lugar:* ${detalleLugar}\n` +
      `👤 *Responsable:* Sede ${responsable}\n` +
      `📸 *Constancia:* Subida correctamente`,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    console.error("❌ Error al procesar el gasto:", error.message);
    bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
    
    bot.sendMessage(
      chatId,
      `❌ *Error al registrar gasto*\n\n` +
      `⚠️ *Detalle:* ${error.message}\n\n` +
      `Por favor, inténtalo de nuevo corrigiendo el formato.`,
      { parse_mode: 'Markdown' }
    );
  }
}

// 5. METODOS HELPERS (NORMALIZACIÓN Y DETECCIÓN)

// Detecta si es Lima o Piura según el ID de chat
function detectSede(chatId) {
  const cleanLima = TELEGRAM_USER_LIMA ? TELEGRAM_USER_LIMA.replace(/['"]/g, '').trim() : '';
  const cleanPiura = TELEGRAM_USER_PIURA ? TELEGRAM_USER_PIURA.replace(/['"]/g, '').trim() : '';
  if (chatId === cleanLima) return 'Lima';
  if (chatId === cleanPiura) return 'Piura';
  return 'Lima'; // Valor por defecto si es otro usuario autorizado
}

// Normaliza las categorías ingresadas por texto al enum exacto de base de datos
function normalizarCategoria(input) {
  const raw = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Quitar acentos

  if (raw.includes("honorario") || raw.includes("abogado") || raw.includes("pago")) return 'Honorarios';
  
  if (raw.includes("tasa") || raw.includes("tributo") || raw.includes("impuesto") || raw.includes("sunat")) {
    return 'Tasas y Tributos';
  }
  
  if (raw.includes("notaria") || raw.includes("registro") || raw.includes("sunarp") || raw.includes("firma")) {
    return 'Notaría y Registros';
  }
  
  if (raw.includes("transporte") || raw.includes("viatico") || raw.includes("taxi") || raw.includes("pasaje") || raw.includes("aeropuerto")) {
    return 'Transporte y Viáticos';
  }
  
  if (raw.includes("alimentacion") || raw.includes("representacion") || raw.includes("almuerzo") || raw.includes("cena") || raw.includes("comida")) {
    return 'Alimentación y Representación';
  }
  
  if (raw.includes("suministro") || raw.includes("oficina") || raw.includes("papeleria") || raw.includes("utiles")) {
    return 'Suministros y Oficina';
  }
  
  if (raw.includes("servicio") || raw.includes("luz") || raw.includes("agua") || raw.includes("internet") || raw.includes("software")) {
    return 'Servicios Públicos';
  }

  if (raw.includes("alquiler") || raw.includes("arriendo") || raw.includes("renta") || raw.includes("local")) {
    return 'Alquiler';
  }

  if (raw.includes("mantenimiento") || raw.includes("reparacion") || raw.includes("limpieza") || raw.includes("arreglo")) {
    return 'Mantenimiento';
  }

  // Comprobar si el usuario escribió la categoría muy parecida
  const found = CATEGORIAS_VALIDAS.find(c => c.toLowerCase() === input.toLowerCase());
  if (found) return found;

  return 'Otros Gastos'; // Fallback por defecto
}

// Normaliza la fecha y retorna string YYYY-MM-DD (sin hora, sin zona horaria)
// Usa la zona horaria de Lima para "hoy" y "ayer" aunque el servidor esté en UTC
function normalizarFecha(input) {
  const trimmed = input.trim().toLowerCase();

  if (trimmed === 'hoy') {
    // Obtener la fecha actual en zona horaria de Lima
    const limaDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }); // en-CA retorna YYYY-MM-DD
    return limaDate;
  }

  if (trimmed === 'ayer') {
    const ahora = new Date();
    ahora.setDate(ahora.getDate() - 1);
    const limaDate = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    return limaDate;
  }

  // Intentar parsear formato YYYY-MM-DD (ya es el formato deseado)
  const regexISO = /^(\d{4})-(\d{2})-(\d{2})$/;
  const matchISO = input.trim().match(regexISO);
  if (matchISO) {
    const y = parseInt(matchISO[1], 10);
    const m = parseInt(matchISO[2], 10);
    const d = parseInt(matchISO[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return input.trim(); // Devolver el string tal cual
    }
  }

  // Intentar parsear formato DD/MM/YYYY o DD-MM-YYYY
  const regexDate = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
  const match = input.trim().match(regexDate);
  if (match) {
    const day = String(parseInt(match[1], 10)).padStart(2, '0');
    const month = String(parseInt(match[2], 10)).padStart(2, '0');
    const year = match[3];
    if (parseInt(month, 10) >= 1 && parseInt(month, 10) <= 12 && parseInt(day, 10) >= 1 && parseInt(day, 10) <= 31) {
      return `${year}-${month}-${day}`; // Convertir a YYYY-MM-DD
    }
  }

  // Si falla el parseo, lanzar error para no guardar fechas erróneas
  throw new Error(`El formato de fecha \`${input}\` no es válido. Usa AAAA-MM-DD o DD/MM/AAAA.`);
}

// 6. MINI SERVIDOR DE HEALTH CHECK (Para compatibilidad con el plan gratuito de Render)
const http = require('http');
const PORT = process.env.PORT || 0;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Legal-Expense Telegram Bot status: ACTIVE\n');
}).listen(PORT, () => {
  console.log(`📡 Servidor de Health Check escuchando en el puerto ${PORT}`);
});
