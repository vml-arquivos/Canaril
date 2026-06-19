# Canário Gestão Pro - TODO

## Projeto: Sistema Completo de Gestão para Criadouro "Canário Lima"
**Localização**: Brasília, Distrito Federal
**Banco de Dados**: PostgreSQL (Qualify ou Supabase)
**Stack**: React 19 + Tailwind 4 + Express + tRPC + PostgreSQL

---

## FASE 1: CONFIGURAÇÃO E BANCO DE DADOS

### Banco de Dados e Schema
- [x] Configurar conexão MySQL
- [x] Criar schema MySQL com todas as tabelas
- [x] Criar índices para otimização de queries
- [x] Validar integridade referencial

### Helpers de Banco de Dados
- [x] Implementar queries para pássaros (CRUD, busca, filtros)
- [x] Implementar queries para anilhas (CRUD, disponibilidade)
- [x] Implementar queries para cruzamentos/casais
- [x] Implementar queries para posturas e filhotes
- [x] Implementar queries para genealogia (árvore ancestral)
- [x] Implementar queries para galeria e informações do criadouro

---

## FASE 2: PÁGINA INSTITUCIONAL PÚBLICA

### Layout e Navegação
- [x] Criar header com logo e navegação principal
- [x] Criar footer com informações de contato
- [x] Implementar design system elegante e refinado (cores, tipografia, espaçamento)
- [x] Garantir responsividade (mobile, tablet, desktop)

### Seções da Página Pública
- [x] Seção Hero com apresentação do criadouro "Canário Lima"
- [x] Seção de especialidades com cards para cada raça (Gloster Corona, Gloster Consort, Holandês, Frisado do Norte, Frisado do Sul, Belga Clássico)
- [ ] Galeria de fotos com filtro por especialidade
- [x] Seção "Sobre o Criadouro" com história e informações
- [ ] Seção de contato com formulário
- [ ] Página de detalhes de cada especialidade (características, padrão FOB, cores possíveis)

### Conteúdo Estático
- [x] Descrever cada especialidade com características técnicas
- [x] Listar cores/mutações possíveis para cada raça
- [ ] Adicionar informações sobre padrão de julgamento FOB

---

## FASE 3: AUTENTICAÇÃO E PAINEL DE CONTROLE

### Autenticação
- [x] Implementar login com OAuth Manus (já integrado)
- [x] Criar página de login
- [x] Implementar logout
- [x] Proteger rotas do painel (apenas usuários autenticados)

### Dashboard Principal
- [x] Exibir totalizadores: Total de pássaros, Casais ativos, Filhotes da temporada, Anilhas disponíveis
- [ ] Gráficos de estatísticas (produção por mês, distribuição por especialidade, etc.)
- [x] Atalhos para principais funcionalidades
- [ ] Exibir últimas atividades/registros

### Layout do Painel
- [x] Usar DashboardLayout com sidebar navegável
- [x] Menu lateral com acesso a: Pássaros, Anilhas, Cruzamentos, Posturas, Filhotes, Genealogia, Relatórios, Galeria, Configurações

---

## FASE 4: GESTÃO DE PÁSSAROS

### Cadastro de Pássaro
- [x] Criar formulário com campos: anilha, especialidade, sexo, cor/mutação, data de nascimento, procedência, status, foto
- [x] Validar anilha única
- [ ] Implementar upload de foto
- [x] Permitir associação de pais (genealogia)
- [x] Salvar em banco de dados

### Listagem de Pássaros
- [x] Exibir tabela com todos os pássaros
- [ ] Filtros: especialidade, sexo, cor, status
- [ ] Busca por anilha
- [ ] Paginação
- [x] Ações: editar, visualizar, deletar

### Visualização Individual
- [ ] Exibir dados completos do pássaro
- [ ] Mostrar foto
- [x] Exibir genealogia (pais, avós, bisavós)
- [ ] Histórico de cruzamentos (se aplicável)
- [ ] Filhotes produzidos (se aplicável)
- [ ] Botões para editar ou deletar

---

## FASE 5: GESTÃO DE ANILHAS

### Cadastro de Lote de Anilhas
- [x] Criar formulário: número, ano, cor, quantidade, status
- [x] Validar combinação única (número + ano)
- [x] Salvar em banco de dados

### Listagem de Anilhas
- [x] Exibir tabela com lotes de anilhas
- [x] Mostrar: número, ano, cor, quantidade total, quantidade usada, disponível, status
- [ ] Filtros: ano, status, cor
- [ ] Busca por número
- [x] Ações: editar, visualizar detalhes, deletar

