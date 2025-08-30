# Max Agent - Streamlit Version

Este é o agente Max implementado em Python com Streamlit para interface de teste.

## Funcionalidades

- **RAG (Retrieval-Augmented Generation)**: Ingere documentos (PDF, DOCX, TXT) e permite busca semântica
- **Integração com OpenAI**: Suporte a modelos GPT-4, GPT-3.5-turbo e outros
- **Interface Streamlit**: Interface web intuitiva para testes
- **Configuração de Modelo Global**: Define modelo padrão para todos os usuários
- **Sistema de Prompt Personalizado**: Prompt específico do Max para políticas internas

## Instalação Local

1. Clone ou baixe este repositório
2. Instale as dependências:
```bash
pip install -r requirements.txt
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite .env e adicione sua OPENAI_API_KEY
```

4. Execute a aplicação:
```bash
streamlit run streamlit_app.py
```

## Deploy no Streamlit Cloud

1. Faça upload dos arquivos para um repositório GitHub
2. Acesse [share.streamlit.io](https://share.streamlit.io)
3. Conecte seu repositório GitHub
4. Configure a variável de ambiente `OPENAI_API_KEY` nos Settings
5. Deploy automático!

## Estrutura do Projeto

```
streamlit_max_agent/
├── README.md
├── requirements.txt
├── .env.example
├── streamlit_app.py          # Interface principal Streamlit
├── .streamlit/
│   └── config.toml          # Configurações do Streamlit
├── prompts/
│   └── system_max.pt.txt    # Prompt do sistema Max
└── agent/
    ├── __init__.py
    ├── config.py            # Configurações e variáveis de ambiente
    ├── utils.py            # Utilitários gerais
    ├── rag_store.py        # Sistema RAG com ChromaDB
    ├── ingest.py           # Processamento de documentos
    └── chat.py             # Lógica do chat com OpenAI
```

## Uso

1. **Configurar Modelo**: Use a sidebar para selecionar o modelo OpenAI
2. **Ingerir Documentos**: Faça upload de PDFs, DOCX ou TXT na aba "Ingestão"
3. **Chat**: Converse com o Max na aba principal
4. **Busca**: Use a aba "Busca" para encontrar informações nos documentos

## Variáveis de Ambiente

- `OPENAI_API_KEY`: Sua chave da API OpenAI (obrigatório)
- `DEFAULT_MODEL`: Modelo padrão (opcional, default: gpt-4)
- `CHROMA_PERSIST_DIRECTORY`: Diretório de persistência (opcional, default: ./chroma_db)

## Notas Importantes

- Os documentos são armazenados localmente usando ChromaDB
- Para produção, considere usar um banco vetorial em nuvem
- Mantenha sua `OPENAI_API_KEY` segura e nunca a compartilhe
- O sistema persiste conversas apenas durante a sessão atual

## Suporte

Para dúvidas ou suporte, consulte a documentação do projeto principal.