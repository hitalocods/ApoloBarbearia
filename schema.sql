-- ============================================================
-- SCHEMA NEON POSTGRESQL — APOLO BARBEARIA
-- ============================================================

-- 1. BARBEIROS
CREATE TABLE IF NOT EXISTS barbeiros (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    especialidade TEXT,
    whatsapp TEXT NOT NULL,
    foto TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. SERVIÇOS
CREATE TABLE IF NOT EXISTS servicos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    duracao INTEGER NOT NULL, -- Duração em minutos
    preco NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. HORÁRIOS DE ATENDIMENTO (Por barbeiro e dia da semana)
-- dias: dom, seg, ter, qua, qui, sex, sab
CREATE TABLE IF NOT EXISTS horarios (
    barbeiro_id TEXT NOT NULL REFERENCES barbeiros(id) ON DELETE CASCADE,
    dia TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    slots JSONB NOT NULL DEFAULT '[]'::jsonb,
    PRIMARY KEY (barbeiro_id, dia)
);

-- 4. AGENDAMENTOS
CREATE TABLE IF NOT EXISTS agendamentos (
    id TEXT PRIMARY KEY,
    barbeiro_id TEXT REFERENCES barbeiros(id) ON DELETE SET NULL,
    servico_id TEXT REFERENCES servicos(id) ON DELETE SET NULL,
    data DATE NOT NULL,
    hora TEXT NOT NULL,
    nome TEXT NOT NULL,
    tel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente', -- pendente, concluido, cancelado
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. DESPESAS / FLUXO DE CAIXA
CREATE TABLE IF NOT EXISTS despesas (
    id TEXT PRIMARY KEY,
    descricao TEXT NOT NULL,
    categoria TEXT NOT NULL,
    data DATE NOT NULL,
    valor NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES PARA ALTA PERFORMANCE DE CONSULTA
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_hora ON agendamentos(data, hora);
CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro ON agendamentos(barbeiro_id);
CREATE INDEX IF NOT EXISTS idx_horarios_barbeiro ON horarios(barbeiro_id);
CREATE INDEX IF NOT EXISTS idx_despesas_data ON despesas(data);
