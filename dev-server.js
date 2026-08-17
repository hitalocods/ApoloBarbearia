// dev-server.js - Servidor de desenvolvimento local com suporte a arquivos estáticos e /api/*
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import dns from 'dns';
import dotenv from 'dotenv';

try {
    dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

dotenv.config({ path: '.env.local' });
dotenv.config();

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
    const fullUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = fullUrl.pathname;

    // Rota API
    if (pathname.startsWith('/api/')) {
        const REWRITES = {
            'barbeiros': 'equipe',
            'servicos': 'equipe',
            'horarios': 'equipe',
            'despesas': 'financeiro',
            'entradas': 'financeiro',
            'comissoes': 'financeiro'
        };
        const rawRoute = pathname.replace('/api/', '').split('/')[0];
        const routeName = REWRITES[rawRoute] || rawRoute;
        const apiFilePath = path.join(process.cwd(), 'api', `${routeName}.js`);

        if (fs.existsSync(apiFilePath)) {
            try {
                // Parsing body
                let body = '';
                for await (const chunk of req) {
                    body += chunk;
                }
                if (body) {
                    try { req.body = JSON.parse(body); } catch (e) { req.body = body; }
                } else {
                    req.body = {};
                }
                req.query = Object.fromEntries(fullUrl.searchParams.entries());

                // Response helper methods
                res.status = function (code) {
                    res.statusCode = code;
                    return res;
                };
                res.json = function (data) {
                    res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    res.end(JSON.stringify(data));
                    return res;
                };

                const module = await import(`${url.pathToFileURL(apiFilePath).href}?t=${Date.now()}`);
                const handler = module.default;
                return await handler(req, res);
            } catch (err) {
                console.error(`Erro ao executar API ${pathname}:`, err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ ok: false, error: err.message }));
            }
        } else {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: false, error: 'Endpoint não encontrado' }));
        }
    }

    // Arquivos estáticos
    let filePath = path.join(process.cwd(), pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(process.cwd(), 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.statusCode = 404;
            res.end('Arquivo não encontrado');
        } else {
            res.statusCode = 200;
            res.setHeader('Content-Type', contentType);
            res.end(content);
        }
    });
});

let currentPort = Number(PORT);

function startServer(port) {
    server.listen(port, () => {
        console.log(`\n💈 Servidor Apolo Barbearia rodando com sucesso!`);
        console.log(`👉 Acesse no navegador: http://localhost:${port}`);
        console.log(`👉 Painel Admin: http://localhost:${port}/admin.html\n`);
    });
}

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Porta ${currentPort} já está em uso. Tentando porta ${currentPort + 1}...`);
        currentPort++;
        startServer(currentPort);
    } else {
        console.error('Erro no servidor:', err);
    }
});

startServer(currentPort);

