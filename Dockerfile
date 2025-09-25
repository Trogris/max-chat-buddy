# Dockerfile para build de produção do frontend
FROM node:18-alpine as builder

# Diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./
COPY bun.lockb ./

# Instalar dependências
RUN npm install -g bun
RUN npm install -g vite
RUN bun install

# Copiar código fonte
COPY . .

# Build de produção
RUN vite build

# Servidor nginx para servir os arquivos estáticos
FROM nginx:alpine

# Copiar build para nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuração customizada do nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Expor porta 80
EXPOSE 80

# Comando para iniciar nginx
CMD ["nginx", "-g", "daemon off;"]