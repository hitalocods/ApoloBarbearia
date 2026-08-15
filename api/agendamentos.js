import { query, isDbConfigured } from '../lib/db.js';
import { sendPushToAll } from '../lib/pushHelper.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!isDbConfigured) {
        return res.status(200).json({ ok: false, isDbConfigured: false, message: 'DATABASE_URL não configurada.' });
    }

    try {
        if (req.method === 'GET') {
            const rows = await query`
                SELECT id, barbeiro_id as "barbeiroId", servico_id as "servicoId", 
                       to_char(data, 'YYYY-MM-DD') as data, hora, nome, tel, status, 
                       criado_em as "criadoEm" 
                FROM agendamentos 
                ORDER BY data ASC, hora ASC
            `;
            return res.status(200).json({ ok: true, agendamentos: rows });
        }

        if (req.method === 'POST') {
            const { id, barbeiroId, servicoId, data, hora, nome, tel, status = 'pendente' } = req.body || {};
            if (!nome || !tel || !data || !hora || !barbeiroId || !servicoId) {
                return res.status(400).json({ ok: false, error: 'Dados incompletos para agendamento.' });
            }

            const agId = id || 'ag_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

            // Verificar se o horário já está ocupado
            const checkCollision = await query`
                SELECT id FROM agendamentos 
                WHERE barbeiro_id = ${barbeiroId} 
                  AND data = ${data}::date 
                  AND hora = ${hora} 
                  AND status != 'cancelado'
            `;

            if (checkCollision && checkCollision.length > 0) {
                return res.status(409).json({ ok: false, error: 'Este horário acabou de ser preenchido por outro cliente. Por favor, selecione outro.' });
            }

            await query`
                INSERT INTO agendamentos (id, barbeiro_id, servico_id, data, hora, nome, tel, status)
                VALUES (${agId}, ${barbeiroId}, ${servicoId}, ${data}::date, ${hora}, ${nome}, ${tel}, ${status})
            `;

            // Disparo de notificação Push para os celulares cadastrados (em background seguro)
            (async () => {
                try {
                    // Buscar nomes do barbeiro e serviço para montar mensagem rica
                    const bRes = await query`SELECT nome FROM barbeiros WHERE id = ${barbeiroId}`;
                    const sRes = await query`SELECT nome FROM servicos WHERE id = ${servicoId}`;
                    const barbeiroNome = bRes[0]?.nome || 'Barbeiro';
                    const servicoNome = sRes[0]?.nome || 'Serviço';

                    // Formatar data DD/MM
                    let dataFmt = data;
                    if (data && data.includes('-')) {
                        const parts = data.split('-');
                        if (parts.length === 3) dataFmt = `${parts[2]}/${parts[1]}`;
                    }

                    // Formatar telefone se disponível
                    let telFmt = tel;
                    const cleanDigits = String(tel || '').replace(/\D/g, '');
                    if (cleanDigits.length === 11) {
                        telFmt = `(${cleanDigits.slice(0, 2)}) ${cleanDigits.slice(2, 7)}-${cleanDigits.slice(7)}`;
                    } else if (cleanDigits.length === 10) {
                        telFmt = `(${cleanDigits.slice(0, 2)}) ${cleanDigits.slice(2, 6)}-${cleanDigits.slice(6)}`;
                    }

                    const pushTitle = `💈 Novo Agendamento — ${nome}`;
                    const pushBody = `✂️ ${servicoNome}\n📅 ${dataFmt} às ${hora}\n👤 Barbeiro: ${barbeiroNome}\n📞 ${telFmt}`;

                    await sendPushToAll({
                        title: pushTitle,
                        body: pushBody,
                        url: '/admin.html',
                        data: { agendamentoId: agId, data, hora, barbeiroId, nome, servicoNome, barbeiroNome, tel }
                    });
                } catch (pushErr) {
                    console.error('[Agendamentos] Erro ao disparar notificação push:', pushErr);
                }
            })();

            return res.status(201).json({
                ok: true,
                agendamento: { id: agId, barbeiroId, servicoId, data, hora, nome, tel, status }
            });
        }

        if (req.method === 'PATCH') {
            const { id, status } = req.body || {};
            if (!id || !status) {
                return res.status(400).json({ ok: false, error: 'ID e status são obrigatórios.' });
            }

            await query`
                UPDATE agendamentos 
                SET status = ${status} 
                WHERE id = ${id}
            `;

            return res.status(200).json({ ok: true, id, status });
        }

        if (req.method === 'DELETE') {
            const id = req.body?.id || req.query?.id;
            if (!id) return res.status(400).json({ ok: false, error: 'ID é obrigatório.' });

            await query`DELETE FROM agendamentos WHERE id = ${id}`;
            return res.status(200).json({ ok: true, id });
        }

        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('Erro em /api/agendamentos:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