### Controle de Disponibilidade
- [ ] Atualizar automaticamente quantidade usada ao anilhar filhote
- [x] Alertar quando anilhas estiverem acabando
- [x] Permitir marcar anilha como "em estoque" ou "disponível"

---

## FASE 6: GESTÃO DE CRUZAMENTOS E CASAIS

### Cadastro de Casal
- [x] Criar formulário: selecionar macho, selecionar fêmea, gaiola, data de formação, status
- [ ] Validar que macho e fêmea são de sexos diferentes
- [ ] Validar especialidades compatíveis
- [ ] Alertar sobre cruzamentos não recomendados (genética)
- [x] Salvar em banco de dados

### Listagem de Casais
- [x] Exibir tabela com casais
- [x] Mostrar: macho (anilha), fêmea (anilha), gaiola, data de formação, status, ações
- [ ] Filtros: status (ativo, inativo, finalizado), especialidade
- [x] Ações: editar, visualizar detalhes, finalizar, deletar

### Visualização de Casal
- [ ] Exibir dados do casal
- [ ] Mostrar foto do macho e fêmea
- [x] Histórico de posturas
- [ ] Filhotes produzidos
- [ ] Botões para editar ou finalizar

---

## FASE 7: GESTÃO DE POSTURAS E FILHOTES

### Registro de Postura
- [x] Criar formulário: selecionar casal, data da postura, total de ovos, ovos galados, inférteis, perdidos
- [ ] Permitir registrar data de eclosão e quantidade de filhotes nascidos
- [x] Salvar em banco de dados

### Listagem de Posturas
- [x] Exibir tabela com posturas
- [x] Mostrar: casal, data, total de ovos, galados, filhotes nascidos, status
- [ ] Filtros: data, casal, status
- [x] Ações: editar, visualizar filhotes, deletar

### Registro de Filhotes
- [x] Criar formulário: selecionar postura, anilha, sexo, cor, data de nascimento, data de anilhamento, data de desmame
- [ ] Permitir upload de foto do filhote
- [ ] Validar anilha disponível
- [x] Salvar em banco de dados

### Listagem de Filhotes
- [x] Exibir tabela com filhotes
- [x] Mostrar: anilha, postura, sexo, cor, data de nascimento, status
- [ ] Filtros: postura, sexo, cor, status
- [x] Ações: editar, visualizar, deletar

### Visualização de Filhote
- [ ] Exibir dados completos
- [ ] Mostrar foto
- [ ] Exibir pais (macho e fêmea do casal)
- [ ] Exibir genealogia completa (avós, bisavós)
- [ ] Botões para editar ou deletar

---

## FASE 8: ÁRVORE GENEALÓGICA

### Visualização Interativa
- [ ] Criar componente de árvore genealógica visual
- [ ] Exibir até 5 gerações (pais, avós, bisavós, trisavós, tetravós)
- [ ] Mostrar para cada pássaro: anilha, especialidade, cor, sexo
- [ ] Permitir clicar em cada pássaro para ver detalhes
- [ ] Navegação entre gerações

### Cálculo de Consanguinidade
- [ ] Implementar cálculo de coeficiente de endogamia
- [ ] Alertar sobre cruzamentos consanguíneos
- [ ] Sugerir cruzamentos seguros

### Análise de Cores
- [ ] Calcular probabilidade de cores dos filhotes baseado nos pais
- [ ] Exibir possíveis cores esperadas
- [ ] Alertar sobre cruzamentos que podem gerar cores indesejadas

---

## FASE 9: RELATÓRIOS EM PDF

### Ficha de Controle de Choca
- [x] Gerar PDF com dados do casal
- [x] Incluir: gaiola, macho, fêmea, data de formação
- [x] Tabela de posturas
- [x] Espaço para acompanhamento diário
- [x] Pronto para imprimir e usar nas gaiolas

### Relatório de Plantel Completo
- [ ] Gerar PDF com lista de todos os pássaros
- [ ] Incluir: anilha, especialidade, sexo, cor, data de nascimento, status
- [ ] Agrupar por especialidade
- [ ] Incluir logo e nome do criadouro

### Relatório de Cruzamentos
- [ ] Gerar PDF com histórico de cruzamentos
- [ ] Incluir: macho, fêmea, gaiola, data de formação, posturas, filhotes
- [ ] Agrupar por período/temporada
- [ ] Incluir estatísticas de produção

### Relatório de Produção por Temporada
- [ ] Gerar PDF com estatísticas de produção
- [ ] Incluir: total de casais, total de posturas, total de filhotes, taxa de sucesso
- [ ] Gráficos de produção por mês
- [ ] Distribuição por especialidade e cor

