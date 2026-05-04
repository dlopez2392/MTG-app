-- 008_rules_embeddings.sql
-- Enable pgvector extension and create rules_embeddings table for Ask Harry RAG pipeline

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE rules_embeddings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL,
  source_id text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(source, source_id)
);

CREATE INDEX rules_embeddings_embedding_idx ON rules_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX rules_embeddings_source_idx ON rules_embeddings (source);
CREATE INDEX rules_embeddings_source_id_idx ON rules_embeddings (source_id);

-- Vector similarity search function used by the retrieval pipeline
CREATE OR REPLACE FUNCTION match_rules(
  query_embedding text,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  source text,
  source_id text,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.source,
    r.source_id,
    r.title,
    r.content,
    r.metadata,
    1 - (r.embedding <=> query_embedding::vector) AS similarity
  FROM rules_embeddings r
  WHERE 1 - (r.embedding <=> query_embedding::vector) > match_threshold
  ORDER BY r.embedding <=> query_embedding::vector
  LIMIT match_count;
END;
$$;
