-- ================================================================
-- EVENT APP - SCRIPT DE CRIAÇÃO DO BANCO DE DADOS (SUPABASE SQL)
-- Copie e cole este código no SQL Editor do seu projeto Supabase
-- ================================================================

-- 1. Criação da tabela de Eventos
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    date TEXT,
    location TEXT,
    price NUMERIC(10,2) DEFAULT 0.00,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Criação da tabela de Redes (cadastradas pelo usuário/administrador)
CREATE TABLE IF NOT EXISTS public.networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Criação da tabela de Discipuladores (cadastrados pelo usuário/administrador)
CREATE TABLE IF NOT EXISTS public.disciplers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Criação da tabela de Inscrições
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL,
    name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    network TEXT NOT NULL,         -- Selecionado da lista de redes
    leader TEXT,                   -- Livre / Pode ficar em branco
    discipler TEXT NOT NULL,       -- Selecionado da lista de discipuladores
    payment_method TEXT NOT NULL,  -- Forma de pagamento (PIX, Cartão, Dinheiro)
    payment_status TEXT DEFAULT 'Pendente', -- Pendente, Pago, Confirmado
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para buscas rápidas e filtros
CREATE INDEX IF NOT EXISTS idx_registrations_network ON public.registrations(network);
CREATE INDEX IF NOT EXISTS idx_registrations_leader ON public.registrations(leader);
CREATE INDEX IF NOT EXISTS idx_registrations_discipler ON public.registrations(discipler);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_method ON public.registrations(payment_method);
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON public.registrations(event_id);

-- 5. Habilitação de Segurança (Row Level Security)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Políticas para Eventos
CREATE POLICY "Leitura pública de eventos" ON public.events FOR SELECT USING (true);
CREATE POLICY "Gestão de eventos" ON public.events FOR ALL USING (true) WITH CHECK (true);

-- Políticas para Redes
CREATE POLICY "Leitura pública de redes" ON public.networks FOR SELECT USING (true);
CREATE POLICY "Gestão de redes" ON public.networks FOR ALL USING (true) WITH CHECK (true);

-- Políticas para Discipuladores
CREATE POLICY "Leitura pública de discipuladores" ON public.disciplers FOR SELECT USING (true);
CREATE POLICY "Gestão de discipuladores" ON public.disciplers FOR ALL USING (true) WITH CHECK (true);

-- Políticas para Inscrições
CREATE POLICY "Permitir criação de inscrições" ON public.registrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir leitura de inscrições" ON public.registrations FOR SELECT USING (true);
CREATE POLICY "Permitir atualização de inscrições" ON public.registrations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Permitir exclusão de inscrições" ON public.registrations FOR DELETE USING (true);

-- 6. Dados Iniciais de Exemplo (Opcional - podem ser editados no app)
INSERT INTO public.events (name, date, location, price, active)
VALUES 
  ('Conferência do Reino 2026', '14 a 16 de Novembro', 'Auditório Principal', 80.00, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.networks (name) VALUES 
  ('Jovens'),
  ('Teens'),
  ('Casais'),
  ('Mulheres'),
  ('Homens'),
  ('Kids')
ON CONFLICT DO NOTHING;

INSERT INTO public.disciplers (name) VALUES 
  ('Pastor Marcos'),
  ('Pastora Helena'),
  ('Diácono Carlos'),
  ('Líder Mariana')
ON CONFLICT DO NOTHING;
