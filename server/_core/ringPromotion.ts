import type { Pool, PoolClient } from "pg";
import { assessRingCompatibility, findRecommendedRingGauge, type RingGaugeRuleLike, type RingSubject } from "./ringCompatibility";

export type RingPromotionInput = {
  tenantId: number;
  clutchId: number;
  sex: "macho" | "fêmea" | "indefinido";
  hatchDate?: Date;
};

type DbRow = Record<string, any>;

function ensureSingle<T extends DbRow>(rows: T[], message: string): T {
  if (rows.length !== 1) throw new Error(message);
  return rows[0];
}

async function loadGrandparents(client: PoolClient, parentRows: DbRow[], tenantId: number) {
  const ids = [...new Set(parentRows.flatMap((p) => [p.fatherId, p.motherId]).filter(Number.isInteger))];
  if (ids.length === 0) return [];
  const { rows } = await client.query(
    `SELECT id, ring, "displayTitle" FROM birds
      WHERE id = ANY($1::integer[]) AND "tenantId"=$2 AND "deletedAt" IS NULL`,
    [ids, tenantId],
  );
  return rows;
}

/**
 * Anilha e promove um filhote em uma única transação PostgreSQL.
 *
 * Invariantes:
 * - postura, casal, pais, filhote, anilha e lote pertencem ao mesmo tenant;
 * - a anilha é bloqueada com FOR UPDATE SKIP LOCKED;
 * - ave, filhote, anilha e contador do lote são confirmados juntos;
 * - qualquer erro executa rollback total, sem cadastro parcial.
 */
