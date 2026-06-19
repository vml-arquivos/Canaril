# Correção de Login e Preparação para Produção — Canário Gestão Pro

## Problema identificado

O formulário de login informava “Login realizado com sucesso”, alterava a URL para `/dashboard`, mas o painel continuava exibindo a tela de login.

A causa real era que `client/src/pages/Login.tsx` ainda possuía login simulado com `setTimeout`. Esse fluxo apenas mudava a rota no navegador, mas não chamava o backend, não validava `ADMIN_EMAIL`/`ADMIN_PASSWORD`, não criava cookie de sessão e não atualizava `auth.me`. Como as rotas protegidas dependem de `useAuth()` e `auth.me`, o usuário continuava sem sessão real e o sistema renderizava a tela de login dentro da rota `/dashboard`.

## Correções aplicadas

### 1. Login real no backend

Arquivo alterado:

- `server/routers.ts`

Foi criada a mutation:

```ts
auth.login
```

Ela:

- valida `ADMIN_EMAIL` e `ADMIN_PASSWORD` via ambiente;
- compara o e-mail/senha enviados pelo formulário;
- cria/atualiza o usuário administrador no banco;
- gera token de sessão assinado;
- grava o cookie `app_session_id`;
- retorna o usuário autenticado para o frontend.

### 2. Frontend deixou de simular login

Arquivo alterado:

- `client/src/pages/Login.tsx`

O formulário agora chama `trpc.auth.login.useMutation()`. Após sucesso:

- atualiza o cache de `auth.me`;
- invalida/refaz a consulta do usuário autenticado;
- redireciona para `/dashboard`.

Isso corrige exatamente o comportamento relatado: a URL mudava, mas o painel não abria.

### 3. Variáveis administrativas adicionadas

Arquivos alterados:

- `.env.production`
- `ENV_COPY_PASTE.txt`
- `ENVIRONMENT_VARIABLES.md`
- `.env.example` já possuía o modelo

Variáveis necessárias:

```env
ADMIN_NAME=Vilson Marcio
ADMIN_EMAIL=vilsonmarcio@gmail.com
ADMIN_PASSWORD=Senha@123
```

No Coolify, essas três variáveis devem estar no ambiente da aplicação. Após adicionar, é obrigatório redeploy/restart do container.

### 4. Ajuste técnico da conexão PostgreSQL

Arquivo alterado:

- `server/db.ts`

Foi ajustado o tipo de conexão PostgreSQL para usar `Pool` em vez de `Client`, resolvendo erro de TypeScript e mantendo compatibilidade com Drizzle ORM em produção.

## Validações executadas

Foram executados com sucesso:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm test
```

Resultado:

- TypeScript: OK
- Build Vite/esbuild: OK
- Testes: OK

## Variáveis que precisam existir no Coolify

Use este bloco no ambiente da aplicação:

```env
DATABASE_URL=postgresql://SEU_USUARIO:SUA_SENHA@SEU_HOST:5432/SEU_BANCO
VITE_APP_TITLE=Canário Gestão Pro
JWT_SECRET=SEU_JWT_SECRET
NODE_ENV=production
VITE_APP_ID=canario-gestao-pro-001
VITE_APP_LOGO=https://canarillima.casadf.com.br/logo.png
CSRF_SECRET=SEU_CSRF_SECRET
SESSION_SECRET=SEU_SESSION_SECRET
OWNER_NAME=Canário Lima
OWNER_OPEN_ID=canario-lima-001
ADMIN_NAME=Vilson Marcio
ADMIN_EMAIL=vilsonmarcio@gmail.com
ADMIN_PASSWORD=Senha@123
CORS_ORIGIN=https://canarillima.casadf.com.br
LOG_LEVEL=info
PORT=3000
```

## Próximo passo para produção

1. Subir este pacote corrigido para o GitHub.
2. Conferir que `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_NAME` existem no Coolify.
3. Fazer redeploy completo.
4. Acessar `/login`.
5. Entrar com o e-mail/senha configurados.
6. Validar se `/dashboard` abre o painel real.

## Próximas evoluções mapeadas

As próximas funções solicitadas podem ser organizadas em módulos:

1. **Campeonatos**
   - cadastro de campeonato;
   - seleção dos pássaros participantes;
   - categorias/classes;
   - pontuação por julgamento;
   - histórico de resultados;
   - modo PWA/mobile para lançamento durante o evento.

2. **Pássaros de outros criadores**
   - cadastro de criador externo;
   - anilhas externas com registro próprio;
   - origem/aquisição/custo;
   - impacto na árvore genealógica;
   - vínculo do pássaro externo ao plantel.

3. **Fotos e documentos do pássaro**
   - upload/foto por câmera;
   - galeria por animal;
   - imagem principal na ficha;
   - anexos/documentos.

4. **Acasalamento e ficha de gaiola**
   - seleção fácil de macho/fêmea;
   - número da gaiola;
   - data de formação do casal;
   - geração de ficha de identificação;
   - ovos, nascimento, anilhamento e desmame;
   - relatório por casal/postura.
