# Canário Gestão Pro - Status de Produção

## Resolvido nesta revisão
- Dockerfile corrigido para copiar `patches/` antes do `pnpm install --frozen-lockfile`.
- Backend migrado para PostgreSQL (`drizzle-orm/node-postgres` + `pg-core`).
- Migrations PostgreSQL recriadas para refletir as tabelas usadas pelo código.
- Login simulado removido e substituído por autenticação local real via `ADMIN_EMAIL` e `ADMIN_PASSWORD`.
- Healthcheck `/health` criado para Coolify/Docker.
- Menu lateral placeholder removido e substituído pelas áreas reais do sistema.
- Template HTML sem scripts/variáveis de analytics placeholders.

## Próximas evoluções recomendadas
- Implementar edição completa de aves, casais, anilhas e posturas.
- Adicionar testes de integração com PostgreSQL real.
- Quebrar o bundle frontend em chunks dinâmicos para reduzir o aviso de tamanho do Vite.
