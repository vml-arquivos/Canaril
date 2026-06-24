# Baseline de Isolamento de Tenants

Este arquivo registra o estado inicial do repositório antes das correções de isolamento multi‑canaril. Como o projeto não é um repositório Git nesta sandbox, não há informações de branch ou commit. O ambiente também não permite instalar dependências, portanto os comandos de verificação, testes e build falham já de início. Esses erros são **falhas pré‑existentes** e não devem ser confundidos com regressões introduzidas pelas correções.

## Informações do repositório

* **Branch atual**: _indefinido_ (não há diretório `.git`)
* **Commit atual**: _não aplicável_
* **Scripts disponíveis** (package.json):
  * `dev` — inicia servidor em modo desenvolvimento
  * `build` — compila front‑end e back‑end
  * `start` — executa aplicação em produção
  * `check` — executa TypeScript (`tsc --noEmit`)
  * `test` — executa tests com Vitest
  * `db:push` — gera e aplica migrations
  * `seed:knowledge` — insere seeds de conhecimento

## Comandos executados

| Comando                  | Resultado | Observação |
|--------------------------|----------|-----------|
| `git status`            | erro     | O diretório não é um repositório git. |
| `git diff`              | erro     | Não é um repositório git. |
| `git log --oneline -n 20` | erro     | Não é um repositório git. |
| `cat package.json`      | OK       | Mostra scripts e dependências (vide acima). |
| `pnpm run check`        | falha    | `pnpm` não está instalado no ambiente; não foi possível executar. **FALHA PRÉ‑EXISTENTE** |
| `pnpm test`             | falha    | `pnpm` e dependências (`vitest`) ausentes. **FALHA PRÉ‑EXISTENTE** |
| `pnpm run build`        | falha    | `vite` não está instalado; build não é possível. **FALHA PRÉ‑EXISTENTE** |

Todas as falhas acima ocorrem antes de qualquer modificação e refletem limitações do ambiente sandbox. As correções subsequentes não introduziram novas falhas além dessas.