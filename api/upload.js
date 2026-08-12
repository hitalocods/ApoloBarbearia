// api/upload.js
// Upload de arquivos e fotos para o Vercel Blob Storage
import { put } from '@vercel/blob';
import dotenv from 'dotenv';
import { requireAdminAuth } from './authCheck.js';

try {
    dotenv.config({ path: '.env.local' });
    dotenv.config();
} catch (e) {}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '8mb',
        },
    },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const isBlobConfigured = Boolean(token && !token.includes('vercel_blob_rw_xxx'));

    // Verificação de status do Blob (GET ou POST com { test: true })
    if (req.method === 'GET' || req.body?.test) {
        return res.status(200).json({
            ok: true,
            configured: isBlobConfigured,
            message: isBlobConfigured 
                ? 'Vercel Blob conectado e pronto para uploads.' 
                : 'BLOB_READ_WRITE_TOKEN não configurada na Vercel.'
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    if (!requireAdminAuth(req, res)) return;

    if (!isBlobConfigured) {
        return res.status(200).json({
            ok: false,
            configured: false,
            message: 'BLOB_READ_WRITE_TOKEN não configurada na Vercel.',
            // Retorna a imagem base64 diretamente para permitir pré-visualização local
            url: req.body?.dataUrl || null
        });
    }

    try {
        const { filename, base64, dataUrl } = req.body || {};

        let imageBuffer;
        let mimeType = 'image/jpeg';
        let safeFilename = filename || `barbeiro-${Date.now()}.jpg`;

        if (dataUrl && dataUrl.startsWith('data:')) {
            const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                mimeType = matches[1];
                imageBuffer = Buffer.from(matches[2], 'base64');
            }
        } else if (base64) {
            imageBuffer = Buffer.from(base64, 'base64');
        }

        if (!imageBuffer) {
            return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
        }

        const ext = mimeType.split('/')[1] || 'jpg';
        if (!safeFilename.includes('.')) {
            safeFilename += `.${ext}`;
        }
        const blobPath = `barbeiros/${Date.now()}-${safeFilename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        // Upload direto para o Vercel Blob
        const blob = await put(blobPath, imageBuffer, {
            access: 'public',
            contentType: mimeType,
            token: token
        });

        return res.status(200).json({
            ok: true,
            configured: true,
            url: blob.url,
            pathname: blob.pathname,
            contentType: blob.contentType
        });
    } catch (error) {
        console.error('Erro no upload para o Vercel Blob:', error);
        return res.status(500).json({
            ok: false,
            error: error.message || 'Falha ao processar upload para o Vercel Blob.'
        });
    }
}
