// api/auth.js
// Endpoint de autenticação para o Painel Administrativo
import { verifyAdminAuth, getExpectedToken } from '../lib/authCheck.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'GET') {
            const isValid = verifyAdminAuth(req);
            return res.status(200).json({ ok: true, authenticated: isValid });
        }

        if (req.method === 'POST') {
            const { password } = req.body || {};
            const adminPass = process.env.ADMIN_PASSWORD || 'apolo123';

            if (!password) {
                return res.status(400).json({ ok: false, error: 'Senha não fornecida.' });
            }

            if (String(password).trim() === String(adminPass).trim()) {
                const token = getExpectedToken();
                return res.status(200).json({ 
                    ok: true, 
                    token, 
                    message: 'Login realizado com sucesso!' 
                });
            } else {
                return res.status(401).json({ ok: false, error: 'Senha incorreta.' });
            }
        }

        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('Erro em /api/auth:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
