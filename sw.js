const CACHE_NAME = "legal-expense-tracker-v2";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./index.css",
  "./app.js",
  "./manifest.json",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap",
  "https://unpkg.com/@phosphor-icons/web@2.1.1",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];

// Instalar el Service Worker y almacenar en caché la estructura base
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Almacenando caché de la estructura base");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activar y limpiar cachés antiguas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheKeys) => {
      return Promise.all(
        cacheKeys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Eliminando caché antigua", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia Network-First con fallback en Cache
// Para el tracker de gastos, primero intentamos obtener datos actualizados de la red,
// y si el usuario está sin conexión, cargamos el esqueleto y archivos en caché.
self.addEventListener("fetch", (event) => {
  // Evitar interceptar solicitudes a Supabase API con caché persistente (queremos datos reales siempre que haya red)
  if (event.request.url.includes("supabase.co")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, clonarla y guardarla en la caché
        if (response.status === 200 && event.request.method === "GET") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, buscar en la caché
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si no está en caché y falla la red (por ejemplo, para imágenes no cacheadas)
          return new Response("Sin conexión a Internet", {
            status: 503,
            statusText: "Service Unavailable"
          });
        });
      })
  );
});
