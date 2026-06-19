-- ============================================================================
-- MIGRATION: Seed Data - Dados Iniciais do Sistema Canário Lima
-- ============================================================================

INSERT INTO specialties (code, name, description, size_cm, weight_g, status) VALUES
('gloster_corona', 'Gloster Corona', 'Canário com crista pronunciada em forma de coroa. Corpo compacto e bem proporcionado.', '11-12', '12-29', 'active'),
('gloster_consort', 'Gloster Consort', 'Canário sem crista, cabeça lisa. Companheiro ideal do Corona para cruzamentos.', '11-12', '12-29', 'active'),
('holandês', 'Holandês', 'Raça de porte grande e elegante. Corpo alongado com postura ereta e nobre.', '13-14', '30-40', 'active'),
('frisado_norte', 'Frisado do Norte', 'Canário com plumagem frisada característica. Origem holandesa, porte médio.', '12-13', '20-35', 'active'),
('frisado_sul', 'Frisado do Sul', 'Canário frisado de porte menor. Plumagem ondulada e bem distribuída.', '12-13', '20-35', 'active'),
('belga_clássico', 'Belga Clássico', 'Raça de porte clássica. Forma alongada e elegante com postura característica.', '13-14', '30-40', 'active')
ON CONFLICT (code) DO NOTHING;

INSERT INTO colors (code, name, category, genetics, description, status) VALUES
('amarelo_intenso', 'Amarelo Intenso', 'Amarelo', 'Recessivo', 'Amarelo puro e intenso sem marcações brancas.', 'active'),
('amarelo_nevado', 'Amarelo Nevado', 'Amarelo', 'Dominante', 'Amarelo com marcações brancas. Padrão nevado bem definido.', 'active'),
('amarelo_mosaico', 'Amarelo Mosaico', 'Amarelo', 'Ligado ao sexo', 'Amarelo com padrão mosaico.', 'active'),
('vermelho_intenso', 'Vermelho Intenso', 'Vermelho', 'Recessivo', 'Vermelho puro e intenso sem marcações brancas.', 'active'),
('vermelho_nevado', 'Vermelho Nevado', 'Vermelho', 'Dominante', 'Vermelho com marcações brancas.', 'active'),
('vermelho_mosaico', 'Vermelho Mosaico', 'Vermelho', 'Ligado ao sexo', 'Vermelho com padrão mosaico.', 'active'),
('branco', 'Branco', 'Branco', 'Dominante', 'Branco puro dominante. Cuidado com cruzamentos branco x branco.', 'active'),
('prateado', 'Prateado', 'Branco', 'Recessivo', 'Branco recessivo com tonalidade prateada.', 'active'),
('opalino', 'Opalino', 'Mutação', 'Recessivo', 'Mutação que altera a distribuição de pigmento.', 'active'),
('feo', 'Feo', 'Mutação', 'Recessivo', 'Mutação que reduz pigmentação.', 'active'),
('topázio', 'Topázio', 'Mutação', 'Recessivo', 'Mutação com tonalidade amarelada uniforme.', 'active'),
('albino', 'Albino', 'Mutação', 'Recessivo', 'Ausência total de pigmentação. Alto risco genético.', 'active'),
('lutino', 'Lutino', 'Mutação', 'Recessivo', 'Amarelo puro sem pigmentação escura. Ligado ao sexo.', 'active')
ON CONFLICT (code) DO NOTHING;

INSERT INTO breeders (name, city, state, country, registration_number, association, phone, email, website, description, status) VALUES
('Canário Lima', 'Brasília', 'DF', 'Brasil', 'CBCA-2024-001', 'Confederação Brasileira de Criadores de Aves (CBCA)', '(61) 99999-9999', 'contato@canarioslima.com.br', 'www.canarioslima.com.br', 'Criadouro profissional especializado em Canários Belga com foco em qualidade genética e bem-estar animal.', 'active')
ON CONFLICT (registration_number) DO NOTHING;

INSERT INTO ring_batches (batch_number, year, color, quantity_total, quantity_used, status) VALUES
('001', 2024, 'Vermelha', 100, 0, 'available'),
('002', 2024, 'Azul', 100, 0, 'available'),
('003', 2024, 'Verde', 100, 0, 'available'),
('004', 2024, 'Amarela', 100, 0, 'available'),
('005', 2024, 'Branca', 100, 0, 'available')
ON CONFLICT (batch_number, year) DO NOTHING;

INSERT INTO genetic_rules (male_color, female_color, rule_type, description, status) VALUES
('amarelo_intenso', 'amarelo_intenso', 'recommended', 'Cruzamento recomendado para manutenção da cor intenso.', 'active'),
('vermelho_intenso', 'vermelho_intenso', 'recommended', 'Cruzamento recomendado para manutenção da cor intenso.', 'active'),
('amarelo_nevado', 'amarelo_nevado', 'warning', 'Pode resultar em filhotes muito claros ou com problemas de pigmentação.', 'active'),
('branco', 'branco', 'forbidden', 'Branco dominante x branco dominante: proibido por risco de surdez.', 'active'),
('albino', 'albino', 'forbidden', 'Albino x albino: proibido por alto risco genético.', 'active')
ON CONFLICT (male_color, female_color, rule_type) DO NOTHING;

INSERT INTO specialty_colors (specialty_code, color_code, status) VALUES
('gloster_corona', 'amarelo_intenso', 'active'),
('gloster_corona', 'amarelo_nevado', 'active'),
('gloster_corona', 'amarelo_mosaico', 'active'),
('gloster_corona', 'vermelho_intenso', 'active'),
('gloster_corona', 'vermelho_nevado', 'active'),
('gloster_corona', 'vermelho_mosaico', 'active'),
('gloster_corona', 'branco', 'active'),
('gloster_corona', 'prateado', 'active'),
('gloster_consort', 'amarelo_intenso', 'active'),
('gloster_consort', 'amarelo_nevado', 'active'),
('gloster_consort', 'amarelo_mosaico', 'active'),
('gloster_consort', 'vermelho_intenso', 'active'),
('gloster_consort', 'vermelho_nevado', 'active'),
('gloster_consort', 'vermelho_mosaico', 'active'),
('gloster_consort', 'branco', 'active'),
('gloster_consort', 'prateado', 'active'),
('holandês', 'amarelo_intenso', 'active'),
('holandês', 'amarelo_nevado', 'active'),
('holandês', 'vermelho_intenso', 'active'),
('holandês', 'vermelho_nevado', 'active'),
('holandês', 'branco', 'active'),
('holandês', 'prateado', 'active'),
('frisado_norte', 'amarelo_intenso', 'active'),
('frisado_norte', 'amarelo_nevado', 'active'),
('frisado_norte', 'vermelho_intenso', 'active'),
('frisado_norte', 'vermelho_nevado', 'active'),
('frisado_norte', 'branco', 'active'),
('frisado_sul', 'amarelo_intenso', 'active'),
('frisado_sul', 'amarelo_nevado', 'active'),
('frisado_sul', 'vermelho_intenso', 'active'),
('frisado_sul', 'vermelho_nevado', 'active'),
('frisado_sul', 'branco', 'active'),
('belga_clássico', 'amarelo_intenso', 'active'),
('belga_clássico', 'amarelo_nevado', 'active'),
('belga_clássico', 'vermelho_intenso', 'active'),
('belga_clássico', 'vermelho_nevado', 'active'),
('belga_clássico', 'branco', 'active'),
('belga_clássico', 'prateado', 'active')
ON CONFLICT (specialty_code, color_code) DO NOTHING;
