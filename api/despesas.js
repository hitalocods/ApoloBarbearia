// api/despesas.js
// Gestão de Despesas e Financeiro no Neon PostgreSQL
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

        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('Erro em /api/despesas:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
