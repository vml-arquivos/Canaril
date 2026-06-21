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

import { and, eq, asc, isNull, sql, notInArray } from "drizzle-orm";
import { ring_batches, rings, birds } from "../../drizzle/schema";
import { generateRingCode, generateBatchCodes } from "./ringParser";
import type { Pool } from "pg";

type DB = NonNullable<Awaited<ReturnType<typeof import("../db").getDb>>>;

export interface RingCriteria {
  speciesName?: string;
  breedName?: string;
  modality?: string;
  ringGaugeMm?: number;
  year?: number;
  batchId?: number;
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
  // Coleta todos os códigos já usados em birds.ring para exclusão
  const usedRings = await db.select({ ring: birds.ring }).from(birds);
  const usedCodes = new Set(usedRings.map((b) => b.ring));

  // Monta condições de filtro para o lote
  const batchConditions = [
    eq(ring_batches.status, "available"),
  ];

  if (criteria.batchId) {
    batchConditions.push(eq(ring_batches.id, criteria.batchId));
  }
  if (criteria.year) {
    batchConditions.push(eq(ring_batches.year, criteria.year));
  }
  if (criteria.speciesName) {
    batchConditions.push(eq(ring_batches.speciesName, criteria.speciesName));
  }
  if (criteria.modality) {
    batchConditions.push(eq(ring_batches.modality, criteria.modality));
  }
  if (criteria.ringGaugeMm) {
    batchConditions.push(eq(ring_batches.ringGaugeMm, criteria.ringGaugeMm));
  }

  // Busca lotes compatíveis ordenados por ano asc (mais antigo com vagas primeiro)
  const compatibleBatches = await db
    .select()
    .from(ring_batches)
    .where(and(...batchConditions))
    .orderBy(asc(ring_batches.year));

  for (const batch of compatibleBatches) {
    // Busca as próximas anilhas disponíveis do lote (pega algumas para filtrar)
    const candidates = await db
      .select()
      .from(rings)
      .where(
        and(
          eq(rings.batchId, batch.id),
          eq(rings.status, "available"),
          isNull(rings.birdId)
        )
      )
      .orderBy(asc(rings.sequence))
      .limit(50); // pega até 50 candidatas para filtrar as já usadas em birds

    // Filtra excluindo códigos já presentes em birds.ring
    const firstFree = candidates.find((r) => {
      const code = r.fullCode ?? r.number;
      return !usedCodes.has(code);
    });

    if (firstFree) {
      return {
        ring: firstFree,
        batch,
        fullCode: firstFree.fullCode ?? firstFree.number,
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
  birdId: number
): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Bloqueia a linha para evitar corrida (SELECT FOR UPDATE)
    const lockResult = await client.query<{
      id: number;
      status: string;
      "birdId": number | null;
      "fullCode": string | null;
      number: string;
    }>(
      `SELECT id, status, "birdId", "fullCode", number
       FROM rings
       WHERE id = $1
       FOR UPDATE`,
      [ringId]
    );

    if (lockResult.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error(`Anilha #${ringId} não encontrada.`);
    }

    const ring = lockResult.rows[0];

    if (ring.status !== "available") {
      await client.query("ROLLBACK");
      throw new Error(
        `Anilha "${ring.fullCode ?? ring.number}" não está disponível (status: ${ring.status}).`
      );
    }

    if (ring.birdId !== null) {
      await client.query("ROLLBACK");
      throw new Error(
        `Anilha "${ring.fullCode ?? ring.number}" já está vinculada ao pássaro #${ring.birdId}.`
      );
    }

    // Marca como USED e vincula ao pássaro
    await client.query(
      `UPDATE rings
       SET status = 'in_use', "birdId" = $1, "usedAt" = NOW(), "updatedAt" = NOW()
       WHERE id = $2`,
      [birdId, ringId]
    );

    // Incrementa o contador do lote
    await client.query(
      `UPDATE ring_batches
       SET quantity_used = quantity_used + 1,
           "currentNumber" = "currentNumber" + 1,
           "updatedAt" = NOW()
       WHERE id = (SELECT "batchId" FROM rings WHERE id = $1)`,
      [ringId]
    );

    // Marca o lote como EXHAUSTED se não houver mais anilhas disponíveis
    await client.query(
      `UPDATE ring_batches
       SET status = 'exhausted', "updatedAt" = NOW()
       WHERE id = (SELECT "batchId" FROM rings WHERE id = $1)
         AND NOT EXISTS (
           SELECT 1 FROM rings
           WHERE "batchId" = ring_batches.id
             AND status = 'available'
         )`,
      [ringId]
    );

    await client.query("COMMIT");
    return ring.fullCode ?? ring.number;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Libera uma anilha que foi vinculada a um pássaro (ex: exclusão do pássaro).
 * Só funciona se o pássaro ainda não foi confirmado como anilhado.
 */
export async function releaseRingFromBird(
  db: DB,
  pool: Pool,
  birdId: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE rings
       SET status = 'available', "birdId" = NULL, "usedAt" = NULL, "updatedAt" = NOW()
       WHERE "birdId" = $1 AND status = 'in_use'`,
      [birdId]
    );

    // Decrementa o contador do lote
    await client.query(
      `UPDATE ring_batches
       SET quantity_used = GREATEST(0, quantity_used - 1),
           status = 'available',
           "updatedAt" = NOW()
       WHERE id IN (
         SELECT "batchId" FROM rings WHERE "birdId" = $1
       )`,
      [birdId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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
  }
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
    }));

    await db.insert(rings).values(values).onConflictDoNothing();
    inserted += chunk.length;
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
  }
): Promise<typeof rings.$inferSelect> {
  // Verifica duplicidade
  const existing = await db
    .select({ id: rings.id })
    .from(rings)
    .where(eq(rings.fullCode, params.fullCode))
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
    })
    .returning();

  return created;
}
