# VittaBird — Deploy final em VPS/Coolify

Use este arquivo junto com `DEPLOY_GUIDE.md` e `DEPLOYMENT_CHECKLIST.md`.

## Configuração essencial

- Runtime: Dockerfile incluído no repositório.
- Porta interna: `3000`.
- Healthcheck: `/ready`.
- Banco: PostgreSQL 16 ou compatível.
- Uploads persistentes: `/app/uploads`.
- Migrations: executadas automaticamente antes do servidor aceitar requisições.

## Segredos

Cadastre todos os valores reais apenas no painel de secrets do provedor. Não copie chaves, senhas ou tokens para este arquivo ou para o Git.

Variáveis mínimas:

```env
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:5432/BANCO
JWT_SECRET=GERAR_COM_OPENSSL_RAND_BASE64_48
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://seu-dominio.com.br
COOKIE_SECURE=true
APP_TIME_ZONE=America/Sao_Paulo
```

## Publicação

```bash
pnpm install --frozen-lockfile
pnpm validate:hardening
pnpm validate:genetics
pnpm validate:security
pnpm check
pnpm test
pnpm build
```

Depois faça o deploy da imagem validada e confirme:

```bash
curl -fsS https://seu-dominio.com.br/ready
```

Resposta esperada:

```json
{"ok":true,"database":"ready"}
```

A publicação só está concluída depois do smoke test listado em `DEPLOYMENT_CHECKLIST.md`.
