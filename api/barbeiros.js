// api/barbeiros.js
// CRUD de Barbeiros no Neon PostgreSQL
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
            const barbeiros = await query`SELECT id, nome, especialidade, whatsapp, foto FROM barbeiros ORDER BY created_at ASC`;
            return res.status(200).json({ ok: true, barbeiros });
        }

        if (req.method === 'POST') {
            const { id, nome, especialidade, whatsapp, foto } = req.body || {};
            if (!nome || !whatsapp) {
                return res.status(400).json({ ok: false, error: 'Nome e WhatsApp são obrigatórios.' });
            }

            const cleanWhats = String(whatsapp).replace(/\D/g, '');

            if (id) {
                // Atualização
                await query`
                    UPDATE barbeiros 
                    SET nome = ${nome}, especialidade = ${especialidade || null}, whatsapp = ${cleanWhats}, foto = ${foto || null}
                    WHERE id = ${id}
                `;
                return res.status(200).json({ ok: true, barbeiro: { id, nome, especialidade, whatsapp: cleanWhats, foto } });
            } else {
                // Novo barbeiro
                const newId = 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                await query`
                    INSERT INTO barbeiros (id, nome, especialidade, whatsapp, foto)
                    VALUES (${newId}, ${nome}, ${especialidade || null}, ${cleanWhats}, ${foto || null})
                `;

                // Inicializar horários padrão para o novo barbeiro
                const weekdays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
                const gerarSlots = (inicio, fim, passo) => {
                    const slots = [];
                    const [hI, mI] = inicio.split(':').map(Number);
                    const [hF, mF] = fim.split(':').map(Number);
                    let cursor = hI * 60 + mI;
                    const fimMin = hF * 60 + mF;
                    while (cursor <= fimMin) {
                        slots.push(String(Math.floor(cursor / 60)).padStart(2, '0') + ':' + String(cursor % 60).padStart(2, '0'));
                        cursor += passo;
                    }
                    return slots;
                };

                const slotsSemana = JSON.stringify(gerarSlots('09:00', '18:30', 30));
                const slotsSabado = JSON.stringify(gerarSlots('08:00', '16:00', 30));
                const slotsVazio = JSON.stringify([]);

                for (const dia of weekdays) {
                    if (dia === 'dom') {
                        await query`INSERT INTO horarios (barbeiro_id, dia, ativo, slots) VALUES (${newId}, ${dia}, false, ${slotsVazio}::jsonb) ON CONFLICT DO NOTHING`;
                    } else if (dia === 'sab') {
                        await query`INSERT INTO horarios (barbeiro_id, dia, ativo, slots) VALUES (${newId}, ${dia}, true, ${slotsSabado}::jsonb) ON CONFLICT DO NOTHING`;
                    } else {
                        await query`INSERT INTO horarios (barbeiro_id, dia, ativo, slots) VALUES (${newId}, ${dia}, true, ${slotsSemana}::jsonb) ON CONFLICT DO NOTHING`;
                    }
                }

                return res.status(201).json({
                    ok: true,
                    barbeiro: { id: newId, nome, especialidade, whatsapp: cleanWhats, foto }
                });
            }
        }

        if (req.method === 'DELETE') {
            const id = req.body?.id || req.query?.id;
            if (!id) return res.status(400).json({ ok: false, error: 'ID é obrigatório para exclusão.' });

            // Remover horários e desvincular agendamentos para evitar violação de Foreign Key
            try {
                await query`DELETE FROM horarios WHERE barbeiro_id = ${id}`;
                await query`UPDATE agendamentos SET barbeiro_id = NULL WHERE barbeiro_id = ${id}`;
            } catch (e) {
                console.warn('Aviso ao desvincular tabelas filhas:', e.message);
            }

            await query`DELETE FROM barbeiros WHERE id = ${id}`;
            return res.status(200).json({ ok: true, id });
        }

        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('Erro em /api/barbeiros:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
