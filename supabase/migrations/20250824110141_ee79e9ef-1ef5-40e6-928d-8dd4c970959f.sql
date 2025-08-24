-- Adicionar coluna de área/departamento à tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN area text DEFAULT 'Não informado';

-- Adicionar coluna para rastrear área específica nos usage_stats  
ALTER TABLE public.usage_stats
ADD COLUMN area text;

-- Criar índice para melhorar performance das consultas por área
CREATE INDEX idx_profiles_area ON public.profiles(area);
CREATE INDEX idx_usage_stats_area ON public.usage_stats(area);

-- Atualizar alguns perfis de exemplo com áreas (opcional para teste)
UPDATE public.profiles SET area = 'Fiscal' WHERE role = 'admin';
UPDATE public.profiles SET area = 'Contabilidade' WHERE area = 'Não informado' AND created_at < now() - interval '1 day';
UPDATE public.profiles SET area = 'Recursos Humanos' WHERE area = 'Não informado' AND created_at >= now() - interval '1 day';