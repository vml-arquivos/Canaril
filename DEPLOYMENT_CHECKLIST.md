# VittaBird — Checklist de implantação

## Antes do build

- [ ] Backup PostgreSQL testado e armazenado fora da VPS.
- [ ] Versão atual identificada para rollback.
- [ ] Homologação usa cópia recente e anonimizada do banco.
- [ ] Nenhum `.env` real ou segredo está versionado.
- [ ] `DATABASE_URL`, `JWT_SECRET`, domínio e cookies estão configurados no ambiente.

## Qualidade

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm validate:hardening`
- [ ] `pnpm validate:genetics`
- [ ] `pnpm validate:security`
- [ ] `pnpm check`
- [ ] `pnpm test`
- [ ] `pnpm build`

## Banco

- [ ] PostgreSQL disponível antes da aplicação.
- [ ] Usuário do banco possui permissão para migrations.
- [ ] Migrations `0025` a `0029` aplicadas automaticamente sem erro.
- [ ] `_app_migrations` registra cada arquivo uma única vez.
- [ ] Contagem de anilhas conferida após o deploy.

## Aplicação

- [ ] Porta interna 3000.
- [ ] `/health` responde HTTP 200.
- [ ] `/ready` responde HTTP 200 e `database: ready`.
- [ ] Volume persistente montado em `/app/uploads`.
- [ ] Logs não exibem segredo, senha ou URL completa do banco.

## Smoke test

- [ ] Login.
- [ ] Isolamento multi-tenant.
- [ ] Perfil `VIEWER` somente leitura.
- [ ] Cadastro de pássaro.
- [ ] Formação de casal.
- [ ] Postura e eclosão.
- [ ] Correção da quantidade de eclosão antes do anilhamento.
- [ ] Bloqueio da exclusão/correção quando o filhote já possui histórico.
- [ ] Lote e uso de anilha.
- [ ] Anilhamento concorrente sem duplicidade.
- [ ] Genealogia, COI e calculadora genética.
- [ ] Financeiro, suprimentos, relatórios e IA.

## Produção

- [ ] Mesma imagem aprovada em homologação.
- [ ] Janela de deploy definida.
- [ ] Monitoramento de logs, CPU, memória e banco durante a publicação.
- [ ] Plano de rollback pronto.
