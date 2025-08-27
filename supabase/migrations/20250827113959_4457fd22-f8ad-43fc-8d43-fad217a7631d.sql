
-- 1) Habilitar a extensão pgvector no schema "extensions"
create extension if not exists vector with schema extensions;

-- 2) Garantir que a coluna embedding tenha o tipo correto (extensions.vector(1536))
-- Observação: usamos USING NULL::extensions.vector para evitar problemas de cast,
-- pois atualmente não há embeddings válidos salvos (as inserções falharam).
alter table public.company_document_chunks
  alter column embedding type extensions.vector(1536)
  using NULL::extensions.vector;

-- 3) Índice HNSW para acelerar similaridade (cosine)
-- Se já existir, o IF NOT EXISTS evita erro.
create index if not exists company_document_chunks_embedding_hnsw
  on public.company_document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);
