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
      .slice(0, 3); // Máximo 3 documentos (otimizado para velocidade)

    console.log('Documentos relevantes encontrados:', relevantDocs.map(d => ({ filename: d.filename, score: d.score })));

    if (relevantDocs.length === 0) {
      return `Não encontrei informações específicas sobre "${userQuery}" nos documentos carregados. Os documentos disponíveis são: ${allDocs.map(d => d.filename).join(', ')}. Tente reformular sua pergunta ou seja mais específico.`;
    }

    // Formatar contexto dos documentos mais relevantes (com limite de caracteres)
    const contextDocs = relevantDocs.map(doc => {
      // Limitar cada documento a 3000 caracteres para acelerar o processamento
      const truncatedContent = doc.content.length > 3000 
        ? doc.content.substring(0, 3000) + '\n[... documento truncado para otimizar resposta ...]'
        : doc.content;
      
      return `=== DOCUMENTO: ${doc.filename} (Relevância: ${doc.score}) ===\n${truncatedContent}\n=== FIM DO DOCUMENTO ===\n`;
    }).join('\n');

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

OBJETIVO:
Oferecer suporte confiável, rápido e direto sobre processos, condutas, políticas e normas internas da empresa, com linguagem acolhedora e humanizada.

SAUDAÇÃO PADRÃO:
- Para usuários em geral: "Olá! Eu sou o Max, seu assistente virtual na Fiscaltech. Como posso te ajudar?"
- Para usuários novos: "Você é novo na empresa ou está começando em alguma área específica? Assim eu consigo te orientar melhor 😊"

REGRAS OBRIGATÓRIAS:
1. Use EXCLUSIVAMENTE os documentos oficiais fornecidos abaixo - NUNCA invente informações
2. EM HIPÓTESE ALGUMA forneça links para download de arquivos, mesmo que internos
3. NÃO PODE inventar equipamentos, processos ou exemplos que não estejam explícitos nos documentos
4. NÃO busque referências na internet - toda resposta deve estar amparada por material oficial

LIMITAÇÕES DE RESPOSTA - NÃO RESPONDA SOBRE:
- Salários, bonificações, remuneração
- Decisões de gestão
- Dados externos ou não documentados

SEMPRE QUE POSSÍVEL:
- Indique o nome do documento de origem ou área responsável
- Use linguagem simples, cordial e acessível
- Estimule que o usuário continue a conversa com sugestões úteis
- SEMPRE cite o documento quando usar informação específica

CONTEXTO DOS DOCUMENTOS DA EMPRESA:
${relevantContext}

INSTRUÇÕES TÉCNICAS:
- Responda sempre em português brasileiro
- Substitua $ por S em suas respostas
- Use até 2 emojis quando apropriado
- Seja conciso mas completo (3-6 frases quando possível)
- Se documento tiver problemas técnicos, informe que precisa ser recarregado`;


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
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro na API OpenAI:', response.status, errorData);
      throw new Error(`Erro na API OpenAI: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('Resposta da OpenAI recebida com sucesso');

    // Extrair texto de forma resiliente (modelos novos podem variar o formato)
    const choice = data?.choices?.[0] ?? {};
    const messageContent = choice?.message ?? {};

    function coerceToText(content: any): string {
      if (!content) return '';
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        try {
          return content
            .map((part: any) =>
              typeof part === 'string'
                ? part
                : (part?.text ?? part?.content ?? '')
            )
            .join('')
            .trim();
        } catch (_) {
          return '';
        }
      }
      // Último recurso: stringify seguro
      try {
        return JSON.stringify(content);
      } catch (_) {
        return '';
      }
    }

    let aiResponseText = coerceToText(messageContent.content).trim();

    if (!aiResponseText) {
      console.warn('OpenAI retornou conteúdo vazio. Dump parcial da escolha:',
        JSON.stringify({ finish_reason: choice.finish_reason, messageKeys: Object.keys(messageContent || {}) }).slice(0, 500)
      );
      aiResponseText = 'Não encontrei informações suficientes para responder com precisão agora. Tente reformular a pergunta ou ser mais específico.';
    }

    const tokensUsed = data?.usage?.total_tokens || 0;

    console.log(`Tokens utilizados: ${tokensUsed}`);
    console.log('=== FIM DA CONSULTA ===');

    return new Response(JSON.stringify({
      response: aiResponseText,
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