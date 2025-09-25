# 🚀 Guia de Deploy - Migração Híbrida Fiscaltech Max

## Visão Geral
Este guia apresenta como fazer o deploy do frontend do sistema Max no servidor da sua empresa, mantendo o backend no Supabase (migração híbrida).

## 📋 Pré-requisitos

### No Servidor da Empresa:
- Ubuntu 20.04+ ou CentOS 8+
- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM mínimo
- 10GB espaço em disco
- Acesso à internet (para comunicação com Supabase)

### Instalação do Docker (Ubuntu):
```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
newgrp docker
```

## 🔧 Configuração

### 1. Preparar o Servidor
```bash
# Criar diretório da aplicação
sudo mkdir -p /opt/fiscaltech-max
sudo chown $USER:$USER /opt/fiscaltech-max
cd /opt/fiscaltech-max

# Clonar ou transferir arquivos do projeto
# (substitua pelo método de sua preferência)
```

### 2. Configurar Variáveis de Ambiente
```bash
# Copiar arquivo de exemplo
cp .env.production .env

# Editar configurações
nano .env
```

**Configurações importantes em `.env`:**
- `VITE_APP_URL`: URL do seu domínio
- Manter as configurações do Supabase inalteradas

### 3. Configurar Nginx
```bash
# Editar nginx.conf
nano nginx.conf

# Alterar linha:
server_name seu-dominio.com;  # Seu domínio real
```

## 🚀 Deploy

### Método Automatizado (Recomendado):
```bash
# Dar permissão de execução
chmod +x deploy.sh

# Executar deploy
./deploy.sh
```

### Método Manual:
```bash
# Build e iniciar
docker-compose build
docker-compose up -d

# Verificar status
docker-compose ps
```

## 🔒 Configuração SSL (HTTPS)

### Usando Let's Encrypt:
```bash
# Instalar certbot
sudo apt install certbot

# Gerar certificado
sudo certbot certonly --standalone -d seu-dominio.com

# Descomentar configurações HTTPS no nginx.conf
# Atualizar caminhos dos certificados
```

### Configuração no nginx.conf:
```nginx
server {
    listen 443 ssl http2;
    server_name seu-dominio.com;
    
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;
    
    # ... resto da configuração
}
```

## 📊 Monitoramento

### Verificar Status:
```bash
# Status dos containers
docker-compose ps

# Logs em tempo real
docker-compose logs -f

# Logs específicos
docker-compose logs fiscaltech-max-frontend
```

### Health Check:
```bash
# Verificar se aplicação está respondendo
curl http://localhost/health

# Ou com domínio
curl https://seu-dominio.com/health
```

## 🔄 Atualizações

### Para atualizar a aplicação:
```bash
# Parar serviços
docker-compose down

# Atualizar código fonte
git pull  # ou método de sua preferência

# Rebuild e restart
docker-compose build --no-cache
docker-compose up -d
```

## 🔧 Comandos Úteis

```bash
# Parar aplicação
docker-compose down

# Reiniciar aplicação
docker-compose restart

# Ver uso de recursos
docker stats

# Limpar cache do Docker
docker system prune -f

# Backup dos logs
docker-compose logs > backup-logs-$(date +%Y%m%d).log
```

## 🌐 Configuração de Domínio

### No seu DNS:
```
Tipo: A
Nome: @ (ou subdomínio)
Valor: IP_DO_SEU_SERVIDOR
TTL: 300
```

### Para subdomínio:
```
Tipo: CNAME
Nome: max (para max.suaempresa.com)
Valor: seu-dominio-principal.com
TTL: 300
```

## 🔐 Segurança

### Firewall (UFW):
```bash
# Instalar UFW
sudo apt install ufw

# Configurar regras básicas
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir SSH
sudo ufw allow ssh

# Permitir HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Ativar firewall
sudo ufw enable
```

### Backup Automático:
```bash
# Criar script de backup
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)
docker-compose logs > logs/backup-$DATE.log
tar -czf backups/fiscaltech-max-$DATE.tar.gz .
find backups/ -name "*.tar.gz" -mtime +30 -delete
EOF

chmod +x backup.sh

# Adicionar ao crontab (backup diário às 2h)
echo "0 2 * * * /opt/fiscaltech-max/backup.sh" | sudo crontab -
```

## ⚠️ Solução de Problemas

### Container não inicia:
```bash
# Verificar logs detalhados
docker-compose logs --tail=50 fiscaltech-max-frontend

# Verificar recursos do sistema
free -h
df -h
```

### Problemas de conectividade com Supabase:
```bash
# Testar conectividade
curl -I https://dcrbacdjfbgpvzbbcwws.supabase.co

# Verificar DNS
nslookup dcrbacdjfbgpvzbbcwws.supabase.co
```

### Aplicação não carrega:
1. Verificar se o container está rodando: `docker-compose ps`
2. Verificar logs: `docker-compose logs -f`
3. Testar health check: `curl http://localhost/health`
4. Verificar configurações do nginx

## 📞 Suporte

### Logs importantes:
- **Aplicação**: `docker-compose logs fiscaltech-max-frontend`
- **Nginx**: `/var/log/nginx/error.log` (dentro do container)
- **Sistema**: `journalctl -u docker`

### Informações do sistema:
```bash
# Versões
docker --version
docker-compose --version

# Recursos
free -h
df -h
uname -a
```

## ✅ Checklist Pós-Deploy

- [ ] Aplicação carregando corretamente
- [ ] Login funcionando (conecta com Supabase)
- [ ] Upload de documentos funcionando
- [ ] Chat com IA respondendo
- [ ] SSL/HTTPS configurado (se aplicável)
- [ ] Domínio configurado
- [ ] Monitoramento ativo
- [ ] Backup configurado
- [ ] Firewall configurado

---

🎉 **Parabéns!** Sua migração híbrida está completa. O frontend roda no seu servidor enquanto mantém toda a confiabilidade do backend Supabase.