import streamlit as st
from typing import List, Dict, Any
import PyPDF2
from docx import Document
from io import BytesIO
import hashlib
from .utils import get_file_hash

class DocumentProcessor:
    """Processa diferentes tipos de documentos"""
    
    def __init__(self):
        self.supported_types = ['.pdf', '.docx', '.txt']
    
    def process_uploaded_file(self, uploaded_file) -> Dict[str, Any]:
        """Processa arquivo enviado pelo usuário"""
        if not uploaded_file:
            return None
        
        file_content = uploaded_file.read()
        file_hash = get_file_hash(file_content)
        
        # Verifica se já foi processado
        if file_hash in st.session_state.get('processed_files', set()):
            st.warning(f"Arquivo {uploaded_file.name} já foi processado anteriormente.")
            return None
        
        # Reset do ponteiro do arquivo
        uploaded_file.seek(0)
        
        # Determina o tipo do arquivo
        file_type = self._get_file_type(uploaded_file.name)
        
        if file_type not in self.supported_types:
            st.error(f"Tipo de arquivo não suportado: {file_type}")
            return None
        
        try:
            # Processa baseado no tipo
            if file_type == '.pdf':
                content = self._process_pdf(file_content)
            elif file_type == '.docx':
                content = self._process_docx(file_content)
            elif file_type == '.txt':
                content = self._process_txt(file_content)
            else:
                return None
            
            # Marca como processado
            if 'processed_files' not in st.session_state:
                st.session_state.processed_files = set()
            st.session_state.processed_files.add(file_hash)
            
            return {
                'content': content,
                'metadata': {
                    'source': uploaded_file.name,
                    'file_type': file_type,
                    'file_hash': file_hash,
                    'file_size': len(file_content)
                }
            }
            
        except Exception as e:
            st.error(f"Erro ao processar arquivo {uploaded_file.name}: {str(e)}")
            return None
    
    def _get_file_type(self, filename: str) -> str:
        """Extrai a extensão do arquivo"""
        return '.' + filename.lower().split('.')[-1]
    
    def _process_pdf(self, file_content: bytes) -> str:
        """Processa arquivo PDF"""
        try:
            pdf_file = BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            text_content = []
            for page_num, page in enumerate(pdf_reader.pages):
                text = page.extract_text()
                if text.strip():  # Só adiciona se tiver conteúdo
                    text_content.append(f"[Página {page_num + 1}]\n{text}")
            
            return "\n\n".join(text_content)
            
        except Exception as e:
            raise Exception(f"Erro ao processar PDF: {str(e)}")
    
    def _process_docx(self, file_content: bytes) -> str:
        """Processa arquivo DOCX"""
        try:
            doc_file = BytesIO(file_content)
            doc = Document(doc_file)
            
            text_content = []
            for paragraph in doc.paragraphs:
                text = paragraph.text.strip()
                if text:  # Só adiciona parágrafos com conteúdo
                    text_content.append(text)
            
            return "\n\n".join(text_content)
            
        except Exception as e:
            raise Exception(f"Erro ao processar DOCX: {str(e)}")
    
    def _process_txt(self, file_content: bytes) -> str:
        """Processa arquivo TXT"""
        try:
            # Tenta diferentes encodings
            encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
            
            for encoding in encodings:
                try:
                    return file_content.decode(encoding)
                except UnicodeDecodeError:
                    continue
            
            # Se nenhum encoding funcionou
            raise Exception("Não foi possível decodificar o arquivo de texto")
            
        except Exception as e:
            raise Exception(f"Erro ao processar TXT: {str(e)}")
    
    def process_multiple_files(self, uploaded_files: List) -> List[Dict[str, Any]]:
        """Processa múltiplos arquivos"""
        processed_documents = []
        
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        for i, uploaded_file in enumerate(uploaded_files):
            progress = (i + 1) / len(uploaded_files)
            progress_bar.progress(progress)
            status_text.text(f"Processando {uploaded_file.name}...")
            
            doc = self.process_uploaded_file(uploaded_file)
            if doc:
                processed_documents.append(doc)
        
        progress_bar.empty()
        status_text.empty()
        
        return processed_documents
    
    def validate_file_size(self, file_size: int, max_size_mb: int = 10) -> bool:
        """Valida o tamanho do arquivo"""
        max_size_bytes = max_size_mb * 1024 * 1024
        return file_size <= max_size_bytes
    
    def get_file_info(self, uploaded_file) -> Dict[str, Any]:
        """Retorna informações sobre o arquivo"""
        if not uploaded_file:
            return {}
        
        return {
            'name': uploaded_file.name,
            'size': uploaded_file.size,
            'type': uploaded_file.type,
            'size_mb': round(uploaded_file.size / (1024 * 1024), 2)
        }

