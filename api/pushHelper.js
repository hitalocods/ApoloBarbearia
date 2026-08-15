// api/pushHelper.js
// Utilitário de Notificações Web Push (PWA)
import webpush from 'web-push';
import { query, isDbConfigured } from './db.js';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:contato@apolobarbearia.com.br';

let vapidConfigured = false;
if (vapidPublicKey && vapidPrivateKey) {
    try {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
        vapidConfigured = true;
    } catch (err) {
        console.error('Erro ao configurar VAPID no web-push:', err);
    }
}

export function isPushConfigured() {
    return vapidConfigured && isDbConfigured;
}

export function getVapidPublicKey() {
    return vapidPublicKey || '';
}

/**
 * Envia notificação Web Push para todos os aparelhos cadastrados
 * @param {Object} payload { title, body, icon, url, data }
 */
export async function sendPushToAll(payload) {
    if (!isPushConfigured()) {
        console.warn('[Push] Push ou Banco não configurados. Pulando envio.');
        return { sent: 0, failed: 0, reason: 'unconfigured' };
    }

    try {
        const subscriptions = await query`
            SELECT id, endpoint, p256dh, auth 
            FROM push_subscriptions
        `;

        if (!subscriptions || subscriptions.length === 0) {
            console.log('[Push] Nenhuma assinatura de celular cadastrada no momento.');
            return { sent: 0, failed: 0, total: 0 };
        }

        const stringifiedPayload = JSON.stringify({
            title: payload.title || 'Apolo Barbearia 💈',
            body: payload.body || 'Você tem uma nova notificação.',
            icon: payload.icon || '/logoapolo.png',
            badge: payload.badge || '/logoapolo.png',
            url: payload.url || '/admin.html',
            data: payload.data || {}
        });

        let sent = 0;
        let failed = 0;

        const promises = subscriptions.map(async (sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, stringifiedPayload);
                sent++;
            } catch (err) {
                failed++;
                console.warn(`[Push] Falha ao enviar para endpoint (${sub.endpoint.slice(0, 30)}...):`, err.statusCode || err.message);
                
                // Se a inscrição expirou ou não existe mais (404 ou 410), remove do banco
                if (err.statusCode === 410 || err.statusCode === 404) {
                    try {
                        await query`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
                        console.log(`[Push] Inscrição expirada removida do banco: ${sub.id}`);
                    } catch (delErr) {
                        console.error('[Push] Erro ao deletar inscrição expirada:', delErr);
                    }
                }
            }
        });

        await Promise.allSettled(promises);
        console.log(`[Push] Envio concluído: ${sent} sucesso(s), ${failed} falha(s) de ${subscriptions.length} total.`);
        return { sent, failed, total: subscriptions.length };
    } catch (error) {
        console.error('[Push] Erro ao processar envio de notificações push:', error);
        return { sent: 0, failed: 0, error: error.message };
    }
}
