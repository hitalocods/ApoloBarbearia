// api/data.js
// Retorna o estado do sistema (barbeiros, serviços, horários, agendamentos, despesas)
import { query, isDbConfigured } from '../lib/db.js';
import { verifyAuth } from '../lib/authCheck.js';

export default async function handler(req, res) {
    // Definir headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!isDbConfigured) {
        return res.status(200).json({
            ok: true,
            isDbConfigured: false,
            message: 'DATABASE_URL não configurada. Modo offline/demonstração ativo.'
        });
    }

    const auth = await verifyAuth(req);
    const isAdmin = auth.isValid && auth.role === 'admin';
    const isBarbeiro = auth.isValid && auth.role === 'barbeiro';
    const userRole = isAdmin ? 'admin' : (isBarbeiro ? 'barbeiro' : 'public');
    const loggedBarbeiroId = isBarbeiro ? auth.barbeiroId : null;

    try {
        // Consultar entidades básicas públicas
        const [barbeirosRows, servicos, horariosRows, agendamentosRows] = await Promise.all([
            query`SELECT id, nome, especialidade, whatsapp, foto, COALESCE(comissao_pct, 40.00)::float as "comissaoPct", senha FROM barbeiros ORDER BY created_at ASC`,
            query`SELECT id, nome, duracao, preco::float as preco FROM servicos ORDER BY created_at ASC`,
            query`SELECT barbeiro_id, dia, ativo, slots FROM horarios`,
            query`SELECT id, barbeiro_id as "barbeiroId", servico_id as "servicoId", servicos_ids as "servicoIds", to_char(data, 'YYYY-MM-DD') as data, hora, nome, tel, status, criado_em as "criadoEm" FROM agendamentos ORDER BY data ASC, hora ASC`
        ]);

        const parseServicoIds = (sIdsRaw, sIdSingle) => {
            let sIds = [];
            if (Array.isArray(sIdsRaw)) {
                sIds = sIdsRaw;
            } else if (typeof sIdsRaw === 'string') {
                try { sIds = JSON.parse(sIdsRaw); } catch (e) { sIds = []; }
            }
            if (!sIds.length && sIdSingle) {
                sIds = [sIdSingle];
            }
            return sIds;
        };

        // Tratar exibição de senha dos barbeiros (apenas para Admin)
        const barbeiros = barbeirosRows.map(b => {
            if (isAdmin) return b;
            const { senha, ...safeB } = b;
            return safeB;
        });

        let despesas = [];
        let entradas = [];
        let pagamentosComissao = [];

        // Dados financeiros apenas para administrador ou barbeiro autenticado
        if (isAdmin) {
            const [despRows, entRows, pagRows] = await Promise.all([
                query`SELECT id, descricao as desc, categoria as cat, to_char(data, 'YYYY-MM-DD') as data, valor::float as valor, observacao as obs FROM despesas ORDER BY data DESC`,
                query`SELECT id, descricao as desc, valor::float as valor, to_char(data, 'YYYY-MM-DD') as data, barbeiro_id as "barbeiroId", servico_id as "servicoId", servicos_ids as "servicoIds", cliente_nome as "clienteNome", agendamento_id as "agendamentoId", observacao as obs FROM entradas ORDER BY data DESC`,
                query`SELECT id, barbeiro_id as "barbeiroId", valor::float as valor, to_char(data_pagamento, 'YYYY-MM-DD') as "dataPagamento", to_char(periodo_inicio, 'YYYY-MM-DD') as "periodoInicio", to_char(periodo_fim, 'YYYY-MM-DD') as "periodoFim", observacao as obs, status FROM pagamentos_comissao ORDER BY data_pagamento DESC`
            ]);
            despesas = despRows;
            entradas = entRows.map(e => ({
                ...e,
                servicoIds: parseServicoIds(e.servicoIds, e.servicoId)
            }));
            pagamentosComissao = pagRows;
        } else if (isBarbeiro) {
            // Barbeiro pode consultar suas próprias entradas
            const entRows = await query`
                SELECT id, descricao as desc, valor::float as valor, to_char(data, 'YYYY-MM-DD') as data, barbeiro_id as "barbeiroId", servico_id as "servicoId", servicos_ids as "servicoIds", cliente_nome as "clienteNome", agendamento_id as "agendamentoId", observacao as obs 
                FROM entradas 
                WHERE barbeiro_id = ${loggedBarbeiroId}
                ORDER BY data DESC
            `;
            entradas = entRows.map(e => ({
                ...e,
                servicoIds: parseServicoIds(e.servicoIds, e.servicoId)
            }));
        }

        // Anonimizar agendamentos se for acesso público (apenas ocupação de horários)
        const agendamentos = agendamentosRows.map(ag => {
            const sIds = parseServicoIds(ag.servicoIds, ag.servicoId);
            const normalizedAg = {
                ...ag,
                servicoIds: sIds,
                servicoId: ag.servicoId || (sIds[0] || null)
            };

            if (isAdmin) return normalizedAg;
            if (isBarbeiro) {
                // Barbeiro vê detalhes completos dos seus próprios agendamentos
                if (ag.barbeiroId === loggedBarbeiroId) return normalizedAg;
                return {
                    id: ag.id,
                    barbeiroId: ag.barbeiroId,
                    servicoId: normalizedAg.servicoId,
                    servicoIds: sIds,
                    data: ag.data,
                    hora: ag.hora,
                    status: ag.status,
                    nome: 'Reservado',
                    tel: '***'
                };
            }
            return {
                id: ag.id,
                barbeiroId: ag.barbeiroId,
                servicoId: normalizedAg.servicoId,
                servicoIds: sIds,
                data: ag.data,
                hora: ag.hora,
                status: ag.status,
                nome: 'Reservado',
                tel: '***'
            };
        });

        // Formatar horários em mapa estruturado: { barbeiroId: { dom: { ativo, slots }, ... } }
        const horariosMap = {};
        for (const row of horariosRows) {
            if (!horariosMap[row.barbeiro_id]) {
                horariosMap[row.barbeiro_id] = {};
            }
            horariosMap[row.barbeiro_id][row.dia] = {
                ativo: Boolean(row.ativo),
                slots: Array.isArray(row.slots) ? row.slots : (JSON.parse(row.slots || '[]'))
            };
        }

        return res.status(200).json({
            ok: true,
            isDbConfigured: true,
            isAdmin,
            role: userRole,
            barbeiroId: loggedBarbeiroId,
            barbeiros,
            servicos,
            horarios: horariosMap,
            agendamentos,
            despesas,
            entradas,
            pagamentosComissao
        });
    } catch (error) {
        console.error('Erro ao buscar dados no Neon:', error);
        return res.status(500).json({
            ok: false,
            error: error.message || 'Falha ao consultar banco de dados Neon.'
        });
    }
}
