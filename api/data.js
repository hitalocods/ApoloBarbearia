// api/data.js
// Retorna todo o estado do sistema (barbeiros, serviços, horários, agendamentos, despesas)
import { query, isDbConfigured } from './db.js';

export default async function handler(req, res) {
    // Definir headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

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

    try {
        // Consultar todas as entidades em paralelo
        const [barbeiros, servicos, horariosRows, agendamentos, despesas, entradas, pagamentosComissao] = await Promise.all([
            query`SELECT id, nome, especialidade, whatsapp, foto, COALESCE(comissao_pct, 40.00)::float as "comissaoPct" FROM barbeiros ORDER BY created_at ASC`,
            query`SELECT id, nome, duracao, preco::float as preco FROM servicos ORDER BY created_at ASC`,
            query`SELECT barbeiro_id, dia, ativo, slots FROM horarios`,
            query`SELECT id, barbeiro_id as "barbeiroId", servico_id as "servicoId", to_char(data, 'YYYY-MM-DD') as data, hora, nome, tel, status, criado_em as "criadoEm" FROM agendamentos ORDER BY data ASC, hora ASC`,
            query`SELECT id, descricao as desc, categoria as cat, to_char(data, 'YYYY-MM-DD') as data, valor::float as valor, observacao as obs FROM despesas ORDER BY data DESC`,
            query`SELECT id, descricao as desc, valor::float as valor, to_char(data, 'YYYY-MM-DD') as data, barbeiro_id as "barbeiroId", servico_id as "servicoId", cliente_nome as "clienteNome", agendamento_id as "agendamentoId", observacao as obs FROM entradas ORDER BY data DESC`,
            query`SELECT id, barbeiro_id as "barbeiroId", valor::float as valor, to_char(data_pagamento, 'YYYY-MM-DD') as "dataPagamento", to_char(periodo_inicio, 'YYYY-MM-DD') as "periodoInicio", to_char(periodo_fim, 'YYYY-MM-DD') as "periodoFim", observacao as obs, status FROM pagamentos_comissao ORDER BY data_pagamento DESC`
        ]);

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
