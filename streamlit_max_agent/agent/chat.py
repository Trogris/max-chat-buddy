import streamlit as st
from openai import OpenAI
from typing import List, Dict, Any
from .config import Config
from .rag_store import RAGStore
from .utils import add_message, get_model_info
import os

class MaxChatAgent:
    def __init__(self, rag_store: RAGStore):
        self.client = OpenAI(api_key=Config.OPENAI_API_KEY)
        self.rag_store = rag_store
        self.system_prompt = self._load_system_prompt()
    
    def _load_system_prompt(self) -> str:
        """Carrega o prompt do sistema do Max"""
        try:
            prompt_path = os.path.join("prompts", "system_max.pt.txt")
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            # Fallback se o arquivo não for encontrado
            return """Você é o Max, um assistente de IA especializado e experiente da empresa. 
            Sua função é ajudar funcionários e colaboradores com informações internas, políticas da empresa, 
            procedimentos e suporte geral. Seja profissional, acessível e sempre priorize informações dos 
            documentos internos quando disponíveis."""
    
    def generate_response(self, user_message: str, model: str = None) -> str:
        """Gera resposta usando RAG + OpenAI"""
        if model is None:
            model = st.session_state.current_model
        
        try:
            # Busca contexto relevante nos documentos
            relevant_context = self.rag_store.get_relevant_context(
                user_message, 
                max_tokens=1500
            )
            
            # Monta o prompt com contexto
            context_prompt = f"""
            CONTEXTO DOS DOCUMENTOS INTERNOS:
            {relevant_context}
            
            ---
            
            Com base no contexto acima e em seu conhecimento geral, responda à seguinte pergunta:
            {user_message}
            
            IMPORTANTE: 
            - Priorize sempre as informações do contexto dos documentos internos
            - Se a resposta estiver nos documentos, cite a fonte
            - Se não houver informação relevante nos documentos, indique isso claramente
            - Mantenha o tom profissional e amigável do Max
            """
            
            # Monta as mensagens para a API
            messages = [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": context_prompt}
            ]
            
            # Adiciona histórico recente (últimas 5 mensagens)
            recent_messages = st.session_state.messages[-10:] if len(st.session_state.messages) > 0 else []
            for msg in recent_messages:
                if msg['role'] in ['user', 'assistant']:
                    messages.append({
                        "role": msg['role'], 
                        "content": msg['content'][:500]  # Limita o tamanho
                    })
            
            # Adiciona a mensagem atual do usuário
            messages.append({"role": "user", "content": user_message})
            
            # Chama a API OpenAI
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=Config.MAX_TOKENS,
                temperature=Config.TEMPERATURE
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            error_msg = f"Erro ao gerar resposta: {str(e)}"
            st.error(error_msg)
            return "Desculpe, ocorreu um erro interno. Tente novamente em alguns momentos."
    
    def process_user_input(self, user_input: str, model: str = None):
        """Processa entrada do usuário e gera resposta"""
        if not user_input.strip():
            return
        
        # Adiciona mensagem do usuário
        add_message("user", user_input)
        
        # Gera resposta
        with st.spinner("Max está pensando..."):
            response = self.generate_response(user_input, model)
        
        # Adiciona resposta do assistente
        add_message("assistant", response)
        
        return response

def display_chat_interface(chat_agent: MaxChatAgent):
    """Interface principal do chat"""
    st.header("💬 Chat com Max")
    
    # Informações do modelo atual
    model_info = get_model_info(st.session_state.current_model)
    st.info(f"🤖 **Modelo atual:** {model_info['name']} - {model_info['description']}")
    
    # Container para o chat
    chat_container = st.container()
    
    with chat_container:
        # Exibe mensagens anteriores
        for message in st.session_state.messages:
            with st.chat_message(message["role"]):
                st.write(message["content"])
                if message["role"] == "assistant":
                    st.caption(f"🤖 {model_info['name']} • {message['timestamp'].strftime('%H:%M:%S')}")
                else:
                    st.caption(f"👤 Você • {message['timestamp'].strftime('%H:%M:%S')}")
    
    # Input do usuário
    if user_input := st.chat_input("Digite sua mensagem para o Max..."):
        # Exibe mensagem do usuário imediatamente
        with st.chat_message("user"):
            st.write(user_input)
        
        # Processa e exibe resposta
        response = chat_agent.process_user_input(user_input, st.session_state.current_model)
        
        if response:
            with st.chat_message("assistant"):
                st.write(response)
        
        # Rerun para atualizar o estado
        st.rerun()
    
    # Botões de controle
    st.divider()
    
    col1, col2, col3 = st.columns([1, 1, 2])
    
    with col1:
        if st.button("🗑️ Limpar Chat"):
            st.session_state.messages = []
            st.rerun()
    
    with col2:
        if st.button("📊 Estatísticas"):
            st.session_state.show_stats = not st.session_state.get('show_stats', False)
    
    # Estatísticas (se habilitadas)
    if st.session_state.get('show_stats', False):
        st.subheader("📈 Estatísticas da Sessão")
        
        total_messages = len(st.session_state.messages)
        user_messages = len([m for m in st.session_state.messages if m['role'] == 'user'])
        assistant_messages = len([m for m in st.session_state.messages if m['role'] == 'assistant'])
        
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total de Mensagens", total_messages)
        with col2:
            st.metric("Suas Mensagens", user_messages)
        with col3:
            st.metric("Respostas do Max", assistant_messages)

def display_search_interface(rag_store: RAGStore):
    """Interface para busca de documentos"""
    st.header("🔍 Busca nos Documentos")
    
    # Campo de busca
    search_query = st.text_input(
        "Digite sua busca:",
        placeholder="Ex: política de férias, procedimento de segurança..."
    )
    
    # Configurações de busca
    with st.expander("⚙️ Configurações de Busca"):
        col1, col2 = st.columns(2)
        
        with col1:
            num_results = st.slider("Número de resultados", 1, 10, 5)
        
        with col2:
            show_scores = st.checkbox("Mostrar pontuações de similaridade", False)
    
    if search_query and st.button("🔍 Buscar", type="primary"):
        with st.spinner("Buscando nos documentos..."):
            results = rag_store.search_documents(search_query, k=num_results)
        
        if results:
            st.success(f"✅ Encontrados {len(results)} documentos relevantes")
            
            for i, doc in enumerate(results, 1):
                with st.expander(f"📄 Resultado {i}" + (f" (Score: {doc['similarity_score']:.3f})" if show_scores else "")):
                    st.write(doc['page_content'])
                    
                    # Metadados
                    metadata = doc['metadata']
                    st.divider()
                    
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.caption(f"**Fonte:** {metadata.get('source', 'N/A')}")
                    with col2:
                        st.caption(f"**Tipo:** {metadata.get('file_type', 'N/A')}")
                    with col3:
                        if 'page' in metadata:
                            st.caption(f"**Página:** {metadata['page']}")
        else:
            st.warning("⚠️ Nenhum documento relevante encontrado")
            st.info("💡 Dica: Tente usar palavras-chave diferentes ou mais específicas")
    
    # Estatísticas da base
    stats = rag_store.get_collection_stats()
    
    st.divider()
    st.subheader("📊 Estatísticas da Base de Conhecimento")
    
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Total de Documentos", stats['total_documents'])
    with col2:
        st.metric("Modelo de Embedding", stats['embedding_model'])