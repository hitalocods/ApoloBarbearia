// scripts/init-db.js
// Script para inicializar o banco de dados Neon e criar tabelas/dados padrão
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function init() {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (!connectionString || connectionString.includes('seu-host-neon.tech')) {
        console.error('❌ ERRO: DATABASE_URL não foi definida ou está com valor de exemplo.');
        console.log('👉 Crie um arquivo .env com sua URL real do Neon PostgreSQL:');
        console.log('   DATABASE_URL="postgresql://usuario:senha@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"\n');
        process.exit(1);
    }

    console.log('⚡ Conectando ao Neon PostgreSQL...');
    const sql = neon(connectionString);

    try {
        console.log('📦 Lendo schema.sql...');
        const schemaPath = path.join(__dirname, '..', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('🚀 Criando tabelas e índices...');
        // Executar comandos DDL
        const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            await sql(statement);
        }
        console.log('✅ Tabelas criadas/verificadas com sucesso!');

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
                        await sql`INSERT INTO horarios (barbeiro_id, dia, ativo, slots) VALUES (${bId}, ${dia}, false, ${slotsVazio}::jsonb)`;
                    } else if (dia === 'sab') {
                        await sql`INSERT INTO horarios (barbeiro_id, dia, ativo, slots) VALUES (${bId}, ${dia}, true, ${slotsSabado}::jsonb)`;
                    } else {
                        await sql`INSERT INTO horarios (barbeiro_id, dia, ativo, slots) VALUES (${bId}, ${dia}, true, ${slotsSemana}::jsonb)`;
                    }
                }
            }

            console.log('✅ Dados padrão (barbeiros, serviços, horários) inseridos com sucesso!');
        } else {
            console.log(`ℹ️ Banco já possui ${count} barbeiro(s) cadastrado(s). Pulando seed.`);
        }

        console.log('\n🎉 Banco Neon PostgreSQL pronto para uso!');
    } catch (err) {
        console.error('❌ Erro durante a inicialização do banco:', err);
        process.exit(1);
    }
}

init();
