import type { Pool, PoolClient } from "pg";
import { generateBatchCodes } from "./ringParser";

export interface RingBatchInput {
  batch_number: string;
  year: number;
  color: string;
  startNumber: number;
  endNumber: number;
  breederCode?: string;
  associationName?: string;
  speciesName?: string;
  breedName?: string;
  modality?: string;
  ringGaugeMm?: number;
  month?: number;
  prefix?: string;
  suffix?: string;
  formatPattern: string;
  notes?: string;
}

export interface CreatedRingBatch {
  batch: Record<string, unknown>;
  generated: number;
  range: string;
}

async function insertRingRows(
  client: PoolClient,
  batchId: number,
  tenantId: number,
  input: RingBatchInput,
): Promise<number> {
  const codes = generateBatchCodes({
    year: input.year,
    month: input.month,
    breederCode: input.breederCode,
    prefix: input.prefix,
    suffix: input.suffix,
    formatPattern: input.formatPattern,
    startNumber: input.startNumber,
    endNumber: input.endNumber,
  });

  const CHUNK_SIZE = 400;
  let inserted = 0;
  for (let offset = 0; offset < codes.length; offset += CHUNK_SIZE) {
    const chunk = codes.slice(offset, offset + CHUNK_SIZE);
    const values: unknown[] = [];
    const tuples = chunk.map((code, index) => {
      const base = index * 7;
      values.push(
        batchId,
        code.fullCode,
        code.fullCode,
        code.sequence,
        "available",
        "BATCH",
        tenantId,
      );
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`;
    });

    const result = await client.query(
      `INSERT INTO rings
         ("batchId", number, "fullCode", sequence, status, "ringSource", "tenantId")
       VALUES ${tuples.join(",")}
       RETURNING id`,
      values,
    );
    inserted += result.rowCount ?? 0;
  }

  if (inserted !== codes.length) {
    throw new Error(
      `Falha de integridade ao gerar o lote: esperado ${codes.length}, gerado ${inserted}.`,
    );
  }
  return inserted;
}

async function insertBatch(
  client: PoolClient,
  tenantId: number,
  input: RingBatchInput,
): Promise<Record<string, unknown>> {
  const quantityTotal = input.endNumber - input.startNumber + 1;
  if (quantityTotal <= 0 || quantityTotal > 10_000) {
    throw new Error("Faixa de anilhas inválida (máximo de 10.000 por lote).");
  }

  const result = await client.query<Record<string, unknown>>(
    `INSERT INTO ring_batches (
       batch_number, year, color, quantity_total, quantity_used, status,
       "breederCode", "associationName", "speciesName", "breedName", modality,
       "ringGaugeMm", month, prefix, suffix, "startNumber", "endNumber",
       "currentNumber", "formatPattern", notes, "tenantId"
     ) VALUES (
       $1,$2,$3,$4,0,'available',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$14,$16,$17,$18
     ) RETURNING *`,
    [
      input.batch_number,
      input.year,
      input.color,
      quantityTotal,
      input.breederCode ?? null,
      input.associationName ?? null,
      input.speciesName ?? null,
      input.breedName ?? null,
      input.modality ?? null,
      input.ringGaugeMm ?? null,
      input.month ?? null,
      input.prefix ?? null,
      input.suffix ?? null,
      input.startNumber,
      input.endNumber,
      input.formatPattern,
      input.notes ?? null,
      tenantId,
    ],
  );

  const batch = result.rows[0];
  if (!batch || typeof batch.id !== "number") {
    throw new Error("O banco não retornou o lote criado.");
  }
  return batch;
}

/**
 * Cria um ou vários lotes e todas as anilhas dentro de uma única transação.
 * Qualquer colisão ou falha reverte integralmente o pedido, impedindo lotes
 * vazios e faixas parcialmente geradas.
 */
export async function createRingBatchesAtomic(
  pool: Pool,
  tenantId: number,
  inputs: RingBatchInput[],
): Promise<CreatedRingBatch[]> {
  if (inputs.length === 0) return [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created: CreatedRingBatch[] = [];

    for (const input of inputs) {
      const batch = await insertBatch(client, tenantId, input);
      const generated = await insertRingRows(client, Number(batch.id), tenantId, input);
      created.push({
        batch,
        generated,
        range: `${input.startNumber}–${input.endNumber}`,
      });
    }

    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Remove apenas um lote comprovadamente nunca utilizado, sob lock. */
export async function deleteUnusedRingBatchAtomic(
  pool: Pool,
  tenantId: number,
  batchId: number,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const batch = await client.query(
      `SELECT id FROM ring_batches
        WHERE id=$1 AND "tenantId"=$2 AND "deletedAt" IS NULL
        FOR UPDATE`,
      [batchId, tenantId],
    );
    if (batch.rows.length !== 1) throw new Error("Lote não encontrado neste criadouro.");

    const used = await client.query<{ number: string }>(
      `SELECT number FROM rings
        WHERE "batchId"=$1 AND "tenantId"=$2
          AND ("usedAt" IS NOT NULL OR "birdId" IS NOT NULL OR "chickId" IS NOT NULL
               OR status IN ('in_use','used','reserved'))
        LIMIT 5 FOR UPDATE`,
      [batchId, tenantId],
    );
    if (used.rows.length > 0) {
      throw new Error("Este lote possui histórico de uso e não pode ser apagado. Arquive-o para preservar a rastreabilidade.");
    }

    const deletedRings = await client.query(
      `DELETE FROM rings WHERE "batchId"=$1 AND "tenantId"=$2`,
      [batchId, tenantId],
    );
    await client.query(
      `DELETE FROM ring_batches WHERE id=$1 AND "tenantId"=$2`,
      [batchId, tenantId],
    );
    await client.query("COMMIT");
    return deletedRings.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