export async function ringAndPromoteChick(pool: Pool, input: RingPromotionInput) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const clutch = ensureSingle(
      (await client.query(
        `SELECT cl.*
           FROM clutches cl
          WHERE cl.id = $1 AND cl."tenantId" = $2 AND cl."deletedAt" IS NULL
          FOR UPDATE`,
        [input.clutchId, input.tenantId],
      )).rows,
      "Postura não encontrada neste criadouro.",
    );

    const couple = ensureSingle(
      (await client.query(
        `SELECT cp.*
           FROM couples cp
          WHERE cp.id = $1 AND cp."tenantId" = $2 AND cp."deletedAt" IS NULL
          FOR UPDATE`,
        [clutch.coupleId, input.tenantId],
      )).rows,
      "Casal da postura não encontrado neste criadouro.",
    );

    const parentResult = await client.query(
      `SELECT * FROM birds
        WHERE id = ANY($1::integer[])
          AND "tenantId" = $2
          AND "deletedAt" IS NULL
        FOR SHARE`,
      [[couple.maleId, couple.femaleId], input.tenantId],
    );
    const father = parentResult.rows.find((b) => b.id === couple.maleId);
    const mother = parentResult.rows.find((b) => b.id === couple.femaleId);
    if (!father || !mother) {
      throw new Error("Os reprodutores do casal não estão disponíveis neste criadouro.");
    }

    const cageResult = couple.cageId
      ? await client.query(
          `SELECT id FROM cages
            WHERE id = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL`,
          [couple.cageId, input.tenantId],
        )
      : await client.query(
          `SELECT id FROM cages
            WHERE code = $1 AND "tenantId" = $2 AND "deletedAt" IS NULL
            LIMIT 1`,
          [couple.cageNumber, input.tenantId],
        );
    const cageId = cageResult.rows[0]?.id ?? null;

    const gaugeRules = (await client.query<RingGaugeRuleLike>(
      `SELECT "speciesName", "breedName", modality,
              "recommendedGaugeMm" AS "recommendedGaugeMm", active
         FROM ring_gauge_rules
        WHERE active = TRUE`,
    )).rows;

    const fatherSubject: RingSubject = {
      speciesName: father.speciesName,
      breedName: father.breedName,
      modality: father.modality,
    };
    const motherSubject: RingSubject = {
      speciesName: mother.speciesName,
      breedName: mother.breedName,
      modality: mother.modality,
    };
    const fatherGauge = findRecommendedRingGauge(fatherSubject, gaugeRules);
    const motherGauge = findRecommendedRingGauge(motherSubject, gaugeRules);
    if (fatherGauge !== null && motherGauge !== null && Math.abs(fatherGauge - motherGauge) > 0.051) {
      throw new Error(
        `Os reprodutores estão cadastrados com bitolas oficiais diferentes (${fatherGauge.toFixed(1)} mm e ${motherGauge.toFixed(1)} mm). ` +
        "Revise a classificação/raça do casal em Pássaros antes de anilhar o filhote.",
      );
    }

    const targetSubject: RingSubject = {
      speciesName: father.speciesName ?? mother.speciesName,
      breedName: father.breedName ?? mother.breedName,
      modality: father.modality ?? mother.modality,
      ringGaugeMm: fatherGauge ?? motherGauge,
    };

    // Seleciona primeiro o lote fisicamente compatível e só então bloqueia a
    // anilha. Assim, lotes de Canário de Cor 3,0 mm também atendem Gloster
    // 3,0 mm, sem permitir uma bitola de Border/Norwich 3,4 mm.
    const batchCandidates = (await client.query<DbRow>(
      `SELECT rb.*
         FROM ring_batches rb
        WHERE rb."tenantId" = $1
          AND rb.status = 'available'
          AND rb."deletedAt" IS NULL
          AND EXISTS (
            SELECT 1
              FROM rings r
             WHERE r."batchId" = rb.id
               AND r."tenantId" = $1
               AND r.status = 'available'
               AND r."deletedAt" IS NULL
               AND r."birdId" IS NULL
               AND r."chickId" IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM birds used
                  WHERE used.ring = COALESCE(r."fullCode", r.number)
                    AND used."deletedAt" IS NULL
               )
          )`,
      [input.tenantId],
    )).rows
      .map((batch) => ({
        batch,
        assessment: assessRingCompatibility(targetSubject, {
          speciesName: batch.speciesName,
          breedName: batch.breedName,
          modality: batch.modality,
          ringGaugeMm: batch.ringGaugeMm,
        }, gaugeRules),
      }))
      .filter(({ assessment }) => assessment.compatible)
      .sort((left, right) =>
        right.assessment.score - left.assessment.score
        || Number(left.batch.year ?? 0) - Number(right.batch.year ?? 0)
        || Number(left.batch.id) - Number(right.batch.id),
      );

    let ring: DbRow | null = null;
    for (const candidate of batchCandidates) {
      const locked = await client.query<DbRow>(
        `SELECT r.*, rb."batch_number", rb.year, rb."breedName", rb."speciesName",
                rb.modality, rb."ringGaugeMm"
           FROM rings r
           JOIN ring_batches rb ON rb.id = r."batchId"
          WHERE rb.id = $1
            AND r."tenantId" = $2
            AND rb."tenantId" = $2
            AND r.status = 'available'
            AND rb.status = 'available'
            AND r."deletedAt" IS NULL
            AND rb."deletedAt" IS NULL
            AND r."birdId" IS NULL
            AND r."chickId" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM birds used
               WHERE used.ring = COALESCE(r."fullCode", r.number)
                 AND used."deletedAt" IS NULL
            )
          ORDER BY r.sequence ASC, r.id ASC
          FOR UPDATE OF r SKIP LOCKED
          LIMIT 1`,
        [candidate.batch.id, input.tenantId],
      );
      if (locked.rows[0]) {
        ring = locked.rows[0];
        break;
      }
    }

    if (!ring) {
      const expectedGauge = findRecommendedRingGauge(targetSubject, gaugeRules);
      const suffix = expectedGauge === null ? "" : ` Bitola esperada: ${expectedGauge.toFixed(1)} mm.`;
      throw new Error(`Sem anilhas fisicamente compatíveis disponíveis.${suffix} Cadastre ou revise o lote em Anilhas.`);
    }
    const ringCode = ring.fullCode ?? ring.number;

    const pendingChickResult = await client.query(
      `SELECT * FROM chicks
        WHERE "clutchId" = $1
          AND "tenantId" = $2
          AND "deletedAt" IS NULL
          AND "birdId" IS NULL
          AND ring IS NULL
        ORDER BY "birthDate" ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1`,
      [input.clutchId, input.tenantId],
    );

    const recordedBirth = pendingChickResult.rows[0]?.hatchDateTime
      ?? pendingChickResult.rows[0]?.birthDate
      ?? input.hatchDate
      ?? clutch.clutchDate;
    const birthDateSource = pendingChickResult.rows[0]?.birthDateSource
      ?? (input.hatchDate ? "recorded" : "inferred_clutch");

    const birdResult = await client.query(
      `INSERT INTO birds (
        ring, "specialty_code", sex, "color_code", "birthDate",
        "fatherId", "motherId", "cageId", status, "speciesName",
        "breedName", modality, "tenantId", notes
      ) VALUES ($1, 'A_DEFINIR', $2, 'A_DEFINIR', $3, $4, $5, $6,
                'active', $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        ringCode,
        input.sex,
        recordedBirth,
        couple.maleId,
        couple.femaleId,
        cageId,
        father.speciesName ?? mother.speciesName,
        father.breedName ?? mother.breedName,
        father.modality ?? mother.modality,
        input.tenantId,
        birthDateSource === "inferred_clutch"
          ? "Data de nascimento inicialmente inferida pela data da postura; revise na ficha do filhote."
          : null,
      ],
    );
    const bird = ensureSingle(birdResult.rows, "Não foi possível criar o pássaro.");

    let chick: DbRow;
    if (pendingChickResult.rows.length > 0) {
      chick = ensureSingle(
        (await client.query(
          `UPDATE chicks
              SET ring = $1, sex = $2, "color_code" = COALESCE("color_code", 'A_DEFINIR'),
                  "ringDate" = NOW(), "birdId" = $3, "updatedAt" = NOW()
            WHERE id = $4 AND "tenantId" = $5 AND ring IS NULL AND "birdId" IS NULL
          RETURNING *`,
          [ringCode, input.sex, bird.id, pendingChickResult.rows[0].id, input.tenantId],
        )).rows,
        "O filhote foi alterado por outro usuário. Tente novamente.",
      );
    } else {
      chick = ensureSingle(
        (await client.query(
          `INSERT INTO chicks (
             "clutchId", ring, sex, "color_code", "birthDate", "hatchDateTime",
             "birthDateSource", "ringDate", status, "birdId", "tenantId"
           ) VALUES ($1, $2, $3, 'A_DEFINIR', $4, $4, $5, NOW(), 'active', $6, $7)
           RETURNING *`,
          [input.clutchId, ringCode, input.sex, recordedBirth, birthDateSource, bird.id, input.tenantId],
        )).rows,
        "Não foi possível criar o registro do filhote.",
      );
    }

    const ringUpdate = await client.query(
      `UPDATE rings
          SET status = 'in_use', "birdId" = $1, "chickId" = $2,
              "usedAt" = NOW(), "updatedAt" = NOW()
        WHERE id = $3 AND "tenantId" = $4 AND status = 'available'
          AND "birdId" IS NULL AND "chickId" IS NULL
      RETURNING id`,
      [bird.id, chick.id, ring.id, input.tenantId],
    );
    if (ringUpdate.rowCount !== 1) {
      throw new Error("A anilha foi utilizada por outro usuário. Nenhum dado foi salvo.");
    }

    // O lote é bloqueado somente na consolidação. Não bloquear rb junto com
    // a anilha permite que dois filhotes recebam anilhas diferentes do mesmo
    // lote sem falso "estoque esgotado"; a consolidação continua serializada.
    await client.query(
      `SELECT id FROM ring_batches WHERE id = $1 AND "tenantId" = $2 FOR UPDATE`,
      [ring.batchId, input.tenantId],
    );
    await client.query(
      `UPDATE ring_batches rb
          SET quantity_used = (
                SELECT COUNT(*)::integer FROM rings r
                 WHERE r."batchId" = rb.id AND r.status IN ('in_use', 'used')
              ),
              "currentNumber" = COALESCE((
                SELECT MIN(r.sequence) FROM rings r
                 WHERE r."batchId" = rb.id AND r.status = 'available'
              ), rb."endNumber" + 1),
              status = CASE WHEN EXISTS (
                SELECT 1 FROM rings r
                 WHERE r."batchId" = rb.id AND r.status = 'available'
              ) THEN 'available' ELSE 'exhausted' END,
              "updatedAt" = NOW()
        WHERE rb.id = $1 AND rb."tenantId" = $2`,
      [ring.batchId, input.tenantId],
    );

    const grandparents = await loadGrandparents(client, [father, mother], input.tenantId);
    await client.query("COMMIT");

    return {
      bird,
      chick,
      ring: ringCode,
      father: { id: father.id, ring: father.ring },
      mother: { id: mother.id, ring: mother.ring },
      grandparents,
      birthDateSource,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
