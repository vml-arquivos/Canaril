# 🐳 Guia de Deploy com Docker - Canário Gestão Pro

## 📋 Sumário
1. [Pré-requisitos](#pré-requisitos)
2. [Estrutura Docker](#estrutura-docker)
3. [Configuração Inicial](#configuração-inicial)
4. [Deploy Local](#deploy-local)
5. [Deploy em VPS](#deploy-em-vps)
6. [Monitoramento e Manutenção](#monitoramento-e-manutenção)

---

## ✅ Pré-requisitos

### Instalar Docker e Docker Compose

**Ubuntu/Debian:**
```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verificar instalação
docker --version
docker-compose --version
```

**macOS (com Homebrew):**
```bash
brew install docker docker-compose
```

### Verificar Permissões
```bash
# Adicionar usuário ao grupo docker (sem sudo)
sudo usermod -aG docker $USER
newgrp docker
```

---

## 🐳 Estrutura Docker

### Arquivos Necessários

```
canario-gestao-pro/
├── Dockerfile                 # Imagem da aplicação
├── docker-compose.yml         # Orquestração de containers
├── nginx.conf                 # Configuração Nginx
├── .env.production            # Variáveis de ambiente
├── drizzle/
│   └── migrations/            # Scripts SQL
└── dist/                      # Build da aplicação (gerado)
```

### Serviços

| Serviço | Imagem | Porta | Função |
|---------|--------|-------|--------|
| **postgres** | postgres:16-alpine | 5432 | Banco de dados |
| **app** | canario-lima-app | 3000 | Aplicação Node.js |
| **nginx** | nginx:alpine | 80/443 | Reverse proxy |

---

## 🔧 Configuração Inicial

### 1. Clonar Repositório

```bash
git clone https://github.com/vml-arquivos/Canaril.git
cd Canaril
```

### 2. Preparar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.production .env

# Editar variáveis (IMPORTANTE!)
nano .env

# Variáveis críticas a atualizar:
# - DATABASE_URL (se necessário)
# - JWT_SECRET (já gerado)
# - CORS_ORIGIN (seu domínio)
# - VITE_APP_LOGO (URL do logo)
```

### 3. Preparar Certificados SSL (VPS)

```bash
# Criar diretório para SSL
mkdir -p ssl

# Gerar certificado auto-assinado (teste)
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes

# OU usar Let's Encrypt (produção)
sudo apt-get install certbot
sudo certbot certonly --standalone -d seu-dominio.com
sudo cp /etc/letsencrypt/live/seu-dominio.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/seu-dominio.com/privkey.pem ssl/key.pem
```

### 4. Atualizar nginx.conf

```bash
# Editar nginx.conf e substituir:
# - seu-dominio.com → seu domínio real
# - /etc/nginx/ssl → caminho correto dos certificados

nano nginx.conf
```

---

## 🚀 Deploy Local

### 1. Build da Imagem

```bash
# Build da aplicação
pnpm build

# Verificar build
ls -la dist/

# Build da imagem Docker
docker-compose build
```

### 2. Iniciar Containers

```bash
# Iniciar todos os serviços
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f nginx
```

### 3. Executar Migrations

```bash
# As migrations são executadas automaticamente pelo PostgreSQL
# Verificar se tabelas foram criadas:
docker-compose exec postgres psql -U postgis -d canario_lima_db -c "\dt"

# Se precisar executar manualmente:
docker-compose exec postgres psql -U postgis -d canario_lima_db < drizzle/migrations/0001_init_schema.sql
docker-compose exec postgres psql -U postgis -d canario_lima_db < drizzle/migrations/0002_seed_data.sql
```

### 4. Acessar Aplicação

```
http://localhost:3000
```

### 5. Parar Containers

```bash
# Parar sem remover
docker-compose stop

# Parar e remover
docker-compose down

# Remover volumes (CUIDADO - apaga dados!)
docker-compose down -v
```

---

## 🌐 Deploy em VPS

### 1. Preparar VPS

```bash
# Atualizar sistema
sudo apt-get update && sudo apt-get upgrade -y

# Instalar dependências
sudo apt-get install -y git curl wget nano

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
```

### 2. Clonar Repositório na VPS

```bash
cd /home/seu-usuario
git clone https://github.com/vml-arquivos/Canaril.git
cd Canaril
```

### 3. Configurar Domínio

**Apontar DNS para VPS:**
```
seu-dominio.com → IP_DA_VPS
```

**Verificar DNS propagação:**
```bash
nslookup seu-dominio.com
dig seu-dominio.com
```

### 4. Configurar SSL com Let's Encrypt

```bash
# Instalar Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Gerar certificado
sudo certbot certonly --standalone -d seu-dominio.com -d www.seu-dominio.com

# Copiar certificados
mkdir -p ssl
sudo cp /etc/letsencrypt/live/seu-dominio.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/seu-dominio.com/privkey.pem ssl/key.pem
sudo chown $USER:$USER ssl/*
```

### 5. Atualizar Configurações

```bash
# Editar .env para produção
nano .env.production

# Atualizar:
# CORS_ORIGIN=https://seu-dominio.com
# VITE_APP_LOGO=https://seu-dominio.com/logo.png

# Editar nginx.conf
nano nginx.conf

# Substituir seu-dominio.com em todos os lugares
```

### 6. Iniciar Aplicação

```bash
# Build e iniciar
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f
```

### 7. Configurar Firewall

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Verificar
sudo ufw status
```

### 8. Configurar Auto-renovação SSL

```bash
# Criar script de renovação
sudo nano /usr/local/bin/renew-ssl.sh

#!/bin/bash
cd /home/seu-usuario/Canaril
sudo certbot renew --quiet
sudo cp /etc/letsencrypt/live/seu-dominio.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/seu-dominio.com/privkey.pem ssl/key.pem
sudo chown $USER:$USER ssl/*
docker-compose restart nginx

# Tornar executável
sudo chmod +x /usr/local/bin/renew-ssl.sh

# Adicionar ao crontab
sudo crontab -e

# Adicionar linha:
0 3 * * * /usr/local/bin/renew-ssl.sh
```

---

## 📊 Monitoramento e Manutenção

### Verificar Saúde

```bash
# Health check da aplicação
curl http://localhost:3000/health

# Health check do banco
docker-compose exec postgres pg_isready -U postgis

# Verificar uso de recursos
docker stats

# Verificar logs de erro
docker-compose logs app | grep ERROR
```

### Backups

```bash
# Backup do banco de dados
docker-compose exec postgres pg_dump -U postgis canario_lima_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
docker-compose exec -T postgres psql -U postgis canario_lima_db < backup_20260619_120000.sql

# Backup de volumes
docker run --rm -v canario-lima-postgres:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data
```

### Atualizações

```bash
# Atualizar código
git pull origin main

# Rebuild da imagem
docker-compose build

# Reiniciar aplicação
docker-compose up -d

# Verificar se tudo está funcionando
docker-compose ps
docker-compose logs app
```

### Limpeza

```bash
# Remover imagens não usadas
docker image prune -a

# Remover containers parados
docker container prune

# Remover volumes não usados
docker volume prune

# Limpeza completa (CUIDADO!)
docker system prune -a --volumes
```

---

## 🔐 Segurança

### Checklist de Segurança

- [x] SSL/TLS configurado
- [ ] Firewall ativado
- [ ] Senhas fortes configuradas
- [ ] Backups automatizados
- [ ] Logs monitorados
- [ ] Atualizações de segurança aplicadas
- [ ] Rate limiting ativado
- [ ] CORS configurado corretamente

### Variáveis Sensíveis

```bash
# NUNCA commit .env em produção!
echo ".env" >> .gitignore
echo ".env.production" >> .gitignore

# Armazenar secrets em:
# - Docker secrets (Swarm)
# - Environment variables (VPS)
# - Vault (produção enterprise)
```

---

## 🆘 Troubleshooting

### Erro: "Connection refused"

```bash
# Verificar se containers estão rodando
docker-compose ps

# Reiniciar containers
docker-compose restart

# Verificar logs
docker-compose logs app
```

### Erro: "Database connection failed"

```bash
# Verificar se PostgreSQL está saudável
docker-compose exec postgres pg_isready -U postgis

# Verificar variáveis de ambiente
docker-compose config | grep DATABASE_URL

# Reconectar ao banco
docker-compose restart postgres app
```

### Erro: "Port already in use"

```bash
# Encontrar processo usando porta
sudo lsof -i :3000
sudo lsof -i :5432
sudo lsof -i :80

# Matar processo
sudo kill -9 <PID>

# OU mudar porta em docker-compose.yml
```

### Erro: "SSL certificate error"

```bash
# Verificar certificado
openssl x509 -in ssl/cert.pem -text -noout

# Renovar certificado
sudo certbot renew --force-renewal

# Reiniciar nginx
docker-compose restart nginx
```

---

## 📞 Suporte e Logs

### Arquivos de Log

```
logs/
├── nginx/
│   ├── access.log
│   └── error.log
└── app/
    └── (logs da aplicação)
```

### Visualizar Logs

```bash
# Logs em tempo real
docker-compose logs -f

# Últimas 100 linhas
docker-compose logs --tail=100

# Logs de um serviço específico
docker-compose logs -f app

# Logs com timestamp
docker-compose logs --timestamps
```

---

## ✅ Checklist Final de Deploy

- [ ] Repositório clonado
- [ ] Docker e Docker Compose instalados
- [ ] .env.production configurado
- [ ] SSL/TLS certificados gerados
- [ ] nginx.conf atualizado com domínio
- [ ] DNS apontado para VPS
- [ ] Firewall configurado
- [ ] Build executado com sucesso
- [ ] Containers iniciados sem erros
- [ ] Migrations executadas
- [ ] Aplicação acessível via HTTPS
- [ ] Testes funcionais completos
- [ ] Backups configurados
- [ ] Monitoramento ativado

---

**Versão**: 1.0  
**Data**: 2026-06-19  
**Status**: Pronto para Deploy em Produção
