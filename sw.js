// sw.js — Service Worker da Apolo Barbearia
const CACHE_NAME = 'apolo-barbearia-v5';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/admin.html',
    '/admin',
    '/logoapolo.png',
    '/apolo.png',
    '/manifest.json'
];

// Instalação do Service Worker e cache estático
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[SW] Alguns ativos não puderam ser cacheados:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// ============================================================
// RECEBIMENTO DE NOTIFICAÇÕES PUSH
// ============================================================
self.addEventListener('push', (event) => {
    let payload = {
        title: 'Apolo Barbearia 💈',
        body: 'Novo agendamento recebido!',
        icon: '/logoapolo.png',
        badge: '/logoapolo.png',
        url: '/admin.html'
    };

    if (event.data) {
        try {
            const json = event.data.json();
            payload = Object.assign(payload, json);
        } catch (e) {
            payload.body = event.data.text();
        }
    }

    const options = {
        body: payload.body,
        icon: payload.icon || '/logoapolo.png',
        badge: payload.badge || '/logoapolo.png',
        vibrate: [200, 100, 200, 100, 300],
        data: {
            url: payload.url || '/admin.html',
            timestamp: Date.now(),
            ...payload.data
        },
        actions: [
            { action: 'open', title: 'Ver Painel ✂️' }
        ],
        tag: 'apolo-agendamento-' + Date.now(),
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// CLIQUE NA NOTIFICAÇÃO
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/admin.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('admin') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// Intercepção de requisições
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Ignorar requisições de API para não servir dados estáticos defasados
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // Estratégia Network First com Fallback em Cache para páginas e estáticos
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Se a resposta for válida, guarda no cache
                if (response.status === 200 && event.request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Se estiver offline, retorna do cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.headers.get('accept')?.includes('text/html')) {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

