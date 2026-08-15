// api/equipe.js
// Gestão de Barbeiros, Serviços e Horários da Apolo Barbearia
import { query, isDbConfigured } from '../lib/db.js';
import { requireAdminAuth } from '../lib/authCheck.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!isDbConfigured) {
        return res.status(200).json({ ok: false, isDbConfigured: false, message: 'DATABASE_URL não configurada.' });
    }

    const url = req.url || '';
    const isServicos = url.includes('/servicos') || req.query?.entity === 'servicos';
    const isHorarios = url.includes('/horarios') || req.query?.entity === 'horarios';
    const isBarbeiros = !isServicos && !isHorarios;

    try {
        // ============================================================
        // 1. SERVIÇOS
        // ============================================================
        if (isServicos) {
            if (req.method === 'GET') {
                const servicos = await query`SELECT id, nome, duracao, preco::float as preco FROM servicos ORDER BY created_at ASC`;
                return res.status(200).json({ ok: true, servicos });
            }

            if (!requireAdminAuth(req, res)) return;

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
                } catch (e) {}

                await query`DELETE FROM servicos WHERE id = ${id}`;
                return res.status(200).json({ ok: true, id });
            }
        }

        // ============================================================
        // 2. HORÁRIOS
        // ============================================================
        if (isHorarios) {
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

            if (!requireAdminAuth(req, res)) return;

            if (req.method === 'POST') {
                const { barbeiroId, dia, ativo, slots, schedule } = req.body || {};

                if (!barbeiroId) {
                    return res.status(400).json({ ok: false, error: 'barbeiroId é obrigatório.' });
                }

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
        }

        // ============================================================
        // 3. BARBEIROS
        // ============================================================
        if (isBarbeiros) {
            if (req.method === 'GET') {
                const barbeiros = await query`SELECT id, nome, especialidade, whatsapp, foto, COALESCE(comissao_pct, 40.00)::float as "comissaoPct" FROM barbeiros ORDER BY created_at ASC`;
                return res.status(200).json({ ok: true, barbeiros });
            }

            if (!requireAdminAuth(req, res)) return;

            if (req.method === 'POST') {
                const { id, nome, especialidade, whatsapp, foto, comissaoPct } = req.body || {};
                if (!nome || !whatsapp) {
                    return res.status(400).json({ ok: false, error: 'Nome e WhatsApp são obrigatórios.' });
                }

                const cleanWhats = String(whatsapp).replace(/\D/g, '');
                const pct = comissaoPct !== undefined && comissaoPct !== null && comissaoPct !== '' ? parseFloat(comissaoPct) : 40.00;

                if (id) {
                    await query`
                        UPDATE barbeiros 
                        SET nome = ${nome}, especialidade = ${especialidade || null}, whatsapp = ${cleanWhats}, foto = ${foto || null}, comissao_pct = ${pct}
                        WHERE id = ${id}
                    `;
                    return res.status(200).json({ ok: true, barbeiro: { id, nome, especialidade, whatsapp: cleanWhats, foto, comissaoPct: pct } });
                } else {
                    const newId = 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                    await query`
                        INSERT INTO barbeiros (id, nome, especialidade, whatsapp, foto, comissao_pct)
                        VALUES (${newId}, ${nome}, ${especialidade || null}, ${cleanWhats}, ${foto || null}, ${pct})
                    `;

                    // Inicializar horários padrão
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
                        barbeiro: { id: newId, nome, especialidade, whatsapp: cleanWhats, foto, comissaoPct: pct }
                    });
                }
            }

            if (req.method === 'DELETE') {
                const id = req.body?.id || req.query?.id;
                if (!id) return res.status(400).json({ ok: false, error: 'ID é obrigatório para exclusão.' });

                try {
                    await query`DELETE FROM horarios WHERE barbeiro_id = ${id}`;
                    await query`UPDATE agendamentos SET barbeiro_id = NULL WHERE barbeiro_id = ${id}`;
                } catch (e) {}

                await query`DELETE FROM barbeiros WHERE id = ${id}`;
                return res.status(200).json({ ok: true, id });
            }
        }

        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('Erro em /api/equipe:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
