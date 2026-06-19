# 🚀 Guia Final de Deploy - Canário Gestão Pro

## 📌 Informações do Projeto

| Item | Valor |
|------|-------|
| **Domínio** | canarillima.casadf.com.br |
| **Banco de Dados** | PostgreSQL (postgis:postgis) |
| **Aplicação** | Node.js + Express + React |
| **Reverse Proxy** | Nginx com SSL/TLS |
| **Orquestração** | Docker Compose |
| **Status** | ✅ Pronto para Deploy |

---

## 🔑 Chaves e Secrets (SALVE EM LOCAL SEGURO)

### JWT_SECRET
```
TVITqnLcUTCxp0ucX8aZlBHKjlKSBnt1a6v0y+bD25Y=
```

### CSRF_SECRET
```
26e3313ac552271a67533cd7d4b8f04f357c023b271c311c6c6aaa4632b5309b
```

### SESSION_SECRET
```
BKyZUOvHcSqgKWj2V6Ski9kz2FjVyEZJb8IAHHxfyrs=
```

### Backup API Keys
```
Y8HqS00lr7JcjAsD/kuza/qL03k8JHTTA5qJntSwaz4=
87cb3cda00559c41628781911f297d2cb8efd8b293020234e6d65924c1e74f02
```

---

## 📋 Passo a Passo de Deploy

### PASSO 1: Preparar VPS

```bash
# 1.1 SSH para VPS
ssh usuario@seu-ip-vps

# 1.2 Atualizar sistema
sudo apt-get update && sudo apt-get upgrade -y

# 1.3 Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 1.4 Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 1.5 Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
newgrp docker

# 1.6 Verificar instalação
docker --version
docker-compose --version
```

### PASSO 2: Configurar DNS

**Apontar domínio para VPS:**

```
Tipo: A
Nome: canarillima.casadf.com.br
Valor: SEU_IP_VPS

Tipo: A
Nome: www.canarillima.casadf.com.br
Valor: SEU_IP_VPS
```

**Verificar propagação:**
```bash
nslookup canarillima.casadf.com.br
dig canarillima.casadf.com.br
```

### PASSO 3: Clonar Repositório

```bash
# 3.1 Criar diretório
mkdir -p /home/$USER/apps
cd /home/$USER/apps

# 3.2 Clonar repositório
git clone https://github.com/vml-arquivos/Canaril.git
cd Canaril

# 3.3 Verificar estrutura
ls -la
```

### PASSO 4: Configurar SSL com Let's Encrypt

```bash
# 4.1 Instalar Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 4.2 Gerar certificado
sudo certbot certonly --standalone \
  -d canarillima.casadf.com.br \
  -d www.canarillima.casadf.com.br \
  -m seu-email@exemplo.com \
  --agree-tos \
  --non-interactive

# 4.3 Criar diretório SSL
mkdir -p ssl/canarillima.casadf.com.br

# 4.4 Copiar certificados
sudo cp /etc/letsencrypt/live/canarillima.casadf.com.br/fullchain.pem \
  ssl/canarillima.casadf.com.br/fullchain.pem

sudo cp /etc/letsencrypt/live/canarillima.casadf.com.br/privkey.pem \
  ssl/canarillima.casadf.com.br/privkey.pem

# 4.5 Ajustar permissões
sudo chown -R $USER:$USER ssl/
chmod 600 ssl/canarillima.casadf.com.br/privkey.pem
chmod 644 ssl/canarillima.casadf.com.br/fullchain.pem

# 4.6 Verificar certificado
openssl x509 -in ssl/canarillima.casadf.com.br/fullchain.pem -text -noout
```

### PASSO 5: Configurar Variáveis de Ambiente

```bash
# 5.1 Editar .env.production
nano .env.production

# Verificar se está correto:
# DATABASE_URL="postgresql://postgis:postgis@postgres:5432/canario_lima_db"
# CORS_ORIGIN="https://canarillima.casadf.com.br,https://www.canarillima.casadf.com.br"
# VITE_APP_LOGO="https://canarillima.casadf.com.br/logo.png"
```

### PASSO 6: Configurar Nginx

```bash
# 6.1 Verificar nginx.conf
cat nginx.conf | grep -A 2 "server_name"

# Deve mostrar:
# server_name canarillima.casadf.com.br www.canarillima.casadf.com.br;

# 6.2 Se precisar editar
nano nginx.conf
```

### PASSO 7: Build e Deploy

```bash
# 7.1 Build da imagem Docker
docker-compose build

# 7.2 Iniciar containers
docker-compose up -d

# 7.3 Verificar status
docker-compose ps

# Esperado:
# postgres    running
# app         running
# nginx       running

# 7.4 Ver logs
docker-compose logs -f

# Aguarde até ver:
# [OAuth] Initialized with baseURL
# Server running on http://localhost:3000/
```

### PASSO 8: Executar Migrations

```bash
# 8.1 Verificar se tabelas foram criadas
docker-compose exec postgres psql -U postgis -d canario_lima_db -c "\dt"

# Deve listar as tabelas:
# users, specialties, colors, breeders, ring_batches, birds, couples, clutches, chicks, genetic_rules, specialty_colors

# 8.2 Se precisar executar manualmente
docker-compose exec postgres psql -U postgis -d canario_lima_db < drizzle/migrations/0001_init_schema.sql
docker-compose exec postgres psql -U postgis -d canario_lima_db < drizzle/migrations/0002_seed_data.sql
```

