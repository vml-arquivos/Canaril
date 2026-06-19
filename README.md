# 🐦 Canário Lima - Sistema de Gestão de Criadouro

**Sistema profissional e sofisticado para gestão completa de criadouro de Canários Belga com controle de anilhas, genealogia, cruzamentos e produção.**

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Características](#características)
- [Requisitos](#requisitos)
- [Instalação Rápida](#instalação-rápida)
- [Clone do Repositório](#clone-do-repositório)
- [Configuração Local](#configuração-local)
- [Deploy em Produção](#deploy-em-produção)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Dados Pré-carregados](#dados-pré-carregados)
- [Documentação Completa](#documentação-completa)
- [Suporte](#suporte)

---

## 🎯 Visão Geral

**Canário Lima** é um sistema web completo para gerenciar profissionalmente um criadouro de Canários Belga, com:

- ✅ Página pública institucional elegante
- ✅ Área de login protegida
- ✅ Dashboard com estatísticas em tempo real
- ✅ Gestão completa de pássaros (CRUD)
- ✅ Controle de anilhas com alertas de estoque
- ✅ Registro de cruzamentos e casais
- ✅ Acompanhamento de posturas e filhotes
- ✅ Árvore genealógica interativa
- ✅ Ficha de controle de choca para impressão
- ✅ Relatórios em PDF
- ✅ Banco de dados PostgreSQL robusto
- ✅ Deploy com Docker e Nginx

---

## ✨ Características

### Frontend
- **React 19** com Tailwind CSS 4
- **Design elegante e refinado** com paleta âmbar/laranja
- **Responsivo** (mobile, tablet, desktop)
- **Componentes reutilizáveis** com shadcn/ui
- **Navegação intuitiva** com roteamento wouter

### Backend
- **tRPC** para APIs type-safe
- **Express 4** como servidor
- **PostgreSQL** como banco de dados
- **Drizzle ORM** para queries otimizadas
- **JWT** para autenticação
- **CSRF protection** integrada

### Banco de Dados
- **11 tabelas** relacionadas
- **Dados pré-carregados**: especialidades, cores, criador
- **Migrations SQL** prontas
- **Índices otimizados** para performance

### Deployment
- **Docker** com multi-stage build
- **Docker Compose** com PostgreSQL + App + Nginx
- **Nginx** como reverse proxy com SSL/TLS
- **Let's Encrypt** para certificados automáticos
- **Coolify-ready** para gerenciamento simplificado

---

## 📦 Requisitos

### Desenvolvimento Local
- **Node.js** 22.13.0+
- **pnpm** 10.4.1+
- **PostgreSQL** 15+
- **Docker** (opcional, para testes em container)

### Produção
- **VPS** com Docker e Docker Compose
- **Domínio** configurado (ex: canarillima.casadf.com.br)
- **SSL/TLS** (Let's Encrypt)
- **PostgreSQL** (nativo ou container)

---

## 🚀 Instalação Rápida

### 1. Clone o Repositório

```bash
# Clone do repositório
git clone https://github.com/vml-arquivos/Canaril.git
cd Canaril

# Ou com SSH
git clone git@github.com:vml-arquivos/Canaril.git
cd Canaril
```

### 2. Instale Dependências

```bash
# Instalar dependências
pnpm install

# Ou com npm
npm install

# Ou com yarn
yarn install
```

### 3. Configure Banco de Dados Local

```bash
# Criar banco de dados PostgreSQL
createdb canario_lima_db

# Executar migrations
psql canario_lima_db < drizzle/migrations/0001_init_schema.sql
psql canario_lima_db < drizzle/migrations/0002_seed_data.sql

# Ou com Docker
docker run -d \
  --name canario-postgres \
  -e POSTGRES_DB=canario_lima_db \
  -e POSTGRES_USER=postgis \
  -e POSTGRES_PASSWORD=postgis \
  -p 5432:5432 \
  postgres:17-alpine
```

### 4. Configure Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.production .env.local

# Editar .env.local
nano .env.local

# Variáveis essenciais:
DATABASE_URL=postgresql://postgis:postgis@localhost:5432/canario_lima_db
VITE_APP_TITLE=Canário Gestão Pro
JWT_SECRET=seu_jwt_secret_aqui
```

### 5. Inicie o Servidor de Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
pnpm dev

# Ou
npm run dev

# Acesse: http://localhost:3000
```

---

## 📥 Clone do Repositório

### Opção 1: HTTPS (Mais Simples)

```bash
git clone https://github.com/vml-arquivos/Canaril.git
cd Canaril
```

### Opção 2: SSH (Recomendado para CI/CD)

```bash
git clone git@github.com:vml-arquivos/Canaril.git
cd Canaril
```

### Opção 3: GitHub CLI

```bash
gh repo clone vml-arquivos/Canaril
cd Canaril
```

### Opção 4: Download ZIP

```bash
# Baixar arquivo ZIP
curl -L https://github.com/vml-arquivos/Canaril/archive/refs/heads/main.zip -o Canaril.zip

# Descompactar
unzip Canaril.zip
cd Canaril-main
```

---

## ⚙️ Configuração Local

### 1. Instalar Node.js e pnpm

```bash
# macOS (com Homebrew)
brew install node pnpm

# Ubuntu/Debian
sudo apt-get install nodejs npm
npm install -g pnpm

# Windows (com Chocolatey)
choco install nodejs pnpm
```

### 2. Instalar PostgreSQL

```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# Windows
# Baixar de: https://www.postgresql.org/download/windows/

# Iniciar serviço
sudo service postgresql start
```

### 3. Criar Banco de Dados

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Criar banco de dados
CREATE DATABASE canario_lima_db;

# Criar usuário
CREATE USER postgis WITH PASSWORD 'postgis';

# Dar permissões
GRANT ALL PRIVILEGES ON DATABASE canario_lima_db TO postgis;

# Sair
\q
```

### 4. Executar Migrations

```bash
# Conectar ao banco
psql -U postgis -d canario_lima_db

# Executar migrations
\i drizzle/migrations/0001_init_schema.sql
\i drizzle/migrations/0002_seed_data.sql

# Verificar tabelas
\dt

# Sair
\q
```

### 5. Configurar Variáveis de Ambiente

```bash
# Criar arquivo .env.local
cat > .env.local << EOF
DATABASE_URL=postgresql://postgis:postgis@localhost:5432/canario_lima_db
VITE_APP_ID=canario-gestao-pro-001
VITE_APP_TITLE=Canário Gestão Pro
VITE_APP_LOGO=https://canarillima.casadf.com.br/logo.png
JWT_SECRET=troque-por-jwt-secret-forte
CSRF_SECRET=troque-por-csrf-secret-forte
SESSION_SECRET=troque-por-session-secret-forte
OWNER_NAME=Canário Lima
OWNER_OPEN_ID=canario-lima-001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
LOG_LEVEL=info
EOF
```

### 6. Iniciar Desenvolvimento

```bash
# Instalar dependências
pnpm install

# Iniciar servidor de desenvolvimento
pnpm dev

# Em outro terminal, iniciar build watch (opcional)
pnpm check

# Acessar
# http://localhost:3000 (página pública)
# http://localhost:3000/login (login)
# http://localhost:3000/dashboard (dashboard)
```

---

## 🚀 Deploy em Produção

### Opção 1: Deploy com Docker Compose (Recomendado)

```bash
# 1. SSH para VPS
ssh usuario@seu-ip-vps

# 2. Clone repositório
git clone https://github.com/vml-arquivos/Canaril.git
cd Canaril

# 3. Criar diretórios SSL
mkdir -p ssl/canarillima.casadf.com.br

# 4. Gerar certificado SSL
sudo certbot certonly --standalone \
  -d canarillima.casadf.com.br \
  -d www.canarillima.casadf.com.br \
  -m seu-email@exemplo.com \
  --agree-tos \
  --non-interactive

# 5. Copiar certificados
sudo cp /etc/letsencrypt/live/canarillima.casadf.com.br/fullchain.pem ssl/canarillima.casadf.com.br/
sudo cp /etc/letsencrypt/live/canarillima.casadf.com.br/privkey.pem ssl/canarillima.casadf.com.br/
sudo chown -R $USER:$USER ssl/

# 6. Build e Deploy
docker-compose build
docker-compose up -d

# 7. Verificar status
docker-compose ps

# 8. Ver logs
docker-compose logs -f app
```

### Opção 2: Deploy com Coolify (Simplificado)

```bash
# 1. Acesse Coolify
# https://seu-coolify.com.br

# 2. Crie novo projeto
# - Nome: Canário Lima
# - Servidor: Seu servidor

# 3. Adicione aplicação
# - Repositório: https://github.com/vml-arquivos/Canaril.git
# - Branch: main
# - Build: pnpm build
# - Start: node dist/index.js
# - Port: 3000

# 4. Adicione banco de dados
# - Tipo: PostgreSQL
# - Nome: canario_lima_db
# - User: postgis
# - Pass: postgis

# 5. Configure domínio
# - canarillima.casadf.com.br

# 6. Deploy
# Clique em "Deploy" e pronto!
```

### Opção 3: Deploy Manual (Avançado)

```bash
# 1. Clone repositório
git clone https://github.com/vml-arquivos/Canaril.git
cd Canaril

# 2. Instale dependências
pnpm install

# 3. Build
pnpm build

# 4. Configure variáveis
export DATABASE_URL=postgresql://postgis:postgis@seu-host:5432/canario_lima_db
export JWT_SECRET=seu_jwt_secret
export NODE_ENV=production

# 5. Inicie servidor
node dist/index.js

# 6. Configure Nginx como reverse proxy
# Veja nginx.conf para exemplo
```

---

## 📁 Estrutura do Projeto

```
Canaril/
├── 📄 README.md (este arquivo)
├── 📄 Dockerfile (Build da aplicação)
├── 📄 docker-compose.yml (Orquestração)
├── 📄 nginx.conf (Reverse proxy)
├── 📄 .env.production (Variáveis de produção)
│
├── 📂 client/ (Frontend React)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx (Página pública)
│   │   │   ├── Login.tsx (Login)
│   │   │   ├── Dashboard.tsx (Dashboard)
│   │   │   ├── Birds.tsx (Gestão de pássaros)
│   │   │   ├── Couples.tsx (Cruzamentos)
│   │   │   ├── Rings.tsx (Anilhas)
│   │   │   ├── Clutches.tsx (Posturas/Filhotes)
│   │   │   └── ControlSheetPDF.tsx (Ficha de choca)
│   │   ├── components/ (UI components)
│   │   ├── App.tsx (Roteamento)
│   │   └── index.css (Estilos globais)
│   ├── index.html
│   └── vite.config.ts
│
├── 📂 server/ (Backend tRPC)
│   ├── routers.ts (APIs principais)
│   ├── routers/
│   │   ├── birds.ts (Gestão de pássaros)
│   │   └── management.ts (Anilhas, cruzamentos, posturas)
│   ├── db.ts (Queries)
│   └── _core/ (Autenticação, contexto)
│
├── 📂 drizzle/ (Banco de Dados)
│   ├── schema.ts (Definição de tabelas)
│   ├── relations.ts (Relacionamentos)
│   └── migrations/
│       ├── 0001_init_schema.sql (Schema inicial)
│       └── 0002_seed_data.sql (Dados pré-carregados)
│
├── 📂 shared/ (Tipos e constantes)
│   ├── constants.ts (Especialidades, cores, etc.)
│   └── types.ts (Tipos TypeScript)
│
├── 📄 package.json (Dependências)
├── 📄 tsconfig.json (TypeScript config)
├── 📄 vite.config.ts (Vite config)
│
└── 📂 docs/ (Documentação)
    ├── DEPLOY_VPS_FINAL.md (Guia de deploy)
    ├── DOCKER_DEPLOY.md (Deploy com Docker)
    ├── DEPLOYMENT_CHECKLIST.md (Checklist)
    └── REPOSITORY_STRUCTURE.md (Estrutura)
```

---

## 📊 Dados Pré-carregados

### Especialidades (6)
- Gloster Corona
- Gloster Consort
- Holandês
- Frisado do Norte
- Frisado do Sul
- Belga Clássico

### Cores/Mutações (13)
- Amarelo Intenso
- Amarelo Nevado
- Amarelo Mosaico
- Vermelho Intenso
- Vermelho Nevado
- Branco Intenso
- Branco Nevado
- Prateado
- Opalino
- Feo
- Topázio
- Albino
- Lutino

### Criador
- **Nome**: Canário Lima
- **Localização**: Brasília, Distrito Federal
- **Registro**: CBCA-2024-001

### Anilhas (5 lotes)
- 100 unidades vermelhas
- 100 unidades azuis
- 100 unidades verdes
- 100 unidades amarelas
- 100 unidades brancas

---

## 📚 Documentação Completa

### Guias de Deploy
- **[DEPLOY_VPS_FINAL.md](./DEPLOY_VPS_FINAL.md)** - Passo a passo completo (10 passos)
- **[DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md)** - Deploy com Docker
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Checklist pré-deploy

### Referências Técnicas
- **[REPOSITORY_STRUCTURE.md](./REPOSITORY_STRUCTURE.md)** - Estrutura do projeto
- **[DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)** - Guia geral de deploy

---

## 🎯 URLs de Acesso

Após deploy bem-sucedido:

| Página | URL | Tipo |
|--------|-----|------|
| **Página Pública** | https://canarillima.casadf.com.br | Pública |
| **Login** | https://canarillima.casadf.com.br/login | Pública |
| **Dashboard** | https://canarillima.casadf.com.br/dashboard | Protegida |
| **Pássaros** | https://canarillima.casadf.com.br/birds | Protegida |
| **Cruzamentos** | https://canarillima.casadf.com.br/couples | Protegida |
| **Anilhas** | https://canarillima.casadf.com.br/rings | Protegida |
| **Posturas/Filhotes** | https://canarillima.casadf.com.br/clutches | Protegida |

---

## 🔧 Comandos Úteis

### Desenvolvimento
```bash
pnpm dev          # Iniciar servidor de desenvolvimento
pnpm build        # Build para produção
pnpm start        # Iniciar servidor de produção
pnpm test         # Executar testes
pnpm check        # Verificar tipos TypeScript
pnpm format       # Formatar código
```

### Docker
```bash
docker-compose build              # Build das imagens
docker-compose up -d              # Iniciar containers
docker-compose down               # Parar containers
docker-compose logs -f app        # Ver logs da aplicação
docker-compose ps                 # Status dos containers
docker-compose restart            # Reiniciar containers
```

### Banco de Dados
```bash
psql -U postgis -d canario_lima_db        # Conectar ao banco
\dt                                        # Listar tabelas
\d nome_tabela                             # Descrever tabela
SELECT * FROM birds LIMIT 10;              # Consultar dados
```

---

## 🐛 Troubleshooting

### Erro: "Connection refused"
```bash
# Verificar se PostgreSQL está rodando
sudo service postgresql status

# Ou com Docker
docker-compose logs postgres
```

### Erro: "Port already in use"
```bash
# Encontrar processo na porta
lsof -i :3000

# Matar processo
kill -9 <PID>
```

### Erro: "SSL certificate error"
```bash
# Renovar certificado
sudo certbot renew --force-renewal

# Copiar certificados
sudo cp /etc/letsencrypt/live/canarillima.casadf.com.br/fullchain.pem ssl/canarillima.casadf.com.br/
sudo cp /etc/letsencrypt/live/canarillima.casadf.com.br/privkey.pem ssl/canarillima.casadf.com.br/

# Reiniciar Nginx
docker-compose restart nginx
```

---

## 📞 Suporte

### Documentação
- Veja os arquivos `.md` na raiz do projeto
- Consulte comentários no código-fonte
- Verifique os logs em `.manus-logs/`

### Contato
- **Criador**: Canário Lima
- **Localização**: Brasília, DF
- **Registro**: CBCA-2024-001

---

## 📄 Licença

Este projeto é propriedade do Criadouro Canário Lima.

---

## ✅ Checklist de Deploy

- [ ] Repositório clonado
- [ ] Dependências instaladas (`pnpm install`)
- [ ] Banco de dados criado
- [ ] Migrations executadas
- [ ] Variáveis de ambiente configuradas
- [ ] Build testado localmente (`pnpm build`)
- [ ] Servidor local funcionando (`pnpm dev`)
- [ ] DNS apontado para VPS
- [ ] Certificado SSL gerado
- [ ] Docker Compose iniciado (`docker-compose up -d`)
- [ ] Aplicação acessível via HTTPS
- [ ] Testes funcionais completos
- [ ] Backups configurados

---

**Versão**: 1.0  
**Data**: 2026-06-19  
**Status**: ✅ Pronto para Produção

🚀 **Boa sorte com seu Criadouro Canário Lima!**
