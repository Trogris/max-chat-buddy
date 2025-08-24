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

async function getCompanyDocuments() {
  try {
    console.log('Buscando documentos da empresa...');
    const { data, error } = await supabase
      .from('company_documents')
      .select('filename, content')
      .limit(50); // Limit to avoid exceeding token limits

    if (error) {
      console.error('Error fetching documents:', error);
      return 'Nenhum documento da empresa disponível no momento.';
    }

    if (!data || data.length === 0) {
      console.log('Nenhum documento encontrado no banco');
      return 'Nenhum documento da empresa foi carregado ainda. Por favor, peça ao administrador para carregar os documentos oficiais.';
    }

    console.log(`Encontrados ${data.length} documentos:`, data.map(d => d.filename));

    // Format documents for context with better formatting
    const formattedDocs = data.map(doc => 
      `=== DOCUMENTO: ${doc.filename} ===\n${doc.content}\n=== FIM DO DOCUMENTO ===\n`
    ).join('\n');

    const totalChars = formattedDocs.length;
    console.log(`Contexto formatado com ${totalChars} caracteres`);

    return formattedDocs;
  } catch (error) {
    console.error('Error in getCompanyDocuments:', error);
    return 'Erro ao acessar documentos da empresa.';
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key não configurada');
    }

    const { message } = await req.json();

    if (!message) {
      throw new Error('Mensagem é obrigatória');
    }

    console.log('Enviando mensagem para OpenAI:', message);

    // Get company documents for context
    const documentsContext = await getCompanyDocuments();
    console.log('Contexto dos documentos obtido, enviando para OpenAI...');

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

1. Ajudar funcionários com perguntas sobre procedimentos e processos da empresa
2. Fornecer informações baseadas EXCLUSIVAMENTE nos documentos oficiais da Fiscaltech
3. Usar uma linguagem simples, humanizada e voltada ao público interno
4. Responder sempre em português brasileiro
5. Ser cordial, profissional e prestativo

IMPORTANTE: 
- Você só pode responder com base nas informações dos documentos da empresa
- Se não encontrar a informação nos documentos, informe que não possui essa informação
- Sempre mantenha um tom profissional mas amigável
- Cite quando possível a fonte da informação (nome do documento)

Documentos da empresa disponíveis:
${documentsContext}

Se não houver documentos carregados ou se a pergunta não estiver relacionada aos documentos, informe que você precisa de documentos da empresa para fornecer respostas precisas.`
          },
          { role: 'user', content: message }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro na API OpenAI:', response.status, errorData);
      throw new Error(`Erro na API OpenAI: ${response.status}`);
    }

    const data = await response.json();
    console.log('Resposta da OpenAI recebida');
    
    const aiResponse = data.choices[0].message.content;
    const tokensUsed = data.usage?.total_tokens || 0;

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