# 🚀 Guia de Configuração: Neon PostgreSQL + Vercel Blob

Este guia explica o passo a passo completo para conectar o projeto **Apolo Barbearia** ao banco de dados **Neon (PostgreSQL Serverless)** e ao **Vercel Blob** (armazenamento de fotos e mídias na nuvem).

---

## 📌 Sumário
1. [Criar Banco no Neon PostgreSQL](#1-criar-banco-no-neon-postgresql)
2. [Criar Vercel Blob Storage](#2-criar-vercel-blob-storage)
3. [Configurar Variáveis de Ambiente](#3-configurar-variáveis-de-ambiente)
4. [Inicializar Tabelas e Dados Iniciais](#4-inicializar-tabelas-e-dados-iniciais)
5. [Deploy e Execução](#5-deploy-e-execução)

---

## 1. Criar Banco no Neon PostgreSQL

1. Acesse **[neon.tech](https://neon.tech)** e faça login ou crie sua conta gratuita.
2. Clique em **"New Project"** (Novo Projeto).
3. Defina o nome do projeto (ex: `apolo-barbearia`) e escolha a região mais próxima (ex: `US East (Ohio)` ou `US East (N. Virginia)`).
4. Ao concluir, o Neon exibirá sua **Connection String** no formato:
   ```text
   postgresql://neondb_owner:SENHA_SECRETA@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Copie essa URL completa (ela é sua `DATABASE_URL`).

---

## 2. Criar Vercel Blob Storage

1. Acesse o **[Painel da Vercel](https://vercel.com/dashboard)**.
2. No menu superior, clique na aba **Storage**.
3. Clique em **"Create Database"** ou **"Create Store"** e selecione a opção **Blob**.
4. Defina o nome do store (ex: `apolo-barbearia-blob`) e clique em **Create**.
5. Na tela do Blob recém-criado, clique em **".env.local"** ou **"Quickstart"** e copie a chave:
   ```text
   BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```

---

## 3. Configurar Variáveis de Ambiente

### A. Para Desenvolvimento Local (no seu computador):
1. No diretório raiz do projeto, crie um arquivo chamado `.env` (ou duplique o `.env.example`).
2. Cole suas credenciais:
   ```env
   DATABASE_URL="postgresql://usuario:senha@seu-host-neon.tech/neondb?sslmode=require"
   BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxxxxxxxxxxxxxxxxxxxxxxx"
   ADMIN_PASSWORD="apolo123"
   ```

### B. Na Vercel (Produção):
1. No seu projeto na Vercel, acesse **Settings** → **Environment Variables**.
2. Adicione as duas variáveis:
   - **`DATABASE_URL`**: com a connection string do Neon.
   - **`BLOB_READ_WRITE_TOKEN`**: com o token do Vercel Blob *(se você vinculou o Storage diretamente ao projeto pela Vercel, essa variável já é adicionada automaticamente)*.
3. Salve as alterações.

---

## 4. Inicializar Tabelas e Dados Iniciais

O projeto possui criação automática de tabelas, mas você pode executar a migração e inserção de dados iniciais a qualquer momento:

### Opção 1: Via Terminal (Linha de comando)
Com o arquivo `.env` configurado, execute:
```bash
npm run init-db
```
Isso criará:
- Tabelas: `barbeiros`, `servicos`, `horarios`, `agendamentos`, `despesas`.
- Índices de performance para consultas instantâneas.
- Os 3 barbeiros iniciais com seus horários padrão e serviços.

### Opção 2: Automático via Nuvem
Ao abrir a aplicação na Vercel com as variáveis configuradas, o sistema automaticamente verifica e inicializa as tabelas se necessário.

---

## 5. Deploy e Execução

### Como rodar localmente com a Vercel CLI:
```bash
npx vercel dev
```
Abra `http://localhost:3000` no seu navegador.

### Como publicar na Vercel:
Se o seu projeto estiver conectado a um repositório Git (GitHub/GitLab):
1. Faça o commit e push:
   ```bash
   git add .
   git commit -m "feat: integracao neon postgresql e vercel blob"
   git push origin main
   ```
2. A Vercel fará o build e deploy automaticamente com todas as rotas serverless ativas em `/api/*`.

---

## 📊 Indicadores no Painel Administrativo

Ao acessar o Painel Admin (senha padrão `apolo123`), você verá no rodapé da barra lateral:
- 🟢 **Neon DB: Conectado**: O sistema está salvando e lendo dados diretamente do PostgreSQL na nuvem.
- 🟢 **Vercel Blob: Ativo**: As fotos dos barbeiros estão sendo enviadas e hospedadas diretamente na CDN da Vercel.
- 🟡 **Modo Demo / Local**: Caso as variáveis ainda não tenham sido configuradas, o sistema funciona em modo de demonstração local seguro sem travar.
