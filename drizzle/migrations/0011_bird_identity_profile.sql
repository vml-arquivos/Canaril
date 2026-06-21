-- 0011_bird_identity_profile.sql
-- Evolução segura da ficha do pássaro para cadastro reprodutivo/genético.
-- Todos os campos são nullable ou possuem default para preservar registros existentes.

ALTER TABLE birds ADD COLUMN IF NOT EXISTS "displayTitle" varchar(250);
ALTER TABLE birds ADD COLUMN IF NOT EXISTS "nickname" varchar(100);
ALTER TABLE birds ADD COLUMN IF NOT EXISTS "speciesName" varchar(50) DEFAULT 'Canário';
ALTER TABLE birds ADD COLUMN IF NOT EXISTS "modality" varchar(20);
ALTER TABLE birds ADD COLUMN IF NOT EXISTS "breedName" varchar(100);
ALTER TABLE birds ADD COLUMN IF NOT EXISTS "officialClassId" integer;

CREATE INDEX IF NOT EXISTS birds_display_title_idx ON birds ("displayTitle");
CREATE INDEX IF NOT EXISTS birds_official_class_idx ON birds ("officialClassId");
CREATE INDEX IF NOT EXISTS birds_species_idx ON birds ("speciesName");
CREATE INDEX IF NOT EXISTS birds_modality_idx ON birds ("modality");

-- Retropreenche título dos pássaros antigos sem sobrescrever futuros títulos calculados.
UPDATE birds
SET "displayTitle" = CONCAT(ring, ' — ', COALESCE("specialty_code", 'Canário'), ' — ', COALESCE("color_code", 'Classe não informada'), ' — ', COALESCE(sex, 'Sexo não informado'))
WHERE "displayTitle" IS NULL;
