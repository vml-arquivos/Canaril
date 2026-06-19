# 📁 Estrutura do Repositório - Canário Gestão Pro

## 🎯 Visão Geral

```
canario-gestao-pro/
├── client/                          # Frontend React + Vite
├── server/                          # Backend Express + tRPC
├── drizzle/                         # Banco de dados (schema + migrations)
├── shared/                          # Código compartilhado
├── storage/                         # Helpers S3
├── package.json                     # Dependências
├── tsconfig.json                    # Configuração TypeScript
├── vite.config.ts                   # Configuração Vite
├── drizzle.config.ts                # Configuração Drizzle ORM
├── DEPLOY_GUIDE.md                  # Guia de deploy
└── README.md                        # Documentação principal
```

---

## 📂 Estrutura Detalhada

### `client/` - Frontend React

```
client/
├── public/                          # Arquivos estáticos
│   ├── favicon.ico
│   ├── robots.txt
│   └── __manus__/                   # Arquivos internos Manus
├── src/
│   ├── pages/                       # Páginas principais
│   │   ├── Home.tsx                 # Página pública (institucional)
│   │   ├── Dashboard.tsx            # Dashboard principal
│   │   ├── Birds.tsx                # Gestão de pássaros
│   │   ├── Rings.tsx                # Gestão de anilhas
│   │   ├── Couples.tsx              # Gestão de cruzamentos
│   │   ├── Clutches.tsx             # Gestão de posturas e filhotes
│   │   ├── ControlSheetPDF.tsx      # Ficha de controle de choca
│   │   ├── NotFound.tsx             # Página 404
│   │   └── ComponentShowcase.tsx    # Showcase de componentes
│   ├── components/                  # Componentes reutilizáveis
│   │   ├── DashboardLayout.tsx      # Layout do dashboard
│   │   ├── DashboardLayoutSkeleton.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── AIChatBox.tsx
│   │   ├── Map.tsx
│   │   ├── ManusDialog.tsx
│   │   └── ui/                      # Componentes shadcn/ui
│   ├── contexts/                    # React Contexts
│   │   └── ThemeContext.tsx
│   ├── hooks/                       # Custom Hooks
│   │   ├── useComposition.ts
│   │   ├── useMobile.tsx
│   │   └── usePersistFn.ts
│   ├── _core/                       # Código interno
│   │   └── hooks/
│   │       └── useAuth.ts           # Hook de autenticação
│   ├── lib/
│   │   ├── trpc.ts                  # Cliente tRPC
│   │   └── utils.ts                 # Utilitários
│   ├── const.ts                     # Constantes do frontend
│   ├── index.css                    # Estilos globais
│   ├── main.tsx                     # Entry point
│   └── App.tsx                      # Componente raiz
├── index.html                       # Template HTML
└── tsconfig.json                    # Configuração TypeScript
```

### `server/` - Backend Express + tRPC

```
server/
├── routers/                         # Routers tRPC
│   ├── birds.ts                     # Procedures para pássaros
│   ├── management.ts                # Procedures para gestão
│   └── (outros routers)
├── _core/                           # Código interno do framework
│   ├── index.ts                     # Entry point servidor
│   ├── context.ts                   # Contexto tRPC
│   ├── trpc.ts                      # Setup tRPC
│   ├── oauth.ts                     # OAuth Manus
│   ├── cookies.ts                   # Gerenciamento de cookies
│   ├── env.ts                       # Variáveis de ambiente
│   ├── llm.ts                       # Integração LLM
│   ├── imageGeneration.ts           # Geração de imagens
│   ├── voiceTranscription.ts        # Transcrição de voz
│   ├── notification.ts              # Notificações
│   ├── storageProxy.ts              # Proxy S3
│   ├── systemRouter.ts              # Routers do sistema
│   ├── vite.ts                      # Integração Vite
│   ├── heartbeat.ts                 # Scheduled tasks
│   ├── dataApi.ts                   # Data API
│   ├── map.ts                       # Google Maps
│   ├── sdk.ts                       # SDK Manus
│   └── types/                       # Tipos TypeScript
├── db.ts                            # Helpers de banco de dados
├── routers.ts                       # Router principal
├── storage.ts                       # Helpers S3
└── auth.logout.test.ts              # Teste de exemplo
```

### `drizzle/` - Banco de Dados

```
drizzle/
├── schema.ts                        # Definição das tabelas
├── relations.ts                     # Relacionamentos
├── config.ts                        # Configuração Drizzle
├── migrations/                      # Migrations SQL
│   ├── 0001_init_schema.sql         # Schema inicial
│   ├── 0002_seed_data.sql           # Dados pré-carregados
│   └── (futuras migrations)
├── meta/                            # Metadados Drizzle
│   └── _journal.json
└── (outros arquivos)
```

### `shared/` - Código Compartilhado

```
shared/
├── const.ts                         # Constantes globais
├── types.ts                         # Tipos compartilhados
└── _core/
    └── errors.ts                    # Tratamento de erros
```

### `storage/` - Helpers S3

```
storage/
└── (helpers para upload/download de arquivos)
```

---

## 📊 Tabelas do Banco de Dados

### Schema MySQL

