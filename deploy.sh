#!/bin/bash

# Script de Deploy - Migração Híbrida Fiscaltech Max
# Frontend próprio + Backend Supabase

set -e  # Para em caso de erro

echo "🚀 Iniciando deploy do Fiscaltech Max..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para log colorido
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    error "Docker não está instalado!"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose não está instalado!"
    exit 1
fi

# Parar containers existentes
log "Parando containers existentes..."
docker-compose down --remove-orphans

# Remover imagens antigas (opcional)
read -p "Deseja remover imagens antigas? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Removendo imagens antigas..."
    docker system prune -f
fi

# Build da nova imagem
log "Construindo nova imagem..."
docker-compose build --no-cache

# Iniciar serviços
log "Iniciando serviços..."
docker-compose up -d

# Verificar se os serviços estão rodando
log "Verificando status dos serviços..."
sleep 10

if docker-compose ps | grep -q "Up"; then
    log "✅ Deploy concluído com sucesso!"
    log "🌐 Aplicação disponível em: http://localhost"
    log "📊 Status dos containers:"
    docker-compose ps
else
    error "❌ Falha no deploy. Verificando logs..."
    docker-compose logs
    exit 1
fi

# Backup dos logs (opcional)
log "Salvando logs de deploy..."
mkdir -p logs
docker-compose logs > logs/deploy-$(date +%Y%m%d-%H%M%S).log

log "🎉 Deploy finalizado!"
echo
echo "📋 Próximos passos:"
echo "1. Configure seu domínio no nginx.conf"
echo "2. Configure certificados SSL se necessário"
echo "3. Monitore os logs: docker-compose logs -f"
echo "4. Para parar: docker-compose down"