// lib/authCheck.js
// Utilitário para verificação de segurança e token administrativo
import crypto from 'crypto';

/**
 * Obtém o token esperado com base na senha administrativa do ambiente
 */
export function getExpectedToken() {
    const adminPass = process.env.ADMIN_PASSWORD || 'apolo123';
    return crypto.createHash('sha256').update(adminPass + '_apolo_salt').digest('hex');
}

/**
 * Verifica se a requisição possui um token administrativo válido
 * @param {import('http').IncomingMessage} req 
 * @returns {boolean}
 */
export function verifyAdminAuth(req) {
    const adminPass = process.env.ADMIN_PASSWORD || 'apolo123';
    const expectedToken = getExpectedToken();
    
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || req.headers['x-admin-token'];
    if (!authHeader) return false;

    const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();
    return token === expectedToken || token === adminPass;
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
            error: 'Acesso não autorizado. Faça login com a senha de administrador.' 
        });
        return false;
    }
    return true;
}
