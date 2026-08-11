// api/entradas.js
// Gestão de Entradas Financeiras Manuais e Retroativas no Neon PostgreSQL
import { query, isDbConfigured } from './db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!isDbConfigured) {
        return res.status(200).json({ ok: false, isDbConfigured: false, message: 'DATABASE_URL não configurada.' });
    }

    try {
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

        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('Erro em /api/entradas:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
