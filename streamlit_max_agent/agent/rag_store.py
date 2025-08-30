import streamlit as st
import chromadb
from chromadb.config import Settings
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter
from typing import List, Dict, Any
import os
from .config import Config

class RAGStore:
    def __init__(self):
        self.embeddings = OpenAIEmbeddings(
            openai_api_key=Config.OPENAI_API_KEY,
            model=Config.EMBEDDING_MODEL
        )
        
        # Configuração do ChromaDB para persistência
        self.chroma_client = chromadb.PersistentClient(
            path=Config.CHROMA_PERSIST_DIRECTORY
        )
        
        self.collection_name = "max_documents"
        
        # Inicializa o vector store
        self.vectorstore = Chroma(
            client=self.chroma_client,
            collection_name=self.collection_name,
            embedding_function=self.embeddings
        )
        
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=Config.RAG_CHUNK_SIZE,
            chunk_overlap=Config.RAG_CHUNK_OVERLAP,
            separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""]
        )
    
    def add_documents(self, documents: List[Dict[str, Any]]) -> bool:
        """Adiciona documentos ao store vetorial"""
        try:
            texts = []
            metadatas = []
            
            for doc in documents:
                # Divide o texto em chunks
                chunks = self.text_splitter.split_text(doc['content'])
                
                for i, chunk in enumerate(chunks):
                    texts.append(chunk)
                    metadata = doc['metadata'].copy()
                    metadata['chunk_id'] = i
                    metadatas.append(metadata)
            
            # Adiciona ao vectorstore
            self.vectorstore.add_texts(
                texts=texts,
                metadatas=metadatas
            )
            
            return True
            
        except Exception as e:
            st.error(f"Erro ao adicionar documentos: {str(e)}")
            return False
    
    def search_documents(self, query: str, k: int = None) -> List[Dict[str, Any]]:
        """Busca documentos similares à query"""
        if k is None:
            k = Config.RAG_TOP_K
            
        try:
            # Busca similaridade
            results = self.vectorstore.similarity_search_with_score(
                query=query,
                k=k
            )
            
            documents = []
            for doc, score in results:
                documents.append({
                    'page_content': doc.page_content,
                    'metadata': doc.metadata,
                    'similarity_score': float(score)
                })
            
            return documents
            
        except Exception as e:
            st.error(f"Erro na busca: {str(e)}")
            return []
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas da coleção"""
        try:
            collection = self.chroma_client.get_collection(self.collection_name)
            count = collection.count()
            
            return {
                'total_documents': count,
                'collection_name': self.collection_name,
                'embedding_model': Config.EMBEDDING_MODEL
            }
            
        except Exception as e:
            return {
                'total_documents': 0,
                'collection_name': self.collection_name,
                'embedding_model': Config.EMBEDDING_MODEL,
                'error': str(e)
            }
    
    def clear_collection(self) -> bool:
        """Limpa todos os documentos da coleção"""
        try:
            # Deleta a coleção existente
            try:
                self.chroma_client.delete_collection(self.collection_name)
            except:
                pass  # Coleção pode não existir
            
            # Cria uma nova coleção
            self.vectorstore = Chroma(
                client=self.chroma_client,
                collection_name=self.collection_name,
                embedding_function=self.embeddings
            )
            
            return True
            
        except Exception as e:
            st.error(f"Erro ao limpar coleção: {str(e)}")
            return False
    
    def delete_document(self, document_id: str) -> bool:
        """Remove um documento específico"""
        try:
            # ChromaDB/Langchain não tem método direto para deletar por metadata
            # Esta é uma implementação simplificada
            st.warning("Funcionalidade de deletar documento individual não implementada nesta versão")
            return False
            
        except Exception as e:
            st.error(f"Erro ao deletar documento: {str(e)}")
            return False
    
    def get_relevant_context(self, query: str, max_tokens: int = 2000) -> str:
        """Retorna contexto relevante para uma query, limitado por tokens"""
        docs = self.search_documents(query)
        
        if not docs:
            return "Nenhuma informação relevante encontrada nos documentos."
        
        context_parts = []
        current_tokens = 0
        
        for doc in docs:
            content = doc['page_content']
            # Estimativa aproximada de tokens (1 token ≈ 4 caracteres)
            content_tokens = len(content) // 4
            
            if current_tokens + content_tokens > max_tokens:
                # Trunca o conteúdo para caber no limite
                remaining_chars = (max_tokens - current_tokens) * 4
                content = content[:remaining_chars] + "..."
                context_parts.append(content)
                break
            
            context_parts.append(content)
            current_tokens += content_tokens
        
        return "\n\n---\n\n".join(context_parts)