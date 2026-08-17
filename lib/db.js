// lib/db.js
// Conexão com Neon PostgreSQL Serverless
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import dns from 'dns';

// Força IPv4 prioritário para evitar timeout de conexão IPv6 em redes locais/Windows
try {
    dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

try {
    dotenv.config({ path: '.env.local' });
    dotenv.config();
} catch (e) {}

// Permite conexões otimizadas em ambientes serverless
const connectionString = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.DATABASE_URL_UNPOOLED || 
    process.env.POSTGRES_URL_NON_POOLING;

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
        return await sqlClient(queryTextOrStrings, values);
    }
    return await sqlClient(queryTextOrStrings, ...values);
}

export const sql = sqlClient;
export default query;
