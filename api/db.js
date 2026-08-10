// api/db.js
// Conexão com Neon PostgreSQL Serverless
import { neon, neonConfig } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

// Permite conexões otimizadas em ambientes serverless
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export const isDbConfigured = Boolean(connectionString && !connectionString.includes('seu-host-neon.tech'));

let sqlClient = null;

if (isDbConfigured) {
    try {
        sqlClient = neon(connectionString);
    } catch (err) {
        console.error('Erro ao inicializar cliente Neon:', err);
    }
}

/**
 * Executa uma query SQL no Neon
 * @param {string|TemplateStringsArray} queryTextOrStrings 
 * @param  {...any} values 
 */
export async function query(queryTextOrStrings, ...values) {
    if (!isDbConfigured || !sqlClient) {
        throw new Error('DATABASE_URL não configurada no ambiente. Configure a variável no painel da Vercel ou no arquivo .env.');
    }
    
    if (typeof queryTextOrStrings === 'string') {
        // Execução tradicional com texto e parâmetros
        return await sqlClient(queryTextOrStrings, values);
    }
    // Tagged template literal
    return await sqlClient(queryTextOrStrings, ...values);
}

export const sql = sqlClient;
export default query;
