-- ============================================================================
-- MIGRATION 0006: Saúde/Alimentação, Lembretes de Reprodução, IoT (schema)
-- ============================================================================
-- Idempotente, mesmo padrão das anteriores.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "health_records" (
  "id" SERIAL PRIMARY KEY,
  "birdId" INTEGER NOT NULL,
  "type" VARCHAR(20) NOT NULL,
  "description" VARCHAR(300) NOT NULL,
  "date" TIMESTAMP NOT NULL,
  "weightGrams" REAL,
  "dietPhase" VARCHAR(20),
  "nextDueDate" TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "breeding_reminders" (
  "id" SERIAL PRIMARY KEY,
  "coupleId" INTEGER NOT NULL,
  "eventType" VARCHAR(30) NOT NULL,
  "expectedDate" TIMESTAMP NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "cage_sensor_readings" (
  "id" SERIAL PRIMARY KEY,
  "cageId" INTEGER,
  "section" VARCHAR(100),
  "temperatureC" REAL,
  "humidityPct" REAL,
  "luminosityLux" REAL,
  "ammoniaPpm" REAL,
  "recordedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "health_records_bird_idx" ON "health_records" USING btree ("birdId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index health_records_bird_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "health_records_type_idx" ON "health_records" USING btree ("type");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index health_records_type_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "breeding_reminders_couple_idx" ON "breeding_reminders" USING btree ("coupleId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index breeding_reminders_couple_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "breeding_reminders_date_idx" ON "breeding_reminders" USING btree ("expectedDate");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index breeding_reminders_date_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "cage_sensor_readings_cage_idx" ON "cage_sensor_readings" USING btree ("cageId");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index cage_sensor_readings_cage_idx: coluna ausente.';
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "cage_sensor_readings_recorded_idx" ON "cage_sensor_readings" USING btree ("recordedAt");
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'Pulando index cage_sensor_readings_recorded_idx: coluna ausente.';
END $$;
