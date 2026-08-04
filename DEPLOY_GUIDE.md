# VittaBird — Guia de publicação segura

Este repositório utiliza **Node.js 22**, **PostgreSQL 16**, porta interna **3000** e migrations SQL automáticas.

## 1. Regra de segurança

Nunca grave senhas, chaves, tokens ou a URL real do banco no Git. Use as variáveis secretas do Coolify ou um arquivo `.env` local não versionado, baseado em `.env.production.example`.

Antes de substituir a versão em produção:

1. gere um backup completo do PostgreSQL;
2. preserve a imagem/commit atualmente publicado;
3. valide a nova versão em homologação com uma cópia recente do banco;
4. publique exatamente a mesma imagem validada.

## 2. Variáveis obrigatórias

```env
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:5432/BANCO
JWT_SECRET=GERAR_COM_OPENSSL_RAND_BASE64_48
NODE_ENV=production
PORT=3000
APP_TIME_ZONE=America/Sao_Paulo
CORS_ORIGIN=https://seu-dominio.com.br
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

Opcionais:

```env
ADMIN_EMAIL=
ADMIN_PASSWORD=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
```

Gere o segredo JWT fora do repositório:

```bash
openssl rand -base64 48
```

## 3. Validação antes do deploy

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm validate:hardening
pnpm validate:genetics
pnpm validate:security
pnpm check
pnpm test
pnpm build
```

Não publique se qualquer comando falhar.

## 4. Coolify

- Build pack: **Dockerfile**.
- Porta interna: **3000**.
- Healthcheck: `/ready`.
- Persistência de uploads: montar volume em `/app/uploads`.
- Banco: PostgreSQL acessível por `DATABASE_URL`.
- Não configure porta 80 dentro do container da aplicação.

Na inicialização, a aplicação:

1. valida as variáveis de produção;
2. conecta ao PostgreSQL;
3. obtém um advisory lock;
4. aplica, em ordem, as migrations ainda não registradas em `_app_migrations`;
5. somente depois abre a porta HTTP.

As migrations novas deste pacote são:

- `0025_backfill_ring_tenant.sql`;
- `0026_security_ring_lifecycle.sql`;
- `0027_hatch_log_traceability.sql`;
- `0028_correct_official_ring_gauges.sql`;
- `0029_expand_ring_code_capacity.sql`.

## 5. Docker Compose

Crie um `.env` local fora do Git:

```env
POSTGRES_USER=vittabird
POSTGRES_PASSWORD=GERAR_UMA_SENHA_FORTE
POSTGRES_DB=vittabird
JWT_SECRET=GERAR_COM_OPENSSL_RAND_BASE64_48
CORS_ORIGIN=https://seu-dominio.com.br
COOKIE_SECURE=true
APP_PORT=3000
```

Depois:

```bash
docker compose build --pull
docker compose up -d
docker compose ps
docker compose logs --tail=200 app
curl -fsS http://127.0.0.1:3000/ready
```

## 6. Smoke test obrigatório

Valide em homologação:

- login e renovação da sessão;
- isolamento entre dois criadouros;
- bloqueio de mutations para `VIEWER`;
- dashboard, pássaros, casais e posturas;
- lançamento e correção de eclosão;
- criação de lote de anilhas e contagem disponível;
- concorrência: a mesma anilha não pode ser aplicada duas vezes;
- anilhamento e promoção do filhote;
- genealogia e COI;
- calculadora genética e probabilidades;
- financeiro, suprimentos, fotos e relatórios;
- contexto da IA restrito ao tenant.

## 7. Rollback

Se o smoke test falhar:

1. interrompa a promoção;
2. restaure a imagem anterior;
3. restaure o backup do banco somente quando necessário;
4. não apague manualmente colunas ou registros de `_app_migrations`;
5. não devolva anilhas aplicadas ao estoque.
