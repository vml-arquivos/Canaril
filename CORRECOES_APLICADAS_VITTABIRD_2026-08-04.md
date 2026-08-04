# VittaBird — Correções aplicadas e validação técnica

**Data:** 04/08/2026
**Pacote:** 1.3-production-hardening
**Objetivo:** corrigir segurança, isolamento de dados, anilhamento, ciclo reprodutivo e regras genéticas sem remover funcionalidades existentes.

## 1. Correções implementadas

### Segurança e autorização

- Removidos arquivos de ambiente com credenciais reais; permanecem apenas modelos `.example`.
- Senhas passaram a usar `scrypt` com sal aleatório individual e comparação em tempo constante.
- Hashes legados continuam válidos e são migrados automaticamente no primeiro login correto.
- Operações administrativas destrutivas foram limitadas a `PLATFORM_ADMIN`.
- Limpezas compatíveis com instalações legadas usam `SAVEPOINT`; uma tabela opcional ausente não invalida toda a transação.
- Documentos antigos de deploy foram higienizados e não carregam mais chaves, senhas padrão ou credenciais históricas.
- Perfil `VIEWER` ficou bloqueado centralmente para qualquer mutation.
- Configuração de cookies passou a respeitar HTTPS, proxy, `Secure`, `HttpOnly` e `SameSite`.
- Validação bloqueante das variáveis críticas de produção.

### Multi-tenant e rotas

- Rotas operacionais passaram a obter o `tenantId` exclusivamente da sessão autenticada.
- Consultas e mutations de pássaros, casais, posturas, filhotes, anilhas, rotina, suprimentos e IA receberam validação de propriedade.
- Contexto enviado aos provedores externos de IA passou a ser filtrado pelo criadouro.
- Genealogia e avós não podem retornar registros de outro tenant.

### Anilhas

- Criação do lote e das anilhas individuais agora ocorre em uma única transação PostgreSQL.
- Pedidos divididos por raça/bitola também são atômicos: uma colisão desfaz o pedido inteiro.
- Exclusão só é permitida para lote comprovadamente nunca utilizado.
- Anilha aplicada não volta ao estoque e sua rastreabilidade não pode ser apagada.
- Reconciliação de órfãs preserva a anilha como `used`, sem permitir reutilização, mantendo os identificadores históricos.
- O vínculo entre estoque e pássaro confere se o código da anilha selecionada é exatamente o código cadastrado no indivíduo.
- Contadores do lote são recalculados a partir das anilhas reais, evitando divergência por incremento concorrente.
- Cadastro de pássaro com anilha existente no estoque bloqueia e vincula a anilha atomicamente.
- Alteração manual de uma anilha oficial já rastreada foi bloqueada.
- Seleção automática passou a usar a bitola física oficial como regra principal, com espécie/raça/modalidade como critérios de segurança e preferência.
- Lotes de Canário de Cor 3,0 mm podem atender Gloster 3,0 mm, enquanto bitolas incompatíveis (por exemplo 3,4 mm) são bloqueadas antes do vínculo.
- Sugestão do formulário acompanha mudanças de espécie, raça e modalidade sem sobrescrever uma anilha digitada manualmente pelo criador.
- Código completo da anilha foi padronizado em até 100 caracteres em estoque, filhote e plantel, eliminando divergência entre colunas.
- Tabela pública corrigida conforme o material FOB/OBJO 2026: canário de cor e Gloster 3,0 mm; Fife/Hoso 2,7 mm; Border/Norwich/Yorkshire 3,4 mm.

### Ciclo reprodutivo

- Filhote pode existir desde a eclosão sem anilha, sexo ou cor inventados.
- Data/hora real da eclosão é preservada em `hatchDateTime`.
- Cada filhote criado pela rotina é ligado ao lançamento de eclosão por `hatchLogId`.
- Correção ou exclusão da eclosão ajusta filhotes, totais e lembrete de anilhamento na mesma transação.
- Registros legados sem rastreabilidade e filhotes já identificados, alterados, fotografados, anilhados ou promovidos são protegidos contra exclusão automática.
- Anilhamento e promoção ao plantel são uma única transação com locks (`FOR UPDATE SKIP LOCKED`).
- Pássaro, filhote, anilha e contador do lote são confirmados juntos ou totalmente revertidos.
- Cadastro de casal valida sexo, status, tenant e exclusividade da fêmea ativa.
- Casais, posturas e pássaros usam exclusão lógica para preservar genealogia e histórico.
- Rotina diária deixou de carregar logs e filhotes de outros criadouros.
- Limite universal de oito ovos deixou de bloquear a operação; situações atípicas geram aviso.

### Motor genético

- Pastel configurado como herança ligada ao sexo.
- Opalino configurado como autossômico recessivo, mantendo alias legado sem duplicar a seleção.
- Topázio ficou não selecionável até validação de uma regra científica versionada.
- Macho portador ligado ao sexo não é mais contabilizado como fenótipo visual.
- Probabilidades passaram a indicar corretamente o denominador da prole total.
- Foram adicionadas simulações determinísticas para sexo-ligado, autossômico recessivo e dominante letal.

