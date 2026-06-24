# Baseline de Regressão — Canaril

Este arquivo documenta o estado do repositório **Canaril** antes da aplicação de qualquer correção, conforme exigido pela política de **Regressão Zero**. Todas as informações abaixo refletem o resultado obtido no ambiente de auditoria atual e servem como referência para garantir que alterações futuras não introduzam novas quebras.

## Branch e commit atuais

Este pacote zipado não contém um repositório Git inicializado. Portanto, os comandos `git status`, `git diff` e `git log` não retornam informações de branch ou histórico. O repositório deve ser inicializado ou conectado a um controle de versão externo para prover esse contexto.

## Scripts disponíveis (`package.json`)

Os scripts definidos no arquivo `package.json` são os seguintes:

```
"dev": "NODE_ENV=development tsx watch server/_core/index.ts",
"build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --external:./viteDevServer --bundle --format=esm --outdir=dist",
"start": "NODE_ENV=production node dist/index.js",
"check": "tsc --noEmit",
"format": "prettier --write .",
"test": "vitest run",
"db:push": "drizzle-kit generate && drizzle-kit migrate",
"seed:knowledge": "tsx server/_core/canarilIntelligence/seeds/canaryKnowledgeSeed.ts"
```

## Resultado do `pnpm install --frozen-lockfile`

A tentativa de executar `pnpm install --frozen-lockfile` falhou porque o binário `pnpm` não está disponível globalmente no ambiente de auditoria e o `npx pnpm` retornou erro **403 Forbidden** ao tentar baixar o pacote. Essa falha impede a instalação das dependências e é considerada uma **FALHA PRÉ‑EXISTENTE** no ambiente de testes.

## Resultado do `npm run check`

O comando `npm run check` (que executa o TypeScript Compiler) falhou imediatamente com o seguinte erro:

```
error TS2688: Cannot find type definition file for 'vite/client'.
  The file is in the program because:
    Entry point of type library 'vite/client' specified in compilerOptions
```

Esta falha decorre da ausência de dependências instaladas e configurações de tipo, portanto é registrada como **FALHA PRÉ‑EXISTENTE**.

## Resultado do `npm test`

O comando `npm test` (que executa `vitest run`) falhou porque o binário `vitest` não foi encontrado. A mensagem exibida foi:

```
sh: 1: vitest: not found
```

Essa falha ocorre antes de qualquer modificação e é anotada como **FALHA PRÉ‑EXISTENTE**.

## Resultado do `npm run build`

O comando `npm run build` (que executa `vite build` e `esbuild`) falhou com o erro:

```
sh: 1: vite: not found
```

Tal como as outras falhas, a ausência do binário `vite` se deve à não instalação das dependências. Esta é outra **FALHA PRÉ‑EXISTENTE**.

## Erros e warnings existentes antes da alteração

- Repositório não é um repositório Git; não há controle de versão local.
- `pnpm` não está instalado no ambiente, e tentativa de instalá-lo via `npx` é bloqueada pelo registro npm (Erro 403).
- O check TypeScript (`npm run check`) falha por dependências ausentes (`vite/client`).
- Os scripts de testes e build (`vitest`, `vite`) não estão disponíveis.
- Sem essas dependências, não é possível executar a compilação ou os testes.

Todos esses erros ocorrem antes de qualquer modificação; portanto, qualquer falha semelhante após as alterações deve ser comparada a esta baseline para avaliar regressões.