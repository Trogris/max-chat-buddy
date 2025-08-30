import streamlit as st
import hashlib
from typing import List, Dict, Any
from datetime import datetime

def init_session_state():
    """Inicializa o estado da sessão do Streamlit"""
    if "messages" not in st.session_state:
        st.session_state.messages = []
    
    if "current_model" not in st.session_state:
        st.session_state.current_model = "gpt-4"
    
    if "documents_ingested" not in st.session_state:
        st.session_state.documents_ingested = []

def get_file_hash(file_content: bytes) -> str:
    """Gera hash do arquivo para evitar processamento duplicado"""
    return hashlib.md5(file_content).hexdigest()

def format_message_time(timestamp: datetime = None) -> str:
    """Formata timestamp da mensagem"""
    if timestamp is None:
        timestamp = datetime.now()
    return timestamp.strftime("%H:%M:%S")

def add_message(role: str, content: str, timestamp: datetime = None):
    """Adiciona mensagem ao histórico"""
    if timestamp is None:
        timestamp = datetime.now()
    
    message = {
        "role": role,
        "content": content,
        "timestamp": timestamp
    }
    
    st.session_state.messages.append(message)

def clear_chat_history():
    """Limpa o histórico de chat"""
    st.session_state.messages = []

def format_docs_for_display(docs: List[Dict[str, Any]]) -> str:
    """Formata documentos encontrados para exibição"""
    if not docs:
        return "Nenhum documento relevante encontrado."
    
    formatted = "📄 **Documentos encontrados:**\n\n"
    
    for i, doc in enumerate(docs, 1):
        metadata = doc.get('metadata', {})
        source = metadata.get('source', 'Fonte desconhecida')
        page = metadata.get('page', '')
        
        formatted += f"**{i}. {source}**"
        if page:
            formatted += f" (Página {page})"
        formatted += f"\n\n{doc['page_content'][:200]}...\n\n---\n\n"
    
    return formatted

def display_chat_messages():
    """Exibe mensagens do chat"""
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.write(message["content"])
            st.caption(f"🕒 {format_message_time(message['timestamp'])}")

def get_model_info(model: str) -> Dict[str, str]:
    """Retorna informações sobre o modelo"""
    model_info = {
        "gpt-4": {
            "name": "GPT-4",
            "description": "Modelo mais avançado, melhor para tarefas complexas",
            "context": "8K tokens"
        },
        "gpt-4-turbo-preview": {
            "name": "GPT-4 Turbo",
            "description": "Versão otimizada do GPT-4, mais rápida",
            "context": "128K tokens"
        },
        "gpt-3.5-turbo": {
            "name": "GPT-3.5 Turbo",
            "description": "Modelo rápido e eficiente para a maioria das tarefas",
            "context": "4K tokens"
        },
        "gpt-3.5-turbo-16k": {
            "name": "GPT-3.5 Turbo 16K",
            "description": "Versão com contexto estendido",
            "context": "16K tokens"
        }
    }
    
    return model_info.get(model, {
        "name": model,
        "description": "Modelo personalizado",
        "context": "Varia"
    })