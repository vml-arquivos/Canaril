-- Create enums
CREATE TYPE "role" AS ENUM ('user', 'admin');
CREATE TYPE "specialty" AS ENUM ('gloster_corona', 'gloster_consort', 'holandês', 'frisado_norte', 'frisado_sul', 'belga_clássico');
CREATE TYPE "color" AS ENUM ('amarelo_intenso', 'amarelo_nevado', 'amarelo_mosaico', 'vermelho_intenso', 'vermelho_nevado', 'vermelho_mosaico', 'branco', 'prateado', 'opalino', 'feo', 'topázio', 'albino', 'lutino');
CREATE TYPE "sex" AS ENUM ('macho', 'fêmea', 'indeterminado');
CREATE TYPE "bird_status" AS ENUM ('ativo', 'vendido', 'falecido');
CREATE TYPE "ring_status" AS ENUM ('disponível', 'em_uso', 'estoque');
CREATE TYPE "couple_status" AS ENUM ('ativo', 'inativo', 'finalizado');

-- Users table
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  "name" TEXT,
  "email" VARCHAR(320) UNIQUE,
  "loginMethod" VARCHAR(64),
  "role" "role" DEFAULT 'user',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSignedIn" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "users_openId_idx" ON "users" ("openId");

-- Rings table
CREATE TABLE "rings" (
  "id" SERIAL PRIMARY KEY,
  "number" VARCHAR(50) NOT NULL,
  "year" INTEGER NOT NULL,
  "color" VARCHAR(50),
  "status" "ring_status" NOT NULL DEFAULT 'disponível',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "usedQuantity" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "rings_number_year_idx" ON "rings" ("number", "year");

-- Birds table
CREATE TABLE "birds" (
  "id" SERIAL PRIMARY KEY,
  "ringId" INTEGER REFERENCES "rings"("id") ON DELETE RESTRICT,
  "ring" VARCHAR(50) NOT NULL UNIQUE,
  "specialty" "specialty" NOT NULL,
  "sex" "sex" NOT NULL,
  "color" "color" NOT NULL,
  "birthDate" DATE,
  "procedence" VARCHAR(255),
  "status" "bird_status" NOT NULL DEFAULT 'ativo',
  "photoUrl" TEXT,
  "fatherId" INTEGER,
  "motherId" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "birds_ring_idx" ON "birds" ("ring");
CREATE INDEX "birds_fatherId_idx" ON "birds" ("fatherId");
CREATE INDEX "birds_motherId_idx" ON "birds" ("motherId");
CREATE INDEX "birds_status_idx" ON "birds" ("status");

-- Add foreign keys for genealogy
ALTER TABLE "birds" ADD CONSTRAINT "birds_fatherId_fk" FOREIGN KEY ("fatherId") REFERENCES "birds"("id") ON DELETE SET NULL;
ALTER TABLE "birds" ADD CONSTRAINT "birds_motherId_fk" FOREIGN KEY ("motherId") REFERENCES "birds"("id") ON DELETE SET NULL;

-- Couples table
CREATE TABLE "couples" (
  "id" SERIAL PRIMARY KEY,
  "maleId" INTEGER NOT NULL REFERENCES "birds"("id") ON DELETE RESTRICT,
  "femaleId" INTEGER NOT NULL REFERENCES "birds"("id") ON DELETE RESTRICT,
  "cageNumber" VARCHAR(50),
  "formationDate" DATE NOT NULL,
  "status" "couple_status" NOT NULL DEFAULT 'ativo',
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "couples_maleId_idx" ON "couples" ("maleId");
CREATE INDEX "couples_femaleId_idx" ON "couples" ("femaleId");
CREATE INDEX "couples_status_idx" ON "couples" ("status");

-- Clutches table
CREATE TABLE "clutches" (
  "id" SERIAL PRIMARY KEY,
  "coupleId" INTEGER NOT NULL REFERENCES "couples"("id") ON DELETE CASCADE,
  "clutchDate" DATE NOT NULL,
  "totalEggs" INTEGER NOT NULL DEFAULT 0,
  "fertilizedEggs" INTEGER NOT NULL DEFAULT 0,
  "infertileEggs" INTEGER NOT NULL DEFAULT 0,
  "lostEggs" INTEGER NOT NULL DEFAULT 0,
  "hatchDate" DATE,
  "hatchedChicks" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "clutches_coupleId_idx" ON "clutches" ("coupleId");
CREATE INDEX "clutches_clutchDate_idx" ON "clutches" ("clutchDate");

-- Chicks table
CREATE TABLE "chicks" (
  "id" SERIAL PRIMARY KEY,
  "clutchId" INTEGER NOT NULL REFERENCES "clutches"("id") ON DELETE CASCADE,
  "ringId" INTEGER REFERENCES "rings"("id") ON DELETE RESTRICT,
  "ring" VARCHAR(50) UNIQUE,
  "sex" "sex",
  "color" "color",
  "birthDate" DATE NOT NULL,
  "ringDate" DATE,
  "weanDate" DATE,
  "status" "bird_status" NOT NULL DEFAULT 'ativo',
  "photoUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "chicks_clutchId_idx" ON "chicks" ("clutchId");
CREATE INDEX "chicks_ring_idx" ON "chicks" ("ring");
CREATE INDEX "chicks_status_idx" ON "chicks" ("status");

-- Gallery photos table
CREATE TABLE "galleryPhotos" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "photoUrl" TEXT NOT NULL,
  "specialty" "specialty",
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "galleryPhotos_displayOrder_idx" ON "galleryPhotos" ("displayOrder");

-- Breeder info table
CREATE TABLE "breederInfo" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "city" VARCHAR(255) NOT NULL,
  "state" VARCHAR(2) NOT NULL,
  "description" TEXT,
  "phone" VARCHAR(20),
  "email" VARCHAR(320),
  "website" VARCHAR(255),
  "logoUrl" TEXT,
  "bannerUrl" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
