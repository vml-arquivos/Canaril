# 🚀 Guia Completo de Deploy - Canário Gestão Pro

## 📋 Sumário
1. [Verificação Pré-Deploy](#verificação-pré-deploy)
2. [Configuração do Banco de Dados](#configuração-do-banco-de-dados)
3. [Variáveis de Ambiente](#variáveis-de-ambiente)
4. [Deploy na Qualify](#deploy-na-qualify)
5. [Testes em Produção](#testes-em-produção)
6. [Troubleshooting](#troubleshooting)

---

## ✅ Verificação Pré-Deploy

### 1. Estrutura do Repositório
Confirme que todos os arquivos estão presentes:

```bash
# Verificar estrutura
ls -la

# Arquivos críticos que devem existir:
# ✓ package.json
# ✓ drizzle.config.ts
# ✓ drizzle/schema.ts
# ✓ drizzle/migrations/0001_init_schema.sql
# ✓ drizzle/migrations/0002_seed_data.sql
# ✓ server/routers.ts
# ✓ server/routers/birds.ts
# ✓ server/routers/management.ts
# ✓ client/src/App.tsx
# ✓ vite.config.ts
```

### 2. Verificar Dependências
```bash
# Instalar dependências
pnpm install

# Verificar build
pnpm build

# Verificar tipos TypeScript
pnpm check
```

### 3. Testar Localmente
```bash
# Iniciar servidor de desenvolvimento
pnpm dev

# Acessar em http://localhost:3000
# Testar página pública
# Testar login
# Testar dashboard
```

---

## 🗄️ Configuração do Banco de Dados

### Opção 1: MySQL/MariaDB (Recomendado para Qualify)

#### Criar Banco de Dados
```sql
-- Conectar ao servidor MySQL
mysql -u root -p

-- Criar banco de dados
CREATE DATABASE canario_lima_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Criar usuário
CREATE USER 'canario_user'@'localhost' IDENTIFIED BY 'SenhaForte123!@#';

-- Conceder permissões
GRANT ALL PRIVILEGES ON canario_lima_db.* TO 'canario_user'@'localhost';
FLUSH PRIVILEGES;

-- Verificar
SHOW DATABASES;
```

#### Executar Migrations
```bash
# Executar schema inicial
mysql -u canario_user -p canario_lima_db < drizzle/migrations/0001_init_schema.sql

# Executar seed data (dados pré-carregados)
mysql -u canario_user -p canario_lima_db < drizzle/migrations/0002_seed_data.sql

# Verificar tabelas criadas
mysql -u canario_user -p canario_lima_db -e "SHOW TABLES;"
```

### Opção 2: PostgreSQL (Alternativa)

#### Criar Banco de Dados
```bash
# Conectar ao PostgreSQL
psql -U postgres

# Criar banco de dados
CREATE DATABASE canario_lima_db WITH ENCODING 'UTF8';

# Criar usuário
CREATE USER canario_user WITH PASSWORD 'SenhaForte123!@#';

# Conceder permissões
ALTER ROLE canario_user SET client_encoding TO 'utf8';
ALTER ROLE canario_user SET default_transaction_isolation TO 'read committed';
GRANT ALL PRIVILEGES ON DATABASE canario_lima_db TO canario_user;
```

---

## 🔐 Variáveis de Ambiente

### Arquivo `.env.production`

Crie um arquivo `.env.production` com as seguintes variáveis:

```bash
# ============================================================================
# DATABASE
# ============================================================================
# MySQL
DATABASE_URL="mysql://canario_user:SenhaForte123!@#@localhost:3306/canario_lima_db"

# OU PostgreSQL
# DATABASE_URL="postgresql://canario_user:SenhaForte123!@#@localhost:5432/canario_lima_db"

# ============================================================================
# OAUTH / AUTENTICAÇÃO
# ============================================================================
# Fornecido pelo Manus
VITE_APP_ID="seu_app_id_aqui"
OAUTH_SERVER_URL="https://api.manus.im"
VITE_OAUTH_PORTAL_URL="https://login.manus.im"
JWT_SECRET="gere_uma_chave_segura_aqui_min_32_caracteres"

# ============================================================================
# OWNER / CRIADOR
# ============================================================================
OWNER_NAME="Seu Nome"
OWNER_OPEN_ID="seu_open_id_manus"

# ============================================================================
# APIS INTERNAS MANUS
# ============================================================================
BUILT_IN_FORGE_API_URL="https://forge.manus.im/api"
BUILT_IN_FORGE_API_KEY="sua_chave_api_manus"
VITE_FRONTEND_FORGE_API_URL="https://forge.manus.im/api"
VITE_FRONTEND_FORGE_API_KEY="sua_chave_api_frontend_manus"

# ============================================================================
# ANALYTICS
# ============================================================================
VITE_ANALYTICS_ENDPOINT="https://analytics.manus.im"
VITE_ANALYTICS_WEBSITE_ID="seu_website_id"

# ============================================================================
# APP BRANDING
# ============================================================================
VITE_APP_TITLE="Canário Gestão Pro"
VITE_APP_LOGO="https://seu-dominio.com/logo.png"

# ============================================================================
# NODE
# ============================================================================
NODE_ENV="production"
```

### Gerar Chaves Seguras

```bash
# Gerar JWT_SECRET (32+ caracteres)
openssl rand -base64 32

# Gerar chave aleatória para CSRF
openssl rand -hex 32
```

---

## 🚀 Deploy na Qualify

### 1. Preparar Projeto para Deploy

```bash
# Limpar build anterior
rm -rf dist/

# Instalar dependências
pnpm install

# Build do projeto
pnpm build

# Verificar se build foi bem-sucedido
ls -la dist/
```

### 2. Configurar na Plataforma Qualify

#### Passo 1: Conectar Repositório
1. Acessar [Qualify Dashboard](https://qualify.com)
2. Clicar em "New Project"
3. Selecionar repositório GitHub
4. Conectar repositório `vml-arquivos/Canaril`

#### Passo 2: Configurar Build
- **Build Command**: `pnpm build`
- **Start Command**: `node dist/index.js`
- **Root Directory**: `/`
- **Node Version**: `22.13.0`

#### Passo 3: Adicionar Variáveis de Ambiente
No painel de Variáveis de Ambiente, adicionar:

```
DATABASE_URL=mysql://canario_user:SenhaForte123!@#@seu-host-mysql:3306/canario_lima_db
VITE_APP_ID=seu_app_id
OAUTH_SERVER_URL=https://api.manus.im
JWT_SECRET=sua_chave_gerada
OWNER_NAME=Seu Nome
OWNER_OPEN_ID=seu_open_id
BUILT_IN_FORGE_API_URL=https://forge.manus.im/api
BUILT_IN_FORGE_API_KEY=sua_chave_api
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im/api
VITE_FRONTEND_FORGE_API_KEY=sua_chave_api_frontend
VITE_ANALYTICS_ENDPOINT=https://analytics.manus.im
VITE_ANALYTICS_WEBSITE_ID=seu_website_id
VITE_APP_TITLE=Canário Gestão Pro
NODE_ENV=production
```

#### Passo 4: Configurar Banco de Dados
- Criar banco MySQL na Qualify OU usar banco externo
- Executar migrations no banco:
  ```bash
  mysql -u canario_user -p canario_lima_db < drizzle/migrations/0001_init_schema.sql
  mysql -u canario_user -p canario_lima_db < drizzle/migrations/0002_seed_data.sql
  ```

#### Passo 5: Deploy
1. Clicar em "Deploy"
2. Aguardar build (5-10 minutos)
3. Verificar logs
4. Acessar URL do projeto

### 3. Configurar Domínio Customizado

```bash
# Adicionar domínio customizado
# Qualify → Settings → Domains → Add Domain

# Configurar DNS (exemplo para canarioslima.com.br):
# Tipo: CNAME
# Nome: canarioslima.com.br
# Valor: seu-projeto.qualify.app
```

---

## 🧪 Testes em Produção

### 1. Verificar Saúde da Aplicação

```bash
# Acessar endpoint de saúde
curl https://seu-dominio.com/api/health

# Esperado: { "status": "ok" }
```

### 2. Testar Fluxo Completo

- [ ] Acessar página pública (/)
- [ ] Verificar especialidades e cores
- [ ] Fazer login com OAuth
- [ ] Acessar dashboard
- [ ] Verificar totalizadores
- [ ] Cadastrar novo pássaro
- [ ] Cadastrar lote de anilhas
- [ ] Formar novo casal
- [ ] Registrar postura
- [ ] Gerar ficha de controle de choca
- [ ] Fazer logout

### 3. Monitorar Logs

```bash
# Ver logs em tempo real
tail -f logs/production.log

# Verificar erros
grep ERROR logs/production.log
```

---

## 🔧 Troubleshooting

### Erro: "Database connection failed"

**Solução:**
```bash
# Verificar DATABASE_URL
echo $DATABASE_URL

# Testar conexão
mysql -u canario_user -p -h seu-host canario_lima_db -e "SELECT 1;"

# Se usar PostgreSQL
psql postgresql://canario_user:senha@host:5432/canario_lima_db -c "SELECT 1;"
```

### Erro: "Migration failed"

**Solução:**
```bash
# Verificar se tabelas já existem
mysql -u canario_user -p canario_lima_db -e "SHOW TABLES;"

# Se precisar resetar (CUIDADO - apaga dados!)
mysql -u canario_user -p canario_lima_db < drizzle/migrations/0001_init_schema.sql
```

### Erro: "OAuth not configured"

**Solução:**
```bash
# Verificar variáveis
echo $VITE_APP_ID
echo $OAUTH_SERVER_URL

# Regenerar JWT_SECRET
openssl rand -base64 32
```

### Erro: "Build failed"

**Solução:**
```bash
# Limpar cache
rm -rf node_modules/.pnpm
pnpm install

# Verificar tipos
pnpm check

# Build local
pnpm build
```

---

## 📊 Checklist Final de Deploy

- [ ] Repositório GitHub atualizado e sincronizado
- [ ] Todas as variáveis de ambiente configuradas
- [ ] Banco de dados criado e migrations executadas
- [ ] Build local testado com sucesso
- [ ] Testes em desenvolvimento passando
- [ ] Domínio configurado (se customizado)
- [ ] SSL/HTTPS ativado
- [ ] Backups do banco configurados
- [ ] Monitoramento de logs ativado
- [ ] Testes em produção completos
- [ ] Documentação atualizada

---

## 📞 Suporte e Próximos Passos

### Melhorias Futuras (Sistema Mais Inteligente)

1. **IA para Análise Genética**
   - Sugerir cruzamentos ideais baseado em genealogia
   - Alertar sobre consanguinidade alta
   - Prever cores dos filhotes

2. **Relatórios Avançados**
   - Gráficos de produção por período
   - Análise de rentabilidade
   - Comparativo entre casais

3. **Automação**
   - Notificações automáticas de posturas
   - Lembretes de datas importantes
   - Alertas de anilhas acabando

4. **Mobile App**
   - App nativo para iOS/Android
   - Sincronização offline
   - Câmera para fotos de pássaros

---

## 📝 Notas Importantes

- **Backup Diário**: Configure backups automáticos do banco
- **Monitoramento**: Ative alertas para erros e downtime
- **Segurança**: Mude senhas padrão imediatamente
- **Escalabilidade**: Monitore uso de recursos (CPU, memória, BD)

---

**Versão**: 1.0  
**Data**: 2026-06-19  
**Atualizado por**: Sistema Canário Lima
