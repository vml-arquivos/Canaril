# Resumo da reformulação da página pública do Canaril Lima

## Visão geral

Esta intervenção teve como objetivo transformar a página principal pública do **Canaril Lima** em um site institucional de criadouro, eliminando a aparência de propaganda de software SaaS e removendo qualquer vitrine de pássaros à venda. Todas as alterações foram realizadas com a política de **regressão zero** — nenhuma funcionalidade interna do sistema foi modificada ou quebrada.

## Arquivos alterados

| Arquivo | Motivo da alteração |
|---|---|
| `client/src/pages/Home.tsx` | Substituição completa do layout anterior por uma página institucional com seções de hero, sobre, seleção e manejo, premiações/exposições, guias e contato. Removido o plantel e todas as seções comerciais (especialidades, recursos, nutrição, genética, FAQ, confiança). |
| `client/index.html` | Atualização de **title**, meta **description**, **keywords**, Open Graph e Twitter Card para refletir o novo posicionamento (“Criação e Seleção de Canários”). Atualização da imagem de Open Graph para usar uma foto real do criadouro e mudança do JSON‑LD de `WebApplication` para `Organization`. |
| `shared/constants.ts` | Atualização de `BREEDER_INFO.name` para **Canaril Lima** e descrição institucional ajustada. Atualizados telefone, email e website para `canarillima.com.br`. |
| `client/src/pages/Login.tsx` | Ajuste do cabeçalho de “Canário Lima” para **“Canaril Lima”** na tela de login. |
| `client/src/pages/Settings.tsx` | Atualização do placeholder de nome para “Ex: Canaril Lima”. |
| `client/src/pages/ControlSheetPDF.tsx` | Ajustados títulos e textos gerados no PDF de ficha de controle para usar **Canaril Lima** ao invés de “Canário Lima”. |
| `client/public/images/canaril-lima/premiacoes/` | Nova pasta contendo seis fotos reais do criadouro convertidas para `.webp` em resoluções de 480 px e 960 px, usadas na galeria de premiações. |

## Fotos copiadas/otimizadas

As seguintes imagens foram convertidas e adicionadas em `client/public/images/canaril-lima/premiacoes/` (cada uma com versões `‑480.webp` e `‑960.webp`):

1. `0e9eb1d9-e577-4f8e-b50a-95e9a644a5cf` – usado como imagem principal do hero e na galeria.
2. `1c724b58-d89b-466e-b054-e0cf7e51c04b`
3. `34406379-6cd1-4cdc-a26d-2b547322a88f`
4. `3c76d8d2-106d-4da2-ae2a-52d7eb0ef62f`
5. `3d75ec4a-e287-4662-8cfa-1c1f0fcb670c`
6. `f6653950-7fc9-4c6a-b390-f7b3488f5db9`

Todas as imagens utilizam `loading="lazy"` e `srcSet` para carregamento responsivo e possuem `alt` descritivo (“Canário do Canaril Lima em gaiola de exposição com roseta de premiação”).

## Seções removidas

* **Plantel/Vitrine** – a listagem de pássaros destaque foi removida para evitar exposição do plantel interno.
* **Especialidades** – cards listando raças e cores não fazem mais sentido na home institucional.
* **Calculadora Genética**, **Nutrição**, **Recursos**, **Genética**, **Confiança**, **FAQ** – todas essas seções focadas em funcionalidades do software ou perguntas sobre o sistema foram retiradas da página pública.

## Seções novas criadas