```sql
-- Usuários (OAuth)
users
├── id (PK)
├── openId (unique)
├── name
├── email
├── role (user/admin)
└── timestamps

-- Especialidades
specialties
├── id (PK)
├── code (unique)
├── name
├── description
├── size_cm
├── weight_g
└── status

-- Cores/Mutações
colors
├── id (PK)
├── code (unique)
├── name
├── category
├── genetics (Recessivo/Dominante/Ligado ao Sexo)
├── description
└── status

-- Criadores
breeders
├── id (PK)
├── name
├── city
├── state
├── country
├── registration_number
├── association
├── phone
├── email
├── website
└── description

-- Lotes de Anilhas
ring_batches
├── id (PK)
├── batch_number
├── year
├── color
├── quantity_total
├── quantity_used
└── status

-- Pássaros
birds
├── id (PK)
├── ring (unique)
├── specialty_code (FK)
├── sex
├── color_code (FK)
├── birthDate
├── procedence
├── status
├── fatherId (FK - self)
├── motherId (FK - self)
└── notes

-- Casais/Cruzamentos
couples
├── id (PK)
├── maleId (FK → birds)
├── femaleId (FK → birds)
├── cageNumber
├── formationDate
├── status
└── notes

-- Posturas
clutches
├── id (PK)
├── coupleId (FK → couples)
├── clutchDate
├── totalEggs
├── fertilizedEggs
├── infertileEggs
├── lostEggs
├── hatchedChicks
└── notes

-- Filhotes
chicks
├── id (PK)
├── clutchId (FK → clutches)
├── ring (unique)
├── sex
├── color_code (FK)
├── birthDate
├── ringDate
├── weanDate
├── status
└── notes

-- Regras Genéticas
genetic_rules
├── id (PK)
├── male_color
├── female_color
├── rule_type (recommended/warning/forbidden)
├── description
└── status

-- Associação Especialidade-Cor
specialty_colors
├── id (PK)
├── specialty_code (FK)
├── color_code (FK)
└── status
```

---

## 🔑 Dados Pré-carregados

### Especialidades (6)
- GLOSTER_CORONA
- GLOSTER_CONSORT
- HOLANDÊS
- FRISADO_NORTE
- FRISADO_SUL
- BELGA_CLÁSSICO

### Cores (13)
- AMARELO_INTENSO
- AMARELO_NEVADO
- AMARELO_MOSAICO
- VERMELHO_INTENSO
- VERMELHO_NEVADO
- VERMELHO_MOSAICO
- BRANCO
- PRATEADO
- OPALINO
- FEO
- TOPÁZIO
- ALBINO
- LUTINO

### Criador
- Nome: Canário Lima
- Localização: Brasília, DF
- Registro: CBCA-2024-001
- Associação: Confederação Brasileira de Criadores de Aves (CBCA)

### Anilhas (5 lotes)
- 001 - Vermelha (100 unidades)
- 002 - Azul (100 unidades)
- 003 - Verde (100 unidades)
- 004 - Amarela (100 unidades)
- 005 - Branca (100 unidades)

---

## 🔐 Variáveis de Ambiente

### Obrigatórias para Deploy
```
DATABASE_URL
VITE_APP_ID
OAUTH_SERVER_URL
JWT_SECRET
OWNER_NAME
OWNER_OPEN_ID
BUILT_IN_FORGE_API_URL
BUILT_IN_FORGE_API_KEY
VITE_FRONTEND_FORGE_API_URL
VITE_FRONTEND_FORGE_API_KEY
```

### Opcionais
```
VITE_ANALYTICS_ENDPOINT
VITE_ANALYTICS_WEBSITE_ID
VITE_APP_TITLE
VITE_APP_LOGO
NODE_ENV
```

---

## 📦 Dependências Principais

### Frontend
- React 19
- Tailwind CSS 4
- shadcn/ui
- tRPC Client
- Vite

### Backend
- Express 4
- tRPC 11
- Drizzle ORM
- MySQL2 / PostgreSQL

### DevOps
- TypeScript
- Vitest
- Prettier
- ESLint

---

## 🚀 Scripts Disponíveis

```bash
# Desenvolvimento
pnpm dev              # Inicia servidor de desenvolvimento

# Build
pnpm build            # Build para produção
pnpm check            # Verifica tipos TypeScript

# Banco de Dados
pnpm drizzle-kit generate    # Gera migrations
pnpm drizzle-kit migrate     # Executa migrations

# Testes
pnpm test             # Executa testes Vitest

# Formatação
pnpm format           # Formata código com Prettier

# Produção
pnpm start            # Inicia servidor em produção
```

---

## 📝 Checklist de Arquivos Críticos

- [x] `package.json` - Dependências
- [x] `drizzle/schema.ts` - Schema do banco
- [x] `drizzle/migrations/0001_init_schema.sql` - Criação de tabelas
- [x] `drizzle/migrations/0002_seed_data.sql` - Dados iniciais
- [x] `server/routers.ts` - Router principal
- [x] `server/routers/birds.ts` - Procedures de pássaros
- [x] `server/routers/management.ts` - Procedures de gestão
- [x] `client/src/App.tsx` - Componente raiz
- [x] `client/src/pages/Home.tsx` - Página pública
- [x] `client/src/pages/Dashboard.tsx` - Dashboard
- [x] `DEPLOY_GUIDE.md` - Guia de deploy

---

**Versão**: 1.0  
**Data**: 2026-06-19  
**Status**: Pronto para Deploy
