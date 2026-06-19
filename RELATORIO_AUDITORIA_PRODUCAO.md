# Relatório de Auditoria e Correção — Canário Gestão Pro

Data da revisão: 2026-06-18

## Diagnóstico real

### 1. Deploy quebrava no `pnpm install --frozen-lockfile`
O `pnpm-lock.yaml` referencia `patches/wouter@3.7.1.patch`, mas o Dockerfile copiava somente `package.json` e `pnpm-lock.yaml` antes do `pnpm install`. Dentro do build Docker a pasta `patches/` ainda não existia, causando erro `ENOENT` e abortando o deploy.

Arquivos envolvidos:
- `Dockerfile`
- `package.json`
- `pnpm-lock.yaml`
- `patches/wouter@3.7.1.patch`

Correção aplicada:
- `COPY patches ./patches` antes do `pnpm install` nas stages builder e runtime.

### 2. Banco configurado como PostgreSQL, mas código usava MySQL
O deploy e o compose estavam apontando para PostgreSQL, enquanto `drizzle/schema.ts`, `server/db.ts` e `drizzle.config.ts` estavam usando MySQL (`mysql-core`, `mysql2`, dialect `mysql`). Mesmo com o build corrigido, o sistema falharia em produção ao acessar banco.

Arquivos envolvidos:
- `drizzle/schema.ts`
- `server/db.ts`
- `drizzle.config.ts`
- `drizzle/migrations/0001_init_schema.sql`
- `drizzle/migrations/0002_seed_data.sql`

Correção aplicada:
- Migração para `drizzle-orm/pg-core` e `drizzle-orm/node-postgres`.
- Dialeto Drizzle alterado para `postgresql`.
- Migrations PostgreSQL recriadas de forma compatível com as tabelas usadas pelo código.

### 3. Migrations inconsistentes com o schema real
As migrations antigas criavam tabelas com nomes/campos diferentes dos usados pelo backend, por exemplo `rings` na migration e `ring_batches` no código. A seed tentava inserir em tabelas que não existiam no schema inicial.

Correção aplicada:
- `0001_init_schema.sql` recriada com `users`, `specialties`, `colors`, `breeders`, `ring_batches`, `birds`, `couples`, `clutches`, `chicks`, `genetic_rules` e `specialty_colors`.
- `0002_seed_data.sql` atualizada com códigos compatíveis com o frontend.
- Migration MySQL solta `drizzle/0000_windy_domino.sql` removida.

### 4. Login era simulado e não persistia sessão real
A página `Login.tsx` simulava sucesso com `setTimeout`, mas não criava cookie nem usuário autenticado. Ao entrar no dashboard, as rotas protegidas continuariam sem sessão válida.

Arquivos envolvidos:
- `client/src/pages/Login.tsx`
- `server/routers.ts`
- `server/_core/env.ts`
- `client/src/main.tsx`
- `client/src/const.ts`

Correção aplicada:
- Criada mutation real `auth.login` com `ADMIN_EMAIL` e `ADMIN_PASSWORD` via ambiente.
- Login agora cria usuário admin no banco e cookie de sessão assinado.
- Redirecionamento de não autenticado aponta para `/login`, sem depender de OAuth externo.
- OAuth continua possível se configurado, mas não é obrigatório.

### 5. Healthcheck apontava para endpoint inexistente
O Dockerfile e compose chamavam `/health`, mas o Express não expunha essa rota.

Correção aplicada:
- Criado `GET /health` em `server/_core/index.ts`.
- Healthcheck do Dockerfile usa `wget` contra `/health`.

### 6. Placeholders e arquivos demonstrativos
Foram encontrados placeholders reais:
- `client/src/pages/ComponentShowcase.tsx`: página demonstrativa, não usada em produção.
- `client/src/components/DashboardLayout.tsx`: menu lateral com `Page 1`, `Page 2` e `/some-path`.
- `client/index.html`: bloco de comentário de template e placeholders de analytics.
- `client/src/pages/Login.tsx`: texto e fluxo de demonstração.

Correção aplicada:
- `ComponentShowcase.tsx` removido.
- Menu lateral substituído por módulos reais: Dashboard, Pássaros, Casais, Anilhas, Posturas e Filhotes.
- HTML limpo e definido como `pt-BR`.
- Login de demonstração removido.

### 7. Segurança de segredos
Havia segredos reais em arquivos de documentação e `.env.production`. Esses valores também apareceram no log de deploy. Esses segredos devem ser considerados expostos.

Correção aplicada:
- `.env.production`, `.env.example`, docs e arquivos auxiliares foram sanitizados com placeholders.

Ação obrigatória em produção:
- Gere novos valores para `JWT_SECRET`, `SESSION_SECRET`, `CSRF_SECRET` e senha admin.
- Atualize as variáveis no Coolify.
- Não reutilize os segredos antigos.

## Arquivos principais alterados

- `Dockerfile`
- `docker-compose.yml`
- `.env.production`
- `.env.example`
- `client/index.html`
- `client/src/const.ts`
- `client/src/main.tsx`
- `client/src/pages/Login.tsx`
- `client/src/components/DashboardLayout.tsx`
- `server/routers.ts`
- `server/routers/management.ts`
- `server/db.ts`
- `server/_core/env.ts`
- `server/_core/index.ts`
- `server/_core/cookies.ts`
- `server/_core/sdk.ts`
- `drizzle.config.ts`
- `drizzle/schema.ts`
- `drizzle/migrations/0001_init_schema.sql`
- `drizzle/migrations/0002_seed_data.sql`
- `todo.md`

## Validações executadas

- `pnpm install --frozen-lockfile`: OK localmente.
- `pnpm check`: OK.
- `pnpm test`: OK, 1 teste aprovado.
- `pnpm build`: OK.
- Smoke test do servidor buildado: `GET /health` retornou `{ "ok": true, "service": "canario-gestao-pro" }`.

Observação: não foi possível executar `docker build` neste ambiente porque o Docker CLI não está disponível no sandbox, mas o erro exato do Dockerfile foi corrigido no fluxo que o log mostrou.

## Variáveis mínimas para produção no Coolify

```env
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO
JWT_SECRET=gere-com-openssl-rand-base64-32
SESSION_SECRET=gere-com-openssl-rand-base64-32
CSRF_SECRET=gere-com-openssl-rand-hex-32
ADMIN_EMAIL=admin@seudominio.com
ADMIN_PASSWORD=senha-forte
ADMIN_NAME=Canário Lima
OWNER_OPEN_ID=canario-lima-admin
VITE_APP_ID=canario-gestao-pro-001
VITE_APP_TITLE=Canário Gestão Pro
PORT=3000
NODE_ENV=production
```

## Próximos pontos recomendados

- Implementar edição completa nos cadastros.
- Adicionar testes de integração com PostgreSQL real.
- Adicionar code-splitting no frontend para remover o aviso de bundle acima de 500 kB.
