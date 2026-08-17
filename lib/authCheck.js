// lib/authCheck.js
// Utilitário para verificação de segurança e token administrativo/barbeiros
import crypto from 'crypto';
import { query, isDbConfigured } from './db.js';

/**
 * Obtém o token esperado com base na senha administrativa do ambiente
 */
export function getExpectedToken() {
    const adminPass = process.env.ADMIN_PASSWORD || 'apolo123';
    return crypto.createHash('sha256').update(adminPass + '_apolo_salt').digest('hex');
}

/**
 * Gera token seguro para um barbeiro específico
 */
export function getBarberToken(barberId, senha = '') {
    const salt = process.env.ADMIN_PASSWORD || 'apolo_barber_salt';
    const hash = crypto.createHash('sha256').update(`${barberId}_${senha}_${salt}`).digest('hex');
    return `barb_${barberId}_${hash.slice(0, 32)}`;
}

/**
 * Extrai o token do cabeçalho da requisição
 */
export function extractToken(req) {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || req.headers['x-admin-token'];
    if (!authHeader) return null;
    return String(authHeader).replace(/^Bearer\s+/i, '').trim();
}

/**
 * Verifica se a requisição possui um token administrativo de Master/Apolo
 * @param {import('http').IncomingMessage} req 
 * @returns {boolean}
 */
export function verifyAdminAuth(req) {
    const adminPass = process.env.ADMIN_PASSWORD || 'apolo123';
    const expectedToken = getExpectedToken();
    const token = extractToken(req);
    if (!token) return false;

    return token === expectedToken || token === adminPass;
}

/**
 * Verifica se a requisição é autenticada (seja como Admin ou como Barbeiro)
 * @param {import('http').IncomingMessage} req 
 * @returns {Promise<{ isValid: boolean, role?: 'admin' | 'barbeiro', barbeiroId?: string }>}
 */
export async function verifyAuth(req) {
    if (verifyAdminAuth(req)) {
        return { isValid: true, role: 'admin' };
    }

    const token = extractToken(req);
    if (!token) return { isValid: false };

    if (token.startsWith('barb_')) {
        const parts = token.split('_');
        if (parts.length >= 3) {
            const barbeiroId = parts.slice(1, -1).join('_');
            if (isDbConfigured) {
                try {
                    const rows = await query`SELECT id, senha FROM barbeiros WHERE id = ${barbeiroId}`;
                    if (rows && rows.length > 0) {
                        const expected = getBarberToken(barbeiroId, rows[0].senha || '');
                        if (token === expected) {
                            return { isValid: true, role: 'barbeiro', barbeiroId };
                        }
                    }
                } catch (e) {
                    console.error('[authCheck] Erro ao validar token de barbeiro:', e);
                }
            } else {
                // Modo offline / sem DB configurado
                return { isValid: true, role: 'barbeiro', barbeiroId };
            }
        }
    }

    return { isValid: false };
}

/**
 * Intercepta e responde 401 caso não seja um admin autorizado
 * @param {import('http').IncomingMessage} req 
 * @param {import('http').ServerResponse} res 
 * @returns {boolean} True se autorizado, False se bloqueado
 */
export function requireAdminAuth(req, res) {
    if (!verifyAdminAuth(req)) {
        res.status(401).json({ 
            ok: false, 
            error: 'Acesso restrito. Requer permissão de administrador.' 
        });
        return false;
    }
    return true;
}

/**
 * Intercepta e responde 401 caso não esteja autenticado (nem Admin nem Barbeiro)
 * @param {import('http').IncomingMessage} req 
 * @param {import('http').ServerResponse} res 
 * @returns {Promise<{ isValid: boolean, role?: 'admin' | 'barbeiro', barbeiroId?: string } | false>}
 */
export async function requireAnyAuth(req, res) {
    const auth = await verifyAuth(req);
    if (!auth.isValid) {
        res.status(401).json({ 
            ok: false, 
            error: 'Acesso não autorizado. Faça login para continuar.' 
        });
        return false;
    }
    return auth;
}