### PASSO 9: Configurar Firewall

```bash
# 9.1 UFW (Ubuntu)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 9.2 Verificar
sudo ufw status

# Esperado:
# 22/tcp    ALLOW
# 80/tcp    ALLOW
# 443/tcp   ALLOW
```

### PASSO 10: Testar Aplicação

```bash
# 10.1 Verificar saúde
curl -k https://canarillima.casadf.com.br/health

# Esperado: {"status":"ok"}

# 10.2 Acessar no navegador
# https://canarillima.casadf.com.br

# 10.3 Testar fluxo:
# - Página pública carrega
# - Especialidades visíveis
# - Dashboard acessível
# - Cadastro de pássaro funciona
# - Ficha de controle gera PDF
```

---

## 🔄 Auto-renovação de SSL

```bash
# 1. Criar script de renovação
sudo nano /usr/local/bin/renew-ssl-canario.sh

#!/bin/bash
cd /home/$USER/apps/Canaril
sudo certbot renew --quiet
sudo cp /etc/letsencrypt/live/canarillima.casadf.com.br/fullchain.pem ssl/canarillima.casadf.com.br/fullchain.pem
sudo cp /etc/letsencrypt/live/canarillima.casadf.com.br/privkey.pem ssl/canarillima.casadf.com.br/privkey.pem
sudo chown $USER:$USER ssl/canarillima.casadf.com.br/*
docker-compose restart nginx

# 2. Tornar executável
sudo chmod +x /usr/local/bin/renew-ssl-canario.sh

# 3. Adicionar ao crontab
sudo crontab -e

# Adicionar linha:
0 3 * * * /usr/local/bin/renew-ssl-canario.sh

# 4. Verificar crontab
sudo crontab -l
```

---

## 📊 Monitoramento

### Verificar Status

```bash
# Status dos containers
docker-compose ps

# Logs em tempo real
docker-compose logs -f

# Logs de erro
docker-compose logs app | grep ERROR

# Uso de recursos
docker stats

# Saúde do banco
docker-compose exec postgres pg_isready -U postgis
```

### Backups

```bash
# Backup do banco
docker-compose exec postgres pg_dump -U postgis canario_lima_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Listar backups
ls -lh backup_*.sql

# Restaurar backup
docker-compose exec -T postgres psql -U postgis canario_lima_db < backup_20260619_120000.sql
```

### Atualizações

```bash
# Atualizar código
git pull origin main

# Rebuild
docker-compose build

# Reiniciar
docker-compose up -d

# Verificar
docker-compose ps
docker-compose logs app
```

---

## 🆘 Troubleshooting

### Erro: "Connection refused"

```bash
# Reiniciar containers
docker-compose restart

# Verificar logs
docker-compose logs app
```

### Erro: "SSL certificate error"

```bash
# Verificar certificado
openssl x509 -in ssl/canarillima.casadf.com.br/fullchain.pem -text -noout

# Renovar
sudo certbot renew --force-renewal

# Copiar
sudo cp /etc/letsencrypt/live/canarillima.casadf.com.br/fullchain.pem ssl/canarillima.casadf.com.br/
sudo cp /etc/letsencrypt/live/canarillima.casadf.com.br/privkey.pem ssl/canarillima.casadf.com.br/

# Reiniciar
docker-compose restart nginx
```

### Erro: "Database connection failed"

```bash
# Verificar PostgreSQL
docker-compose exec postgres pg_isready -U postgis

# Verificar variáveis
docker-compose config | grep DATABASE_URL

# Reconectar
docker-compose restart postgres app
```

### Erro: "Port already in use"

```bash
# Encontrar processo
sudo lsof -i :80
sudo lsof -i :443
sudo lsof -i :5432

# Matar processo
sudo kill -9 <PID>

# Reiniciar
docker-compose restart
```

---

## ✅ Checklist Final

- [ ] DNS apontado para VPS
- [ ] SSH acesso configurado
- [ ] Docker e Docker Compose instalados
- [ ] Certificado SSL gerado
- [ ] .env.production configurado
- [ ] nginx.conf atualizado
- [ ] Repositório clonado
- [ ] Build executado com sucesso
- [ ] Containers iniciados
- [ ] Migrations executadas
- [ ] Firewall configurado
- [ ] Aplicação acessível via HTTPS
- [ ] Testes funcionais completos
- [ ] Backups configurados
- [ ] Auto-renovação SSL ativada

---

## 📞 Informações de Contato

**Domínio**: canarillima.casadf.com.br  
**Criador**: Canário Lima  
**Localização**: Brasília, DF  
**Registro**: CBCA-2024-001  

---

## 🎯 Próximas Ações

1. ✅ Executar Passo 1-10 acima
2. ✅ Testar aplicação
3. ✅ Configurar backups
4. ✅ Ativar monitoramento
5. ✅ Documentar processo

---

**Versão**: 1.0  
**Data**: 2026-06-19  
**Status**: ✅ Pronto para Deploy em Produção
