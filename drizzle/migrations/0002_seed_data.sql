-- ============================================================================
-- MIGRATION: Seed Data - Dados Iniciais do Sistema Canário Lima
-- ============================================================================
-- Popula o banco de dados com:
-- 1. Especialidades de Canários Belga (6 tipos)
-- 2. Cores e Mutações (13 tipos com códigos genéticos)
-- 3. Criador (Canário Lima - Brasília, DF)
-- 4. Dados de referência para validações

-- ============================================================================
-- TABELA: specialties (Especialidades de Canários Belga)
-- ============================================================================
INSERT INTO specialties (code, name, description, size_cm, weight_g, status) VALUES
('GLOSTER_CORONA', 'Gloster Corona', 'Canário com crista pronunciada em forma de coroa. Corpo compacto e bem proporcionado.', '11-12', '12-29', 'active'),
('GLOSTER_CONSORT', 'Gloster Consort', 'Canário sem crista, cabeça lisa. Companheiro ideal do Corona para cruzamentos.', '11-12', '12-29', 'active'),
('HOLANDÊS', 'Holandês', 'Raça de porte grande e elegante. Corpo alongado com postura ereta e nobre.', '13-14', '30-40', 'active'),
('FRISADO_NORTE', 'Frisado do Norte', 'Canário com plumagem frisada característica. Origem holandesa, porte médio.', '12-13', '20-35', 'active'),
('FRISADO_SUL', 'Frisado do Sul', 'Canário frisado de porte menor. Plumagem ondulada e bem distribuída.', '12-13', '20-35', 'active'),
('BELGA_CLÁSSICO', 'Belga Clássico', 'Raça de porte clássica. Forma alongada e elegante com postura característica.', '13-14', '30-40', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TABELA: colors (Cores e Mutações com Códigos Genéticos)
-- ============================================================================
INSERT INTO colors (code, name, category, genetics, description, status) VALUES
-- Amarelos
('AMARELO_INTENSO', 'Amarelo Intenso', 'Amarelo', 'Recessivo', 'Amarelo puro e intenso sem marcações brancas. Base genética aa.', 'active'),
('AMARELO_NEVADO', 'Amarelo Nevado', 'Amarelo', 'Dominante', 'Amarelo com marcações brancas. Padrão nevado bem definido.', 'active'),
('AMARELO_MOSAICO', 'Amarelo Mosaico', 'Amarelo', 'Ligado ao sexo', 'Amarelo com padrão mosaico. Ligado ao cromossomo sexual.', 'active'),

-- Vermelhos
('VERMELHO_INTENSO', 'Vermelho Intenso', 'Vermelho', 'Recessivo', 'Vermelho puro e intenso sem marcações brancas. Base genética aa.', 'active'),
('VERMELHO_NEVADO', 'Vermelho Nevado', 'Vermelho', 'Dominante', 'Vermelho com marcações brancas. Padrão nevado bem definido.', 'active'),
('VERMELHO_MOSAICO', 'Vermelho Mosaico', 'Vermelho', 'Ligado ao sexo', 'Vermelho com padrão mosaico. Ligado ao cromossomo sexual.', 'active'),

-- Brancos
('BRANCO', 'Branco', 'Branco', 'Dominante', 'Branco puro dominante. Cuidado com cruzamentos branco x branco.', 'active'),
('PRATEADO', 'Prateado', 'Branco', 'Recessivo', 'Branco recessivo com tonalidade prateada. Mais seguro para cruzamentos.', 'active'),

-- Mutações
('OPALINO', 'Opalino', 'Mutação', 'Recessivo', 'Mutação que altera a distribuição de pigmento. Aspecto opalescente.', 'active'),
('FEO', 'Feo', 'Mutação', 'Recessivo', 'Mutação que reduz pigmentação. Aspecto mais claro e uniforme.', 'active'),
('TOPÁZIO', 'Topázio', 'Mutação', 'Recessivo', 'Mutação com tonalidade amarelada uniforme. Aspecto topázio.', 'active'),
('ALBINO', 'Albino', 'Mutação', 'Recessivo', 'Ausência total de pigmentação. Olhos vermelhos. Alto risco genético.', 'active'),
('LUTINO', 'Lutino', 'Mutação', 'Recessivo', 'Amarelo puro sem pigmentação escura. Olhos vermelhos. Ligado ao sexo.', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TABELA: breeders (Criador - Canário Lima)
-- ============================================================================
INSERT INTO breeders (name, city, state, country, registration_number, association, phone, email, website, description, status) VALUES
('Canário Lima', 'Brasília', 'DF', 'Brasil', 'CBCA-2024-001', 'Confederação Brasileira de Criadores de Aves (CBCA)', '(61) 99999-9999', 'contato@canarioslima.com.br', 'www.canarioslima.com.br', 'Criadouro profissional especializado em Canários Belga com foco em qualidade genética e bem-estar animal. Localizado em Brasília, Distrito Federal, com mais de 10 anos de experiência em seleção e criação de canários de alta qualidade.', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TABELA: ring_batches (Lotes de Anilhas Iniciais)
-- ============================================================================
INSERT INTO ring_batches (batch_number, year, color, quantity_total, quantity_used, status) VALUES
('001', 2024, 'Vermelha', 100, 0, 'available'),
('002', 2024, 'Azul', 100, 0, 'available'),
('003', 2024, 'Verde', 100, 0, 'available'),
('004', 2024, 'Amarela', 100, 0, 'available'),
('005', 2024, 'Branca', 100, 0, 'available')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TABELA: genetic_rules (Regras de Validação Genética)
-- ============================================================================
INSERT INTO genetic_rules (male_color, female_color, rule_type, description, status) VALUES
-- Cruzamentos Recomendados
('AMARELO_INTENSO', 'AMARELO_INTENSO', 'recommended', 'Cruzamento recomendado para manutenção da cor intenso', 'active'),
('VERMELHO_INTENSO', 'VERMELHO_INTENSO', 'recommended', 'Cruzamento recomendado para manutenção da cor intenso', 'active'),
('AMARELO_NEVADO', 'AMARELO_NEVADO', 'recommended', 'Cruzamento recomendado para manutenção do padrão nevado', 'active'),
('VERMELHO_NEVADO', 'VERMELHO_NEVADO', 'recommended', 'Cruzamento recomendado para manutenção do padrão nevado', 'active'),

-- Cruzamentos com Alerta
('BRANCO', 'BRANCO', 'warning', 'Branco Dominante x Branco Dominante pode gerar problemas auditivos. Considere usar Prateado.', 'active'),
('AMARELO_NEVADO', 'AMARELO_NEVADO', 'warning', 'Pode resultar em filhotes muito claros ou com problemas de pigmentação.', 'active'),
('ALBINO', 'ALBINO', 'warning', 'Cruzamento de alto risco genético. Pode resultar em problemas de viabilidade.', 'active'),

-- Cruzamentos Proibidos
('BRANCO', 'BRANCO', 'forbidden', 'Branco Dominante x Branco Dominante - PROIBIDO por risco de surdez', 'active'),
('ALBINO', 'ALBINO', 'forbidden', 'Albino x Albino - PROIBIDO por alto risco genético', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- TABELA: specialty_colors (Cores Permitidas por Especialidade)
-- ============================================================================
INSERT INTO specialty_colors (specialty_code, color_code, status) VALUES
-- Gloster Corona
('GLOSTER_CORONA', 'AMARELO_INTENSO', 'active'),
('GLOSTER_CORONA', 'AMARELO_NEVADO', 'active'),
('GLOSTER_CORONA', 'AMARELO_MOSAICO', 'active'),
('GLOSTER_CORONA', 'VERMELHO_INTENSO', 'active'),
('GLOSTER_CORONA', 'VERMELHO_NEVADO', 'active'),
('GLOSTER_CORONA', 'VERMELHO_MOSAICO', 'active'),
('GLOSTER_CORONA', 'BRANCO', 'active'),
('GLOSTER_CORONA', 'PRATEADO', 'active'),
('GLOSTER_CORONA', 'OPALINO', 'active'),

-- Gloster Consort
('GLOSTER_CONSORT', 'AMARELO_INTENSO', 'active'),
('GLOSTER_CONSORT', 'AMARELO_NEVADO', 'active'),
('GLOSTER_CONSORT', 'AMARELO_MOSAICO', 'active'),
('GLOSTER_CONSORT', 'VERMELHO_INTENSO', 'active'),
('GLOSTER_CONSORT', 'VERMELHO_NEVADO', 'active'),
('GLOSTER_CONSORT', 'VERMELHO_MOSAICO', 'active'),
('GLOSTER_CONSORT', 'BRANCO', 'active'),
('GLOSTER_CONSORT', 'PRATEADO', 'active'),
('GLOSTER_CONSORT', 'OPALINO', 'active'),

-- Holandês
('HOLANDÊS', 'AMARELO_INTENSO', 'active'),
('HOLANDÊS', 'AMARELO_NEVADO', 'active'),
('HOLANDÊS', 'VERMELHO_INTENSO', 'active'),
('HOLANDÊS', 'VERMELHO_NEVADO', 'active'),
('HOLANDÊS', 'BRANCO', 'active'),
('HOLANDÊS', 'PRATEADO', 'active'),

-- Frisado do Norte
('FRISADO_NORTE', 'AMARELO_INTENSO', 'active'),
('FRISADO_NORTE', 'AMARELO_NEVADO', 'active'),
('FRISADO_NORTE', 'AMARELO_MOSAICO', 'active'),
('FRISADO_NORTE', 'VERMELHO_INTENSO', 'active'),
('FRISADO_NORTE', 'VERMELHO_NEVADO', 'active'),
('FRISADO_NORTE', 'VERMELHO_MOSAICO', 'active'),
('FRISADO_NORTE', 'BRANCO', 'active'),

-- Frisado do Sul
('FRISADO_SUL', 'AMARELO_INTENSO', 'active'),
('FRISADO_SUL', 'AMARELO_NEVADO', 'active'),
('FRISADO_SUL', 'VERMELHO_INTENSO', 'active'),
('FRISADO_SUL', 'VERMELHO_NEVADO', 'active'),
('FRISADO_SUL', 'BRANCO', 'active'),

-- Belga Clássico
('BELGA_CLÁSSICO', 'AMARELO_INTENSO', 'active'),
('BELGA_CLÁSSICO', 'AMARELO_NEVADO', 'active'),
('BELGA_CLÁSSICO', 'AMARELO_MOSAICO', 'active'),
('BELGA_CLÁSSICO', 'VERMELHO_INTENSO', 'active'),
('BELGA_CLÁSSICO', 'VERMELHO_NEVADO', 'active'),
('BELGA_CLÁSSICO', 'VERMELHO_MOSAICO', 'active'),
('BELGA_CLÁSSICO', 'BRANCO', 'active'),
('BELGA_CLÁSSICO', 'PRATEADO', 'active'),
('BELGA_CLÁSSICO', 'OPALINO', 'active'),
('BELGA_CLÁSSICO', 'FEO', 'active'),
('BELGA_CLÁSSICO', 'TOPÁZIO', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CONFIRMAÇÃO: Dados Iniciais Inseridos com Sucesso
-- ============================================================================
-- Total de registros inseridos:
-- - Especialidades: 6
-- - Cores/Mutações: 13
-- - Criador: 1 (Canário Lima)
-- - Lotes de Anilhas: 5
-- - Regras Genéticas: 8
-- - Associações Especialidade-Cor: 52