def display_ingestion_interface(rag_store):
    """Interface para ingestão de documentos"""
    st.header("📁 Ingestão de Documentos")
    
    processor = DocumentProcessor()
    
    # Estatísticas da coleção
    stats = rag_store.get_collection_stats()
    
    col1, col2 = st.columns(2)
    with col1:
        st.metric("Documentos na Base", stats['total_documents'])
    with col2:
        st.metric("Modelo de Embedding", stats['embedding_model'])
    
    st.divider()
    
    # Upload de arquivos
    st.subheader("📤 Upload de Documentos")
    uploaded_files = st.file_uploader(
        "Selecione os arquivos para processar",
        type=['pdf', 'docx', 'txt'],
        accept_multiple_files=True,
        help="Tipos suportados: PDF, DOCX, TXT (máx. 10MB cada)"
    )
    
    if uploaded_files:
        # Mostra informações dos arquivos
        st.subheader("📋 Arquivos Selecionados")
        
        valid_files = []
        for file in uploaded_files:
            info = processor.get_file_info(file)
            
            col1, col2, col3 = st.columns([3, 1, 1])
            with col1:
                st.text(info['name'])
            with col2:
                st.text(f"{info['size_mb']} MB")
            with col3:
                if processor.validate_file_size(info['size']):
                    st.success("✓")
                    valid_files.append(file)
                else:
                    st.error("Muito grande")
        
        if valid_files:
            col1, col2 = st.columns([1, 1])
            
            with col1:
                if st.button("🚀 Processar Documentos", type="primary"):
                    with st.spinner("Processando documentos..."):
                        documents = processor.process_multiple_files(valid_files)
                        
                        if documents:
                            success = rag_store.add_documents(documents)
                            
                            if success:
                                st.success(f"✅ {len(documents)} documentos processados com sucesso!")
                                
                                # Adiciona à lista de documentos processados
                                if 'documents_ingested' not in st.session_state:
                                    st.session_state.documents_ingested = []
                                
                                for doc in documents:
                                    st.session_state.documents_ingested.append({
                                        'name': doc['metadata']['source'],
                                        'type': doc['metadata']['file_type'],
                                        'size': doc['metadata']['file_size']
                                    })
                                
                                st.rerun()
                            else:
                                st.error("❌ Erro ao adicionar documentos à base")
                        else:
                            st.warning("⚠️ Nenhum documento válido foi processado")
            
            with col2:
                if st.button("🗑️ Limpar Base", type="secondary"):
                    if st.session_state.get('confirm_clear', False):
                        rag_store.clear_collection()
                        st.session_state.documents_ingested = []
                        st.session_state.processed_files = set()
                        st.success("Base de documentos limpa!")
                        st.session_state.confirm_clear = False
                        st.rerun()
                    else:
                        st.session_state.confirm_clear = True
                        st.warning("Clique novamente para confirmar a limpeza da base")
    
    # Lista de documentos processados
    if st.session_state.get('documents_ingested'):
        st.divider()
        st.subheader("📚 Documentos na Base")
        
        for doc in st.session_state.documents_ingested:
            col1, col2, col3 = st.columns([3, 1, 1])
            with col1:
                st.text(f"📄 {doc['name']}")
            with col2:
                st.text(doc['type'])
            with col3:
                st.text(f"{round(doc['size']/1024, 1)} KB")