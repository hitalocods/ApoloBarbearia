// scripts/init-db.js
// Script para inicializar o banco de dados Neon e criar tabelas/dados padrão
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback para .env

async function init() {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (!connectionString || connectionString.includes('seu-host-neon.tech')) {
        console.error('❌ ERRO: DATABASE_URL não foi definida ou está com valor de exemplo.');
        console.log('👉 Crie um arquivo .env.local com sua URL real do Neon PostgreSQL:');
        console.log('   DATABASE_URL="postgresql://usuario:senha@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"\n');
        process.exit(1);
    }

    console.log('⚡ Conectando ao Neon PostgreSQL...');
    const sql = neon(connectionString);

    try {
        console.log('🚀 Criando tabelas e índices...');
        
        // 1. Barbeiros
        await sql`
            CREATE TABLE IF NOT EXISTS barbeiros (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                especialidade TEXT,
                whatsapp TEXT NOT NULL,
                foto TEXT,
                comissao_pct NUMERIC(5, 2) DEFAULT 40.00,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await sql`ALTER TABLE barbeiros ADD COLUMN IF NOT EXISTS comissao_pct NUMERIC(5, 2) DEFAULT 40.00;`;

        // 2. Serviços
        await sql`
            CREATE TABLE IF NOT EXISTS servicos (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                duracao INTEGER NOT NULL,
                preco NUMERIC(10, 2) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 3. Horários
        await sql`
            CREATE TABLE IF NOT EXISTS horarios (
                barbeiro_id TEXT NOT NULL REFERENCES barbeiros(id) ON DELETE CASCADE,
                dia TEXT NOT NULL,
                ativo BOOLEAN NOT NULL DEFAULT true,
                slots JSONB NOT NULL DEFAULT '[]'::jsonb,
                PRIMARY KEY (barbeiro_id, dia)
            );
        `;

        // 4. Agendamentos
        await sql`
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

        // 5. Despesas
        await sql`
            CREATE TABLE IF NOT EXISTS despesas (
                id TEXT PRIMARY KEY,
                descricao TEXT NOT NULL,
                categoria TEXT NOT NULL,
                data DATE NOT NULL,
                valor NUMERIC(10, 2) NOT NULL,
                observacao TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await sql`ALTER TABLE despesas ADD COLUMN IF NOT EXISTS observacao TEXT;`;

        // 6. Entradas (Manuais / Retroativas)
        await sql`
            CREATE TABLE IF NOT EXISTS entradas (
                id TEXT PRIMARY KEY,
                descricao TEXT NOT NULL,
                valor NUMERIC(10, 2) NOT NULL,
                data DATE NOT NULL,
                barbeiro_id TEXT REFERENCES barbeiros(id) ON DELETE SET NULL,
                servico_id TEXT REFERENCES servicos(id) ON DELETE SET NULL,
                cliente_nome TEXT,
                agendamento_id TEXT REFERENCES agendamentos(id) ON DELETE SET NULL,
                observacao TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 7. Pagamentos de Comissão
        await sql`
            CREATE TABLE IF NOT EXISTS pagamentos_comissao (
                id TEXT PRIMARY KEY,
                barbeiro_id TEXT REFERENCES barbeiros(id) ON DELETE CASCADE,
                valor NUMERIC(10, 2) NOT NULL,
                data_pagamento DATE NOT NULL,
                periodo_inicio DATE NOT NULL,
                periodo_fim DATE NOT NULL,
                observacao TEXT,
                status TEXT NOT NULL DEFAULT 'pago',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // Índices
        await sql`CREATE INDEX IF NOT EXISTS idx_agendamentos_data_hora ON agendamentos(data, hora);`;
        await sql`CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro ON agendamentos(barbeiro_id);`;
        await sql`CREATE INDEX IF NOT EXISTS idx_horarios_barbeiro ON horarios(barbeiro_id);`;
        await sql`CREATE INDEX IF NOT EXISTS idx_despesas_data ON despesas(data);`;
        await sql`CREATE INDEX IF NOT EXISTS idx_entradas_data ON entradas(data);`;
        await sql`CREATE INDEX IF NOT EXISTS idx_pagamentos_comissao_barbeiro ON pagamentos_comissao(barbeiro_id);`;

        console.log('✅ Tabelas e colunas criadas/verificadas com sucesso!');

        // Verificar se existem barbeiros
        const barbeirosExistentes = await sql`SELECT COUNT(*) as total FROM barbeiros`;
        const count = parseInt(barbeirosExistentes[0]?.total || '0', 10);

        if (count === 0) {
            console.log('🌱 Inserindo dados iniciais (Seed)...');

            const b1 = 'b1_' + Date.now().toString(36);
            const b2 = 'b2_' + Date.now().toString(36);
            const b3 = 'b3_' + Date.now().toString(36);

            await sql`
                INSERT INTO barbeiros (id, nome, especialidade, whatsapp) VALUES
                (${b1}, 'Marcus Ferreira', 'Degradê e barba na navalha', '86999990001'),
                (${b2}, 'Renê Costa', 'Corte clássico e social', '86999990002'),
                (${b3}, 'Igor Lima', 'Barba desenhada e platinado', '86999990003')
            `;

            const s1 = 's1_' + Date.now().toString(36);
            const s2 = 's2_' + Date.now().toString(36);
            const s3 = 's3_' + Date.now().toString(36);
            const s4 = 's4_' + Date.now().toString(36);

            await sql`
                INSERT INTO servicos (id, nome, duracao, preco) VALUES
                (${s1}, 'Corte clássico', 30, 35.00),
                (${s2}, 'Corte + Barba', 50, 60.00),
                (${s3}, 'Barba na navalha', 25, 30.00),
                (${s4}, 'Platinado', 90, 120.00)
            `;

            // Gerar slots padrão
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

            for (const bId of [b1, b2, b3]) {
                for (const dia of weekdays) {
                    if (dia === 'dom') {
                        await sql`INSERT INTO horarios (barbeiro_id, dia, ativo, slots) VALUES (${bId}, ${dia}, false, ${slotsVazio}::jsonb) ON CONFLICT DO NOTHING`;
                    } else if (dia === 'sab') {
                        await sql`INSERT INTO horarios (barbeiro_id, dia, ativo, slots) VALUES (${bId}, ${dia}, true, ${slotsSabado}::jsonb) ON CONFLICT DO NOTHING`;
                    } else {
                        await sql`INSERT INTO horarios (barbeiro_id, dia, ativo, slots) VALUES (${bId}, ${dia}, true, ${slotsSemana}::jsonb) ON CONFLICT DO NOTHING`;
                    }
                }
            }

            console.log('✅ Dados padrão (barbeiros, serviços, horários) inseridos com sucesso!');
        } else {
            console.log(`ℹ️ Banco já possui ${count} barbeiro(s) cadastrado(s).`);
        }

        console.log('\n🎉 Banco Neon PostgreSQL pronto para uso!');
    } catch (err) {
        console.error('❌ Erro durante a inicialização do banco:', err);
        process.exit(1);
    }
}

init();
