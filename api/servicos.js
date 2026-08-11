// api/servicos.js
// CRUD de Serviços no Neon PostgreSQL
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
            const servicos = await query`SELECT id, nome, duracao, preco::float as preco FROM servicos ORDER BY created_at ASC`;
            return res.status(200).json({ ok: true, servicos });
        }

        if (req.method === 'POST') {
            const { id, nome, duracao, preco } = req.body || {};
            if (!nome || !duracao || preco === undefined || preco === null) {
                return res.status(400).json({ ok: false, error: 'Nome, duração e preço são obrigatórios.' });
            }

            const numDuracao = parseInt(duracao, 10);
            const numPreco = parseFloat(preco);

            if (id) {
                await query`
                    UPDATE servicos 
                    SET nome = ${nome}, duracao = ${numDuracao}, preco = ${numPreco}
                    WHERE id = ${id}
                `;
                return res.status(200).json({ ok: true, servico: { id, nome, duracao: numDuracao, preco: numPreco } });
            } else {
                const newId = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                await query`
                    INSERT INTO servicos (id, nome, duracao, preco)
                    VALUES (${newId}, ${nome}, ${numDuracao}, ${numPreco})
                `;
                return res.status(201).json({ ok: true, servico: { id: newId, nome, duracao: numDuracao, preco: numPreco } });
            }
        }

        if (req.method === 'DELETE') {
            const id = req.body?.id || req.query?.id;
            if (!id) return res.status(400).json({ ok: false, error: 'ID é obrigatório para exclusão.' });

            try {
                await query`UPDATE agendamentos SET servico_id = NULL WHERE servico_id = ${id}`;
            } catch (e) {
                console.warn('Aviso ao desvincular serviço de agendamentos:', e.message);
            }

            await query`DELETE FROM servicos WHERE id = ${id}`;
            return res.status(200).json({ ok: true, id });
        }

        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('Erro em /api/servicos:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
