// api/horarios.js
// Gestão de horários de trabalho por barbeiro
import { query, isDbConfigured } from './db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!isDbConfigured) {
        return res.status(200).json({ ok: false, isDbConfigured: false, message: 'DATABASE_URL não configurada.' });
    }

    try {
        if (req.method === 'GET') {
            const { barbeiroId } = req.query || {};
            let rows;
            if (barbeiroId) {
                rows = await query`SELECT barbeiro_id, dia, ativo, slots FROM horarios WHERE barbeiro_id = ${barbeiroId}`;
            } else {
                rows = await query`SELECT barbeiro_id, dia, ativo, slots FROM horarios`;
            }
            return res.status(200).json({ ok: true, horarios: rows });
        }

        if (req.method === 'POST') {
            const { barbeiroId, dia, ativo, slots, schedule } = req.body || {};

            if (!barbeiroId) {
                return res.status(400).json({ ok: false, error: 'barbeiroId é obrigatório.' });
            }

            // Se for atualização de todos os dias do barbeiro
            if (schedule && typeof schedule === 'object') {
                for (const [d, cfg] of Object.entries(schedule)) {
                    const jsonSlots = JSON.stringify(cfg.slots || []);
                    await query`
                        INSERT INTO horarios (barbeiro_id, dia, ativo, slots)
                        VALUES (${barbeiroId}, ${d}, ${Boolean(cfg.ativo)}, ${jsonSlots}::jsonb)
                        ON CONFLICT (barbeiro_id, dia)
                        DO UPDATE SET ativo = EXCLUDED.ativo, slots = EXCLUDED.slots
                    `;
                }
                return res.status(200).json({ ok: true, message: 'Horários atualizados com sucesso.' });
            }

            // Se for atualização de um único dia
            if (!dia) {
                return res.status(400).json({ ok: false, error: 'dia ou schedule é obrigatório.' });
            }

            const jsonSlots = JSON.stringify(slots || []);
            await query`
                INSERT INTO horarios (barbeiro_id, dia, ativo, slots)
                VALUES (${barbeiroId}, ${dia}, ${Boolean(ativo)}, ${jsonSlots}::jsonb)
                ON CONFLICT (barbeiro_id, dia)
                DO UPDATE SET ativo = EXCLUDED.ativo, slots = EXCLUDED.slots
            `;

            return res.status(200).json({ ok: true, barbeiroId, dia, ativo, slots });
        }

        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('Erro em /api/horarios:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
