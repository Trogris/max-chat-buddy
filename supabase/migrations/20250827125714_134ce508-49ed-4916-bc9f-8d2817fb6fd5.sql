-- Permitir que usuários atualizem suas próprias estatísticas de uso
CREATE POLICY "Users can update their own stats"
ON public.usage_stats
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);