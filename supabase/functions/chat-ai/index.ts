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
    const { message, conversationHistory = [] } = requestBody;

    if (!message) {
      throw new Error('Mensagem é obrigatória');
    }

    console.log('=== NOVA CONSULTA ===');
    console.log('Mensagem recebida:', message);
    console.log('Histórico de conversação:', conversationHistory.length, 'mensagens');

    // Buscar documentos relevantes usando RAG
    const relevantContext = await searchRelevantDocuments(message);
    console.log('Contexto encontrado, enviando para OpenAI...');

    // Preparar mensagens com histórico e contexto
    const systemPrompt = `Você é o MAX, assistente virtual da Fiscaltech. 

PERSONALIDADE:
- Amigável e prestativo
- Use linguagem simples e humanizada
- Sempre cordial e profissional
- Responda sempre em português brasileiro

FUNÇÃO PRINCIPAL:
- Ajudar funcionários com perguntas sobre produtos, procedimentos e processos da empresa
- Fornecer informações baseadas nos documentos oficiais da Fiscaltech carregados

REGRAS CRÍTICAS:
- Use APENAS as informações dos documentos fornecidos abaixo
- Se não encontrar informação específica nos documentos, diga claramente: "Não encontrei essa informação nos documentos carregados"
- SEMPRE cite o nome do documento quando fornecer informações específicas
- Seja detalhado e específico em respostas técnicas
- Se a pergunta não estiver relacionada aos documentos da empresa, redirecione educadamente

CONTEXTO DOS DOCUMENTOS DA EMPRESA:
${relevantContext}

INSTRUÇÕES ADICIONAIS:
- Sempre que houver $ na sua saída, substitua por S
- Mantenha o contexto da conversa atual
- Se o documento parecer ter problemas (ex: "Just a moment...Enable JavaScript"), informe que o documento precisa ser recarregado`;

    // Construir array de mensagens com histórico
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Adicionar histórico de conversação (limitado às últimas 10 mensagens)
    const recentHistory = conversationHistory.slice(-10);
    messages.push(...recentHistory);

    // Adicionar mensagem atual
    messages.push({ role: 'user', content: message });

    console.log('Enviando', messages.length, 'mensagens para OpenAI (incluindo system + histórico + atual)');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: messages,
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