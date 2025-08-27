-- Adicionar campos necessários para tracking de performance na tabela usage_stats
ALTER TABLE public.usage_stats 
ADD COLUMN IF NOT EXISTS response_time_ms integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS error_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS success_rate numeric(5,2) DEFAULT 0.0;