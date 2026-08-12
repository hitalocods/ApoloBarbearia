// api/comissoes.js
// Gestão de Histórico e Pagamentos de Comissões no Neon PostgreSQL
import { query, isDbConfigured } from './db.js';
import { requireAdminAuth } from './authCheck.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (!requireAdminAuth(req, res)) return;

    if (!isDbConfigured) {
        return res.status(200).json({ ok: false, isDbConfigured: false, message: 'DATABASE_URL não configurada.' });
    }

    try {
        if (req.method === 'GET') {
            const pagamentos = await query`
                SELECT id, barbeiro_id as "barbeiroId", valor::float as valor, 
                       to_char(data_pagamento, 'YYYY-MM-DD') as "dataPagamento", 
                       to_char(periodo_inicio, 'YYYY-MM-DD') as "periodoInicio", 
                       to_char(periodo_fim, 'YYYY-MM-DD') as "periodoFim", 
                       observacao as obs, status, created_at as "createdAt"
                FROM pagamentos_comissao 
                ORDER BY data_pagamento DESC, created_at DESC
            `;
            return res.status(200).json({ ok: true, pagamentos });
        }

        if (req.method === 'POST') {
            const { id, barbeiroId, valor, dataPagamento, periodoInicio, periodoFim, obs, status = 'pago' } = req.body || {};
            if (!barbeiroId || valor === undefined || valor === null || !dataPagamento || !periodoInicio || !periodoFim) {
                return res.status(400).json({ ok: false, error: 'Barbeiro, valor, data de pagamento e período são obrigatórios.' });
            }

            const numValor = parseFloat(valor);
            const observacao = obs || null;

            if (id) {
                await query`
                    UPDATE pagamentos_comissao 
                    SET barbeiro_id = ${barbeiroId}, valor = ${numValor}, 
                        data_pagamento = ${dataPagamento}::date, 
                        periodo_inicio = ${periodoInicio}::date, periodo_fim = ${periodoFim}::date, 
                        observacao = ${observacao}, status = ${status}
                    WHERE id = ${id}
                `;
                return res.status(200).json({
                    ok: true,
                    pagamento: { id, barbeiroId, valor: numValor, dataPagamento, periodoInicio, periodoFim, obs: observacao, status }
                });
            } else {
                const newId = 'pg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                await query`
                    INSERT INTO pagamentos_comissao (id, barbeiro_id, valor, data_pagamento, periodo_inicio, periodo_fim, observacao, status)
                    VALUES (${newId}, ${barbeiroId}, ${numValor}, ${dataPagamento}::date, ${periodoInicio}::date, ${periodoFim}::date, ${observacao}, ${status})
                `;

                return res.status(201).json({
                    ok: true,
                    pagamento: { id: newId, barbeiroId, valor: numValor, dataPagamento, periodoInicio, periodoFim, obs: observacao, status }
                });
            }
        }

        if (req.method === 'DELETE') {
            const id = req.body?.id || req.query?.id;
            if (!id) return res.status(400).json({ ok: false, error: 'ID é obrigatório.' });

            await query`DELETE FROM pagamentos_comissao WHERE id = ${id}`;
            return res.status(200).json({ ok: true, id });
        }

        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('Erro em /api/comissoes:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
