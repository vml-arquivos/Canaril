# REGRESSION BASELINE

Este documento registra o estado de base do repositório **Canaril/Canário Gestão Pro** antes das alterações realizadas para a reformulação da página pública institucional. As informações aqui coletadas servem para diferenciar falhas pré‑existentes de possíveis regressões introduzidas durante a missão.

## Data da coleta

Data: 24/06/2026

## Branch e commit atuais

Este repositório foi fornecido em forma de arquivo ZIP e **não contém um repositório git**. Portanto, não é possível obter branch ou hash de commit. Todas as modificações serão realizadas diretamente sobre este snapshot.

## Scripts disponíveis

O arquivo `package.json` lista os seguintes scripts principais:

| Script        | Descrição                                                    |
|---------------|--------------------------------------------------------------|
| `dev`         | Usa `tsx` para subir o servidor em ambiente de desenvolvimento. |
| `build`       | Gera o bundle com Vite e esbuild para o backend.            |
| `start`       | Executa o servidor construído em produção.                  |
| `check`       | Roda o TypeScript para verificação de tipos (sem emitir código). |
| `test`        | Executa os testes com Vitest.                               |
| `db:push`     | Gera e aplica migrations com `drizzle-kit`.                 |
| `seed:knowledge` | Popula a base de conhecimento do módulo de IA.             |

## Resultado das ferramentas de build antes das alterações

Devido a limitações de rede e permissões neste ambiente de execução, não é possível instalar todas as dependências (o comando `pnpm install` ou equivalente não está disponível). Os comandos de checagem, teste e build foram executados com a configuração atual e retornaram as seguintes falhas pré‑existentes:

| Comando               | Resultado                                                                                                                                                     |
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `pnpm install`        | **Falhou** – o gerenciador `pnpm` não está instalado globalmente neste ambiente e não há acesso à internet para baixar dependências.                             |
| `npm run check`       | **Falhou** – TypeScript não encontrou definições de tipos de `vite/client` (`TS2688`).                                                                        |
| `npm test`            | **Falhou** – o executável `vitest` não foi encontrado porque as dependências não estão instaladas.                                                            |
| `npm run build`       | **Falhou** – o executável `vite` não foi encontrado porque as dependências não estão instaladas.                                                              |

Esses erros são considerados **falhas pré‑existentes** e serão usados como referência. O objetivo da reformulação da página pública não inclui resolver problemas de instalação ou infraestrutura, apenas garantir que as novas alterações não introduzam regressões adicionais no código fonte que afetem outras áreas do sistema.

## Erros e avisos existentes

* O projeto não é um repositório Git; portanto, comandos `git status` e `git log` não funcionam.
* Falta de dependências causa falhas de verificação, teste e build. Estes problemas já estavam presentes antes de qualquer modificação.
* O valor do criadouro em `shared/constants.ts` ainda utiliza **"Canário Lima"**, que precisará ser atualizado para **"Canaril Lima"** durante esta missão.

## Conclusão

O estado de base apresenta falhas relacionadas à configuração do ambiente de desenvolvimento (dependências ausentes). Nenhuma funcionalidade interna foi alterada neste momento. As alterações a seguir focarão apenas na reformulação da página pública conforme orientações, mantendo o restante do sistema intocado.