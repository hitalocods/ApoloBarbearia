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
        // Limpeza inteligente automática em background (remove cancelados com mais de 180 dias para economizar o plano Neon)
        if (Math.random() < 0.1) {
            query`DELETE FROM agendamentos WHERE status = 'cancelado' AND data < CURRENT_DATE - INTERVAL '180 days'`.catch(() => {});
        }

        if (req.method === 'GET') {
            const rows = await query`
                SELECT id, barbeiro_id as "barbeiroId", servico_id as "servicoId", 
                       servicos_ids as "servicoIds",
                       to_char(data, 'YYYY-MM-DD') as data, hora, nome, tel, status, 
                       criado_em as "criadoEm" 
                FROM agendamentos 
                ORDER BY data ASC, hora ASC
            `;
            const formatted = rows.map(r => {
                let sIds = [];
                if (Array.isArray(r.servicoIds)) {
                    sIds = r.servicoIds;
                } else if (typeof r.servicoIds === 'string') {
                    try { sIds = JSON.parse(r.servicoIds); } catch (e) { sIds = []; }
                }
                if (!sIds.length && r.servicoId) {
                    sIds = [r.servicoId];
                }
                return {
                    ...r,
                    servicoIds: sIds,
                    servicoId: r.servicoId || (sIds[0] || null)
                };
            });
            return res.status(200).json({ ok: true, agendamentos: formatted });
        }

        if (req.method === 'POST') {
            const { id, barbeiroId, servicoId, servicoIds, data, hora, nome, tel, status = 'pendente' } = req.body || {};
            
            // Normalizar lista de serviços
            let normalizedServicoIds = [];
            if (Array.isArray(servicoIds) && servicoIds.length > 0) {
                normalizedServicoIds = servicoIds;
            } else if (servicoId) {
                normalizedServicoIds = [servicoId];
            }

            const primaryServicoId = normalizedServicoIds[0] || servicoId || null;

            if (!nome || !tel || !data || !hora || !barbeiroId || !primaryServicoId) {
                return res.status(400).json({ ok: false, error: 'Dados incompletos para agendamento (nome, tel, data, hora, barbeiro e ao menos 1 serviço são obrigatórios).' });
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

            const servicosIdsJson = JSON.stringify(normalizedServicoIds);

            await query`
                INSERT INTO agendamentos (id, barbeiro_id, servico_id, servicos_ids, data, hora, nome, tel, status)
                VALUES (${agId}, ${barbeiroId}, ${primaryServicoId}, ${servicosIdsJson}::jsonb, ${data}::date, ${hora}, ${nome}, ${tel}, ${status})
            `;

            // Disparo de notificação Push para os celulares cadastrados (em background seguro)
            (async () => {
                try {
                    // Buscar nomes do barbeiro e de todos os serviços selecionados
                    const bRes = await query`SELECT nome FROM barbeiros WHERE id = ${barbeiroId}`;
                    const allServices = await query`SELECT id, nome, preco FROM servicos`;
                    const barbeiroNome = bRes[0]?.nome || 'Barbeiro';
                    
                    const selectedServices = allServices.filter(s => normalizedServicoIds.includes(s.id));
                    const servicosNomes = selectedServices.length > 0
                        ? selectedServices.map(s => s.nome).join(' + ')
                        : 'Serviço';
                    const valorTotal = selectedServices.reduce((sum, s) => sum + Number(s.preco || 0), 0);
                    const valorFmt = valorTotal > 0 ? ` (R$ ${valorTotal.toFixed(2).replace('.', ',')})` : '';

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
                    const pushBody = `✂️ ${servicosNomes}${valorFmt}\n📅 ${dataFmt} às ${hora}\n👤 Barbeiro: ${barbeiroNome}\n📞 ${telFmt}`;

                    await sendPushToAll({
                        title: pushTitle,
                        body: pushBody,
                        url: '/admin.html',
                        data: { agendamentoId: agId, data, hora, barbeiroId, nome, servicoNome: servicosNomes, barbeiroNome, tel }
                    });
                } catch (pushErr) {
                    console.error('[Agendamentos] Erro ao disparar notificação push:', pushErr);
                }
            })();

            return res.status(201).json({
                ok: true,
                agendamento: { 
                    id: agId, 
                    barbeiroId, 
                    servicoId: primaryServicoId, 
                    servicoIds: normalizedServicoIds, 
                    data, 
                    hora, 
                    nome, 
                    tel, 
                    status 
                }
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
