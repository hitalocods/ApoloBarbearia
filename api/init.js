// api/init.js
// Endpoint para verificar conexão e criar tabelas se necessário
import { query, isDbConfigured } from './db.js';

export default async function handler(req, res) {
    if (!isDbConfigured) {
        return res.status(200).json({
            ok: false,
            configured: false,
            message: 'DATABASE_URL não configurada no ambiente.'
        });
    }

    try {
        // Criação de tabelas
        await query`
            CREATE TABLE IF NOT EXISTS barbeiros (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                especialidade TEXT,
                whatsapp TEXT NOT NULL,
                foto TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await query`
            CREATE TABLE IF NOT EXISTS servicos (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                duracao INTEGER NOT NULL,
                preco NUMERIC(10, 2) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await query`
            CREATE TABLE IF NOT EXISTS horarios (
                barbeiro_id TEXT NOT NULL REFERENCES barbeiros(id) ON DELETE CASCADE,
                dia TEXT NOT NULL,
                ativo BOOLEAN NOT NULL DEFAULT true,
                slots JSONB NOT NULL DEFAULT '[]'::jsonb,
                PRIMARY KEY (barbeiro_id, dia)
            );
        `;

        await query`
            CREATE TABLE IF NOT EXISTS agendamentos (
                id TEXT PRIMARY KEY,
                barbeiro_id TEXT REFERENCES barbeiros(id) ON DELETE SET NULL,
                servico_id TEXT REFERENCES servicos(id) ON DELETE SET NULL,
                data DATE NOT NULL,
                hora TEXT NOT NULL,
                nome TEXT NOT NULL,
                tel TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pendente',
                criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await query`
            CREATE TABLE IF NOT EXISTS despesas (
                id TEXT PRIMARY KEY,
                descricao TEXT NOT NULL,
                categoria TEXT NOT NULL,
                data DATE NOT NULL,
                valor NUMERIC(10, 2) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await query`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id TEXT PRIMARY KEY,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                user_agent TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;

        const countRes = await query`SELECT COUNT(*) as total FROM barbeiros`;
        const totalBarbeiros = parseInt(countRes[0]?.total || '0', 10);

        return res.status(200).json({
            ok: true,
            configured: true,
            message: 'Banco Neon conectado e tabelas sincronizadas.',
            totalBarbeiros
        });
    } catch (error) {
        console.error('Erro no /api/init:', error);
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
}
