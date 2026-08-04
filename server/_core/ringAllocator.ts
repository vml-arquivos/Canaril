/**
 * ringAllocator.ts
 *
 * Serviço de alocação transacional de anilhas.
 *
 * Regras inquebrável:
 *   - Uma anilha USED nunca é reutilizada
 *   - fullCode é único no sistema (constraint + verificação explícita)
 *   - Alocação definitiva ocorre SOMENTE ao salvar o pássaro
 *   - Não há reserva temporária — a anilha fica AVAILABLE até o save
 *   - Toda operação de escrita usa transação explícita
 */

import { and, eq, asc, isNull, sql } from "drizzle-orm";
import { ring_batches, ring_gauge_rules, rings } from "../../drizzle/schema";
import { generateBatchCodes } from "./ringParser";
import type { Pool } from "pg";
import { assessRingCompatibility, type RingGaugeRuleLike } from "./ringCompatibility";

type DB = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export interface RingCriteria {
  speciesName?: string;
  breedName?: string;
  modality?: string;
  ringGaugeMm?: number;
  year?: number;
  batchId?: number;
  /**
   * tenantId usado para filtrar lotes e anilhas disponíveis. Somente lotes
   * pertencentes a esse tenant serão considerados. Se undefined ou null,
   * considera lotes globais (PLATFORM_ADMIN).
   */
  tenantId?: number | null;
}

export interface NextRingResult {
  ring: typeof rings.$inferSelect;
  batch: typeof ring_batches.$inferSelect;
  fullCode: string;
}

/**
 * Busca a próxima anilha disponível compatível com os critérios.
 * NÃO aloca — apenas retorna a sugestão.
 *
 * REGRA INQUERÁVEL: nunca sugere código já presente em birds.ring,
 * independente do status na tabela rings.
 */
export async function getNextAvailableRing(
  db: DB,
  criteria: RingCriteria
): Promise<NextRingResult | null> {
  const batchConditions = [
    eq(ring_batches.status, "available"),
    isNull(ring_batches.deletedAt),
  ];
  if (criteria.batchId) batchConditions.push(eq(ring_batches.id, criteria.batchId));
  if (criteria.year) batchConditions.push(eq(ring_batches.year, criteria.year));
  if (criteria.tenantId !== null && criteria.tenantId !== undefined) {
    batchConditions.push(eq(ring_batches.tenantId, criteria.tenantId));
  }

  const [batches, rules] = await Promise.all([
    db.select().from(ring_batches).where(and(...batchConditions)),
    db.select({
      speciesName: ring_gauge_rules.speciesName,
      breedName: ring_gauge_rules.breedName,
      modality: ring_gauge_rules.modality,
      recommendedGaugeMm: ring_gauge_rules.recommendedGaugeMm,
      active: ring_gauge_rules.active,
    }).from(ring_gauge_rules).where(eq(ring_gauge_rules.active, true)),
  ]);

  const target = {
    speciesName: criteria.speciesName,
    breedName: criteria.breedName,
    modality: criteria.modality,
    ringGaugeMm: criteria.ringGaugeMm,
  };

  const compatibleBatches = batches
    .map((batch) => ({
      batch,
      assessment: assessRingCompatibility(target, {
        speciesName: batch.speciesName,
        breedName: batch.breedName,
        modality: batch.modality,
        ringGaugeMm: batch.ringGaugeMm,
      }, rules as RingGaugeRuleLike[]),
    }))
    .filter(({ assessment }) => assessment.compatible)
    .sort((left, right) =>
      right.assessment.score - left.assessment.score
      || left.batch.year - right.batch.year
      || left.batch.id - right.batch.id,
    );

  // Consulta somente a primeira anilha de cada lote compatível. Evita carregar
  // milhares de códigos em memória e elimina o antigo corte arbitrário de 50.
  for (const { batch } of compatibleBatches) {
    const ringConditions = [
      eq(rings.batchId, batch.id),
      eq(rings.status, "available"),
      isNull(rings.deletedAt),
      isNull(rings.birdId),
      isNull(rings.chickId),
      sql`NOT EXISTS (
        SELECT 1
          FROM "birds" AS used_bird
         WHERE used_bird."ring" = COALESCE(${rings.fullCode}, ${rings.number})
           AND used_bird."deletedAt" IS NULL
      )`,
    ];
    if (criteria.tenantId !== null && criteria.tenantId !== undefined) {
      ringConditions.push(eq(rings.tenantId, criteria.tenantId));
    }

    const [ring] = await db
      .select()
      .from(rings)
      .where(and(...ringConditions))
      .orderBy(asc(rings.sequence), asc(rings.id))
      .limit(1);

    if (ring) {
      return {
        ring,
        batch,
        fullCode: ring.fullCode ?? ring.number,
      };
    }
  }

  return null;
}

/**
 * Aloca definitivamente uma anilha para um pássaro.
 * Deve ser chamado DENTRO da transação de criação do pássaro.
 *
 * Retorna o fullCode alocado ou lança erro se a anilha não estiver disponível.
 */