### Deploy e banco

- Migrations `0025` a `0029` fazem backfill de tenant, flexibilizam o ciclo real do filhote, adicionam rastreabilidade da eclosão, corrigem bitolas oficiais e uniformizam a capacidade dos códigos de anilha de forma idempotente.
- Restrições exclusivas só são criadas quando o histórico está limpo, evitando derrubar instalações legadas.
- Runner de migrations usa advisory lock e transação individual por arquivo.
- Dockerfile inclui migrations na imagem final e executa healthcheck na porta 3000.
- Documentação de produção foi higienizada para não conter segredos nem credenciais fixas.

## 2. Validações executadas

| Validação | Resultado |
|---|---:|
| Parser TypeScript/TSX | **250 arquivos, 0 erros de sintaxe** |
| Imports relativos | **0 ausentes** |
| Marcadores de conflito Git | **0 encontrados** |
| `git diff --check` | **Aprovado** |
| Verificações de hardening | **32/32 aprovadas** |
| Simulações genéticas determinísticas | **4/4 aprovadas** |
| Validações de senha e geração de anilhas | **3/3 aprovadas** |
| Compatibilidade física e catálogo de anilhas | **4/4 aprovadas** |
| Busca por segredos anteriormente expostos | **Nenhuma ocorrência no código/documentação** |
| Arquivo real `.env.production` | **Não versionado** |

Comandos reproduzíveis:

```bash
pnpm validate:hardening
pnpm validate:genetics
pnpm validate:security
pnpm validate:rings
pnpm check
pnpm test
pnpm build
```

## 3. Limitação objetiva desta validação

O ambiente de análise não conseguiu baixar as dependências do projeto porque o registro de pacotes disponível respondeu `404`. Por isso, `pnpm check`, `pnpm test` e `pnpm build` não puderam ser executados integralmente aqui. O `tsc` global confirmou apenas que faltavam os pacotes de tipos `node` e `vite/client`; não apontou um erro de sintaxe do código, pois as dependências não estavam instaladas.

Uma promessa absoluta de “zero regressão” sem executar o build, os testes e um smoke test conectado a uma cópia do banco de produção seria tecnicamente incorreta. O pacote foi estruturado para reduzir regressão por compatibilidade, migrations aditivas, transações, locks, soft delete e validações automatizadas, mas a liberação final deve cumprir o procedimento abaixo.

## 4. Procedimento obrigatório de publicação segura

1. Criar backup completo do PostgreSQL e guardar uma cópia do ZIP atualmente em produção.
2. Criar ambiente de homologação usando uma cópia recente do banco.
3. Configurar as variáveis a partir de `.env.production.example`, sem copiar segredos para o Git.
4. Executar:

```bash
pnpm install --frozen-lockfile
pnpm validate:hardening
pnpm validate:genetics
pnpm validate:security
pnpm validate:rings
pnpm check
pnpm test
pnpm build
```

5. Subir a aplicação em homologação. O runner aplicará as migrations pendentes sob lock.
6. Validar login, dashboard, pássaros, casais, rotina, postura, eclosão, criação de lote, disponibilidade de anilhas, anilhamento, genealogia, genética, financeiro e IA.
7. Somente depois promover a mesma imagem para produção.
8. Não executar exclusão manual de tabelas, não editar migration já aplicada e não devolver anilha usada ao estoque.

## 5. Critérios mínimos do smoke test

- Usuário de um criadouro não enxerga nem altera dados de outro.
- `VIEWER` consulta, mas não grava.
- Um lote de 50 anilhas fisicamente compatíveis exibe disponibilidade na rotina; Gloster 3,0 mm aceita lote COR 3,0 mm e rejeita lote 3,4 mm.
- Dois pedidos simultâneos não conseguem utilizar a mesma anilha.
- Eclosão cria um filhote com a data real e sem dados genéticos fictícios.
- Aumentar/reduzir a quantidade de uma eclosão nova mantém o mesmo número de indivíduos; a redução é bloqueada quando houver qualquer histórico relevante.
- Excluir uma eclosão nova remove somente indivíduos ainda intocados e recalcula o lembrete; registros legados inseguros são bloqueados.
- Anilhamento cria/vincula pássaro, filhote e anilha em uma única operação.
- Exclusão de pássaro não apaga genealogia nem libera sua anilha.
- Macho portador × fêmea normal retorna 25% da prole total como machos portadores e 25% como fêmeas visuais para o locus sexo-ligado configurado.
- Logs, saúde e contexto de IA permanecem no tenant correto.

## 6. Rollback

O rollback seguro é feito restaurando a imagem anterior e o backup do banco. Não remover manualmente as colunas adicionadas pelas migrations. As alterações de banco são aditivas e os campos novos são compatíveis com registros legados.
