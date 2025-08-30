import streamlit as st
import os
from agent.config import Config
from agent.utils import init_session_state, get_model_info
from agent.rag_store import RAGStore
from agent.chat import MaxChatAgent, display_chat_interface, display_search_interface
from agent.ingest import display_ingestion_interface

# Configuração da página
st.set_page_config(
    page_title="Max - Assistente IA",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

def main():
    # Título principal
    st.title("🤖 Max - Assistente de IA da Empresa")
    st.markdown("*Seu assistente inteligente para informações internas e suporte*")
    
    # Inicializa estado da sessão
    init_session_state()
    
    # Verifica configuração
    try:
        Config.validate()
    except ValueError as e:
        st.error(f"❌ Erro de configuração: {e}")
        st.info("💡 Configure sua OPENAI_API_KEY no arquivo .env ou nas variáveis de ambiente")
        st.stop()
    
    # Sidebar - Configurações
    with st.sidebar:
        st.header("⚙️ Configurações")
        
        # Seleção do modelo
        st.subheader("🤖 Modelo OpenAI")
        
        selected_model = st.selectbox(
            "Escolha o modelo:",
            options=Config.AVAILABLE_MODELS,
            index=Config.AVAILABLE_MODELS.index(st.session_state.current_model) 
                if st.session_state.current_model in Config.AVAILABLE_MODELS 
                else 0,
            help="Selecione o modelo OpenAI para usar nas conversas"
        )
        
        # Atualiza modelo se mudou
        if selected_model != st.session_state.current_model:
            st.session_state.current_model = selected_model
            st.rerun()
        
        # Informações do modelo
        model_info = get_model_info(selected_model)
        st.info(f"**{model_info['name']}**\n\n{model_info['description']}\n\n📄 Contexto: {model_info['context']}")
        
        st.divider()
        
        # Configurações de temperatura
        st.subheader("🌡️ Parâmetros")
        
        temperature = st.slider(
            "Temperatura",
            min_value=0.0,
            max_value=2.0,
            value=Config.TEMPERATURE,
            step=0.1,
            help="Controla a criatividade das respostas (0 = mais focada, 2 = mais criativa)"
        )
        
        max_tokens = st.slider(
            "Máximo de Tokens",
            min_value=100,
            max_value=8000,
            value=Config.MAX_TOKENS,
            step=100,
            help="Limita o tamanho das respostas"
        )
        
        # Atualiza configurações
        Config.TEMPERATURE = temperature
        Config.MAX_TOKENS = max_tokens
        
        st.divider()
        
        # Informações da sessão
        st.subheader("📊 Sessão Atual")
        st.metric("Mensagens", len(st.session_state.messages))
        
        if st.session_state.get('documents_ingested'):
            st.metric("Documentos", len(st.session_state.documents_ingested))
    
    # Inicializa componentes
    @st.cache_resource
    def initialize_rag_store():
        return RAGStore()
    
    @st.cache_resource
    def initialize_chat_agent(_rag_store):
        return MaxChatAgent(_rag_store)
    
    rag_store = initialize_rag_store()
    chat_agent = initialize_chat_agent(rag_store)
    
    # Abas principais
    tab1, tab2, tab3, tab4 = st.tabs([
        "💬 Chat", 
        "🔍 Busca", 
        "📁 Ingestão", 
        "ℹ️ Sobre"
    ])
    
    with tab1:
        display_chat_interface(chat_agent)
    
    with tab2:
        display_search_interface(rag_store)
    
    with tab3:
        display_ingestion_interface(rag_store)
    
    with tab4:
        st.header("ℹ️ Sobre o Max")
        
        st.markdown("""
        ### 🤖 O que é o Max?
        
        O Max é seu assistente de IA especializado para informações internas da empresa. 
        Ele combina inteligência artificial avançada com acesso aos documentos e políticas 
        da organização para fornecer respostas precisas e contextualizadas.
        
        ### 🚀 Principais Funcionalidades
        
        - **💬 Chat Inteligente**: Converse naturalmente e obtenha respostas baseadas nos documentos internos
        - **🔍 Busca Avançada**: Encontre rapidamente informações específicas na base de conhecimento
        - **📁 Ingestão de Documentos**: Adicione novos documentos (PDF, DOCX, TXT) à base de conhecimento
        - **🤖 Múltiplos Modelos**: Escolha entre diferentes modelos OpenAI conforme sua necessidade
        
        ### 💡 Como Usar
        
        1. **Configure seu modelo** preferido na barra lateral
        2. **Adicione documentos** na aba "Ingestão" para criar sua base de conhecimento
        3. **Faça perguntas** na aba "Chat" ou **busque informações** na aba "Busca"
        4. **Ajuste parâmetros** como temperatura e tokens conforme necessário
        
        ### 🛡️ Segurança e Privacidade
        
        - Todos os documentos são processados localmente
        - As conversas não são armazenadas permanentemente
        - Sua API key OpenAI é usada apenas para gerar respostas
        
        ### 🔧 Tecnologias Utilizadas
        
        - **Streamlit** - Interface web interativa
        - **OpenAI GPT** - Modelos de linguagem avançados
        - **ChromaDB** - Banco de dados vetorial para busca semântica
        - **LangChain** - Framework para aplicações de IA
        
        ---
        
        **Versão:** 1.0.0 | **Desenvolvido para:** Testes e demonstração
        """)
        
        # Estatísticas do sistema
        st.subheader("📈 Estatísticas do Sistema")
        
        stats = rag_store.get_collection_stats()
        
        col1, col2, col3 = st.columns(3)
        
        with col1:
            st.metric(
                "Documentos na Base",
                stats['total_documents'],
                help="Total de documentos processados e disponíveis para consulta"
            )
        
        with col2:
            st.metric(
                "Modelo de Embedding",
                stats['embedding_model'],
                help="Modelo usado para criar embeddings dos documentos"
            )
        
        with col3:
            st.metric(
                "Modelo de Chat Atual",
                st.session_state.current_model,
                help="Modelo OpenAI atualmente selecionado para conversas"
            )

if __name__ == "__main__":
    main()