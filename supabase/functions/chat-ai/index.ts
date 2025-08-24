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

// Função para buscar documentos relevantes baseado na consulta do usuário
async function searchRelevantDocuments(userQuery: string) {
  try {
    console.log('Iniciando busca por documentos relevantes para:', userQuery);
    
    // Buscar todos os documentos
    const { data: allDocs, error } = await supabase
      .from('company_documents')
      .select('id, filename, content')
      .limit(100);

    if (error) {
      console.error('Erro ao buscar documentos:', error);
      return 'Nenhum documento encontrado.';
    }

    if (!allDocs || allDocs.length === 0) {
      console.log('Nenhum documento no banco de dados');
      return 'Nenhum documento da empresa foi carregado. Por favor, peça ao administrador para carregar os documentos oficiais.';
    }

    console.log(`Encontrados ${allDocs.length} documentos para análise`);

    // Palavras-chave da consulta do usuário
    const queryWords = userQuery.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['que', 'como', 'para', 'por', 'com', 'sem', 'sob', 'sobre', 'qual', 'onde', 'quando', 'fale', 'me', 'do', 'da', 'de', 'em', 'no', 'na'].includes(word));

    console.log('Palavras-chave extraídas:', queryWords);

    // Calcular relevância de cada documento
    const docsWithScore = allDocs.map(doc => {
      const content = doc.content.toLowerCase();
      let score = 0;
      
      // Contagem de palavras-chave encontradas
      queryWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = content.match(regex) || [];
        score += matches.length * 10; // Peso para correspondências exatas
        
        // Busca por palavras parciais (maior flexibilidade)
        if (content.includes(word)) {
          score += 5;
        }
      });

      return { ...doc, score };
    });

    // Ordenar por relevância e pegar os mais relevantes
    const relevantDocs = docsWithScore
      .filter(doc => doc.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Máximo 5 documentos

    console.log('Documentos relevantes encontrados:', relevantDocs.map(d => ({ filename: d.filename, score: d.score })));

    if (relevantDocs.length === 0) {
      return `Não encontrei informações específicas sobre "${userQuery}" nos documentos carregados. Os documentos disponíveis são: ${allDocs.map(d => d.filename).join(', ')}. Tente reformular sua pergunta ou seja mais específico.`;
    }

    // Formatar contexto dos documentos mais relevantes
    const contextDocs = relevantDocs.map(doc => 
      `=== DOCUMENTO: ${doc.filename} (Relevância: ${doc.score}) ===\n${doc.content}\n=== FIM DO DOCUMENTO ===\n`
    ).join('\n');

    console.log(`Contexto preparado com ${contextDocs.length} caracteres de ${relevantDocs.length} documentos`);
    
    return contextDocs;
  } catch (error) {
    console.error('Erro na busca de documentos:', error);
    return 'Erro ao processar documentos da empresa.';
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY não configurada');
      throw new Error('OpenAI API key não configurada');
    }

    const requestBody = await req.json();
    const { message } = requestBody;

    if (!message) {
      throw new Error('Mensagem é obrigatória');
    }

    console.log('=== NOVA CONSULTA ===');
    console.log('Mensagem recebida:', message);

    // Buscar documentos relevantes usando RAG
    const relevantContext = await searchRelevantDocuments(message);

    console.log('Enviando consulta para OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: `Você é o MAX, assistente virtual da Fiscaltech. Sua função é:

1. Ajudar funcionários com perguntas sobre procedimentos, produtos e processos da empresa
2. Fornecer informações baseadas EXCLUSIVAMENTE nos documentos oficiais da Fiscaltech
3. Usar linguagem simples, humanizada e voltada ao público interno
4. Responder sempre em português brasileiro
5. Ser cordial, profissional e prestativo

INSTRUÇÕES CRÍTICAS:
- Use APENAS as informações dos documentos fornecidos abaixo
- Se não encontrar informação específica, diga claramente que não possui essa informação
- Cite sempre o nome do documento quando fornecer informações
- Seja específico e detalhado nas respostas técnicas
- Se a pergunta não estiver relacionada aos documentos, redirecione educadamente

CONTEXTO DOS DOCUMENTOS DA EMPRESA:
${relevantContext}

Responda com base nessas informações oficiais da Fiscaltech.`
          },
          { 
            role: 'user', 
            content: message 
          }
        ],
        max_completion_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro na API OpenAI:', response.status, errorData);
      throw new Error(`Erro na API OpenAI: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('Resposta da OpenAI recebida com sucesso');
    
    const aiResponse = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 0;

    console.log(`Tokens utilizados: ${tokensUsed}`);
    console.log('=== FIM DA CONSULTA ===');

    return new Response(JSON.stringify({ 
      response: aiResponse,
      tokens: tokensUsed 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na função chat-ai:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Erro interno do servidor' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});