export async function assignRingToBird(
  db: DB,
  pool: Pool,
  ringId: number,
  birdId: number,
  tenantId?: number | null,
): Promise<string> {
  void db; // Mantido na assinatura pública para compatibilidade com os chamadores existentes.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Bloqueia a anilha para impedir dupla alocação concorrente.
    const lockResult = await client.query<{
      id: number;
      batchId: number;
      status: string;
      birdId: number | null;
      chickId: number | null;
      fullCode: string | null;
      number: string;
      tenantId: number | null;
      ringDeletedAt: Date | null;
      batchStatus: string;
      batchDeletedAt: Date | null;
      speciesName: string | null;
      breedName: string | null;
      modality: string | null;
      ringGaugeMm: number | null;
    }>(
      `SELECT r.id, r."batchId" AS "batchId", r.status,
              r."birdId" AS "birdId", r."chickId" AS "chickId",
              r."fullCode" AS "fullCode", r.number,
              r."tenantId" AS "tenantId", r."deletedAt" AS "ringDeletedAt",
              rb.status AS "batchStatus", rb."deletedAt" AS "batchDeletedAt",
              rb."speciesName" AS "speciesName", rb."breedName" AS "breedName",
              rb.modality, rb."ringGaugeMm" AS "ringGaugeMm"
         FROM rings r
         JOIN ring_batches rb ON rb.id = r."batchId"
        WHERE r.id = $1
          AND ($2::integer IS NULL OR r."tenantId" = $2)
          AND ($2::integer IS NULL OR rb."tenantId" = $2)
        FOR UPDATE OF r`,
      [ringId, tenantId ?? null],
    );

    if (lockResult.rows.length === 0) {
      throw new Error(`Anilha #${ringId} não encontrada.`);
    }

    const ring = lockResult.rows[0];
    const fullCode = ring.fullCode ?? ring.number;

    if (ring.ringDeletedAt !== null || ring.batchDeletedAt !== null) {
      throw new Error(`Anilha "${fullCode}" pertence a um lote arquivado e não pode ser utilizada.`);
    }
    if (ring.batchStatus !== "available") {
      throw new Error(`O lote da anilha "${fullCode}" não está disponível (status: ${ring.batchStatus}).`);
    }
    if (ring.status !== "available") {
      throw new Error(`Anilha "${fullCode}" não está disponível (status: ${ring.status}).`);
    }
    if (ring.birdId !== null || ring.chickId !== null) {
      throw new Error(`Anilha "${fullCode}" já possui vínculo operacional e não pode ser reutilizada.`);
    }

    const birdResult = await client.query<{
      id: number;
      ring: string;
      speciesName: string | null;
      breedName: string | null;
      modality: string | null;
    }>(
      `SELECT id, ring, "speciesName" AS "speciesName", "breedName" AS "breedName", modality
         FROM birds
        WHERE id = $1
          AND "deletedAt" IS NULL
          AND ($2::integer IS NULL OR "tenantId" = $2)
        FOR UPDATE`,
      [birdId, tenantId ?? null],
    );
    if (birdResult.rows.length === 0) {
      throw new Error("Pássaro não encontrado neste criadouro.");
    }
    if (birdResult.rows[0].ring !== fullCode) {
      throw new Error(
        `Inconsistência de anilha: o pássaro está cadastrado com "${birdResult.rows[0].ring}", ` +
        `mas a anilha selecionada é "${fullCode}".`,
      );
    }

    const gaugeRules = (await client.query<RingGaugeRuleLike>(
      `SELECT "speciesName", "breedName", modality,
              "recommendedGaugeMm" AS "recommendedGaugeMm", active
         FROM ring_gauge_rules
        WHERE active = TRUE`,
    )).rows;
    const compatibility = assessRingCompatibility({
      speciesName: birdResult.rows[0].speciesName,
      breedName: birdResult.rows[0].breedName,
      modality: birdResult.rows[0].modality,
    }, {
      speciesName: ring.speciesName,
      breedName: ring.breedName,
      modality: ring.modality,
      ringGaugeMm: ring.ringGaugeMm,
    }, gaugeRules);
    if (!compatibility.compatible) {
      throw new Error(`A anilha "${fullCode}" não é compatível com o pássaro. ${compatibility.reason}`);
    }

    // Defesa adicional para bancos legados onde o índice único ainda não
    // tenha sido aplicado: um pássaro não pode possuir duas anilhas físicas.
    const existingLink = await client.query<{ id: number }>(
      `SELECT id FROM rings
        WHERE "birdId" = $1 AND id <> $2
        LIMIT 1
        FOR UPDATE`,
      [birdId, ringId],
    );
    if (existingLink.rows.length > 0) {
      throw new Error("O pássaro já está vinculado a outra anilha no estoque.");
    }

    const updateResult = await client.query(
      `UPDATE rings
          SET status = 'in_use', "birdId" = $1, "usedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = $2
          AND status = 'available'
          AND "birdId" IS NULL
          AND "chickId" IS NULL`,
      [birdId, ringId],
    );
    if ((updateResult.rowCount ?? 0) !== 1) {
      throw new Error(`A anilha "${fullCode}" deixou de estar disponível durante a operação.`);
    }

    // Deriva os contadores do estado real das anilhas. O lock do lote ocorre
    // depois do lock da anilha, mantendo a mesma ordem usada nos demais fluxos
    // e garantindo uma fotografia atual após qualquer espera concorrente.
    await client.query(
      `SELECT id FROM ring_batches
        WHERE id = $1 AND ($2::integer IS NULL OR "tenantId" = $2)
        FOR UPDATE`,
      [ring.batchId, tenantId ?? null],
    );
    await client.query(
      `UPDATE ring_batches rb
          SET quantity_used = (
                SELECT COUNT(*)::integer
                  FROM rings r
                 WHERE r."batchId" = rb.id
                   AND (r.status IN ('in_use', 'used') OR r."usedAt" IS NOT NULL)
              ),
              "currentNumber" = COALESCE((
                SELECT MIN(r.sequence)::integer
                  FROM rings r
                 WHERE r."batchId" = rb.id
                   AND r.status = 'available'
                   AND r."birdId" IS NULL
                   AND r."chickId" IS NULL
              ), rb."endNumber" + 1),
              status = CASE
                WHEN EXISTS (
                  SELECT 1 FROM rings r
                   WHERE r."batchId" = rb.id
                     AND r.status = 'available'
                     AND r."birdId" IS NULL
                     AND r."chickId" IS NULL
                ) THEN 'available'
                ELSE 'exhausted'
              END,
              "updatedAt" = NOW()
        WHERE rb.id = $1`,
      [ring.batchId],
    );

    await client.query("COMMIT");
    return fullCode;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Compatibilidade de API: a liberação foi deliberadamente bloqueada.
 * Depois de aplicada, a anilha permanece no histórico mesmo se o pássaro
 * for arquivado ou excluído logicamente.
 */
export async function releaseRingFromBird(
  db: DB,
  pool: Pool,
  birdId: number,
  tenantId?: number | null,
): Promise<void> {
  void db;
  void pool;
  void birdId;
  void tenantId;
  throw new Error(
    "Uma anilha aplicada não pode voltar ao estoque. Corrija os dados do pássaro mantendo a rastreabilidade histórica.",
  );
}

/**
 * Gera e insere todas as anilhas individuais de um lote no banco.
 * Usa INSERT ... ON CONFLICT DO NOTHING para idempotência.
 */
export async function generateRingsForBatch(
  db: DB,
  batchId: number,
  batch: {
    year: number;
    month?: number | null;
    breederCode?: string | null;
    prefix?: string | null;
    suffix?: string | null;
    formatPattern: string;
    startNumber: number;
    endNumber: number;
  },
  tenantId?: number | null
): Promise<number> {
  const codes = generateBatchCodes({
    year: batch.year,
    month: batch.month ?? undefined,
    breederCode: batch.breederCode ?? undefined,
    prefix: batch.prefix ?? undefined,
    suffix: batch.suffix ?? undefined,
    formatPattern: batch.formatPattern,
    startNumber: batch.startNumber,
    endNumber: batch.endNumber,
  });

  if (codes.length === 0) return 0;

  // Insere em chunks de 500 para não sobrecarregar o banco
  const CHUNK = 500;
  let inserted = 0;

  for (let i = 0; i < codes.length; i += CHUNK) {
    const chunk = codes.slice(i, i + CHUNK);
    const values = chunk.map((c) => ({
      batchId,
      number: c.fullCode,
      fullCode: c.fullCode,
      sequence: c.sequence,
      status: "available" as const,
      ringSource: "BATCH" as const,
      tenantId: tenantId ?? null,
    }));

    const created = await db
      .insert(rings)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: rings.id });
    inserted += created.length;
  }

  return inserted;
}

/**
 * Cria uma anilha manual (sem lote) — para aves de outros criadores,
 * anilhas antigas, estrangeiras ou danificadas.
 *
 * Valida unicidade do fullCode antes de inserir.
 */
export async function createManualRing(
  db: DB,
  params: {
    fullCode: string;
    batchId: number; // lote "manual" — deve existir um lote especial com id fixo
    notes?: string;
    tenantId?: number | null;
  }
): Promise<typeof rings.$inferSelect> {
  // Verifica duplicidade
  const existing = await db
    .select({ id: rings.id })
    .from(rings)
    .where(and(
      eq(rings.fullCode, params.fullCode),
      params.tenantId === null || params.tenantId === undefined
        ? isNull(rings.tenantId)
        : eq(rings.tenantId, params.tenantId),
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(
      `Anilha "${params.fullCode}" já existe no sistema. Não é possível cadastrar duplicata.`
    );
  }

  const [created] = await db
    .insert(rings)
    .values({
      batchId: params.batchId,
      number: params.fullCode,
      fullCode: params.fullCode,
      sequence: 0,
      status: "available",
      ringSource: "MANUAL",
      notes: params.notes,
      tenantId: params.tenantId ?? null,
    })
    .returning();

  return created;
}
