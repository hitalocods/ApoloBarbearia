// api/financeiro.js
// Gestão de Despesas, Entradas e Comissões da Apolo Barbearia
import { query, isDbConfigured } from '../lib/db.js';
import { requireAdminAuth } from '../lib/authCheck.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (!requireAdminAuth(req, res)) return;

    if (!isDbConfigured) {
        return res.status(200).json({ ok: false, isDbConfigured: false, message: 'DATABASE_URL não configurada.' });
    }

    const url = req.url || '';
    const isDespesas = url.includes('/despesas') || req.query?.entity === 'despesas';
    const isComissoes = url.includes('/comissoes') || req.query?.entity === 'comissoes';
    const isEntradas = !isDespesas && !isComissoes;

    try {
        // ============================================================
        // 1. DESPESAS
        // ============================================================
        if (isDespesas) {
            if (req.method === 'GET') {
                const despesas = await query`
                    SELECT id, descricao as desc, categoria as cat, to_char(data, 'YYYY-MM-DD') as data, valor::float as valor, observacao as obs 
                    FROM despesas 
                    ORDER BY data DESC, created_at DESC
                `;
                return res.status(200).json({ ok: true, despesas });
            }

            if (req.method === 'POST') {
                const { id, desc, cat, data, valor, obs } = req.body || {};
                if (!desc || !data || valor === undefined || valor === null) {
                    return res.status(400).json({ ok: false, error: 'Descrição, data e valor são obrigatórios.' });
                }

                const numValor = parseFloat(valor);
                const categoria = cat || 'Outros';
                const observacao = obs || null;

                if (id) {
                    await query`
                        UPDATE despesas 
                        SET descricao = ${desc}, categoria = ${categoria}, data = ${data}::date, valor = ${numValor}, observacao = ${observacao}
                        WHERE id = ${id}
                    `;
                    return res.status(200).json({
                        ok: true,
                        despesa: { id, desc, cat: categoria, data, valor: numValor, obs: observacao }
                    });
                } else {
                    const newId = 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                    await query`
                        INSERT INTO despesas (id, descricao, categoria, data, valor, observacao)
                        VALUES (${newId}, ${desc}, ${categoria}, ${data}::date, ${numValor}, ${observacao})
                    `;

                    return res.status(201).json({
                        ok: true,
                        despesa: { id: newId, desc, cat: categoria, data, valor: numValor, obs: observacao }
                    });
                }
            }

            if (req.method === 'DELETE') {
                const id = req.body?.id || req.query?.id;
                if (!id) return res.status(400).json({ ok: false, error: 'ID é obrigatório.' });

                await query`DELETE FROM despesas WHERE id = ${id}`;
                return res.status(200).json({ ok: true, id });
            }
        }

        // ============================================================
        // 2. COMISSÕES
        // ============================================================
        if (isComissoes) {
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
        }

        // ============================================================
        // 3. ENTRADAS
        // ============================================================
        if (isEntradas) {
            if (req.method === 'GET') {
                const entradas = await query`
                    SELECT id, descricao as desc, valor::float as valor, 
                           to_char(data, 'YYYY-MM-DD') as data, 
                           barbeiro_id as "barbeiroId", servico_id as "servicoId", 
                           cliente_nome as "clienteNome", agendamento_id as "agendamentoId", 
                           observacao as obs, created_at as "createdAt"
                    FROM entradas 
                    ORDER BY data DESC, created_at DESC
                `;
                return res.status(200).json({ ok: true, entradas });
            }

            if (req.method === 'POST') {
                const { id, desc, valor, data, barbeiroId, servicoId, clienteNome, agendamentoId, obs } = req.body || {};
                if (!desc || !data || valor === undefined || valor === null) {
                    return res.status(400).json({ ok: false, error: 'Descrição, data e valor são obrigatórios.' });
                }

                const numValor = parseFloat(valor);
                const bId = barbeiroId || null;
                const sId = servicoId || null;
                const client = clienteNome || null;
                const agId = agendamentoId || null;
                const observacao = obs || null;

                if (id) {
                    await query`
                        UPDATE entradas 
                        SET descricao = ${desc}, valor = ${numValor}, data = ${data}::date, 
                            barbeiro_id = ${bId}, servico_id = ${sId}, 
                            cliente_nome = ${client}, agendamento_id = ${agId}, 
                            observacao = ${observacao}
                        WHERE id = ${id}
                    `;
                    return res.status(200).json({
                        ok: true,
                        entrada: { id, desc, valor: numValor, data, barbeiroId: bId, servicoId: sId, clienteNome: client, agendamentoId: agId, obs: observacao }
                    });
                } else {
                    const newId = 'e_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                    await query`
                        INSERT INTO entradas (id, descricao, valor, data, barbeiro_id, servico_id, cliente_nome, agendamento_id, observacao)
                        VALUES (${newId}, ${desc}, ${numValor}, ${data}::date, ${bId}, ${sId}, ${client}, ${agId}, ${observacao})
                    `;

                    return res.status(201).json({
                        ok: true,
                        entrada: { id: newId, desc, valor: numValor, data, barbeiroId: bId, servicoId: sId, clienteNome: client, agendamentoId: agId, obs: observacao }
                    });
                }
            }

            if (req.method === 'DELETE') {
                const id = req.body?.id || req.query?.id;
                if (!id) return res.status(400).json({ ok: false, error: 'ID é obrigatório.' });

                await query`DELETE FROM entradas WHERE id = ${id}`;
                return res.status(200).json({ ok: true, id });
            }
        }

        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('Erro em /api/financeiro:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
