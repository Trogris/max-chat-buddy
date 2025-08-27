import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to chunk text with overlap
function chunkText(text: string, chunkSize = 800, overlap = 150): string[] {
  if (!text || text.length <= chunkSize) return [text];
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    // Try to break at sentence boundaries if possible
    if (end < text.length) {
      const lastSentence = chunk.lastIndexOf('.');
      const lastParagraph = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastSentence, lastParagraph);
      
      if (breakPoint > start + chunkSize * 0.7) {
        chunks.push(chunk.slice(0, breakPoint + 1).trim());
        start = start + breakPoint + 1 - overlap;
      } else {
        chunks.push(chunk.trim());
        start = end - overlap;
      }
    } else {
      chunks.push(chunk.trim());
      break;
    }
  }
  
  return chunks.filter(chunk => chunk.length > 10);
}

// Function to extract page number from chunk (for PDFs)
function extractPageNumber(chunk: string): number | null {
  // Look for page markers in Portuguese and English
  const patterns = [
    /— Página (\d+) —/,
    /Page (\d+)/i,
    /Pág\. (\d+)/i,
    /p\. (\d+)/i
  ];
  
  for (const pattern of patterns) {
    const match = chunk.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  return null;
}

// Function to generate embeddings using OpenAI
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embeddings error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    const { document_ids } = await req.json();

    if (!document_ids || !Array.isArray(document_ids)) {
      throw new Error('document_ids deve ser um array');
    }

    console.log(`Iniciando ingestão de ${document_ids.length} documentos`);

    let totalChunks = 0;
    let totalErrors = 0;

    for (const documentId of document_ids) {
      try {
        console.log(`Processando documento: ${documentId}`);

        // Get document from database
        const { data: document, error: docError } = await supabase
          .from('company_documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (docError) {
          console.error(`Erro ao buscar documento ${documentId}:`, docError);
          totalErrors++;
          continue;
        }

        if (!document) {
          console.error(`Documento não encontrado: ${documentId}`);
          totalErrors++;
          continue;
        }

        // Delete existing chunks for this document
        const { error: deleteError } = await supabase
          .from('company_document_chunks')
          .delete()
          .eq('document_id', documentId);

        if (deleteError) {
          console.error(`Erro ao deletar chunks existentes para ${documentId}:`, deleteError);
        }

        // Chunk the document content
        const chunks = chunkText(document.content);
        console.log(`Dividido em ${chunks.length} chunks`);

        // Process chunks in batches
        const batchSize = 10;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const chunkBatch = chunks.slice(i, i + batchSize);
          
          // Generate embeddings for this batch
          const chunkRecords = await Promise.all(
            chunkBatch.map(async (chunk, index) => {
              try {
                const embedding = await generateEmbedding(chunk);
                const pageNumber = document.file_type === '.pdf' ? extractPageNumber(chunk) : null;

                return {
                  document_id: documentId,
                  chunk_index: i + index,
                  content: chunk,
                  embedding: embedding,
                  page: pageNumber,
                  filename: document.filename,
                  path: document.path || null,
                };
              } catch (error) {
                console.error(`Erro ao processar chunk ${i + index}:`, error);
                return null;
              }
            })
          );

          // Filter out failed chunks
          const validChunks = chunkRecords.filter(chunk => chunk !== null);

          if (validChunks.length > 0) {
            // Insert chunks into database
            const { error: insertError } = await supabase
              .from('company_document_chunks')
              .insert(validChunks);

            if (insertError) {
              console.error(`Erro ao inserir chunks:`, insertError);
              totalErrors++;
            } else {
              totalChunks += validChunks.length;
              console.log(`Inseridos ${validChunks.length} chunks do lote ${Math.floor(i / batchSize) + 1}`);
            }
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`Documento ${documentId} processado: ${chunks.length} chunks`);

      } catch (error) {
        console.error(`Erro ao processar documento ${documentId}:`, error);
        totalErrors++;
      }
    }

    const response = {
      success: true,
      message: `Ingestão concluída: ${totalChunks} chunks criados`,
      total_chunks: totalChunks,
      total_errors: totalErrors,
      processed_documents: document_ids.length
    };

    console.log('Resultado da ingestão:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na função ingest-documents:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Erro interno do servidor',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});