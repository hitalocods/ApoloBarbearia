// api/push.js
// Endpoint para registro de inscrições Web Push e envio de testes
import { query, isDbConfigured } from '../lib/db.js';
import { getVapidPublicKey, isPushConfigured, sendPushToAll } from '../lib/pushHelper.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!isDbConfigured) {
        return res.status(200).json({ 
            ok: false, 
            isDbConfigured: false, 
            message: 'DATABASE_URL não configurada no ambiente.' 
        });
    }

    try {
        // GET: Obter chave pública VAPID e status
        if (req.method === 'GET') {
            const vapidKey = getVapidPublicKey();
            const countRes = await query`SELECT COUNT(*) as total FROM push_subscriptions`;
            const total = parseInt(countRes[0]?.total || '0', 10);

            return res.status(200).json({
                ok: true,
                publicKey: vapidKey,
                isConfigured: isPushConfigured(),
                totalSubscriptions: total
            });
        }

        // POST: Registrar inscrição ou disparar notificação de teste
        if (req.method === 'POST') {
            const body = req.body || {};

            // Disparo de teste
            if (body.action === 'test') {
                const result = await sendPushToAll({
                    title: '💈 Novo Agendamento — Lucas Silva (Exemplo)',
                    body: '✂️ Corte + Barba\n📅 Hoje às 16:30\n👤 Barbeiro: Marcus Ferreira\n📞 Tel: (86) 99999-0000',
                    url: '/admin.html',
                    data: { type: 'test', timestamp: Date.now() }
                });

                return res.status(200).json({
                    ok: true,
                    message: 'Notificação de teste disparada.',
                    result
                });
            }

            // Inscrição de dispositivo
            const subscription = body.subscription || body;
            const endpoint = subscription.endpoint;
            const p256dh = subscription.keys?.p256dh;
            const auth = subscription.keys?.auth;
            const userAgent = req.headers['user-agent'] || body.userAgent || 'Desconhecido';

            if (!endpoint || !p256dh || !auth) {
                return res.status(400).json({
                    ok: false,
                    error: 'Dados da inscrição Web Push incompletos (endpoint, p256dh e auth são obrigatórios).'
                });
            }

            const id = 'sub_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

            // Inserir ou atualizar caso já exista o mesmo endpoint
            await query`
                INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, user_agent)
                VALUES (${id}, ${endpoint}, ${p256dh}, ${auth}, ${userAgent})
                ON CONFLICT (endpoint) 
                DO UPDATE SET p256dh = ${p256dh}, auth = ${auth}, user_agent = ${userAgent}, created_at = CURRENT_TIMESTAMP
            `;

            return res.status(201).json({
                ok: true,
                message: 'Celular inscrito com sucesso para receber notificações!'
            });
        }

        // DELETE: Remover inscrição
        if (req.method === 'DELETE') {
            const endpoint = req.body?.endpoint || req.query?.endpoint;
            if (!endpoint) {
                return res.status(400).json({ ok: false, error: 'Endpoint é obrigatório para cancelamento.' });
            }

            await query`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
            return res.status(200).json({ ok: true, message: 'Inscrição removida com sucesso.' });
        }

        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('Erro em /api/push:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
