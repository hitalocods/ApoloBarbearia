// api/auth.js
// Endpoint de autenticação para o Painel Administrativo e Acesso de Barbeiros
import { verifyAdminAuth, getExpectedToken, getBarberToken, verifyAuth } from '../lib/authCheck.js';
import { query, isDbConfigured } from '../lib/db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'GET') {
            const auth = await verifyAuth(req);
            return res.status(200).json({ 
                ok: true, 
                authenticated: Boolean(auth.isValid),
                role: auth.role || null,
                barbeiroId: auth.barbeiroId || null
            });
        }

        if (req.method === 'POST') {
            const { password, barbeiroId } = req.body || {};
            const adminPass = process.env.ADMIN_PASSWORD || 'apolo123';

            if (!password) {
                return res.status(400).json({ ok: false, error: 'Senha não fornecida.' });
            }

            const cleanPass = String(password).trim();

            // 1. Verificar se é a senha Master do Apolo
            if (cleanPass === String(adminPass).trim()) {
                const token = getExpectedToken();
                return res.status(200).json({ 
                    ok: true, 
                    role: 'admin',
                    token, 
                    message: 'Login de administrador realizado com sucesso!' 
                });
            }

            // 2. Verificar se é a senha de um Barbeiro
            if (isDbConfigured) {
                try {
                    let barbeiros = [];
                    if (barbeiroId) {
                        barbeiros = await query`SELECT id, nome, especialidade, whatsapp, foto, senha, comissao_pct as "comissaoPct" FROM barbeiros WHERE id = ${barbeiroId}`;
                    } else {
                        barbeiros = await query`SELECT id, nome, especialidade, whatsapp, foto, senha, comissao_pct as "comissaoPct" FROM barbeiros`;
                    }

                    const normalizeStr = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                    const cleanPassNorm = normalizeStr(cleanPass);

                    // Encontrar o barbeiro correspondente
                    const matchedBarber = barbeiros.find(b => {
                        const savedPass = (b.senha || '').trim();
                        if (savedPass) {
                            return savedPass === cleanPass || normalizeStr(savedPass) === cleanPassNorm;
                        }
                        // Se o barbeiro for o Alemão e a senha digitada for 'alemao' ou 'alemão'
                        if (normalizeStr(b.nome).includes('alemao') && (cleanPassNorm === 'alemao' || cleanPass === '1234')) {
                            return true;
                        }
                        // Se não tem senha definida ainda, permitir 4 últimos dígitos do WhatsApp ou '1234'
                        const lastDigits = (b.whatsapp || '').replace(/\D/g, '').slice(-4);
                        return cleanPass === '1234' || (lastDigits && cleanPass === lastDigits);
                    });

                    if (matchedBarber) {
                        const token = getBarberToken(matchedBarber.id, matchedBarber.senha || '');
                        return res.status(200).json({
                            ok: true,
                            role: 'barbeiro',
                            barbeiro: {
                                id: matchedBarber.id,
                                nome: matchedBarber.nome,
                                especialidade: matchedBarber.especialidade,
                                whatsapp: matchedBarber.whatsapp,
                                foto: matchedBarber.foto
                            },
                            token,
                            message: `Bem-vindo(a), ${matchedBarber.nome}!`
                        });
                    }
                } catch (dbErr) {
                    console.error('[Auth] Erro ao consultar barbeiros:', dbErr);
                }
            }

            return res.status(401).json({ ok: false, error: 'Senha incorreta ou usuário não encontrado.' });
        }

        return res.status(405).json({ error: 'Método não permitido.' });
    } catch (error) {
        console.error('Erro em /api/auth:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