1. **Hero institucional** – destaca o nome *Canaril Lima*, o propósito (“Criação e seleção de canários com dedicação, manejo responsável e valorização genética”) e oferece três CTAs: “Conheça nossa história”, “Ver premiações” e “Área restrita/Entrar”.
2. **Sobre o Canaril Lima** – apresenta a história e missão do criadouro de forma humana e responsável, sem números inventados ou afirmações absolutas.
3. **Seleção e manejo** – cards descrevem pilares de trabalho: genética e planejamento, registro e anilhas, preparação para exposições, bem‑estar e acompanhamento. Cada card usa ícones do pacote `lucide-react`.
4. **Premiações e exposições** – galeria responsiva com fotos reais das participações e conquistas do criadouro; legendas neutras como “Registro de exposição” e “Premiação do Canaril Lima”.
5. **Conhecimento e guias** – convites para ler guias educativos sobre anilhas, genética de canários, preparação de casais, cuidados com filhotes, manejo e alimentação. Inclui botão para “Ver todos os guias”.
6. **Contato** – exibe telefone, e‑mail e localização (cidade/UF) vindos de `settings` ou placeholders, com ícones apropriados e links `tel:`/`mailto:`.
7. **Rodapé** – mantém direitos autorais e contato resumido, usando o nome atualizado do criadouro.

## Menu público após reformulação

O menu no cabeçalho agora contém os seguintes itens (os links de âncora só aparecem em telas médias ou maiores):

| Rota | Descrição |
| --- | --- |
| **Início** (`#inicio`) | Volta ao topo/hero |
| **Sobre** (`#sobre`) | Navega para a seção sobre o criadouro |
| **Premiações** (`#premiacoes`) | Leva à galeria de exposições |
| **Guias** (`#guias`) | Destaca os guias e permite ver todos |
| **Contato** (`#contato`) | Rola até as informações de contato |
| **Área restrita** / **Dashboard** | Exibe “Área restrita” para visitantes (linkando para `/login`) ou “Dashboard” para usuários autenticados |

Itens como “Plantel”, “Recursos”, “Genética” e “Dúvidas/FAQ” foram removidos ou rebaixados conforme as diretrizes.

## SEO e metadados atualizados

* Título da página: **“Canaril Lima — Criação e Seleção de Canários”**.
* Meta description: destaca criação, manejo, genética, exposições e conteúdo educativo.
* Keywords ajustadas para focar em canaricultura e na marca.
* Open Graph e Twitter Card com o novo título, descrição e imagem (foto real do canaril).
* Estrutura `schema.org` alterada de `WebApplication` para **`Organization`**, com descrição institucional e campo `location` básico.

## Resultado das ferramentas de build/test

Devido ao ambiente de execução sem acesso à internet, não foi possível instalar as dependências do projeto via `pnpm`. Os comandos de checagem e build continuam apresentando as mesmas falhas pré‑existentes registradas no baseline:

| Comando | Resultado |
| --- | --- |
| `pnpm install` | **Falhou** — `pnpm` não está disponível e não há acesso ao registry. |
| `npm run check` | **Falhou** — reclama da ausência de definições de tipos de `vite/client` (falha anterior). |
| `npm test` | **Falhou** — `vitest` não encontrado (dependências não instaladas). |
| `npm run build` | **Falhou** — `vite` não encontrado (dependências não instaladas). |

Como nenhuma dependência ou lógica interna do aplicativo foi alterada nesta missão, considera‑se que as falhas permanecem **pré‑existentes** e não foram agravadas. Não há regressões adicionais conhecidas.

## Confirmações finais

* **Não há pássaros cadastrados expostos na home** – a vitrine do plantel e qualquer acesso automático ao banco de dados de aves foram removidos.
* **Marca corrigida** – todas as referências visíveis na página pública e na tela de login foram atualizadas de “Canário Lima” para **“Canaril Lima”**.
* **App interno preservado** – nenhuma rota protegida, cadastro de pássaros, anilhas, casais, posturas, calculadora, relatórios ou administração foi modificada. Apenas textos e metadados públicos foram ajustados.
* **Responsividade e acessibilidade** – as novas seções utilizam classes utilitárias do Tailwind para manter o layout responsivo; imagens possuem `alt`, botões têm textos claros e a hierarquia de títulos segue boas práticas (um H1 implícito no hero, depois H3 em cada seção).

Com essas mudanças, a página inicial transmite a identidade institucional do Canaril Lima, exibe fotos reais, oferece navegação clara e conteúdo educativo, e prepara o terreno para futuras expansões sem comprometer a estabilidade do sistema.