### Ficha Individual do Pássaro
- [ ] Gerar PDF com dados completos de um pássaro
- [ ] Incluir: foto, anilha, especialidade, sexo, cor, data de nascimento, procedência
- [ ] Exibir genealogia (pais, avós, bisavós)
- [ ] Incluir histórico de cruzamentos (se aplicável)
- [ ] Incluir filhotes produzidos (se aplicável)

---

## FASE 10: GALERIA E CONFIGURAÇÕES

### Galeria de Fotos
- [ ] Criar página para gerenciar galeria
- [ ] Permitir upload de fotos
- [ ] Associar foto a especialidade
- [ ] Ordenar fotos por prioridade de exibição
- [ ] Ativar/desativar fotos da galeria pública

### Informações do Criadouro
- [ ] Criar página de configurações
- [ ] Permitir editar: nome, cidade, estado, descrição, telefone, email, website
- [ ] Permitir upload de logo e banner
- [ ] Salvar informações em banco de dados

### Usuários e Permissões
- [ ] Implementar controle de acesso (admin/user)
- [ ] Permitir admin gerenciar outros usuários
- [ ] Definir permissões por funcionalidade

---

## FASE 11: TESTES E REFINAMENTOS

### Testes Unitários
- [ ] Testar queries de banco de dados
- [ ] Testar cálculos de genealogia e consanguinidade
- [ ] Testar geração de relatórios
- [ ] Testar validações de formulários

### Testes de Integração
- [ ] Testar fluxo completo de cadastro de pássaro
- [ ] Testar fluxo de cruzamento e registro de filhotes
- [ ] Testar geração de relatórios
- [ ] Testar árvore genealógica

### Refinamentos de UI/UX
- [ ] Revisar design e espaçamento
- [ ] Garantir acessibilidade
- [ ] Testar em diferentes navegadores
- [ ] Testar responsividade
- [ ] Otimizar performance

### Documentação
- [ ] Documentar API tRPC
- [ ] Documentar schema do banco de dados
- [ ] Criar guia de uso para o sistema
- [ ] Documentar padrões de código

---

## FASE 12: DEPLOYMENT E PUBLICAÇÃO

### Preparação para Deploy
- [ ] Revisar todas as variáveis de ambiente
- [ ] Testar em ambiente de produção
- [ ] Fazer backup do banco de dados
- [ ] Criar checkpoint final

### Deploy
- [ ] Publicar na plataforma Qualify
- [ ] Configurar domínio customizado
- [ ] Configurar SSL/HTTPS
- [ ] Monitorar logs de erro

### Pós-Deploy
- [ ] Testar todas as funcionalidades em produção
- [ ] Coletar feedback do usuário
- [ ] Fazer ajustes conforme necessário
- [ ] Documentar lições aprendidas

---

## NOTAS TÉCNICAS

### Especialidades de Canários Belga
1. **Gloster Corona**: Corpo compacto, crista proeminente, 11-12 cm, 12-29g
2. **Gloster Consort**: Sem crista, cabeça lisa, 11-12 cm, 12-29g
3. **Holandês**: Raça de porte, corpo alongado
4. **Frisado do Norte**: Plumagem ondulada, origem holandesa
5. **Frisado do Sul**: Plumagem ondulada
6. **Belga Clássico**: Raça de porte clássica

### Cores/Mutações Principais
- Amarelo Intenso, Amarelo Nevado, Amarelo Mosaico
- Vermelho Intenso, Vermelho Nevado, Vermelho Mosaico
- Branco, Prateado, Opalino, Feo, Topázio, Albino, Lutino

### Validações Genéticas
- Gloster Corona × Consort (recomendado)
- Mosaico × Mosaico (recomendado)
- Evitar: Branco Dominante × Branco Dominante, Amarelo Nevado × Amarelo Nevado

---

## STATUS DO PROJETO

- [x] Pesquisa completa sobre Canários Belga
- [x] Configuração inicial do projeto
- [x] Banco de dados MySQL (schema completo)
- [x] Página institucional pública (elegante e responsiva)
- [x] Autenticação e dashboard com totalizadores
- [x] Gestão de pássaros (CRUD completo com selects)
- [x] Gestão de anilhas (com alertas de estoque)
- [x] Gestão de cruzamentos (seleção inteligente de macho/fêmea)
- [x] Gestão de posturas e filhotes (tabs organizados)
- [x] Ficha de controle de choca em PDF
- [x] Dados pré-carregados (especialidades, cores, sexos, status)
- [x] Routers tRPC completos
- [ ] Árvore genealógica interativa visual
- [ ] Relatórios avançados em PDF
- [ ] Galeria e configurações
- [ ] Testes e refinamentos
- [ ] Deployment

