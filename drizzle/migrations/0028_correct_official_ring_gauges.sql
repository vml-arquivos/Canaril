-- Correção idempotente das bitolas oficiais FOB/OBJO 2026.
--
-- Regras administrativas personalizadas são preservadas: em ring_gauge_rules
-- só são atualizadas linhas cuja origem está marcada como FOB/OBJO 2026.

UPDATE ring_gauge_rules
   SET "recommendedGaugeMm" = 3.0,
       active = TRUE,
       "updatedAt" = NOW()
 WHERE notes LIKE 'FOB/OBJO 2026%'
   AND "speciesName" = 'Canário'
   AND "breedName" IS NULL
   AND modality IN ('COR', 'CANTO');

UPDATE ring_gauge_rules AS rule
   SET "recommendedGaugeMm" = official.gauge_mm,
       modality = 'PORTE',
       active = TRUE,
       "updatedAt" = NOW()
  FROM (VALUES
    ('Arlequim Português', 3.2::real),
    ('Benacus', 3.0::real),
    ('Bernois', 3.0::real),
    ('Border Fancy', 3.4::real),
    ('Bossu Belga', 3.0::real),
    ('Frisado Brasileiro', 3.4::real),
    ('Crest-Bred', 3.4::real),
    ('Crested', 3.4::real),
    ('Fife Fancy', 2.7::real),
    ('Fiorino', 3.0::real),
    ('Frisado do Norte', 3.0::real),
    ('Frisado do Sul', 3.0::real),
    ('Frisado Gigante Italiano', 3.4::real),
    ('Frill (Frisé Parisiense)', 3.4::real),
    ('Frisado Suíço', 3.0::real),
    ('Gibber Italicus', 2.7::real),
    ('Giboso Espanhol', 3.0::real),
    ('Giraldillo', 2.7::real),
    ('Gloster Corona', 3.0::real),
    ('Gloster Consort', 3.0::real),
    ('Hoso Japonês', 2.7::real),
    ('Irish Fancy', 2.7::real),
    ('Lancashire', 3.4::real),
    ('Lizard (Canário Lagarto)', 3.0::real),
    ('Llarguet Espanhol', 3.0::real),
    ('London Fancy', 3.2::real),
    ('London Fancy Adulto', 3.2::real),
    ('Mehringer', 3.0::real),
    ('Melado Tenerifenho', 3.0::real),
    ('Münchener', 3.0::real),
    ('Norwich', 3.4::real),
    ('Padovano', 3.4::real),
    ('Pívaro', 3.2::real),
    ('Raça Espanhola', 2.5::real),
    ('Rasmi Persa', 3.2::real),
    ('Rheinländer', 2.7::real),
    ('Rogetto', 3.0::real),
    ('Salentino', 2.7::real),
    ('Scotch Fancy', 3.0::real),
    ('Topete Alemão', 3.0::real),
    ('Yorkshire', 3.4::real),
    ('Brasileirinho', 3.0::real)
  ) AS official(breed_name, gauge_mm)
 WHERE rule.notes LIKE 'FOB/OBJO 2026%'
   AND rule."speciesName" = 'Canário'
   AND rule."breedName" = official.breed_name;

-- A base de conhecimento é catálogo do produto, não configuração operacional
-- do criador. Corrige os valores legados para refletir a mesma tabela oficial.
DO $$
BEGIN
  IF to_regclass('public.breed_knowledge') IS NOT NULL THEN
    UPDATE breed_knowledge AS breed
       SET "defaultRingGaugeMm" = official.gauge_mm,
           "updatedAt" = NOW()
      FROM (VALUES
        ('canario_cor', 3.0::real),
        ('gloster_consort', 3.0::real),
        ('gloster_corona', 3.0::real),
        ('padovano', 3.4::real),
        ('fiorino', 3.0::real),
        ('crest', 3.4::real),
        ('rheinlander', 2.7::real),
        ('frisado_norte', 3.0::real),
        ('frisado_sul', 3.0::real),
        ('fife_fancy', 2.7::real),
        ('yorkshire', 3.4::real),
        ('lizard', 3.0::real),
        ('border', 3.4::real),
        ('norwich', 3.4::real),
        ('scotch_fancy', 3.0::real),
        ('munchener', 3.0::real),
        ('roller', 3.0::real),
        ('timbrado', 3.0::real),
        ('waterslager', 3.0::real)
      ) AS official(code, gauge_mm)
     WHERE breed.code = official.code;
  END IF;
END $$;
