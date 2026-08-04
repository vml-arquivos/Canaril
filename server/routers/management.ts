import { z } from "zod";
import { protectedProcedure, router, requireTenantAccess } from "../_core/trpc";
import { getDb, getPool } from "../db";
import { birds, ring_batches, rings, couples, clutches, chicks, breeding_reminders, cages, breeding_species_rules } from "../../drizzle/schema";
import { and, eq, desc, sql, isNull, gte, lte } from "drizzle-orm";
import { generateBreedingReminders } from "../_core/breeding";
import { getNextAvailableRing } from "../_core/ringAllocator";
import { getCurrentTenantId } from "../_core/tenant";

async function generateRingsForBatch(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, batchId: number, year: number, startNumber: number, endNumber: number) {
  const now = new Date();

  for (let chunkStart = startNumber; chunkStart <= endNumber; chunkStart += 500) {
    const chunkEnd = Math.min(chunkStart + 499, endNumber);
    const values = [];
    for (let sequence = chunkStart; sequence <= chunkEnd; sequence++) {
      values.push({
        batchId,
        number: `${year}-${String(sequence).padStart(3, "0")}`,
        sequence,
        status: "available",
        createdAt: now,
        updatedAt: now,
      });
    }
    if (values.length > 0) {
      await db.insert(rings).values(values).onConflictDoNothing();
    }
  }
}

async function markRingAsUsed(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, ringNumber: string, patch: { birdId?: number; chickId?: number }) {
  await db
    .update(rings)
    .set({
      ...patch,
      status: "in_use",
      usedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(rings.number, ringNumber), eq(rings.status, "available")));
}

export const managementRouter = router({
  // ===== ANILHAS =====
  rings: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        let query: any = db.select().from(ring_batches);
        if (tenantId !== null && tenantId !== undefined) {
          query = query.where(eq(ring_batches.tenantId, tenantId));
        }
        return await query.orderBy(desc(ring_batches.createdAt));
      } catch (error) {
        console.error("Error listing rings:", error);
        return [];
      }
    }),

    create: protectedProcedure
      .input(z.object({
        batch_number: z.string(),
        year: z.number(),
        color: z.string().optional(),
        startNumber: z.number().int().positive(),
        endNumber: z.number().int().positive(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        if (input.endNumber < input.startNumber) {
          throw new Error("A numeração final deve ser maior ou igual à inicial");
        }
        const quantity_total = input.endNumber - input.startNumber + 1;
        if (quantity_total > 5000) {
          throw new Error("Lote muito grande (máximo 5000 anilhas por lote)");
        }

        try {
          const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
          const [createdBatch] = await db.insert(ring_batches).values({
            batch_number: input.batch_number,
            year: input.year,
            color: input.color || "Padrão",
            quantity_total,
            quantity_used: 0,
            status: "available",
            tenantId: tenantId,
          }).returning();

          if (createdBatch) {
            await generateRingsForBatch(db, createdBatch.id, createdBatch.year, input.startNumber, input.endNumber);
            // Após gerar as anilhas individuais, atualiza o tenantId delas
            if (tenantId !== null && tenantId !== undefined) {
              await db.update(rings).set({ tenantId: tenantId }).where(eq(rings.batchId, createdBatch.id));
            }
          }

          return { success: true, batch: createdBatch, generated: quantity_total };
        } catch (error) {
          console.error("Error creating ring batch:", error);
          throw error;
        }
      }),

    // Anilhas individuais disponíveis (para selects de cadastro de pássaro/filhote)
    listAvailable: protectedProcedure
      .input(z.object({ batchId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
          const conditions: any[] = [eq(rings.status, "available")];
          if (tenantId !== null) conditions.push(eq(rings.tenantId, tenantId));
          if (input?.batchId) conditions.push(eq(rings.batchId, input.batchId));
          return await db.select().from(rings).where(and(...conditions)).orderBy(rings.sequence);
        } catch (error) {
          console.error("Error listing available rings:", error);
          return [];
        }
      }),

    // Todas as anilhas individuais de um lote (visão detalhada)
    listByBatch: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          return await db.select().from(rings).where(eq(rings.batchId, input)).orderBy(rings.sequence);
        } catch (error) {
          console.error("Error listing rings by batch:", error);
          return [];
        }
      }),

    // Edita cor/observações do lote. A faixa de numeração (início/fim) não
    // muda depois de gerada, pois isso já criou anilhas individuais reais.
    update: protectedProcedure
      .input(z.object({ id: z.number(), color: z.string().trim().optional(), status: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { id, ...fields } = input;
        await db.update(ring_batches).set({ ...fields, updatedAt: new Date() }).where(eq(ring_batches.id, id));
        return { success: true };
      }),

    // Remove o lote e as anilhas individuais ainda disponíveis dele. Anilhas
    // já em uso vinculadas a pássaros ATIVOS bloqueiam a remoção. Órfãs são ignoradas.
    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ input }) => {
        const db = await getDb();
        const pool = getPool();
        if (!db || !pool) throw new Error("Database not available");

        // Only block if rings are linked to an ACTIVE (non-deleted) bird
        const { rows: activeRows } = await pool.query<{ id: number }>(
          `SELECT r.id FROM rings r
           JOIN birds b ON b.id = r."birdId"
           WHERE r."batchId" = $1
             AND r.status = 'in_use'
             AND r."birdId" IS NOT NULL
             AND (b."deletedAt" IS NULL)
           LIMIT 1`,
          [input]
        );

        if (activeRows.length > 0) {
          throw new Error(`Este lote tem anilha(s) vinculada(s) a pássaro(s) ativo(s) e não pode ser removido. Use a opção "Reconciliar órfãs" se os pássaros já foram removidos.`);
        }

        await db.delete(rings).where(eq(rings.batchId, input));
        await db.delete(ring_batches).where(eq(ring_batches.id, input));
        return { success: true };
      }),
  }),

  // ===== CRUZAMENTOS/CASAIS =====
  couples: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        let query: any = db.select().from(couples);
        if (tenantId !== null && tenantId !== undefined) {
          query = query.where(eq(couples.tenantId, tenantId));
        }
        return await query.orderBy(desc(couples.createdAt));
      } catch (error) {
        console.error("Error listing couples:", error);
        return [];
      }
    }),

    getById: protectedProcedure
      .input(z.number())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return null;
        try {
          const result = await db.select().from(couples).where(eq(couples.id, input)).limit(1);
          const couple = result.length > 0 ? result[0] : null;
          if (!couple) return null;
          const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
          if (tenantId !== null && tenantId !== undefined) {
            requireTenantAccess(ctx, couple.tenantId);
          }
          return couple;
        } catch (error) {
          console.error("Error getting couple:", error);
          return null;
        }
      }),

    create: protectedProcedure
      .input(z.object({
        maleId: z.number(),
        femaleId: z.number(),
        cageNumber: z.string(),
        formationDate: z.date(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        try {
          const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
          // Filtra casais ativos do mesmo tenant
          const activeCouples = await db.select().from(couples).where(
            and(eq(couples.status, "active"), tenantId !== null && tenantId !== undefined ? eq(couples.tenantId, tenantId) : sql`1=1`)
          );
          // O MACHO pode estar em vários casais ativos ao mesmo tempo (uso
          // em "harém", comum na prática de canaricultura — um macho
          // reprodutor bom serve várias fêmeas na mesma temporada). A
          // FÊMEA continua restrita a um único casal ativo por vez, porque
          // ela só pode estar botando num ninho de cada vez.
          const femaleTaken = activeCouples.find((c) => c.femaleId === input.femaleId);
          if (femaleTaken) {
            throw new Error("Este pássaro (fêmea) já está em outro casal ativo. Desfaça o casal anterior primeiro.");
          }
          if (activeCouples.some((c) => c.maleId === input.maleId && c.femaleId === input.femaleId)) {
            throw new Error("Este casal (mesmo macho e mesma fêmea) já está ativo.");
          }

          await db.insert(couples).values({
            maleId: input.maleId,
            femaleId: input.femaleId,
            cageNumber: input.cageNumber,
            formationDate: input.formationDate,
            status: "active",
            tenantId: tenantId,
          });

          const [createdCouple] = await db
            .select()
            .from(couples)
            .where(and(eq(couples.maleId, input.maleId), eq(couples.femaleId, input.femaleId)))
            .orderBy(desc(couples.id))
            .limit(1);

          if (createdCouple) {
            const seeds = generateBreedingReminders(input.formationDate);
            await db.insert(breeding_reminders).values(
              seeds.map((s) => ({
                coupleId: createdCouple.id,
                eventType: s.eventType,
                expectedDate: s.expectedDate,
                notes: s.notes,
              }))
            );
          }

          return { success: true };
        } catch (error) {
          console.error("Error creating couple:", error);
          throw error;
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        maleId: z.number().optional(),
        femaleId: z.number().optional(),
        cageNumber: z.string().optional(),
        formationDate: z.date().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { id, ...fields } = input;
        try {
          const [existing] = await db.select().from(couples).where(eq(couples.id, id));
          if (!existing) {
            throw new Error("Casal não encontrado.");
          }
          const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
          if (tenantId !== null && tenantId !== undefined) {
            requireTenantAccess(ctx, existing.tenantId);
          }
          // Mesma validação do create, mas ignorando o próprio casal sendo
          if (input.maleId !== undefined || input.femaleId !== undefined) {
            const checkMaleId = input.maleId ?? existing?.maleId;
            const checkFemaleId = input.femaleId ?? existing?.femaleId;
            const activeCouples = await db.select().from(couples).where(and(eq(couples.status, "active"), tenantId !== null && tenantId !== undefined ? eq(couples.tenantId, tenantId) : sql`1=1`));
            const maleTaken = activeCouples.find((c) => c.id !== id && (c.maleId === checkMaleId || c.femaleId === checkMaleId));
            const femaleTaken = activeCouples.find((c) => c.id !== id && (c.maleId === checkFemaleId || c.femaleId === checkFemaleId));
            if (maleTaken) {
              throw new Error("Este pássaro (macho) já está em outro casal ativo.");
            }
            if (femaleTaken) {
              throw new Error("Este pássaro (fêmea) já está em outro casal ativo.");
            }
          }
          await db.update(couples).set({ ...fields, updatedAt: new Date() }).where(eq(couples.id, id));
          return { success: true };
        } catch (error) {
          console.error("Error updating couple:", error);
          throw error;
        }
      }),

    delete: protectedProcedure
      .input(z.number())
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        try {
          const [existing] = await db.select().from(couples).where(eq(couples.id, input));
          if (!existing) {
            throw new Error("Casal não encontrado.");
          }
          const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
          if (tenantId !== null && tenantId !== undefined) {
            requireTenantAccess(ctx, existing.tenantId);
          }
          await db.delete(couples).where(eq(couples.id, input));
          return { success: true };
        } catch (error) {
          console.error("Error deleting couple:", error);
          throw error;
        }
      }),
  }),

  // ===== POSTURAS =====
  clutches: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        let query: any = db.select().from(clutches).where(isNull(clutches.deletedAt)).orderBy(desc(clutches.createdAt));
        if (tenantId !== null) query = db.select().from(clutches).where(and(isNull(clutches.deletedAt), eq(clutches.tenantId, tenantId))).orderBy(desc(clutches.createdAt));
        return query;
      } catch (error) {
        console.error("Error listing clutches:", error);
        return [];
      }
    }),

    getByCoupleId: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          return await db.select().from(clutches).where(and(eq(clutches.coupleId, input), isNull(clutches.deletedAt))).orderBy(desc(clutches.clutchDate));
        } catch (error) {
          console.error("Error getting clutches by couple:", error);
          return [];
        }
      }),

    create: protectedProcedure
      .input(z.object({
        coupleId: z.number(),
        clutchDate: z.date(),
        totalEggs: z.number(),
        fertilizedEggs: z.number(),
        infertileEggs: z.number().optional(),
        lostEggs: z.number().optional(),
        hatchedChicks: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        try {
          // Aviso (não bloqueio) se o casal já passou do limite de posturas
          // no mesmo ano-calendário — usa a regra configurável
          // breeding_species_rules.maxClutchesPerSeason (padrão 3, já
          // existia no schema) em vez de um número fixo no código. Não
          // bloqueia o cadastro pra não impedir correção de dados históricos.
          const [rule] = await db.select().from(breeding_species_rules).limit(1);
          const maxPerYear = rule?.maxClutchesPerSeason ?? 3;

          const year = input.clutchDate.getFullYear();
          const yearStart = new Date(year, 0, 1);
          const yearEnd = new Date(year, 11, 31, 23, 59, 59);
          const sameYearClutches = await db.select().from(clutches).where(
            and(eq(clutches.coupleId, input.coupleId), gte(clutches.clutchDate, yearStart), lte(clutches.clutchDate, yearEnd), isNull(clutches.deletedAt))
          );
          const warning = sameYearClutches.length >= maxPerYear
            ? `Atenção: este casal já tem ${sameYearClutches.length} postura(s) registrada(s) em ${year}. O recomendado é no máximo ${maxPerYear} por ano, pra não desgastar o casal.`
            : null;

          await db.insert(clutches).values({
            coupleId: input.coupleId,
            clutchDate: input.clutchDate,
            totalEggs: input.totalEggs,
            fertilizedEggs: input.fertilizedEggs,
            infertileEggs: input.infertileEggs || 0,
            lostEggs: input.lostEggs || 0,
            hatchedChicks: input.hatchedChicks || 0,
            tenantId: tenantId ?? null,
          });
          return { success: true, warning };
        } catch (error) {
          console.error("Error creating clutch:", error);
          throw error;
        }
      }),

    /**
     * Corrige/atualiza uma postura já registrada. Faltava completamente —
     * sem isso, nenhum erro de digitação (ovos, galados, ECLOSÕES) podia
     * ser corrigido depois, e o número de eclosões nunca podia ser
     * preenchido depois que os ovos realmente eclodiam.
     */
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        clutchDate: z.date().optional(),
        totalEggs: z.number().optional(),
        fertilizedEggs: z.number().optional(),
        infertileEggs: z.number().optional(),
        lostEggs: z.number().optional(),
        hatchedChicks: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant
        const { id, ...fields } = input;

        const [existing] = await db.select({ id: clutches.id, tenantId: clutches.tenantId }).from(clutches).where(eq(clutches.id, id)).limit(1);
        if (!existing) throw new Error("Postura não encontrada.");
        if (tenantId !== null && existing.tenantId !== tenantId) {
          throw new Error("Esta postura não pertence ao seu criadouro.");
        }

        await db.update(clutches).set({ ...fields, updatedAt: new Date() }).where(eq(clutches.id, id));
        return { success: true };
      }),

    /** Remove (soft delete) uma postura registrada por engano. */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant
        const uid = (ctx as any)?.userId;

        const [existing] = await db.select({ id: clutches.id, tenantId: clutches.tenantId }).from(clutches).where(eq(clutches.id, input.id)).limit(1);
        if (!existing) throw new Error("Postura não encontrada.");
        if (tenantId !== null && existing.tenantId !== tenantId) {
          throw new Error("Esta postura não pertence ao seu criadouro.");
        }

        await db.update(clutches).set({ deletedAt: new Date(), deletedBy: uid }).where(eq(clutches.id, input.id));
        return { success: true };
      }),
  }),

  // ===== FILHOTES =====
  chicks: router({
    /**
     * Anilha um filhote automaticamente e já cria o cadastro dele em
     * "Pássaros" — puxando anilha (próxima disponível no lote), pai, mãe
     * e gaiola do próprio casal. Cor e especialidade vêm de um valor
     * inicial (herdado do pai) só pra não deixar campo obrigatório vazio;
     * o criador completa o resto direto na ficha do pássaro recém-criado
     * (é exatamente o "preencher os dados restantes" pedido).
     *
     * O campo `birdId` em `chicks` já existia no schema, comentado como
     * "quando o filhote é promovido ao plantel" — mas nenhum endpoint
     * fazia isso de fato até agora.
     */
    ringAndPromote: protectedProcedure
      .input(z.object({
        clutchId: z.number().int().positive(),
        sex: z.enum(["macho", "fêmea", "indefinido"]).default("indefinido"),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant

        const [clutch] = await db.select().from(clutches).where(eq(clutches.id, input.clutchId)).limit(1);
        if (!clutch) throw new Error("Postura não encontrada.");
        if (tenantId !== null && clutch.tenantId !== tenantId) throw new Error("Esta postura não pertence ao seu criadouro.");

        const [couple] = await db.select().from(couples).where(eq(couples.id, clutch.coupleId)).limit(1);
        if (!couple) throw new Error("Casal desta postura não encontrado.");

        const [father] = await db.select().from(birds).where(eq(birds.id, couple.maleId)).limit(1);
        const [mother] = await db.select().from(birds).where(eq(birds.id, couple.femaleId)).limit(1);

        // Gaiola do casal (couples.cageNumber é o código, cages.code é a
        // chave real) — se existir uma gaiola cadastrada com esse código,
        // o pássaro já nasce vinculado a ela.
        let cageId: number | null = null;
        if (couple.cageNumber) {
          const [cage] = await db.select({ id: cages.id }).from(cages).where(eq(cages.code, couple.cageNumber)).limit(1);
          cageId = cage?.id ?? null;
        }

        // Avós (linhagem) — só pra devolver no retorno, pra ficha do
        // pássaro já mostrar de onde ele vem, sem precisar ir atrás.
        const grandparentIds = [father?.fatherId, father?.motherId, mother?.fatherId, mother?.motherId].filter((id): id is number => !!id);
        const grandparents = grandparentIds.length
          ? await db.select({ id: birds.id, ring: birds.ring, displayTitle: birds.displayTitle }).from(birds).where(sql`${birds.id} IN (${sql.join(grandparentIds, sql`, `)})`)
          : [];

        const nextRing = await getNextAvailableRing(db, {
          speciesName: father?.speciesName ?? undefined,
          breedName: father?.breedName ?? undefined,
          modality: (father?.modality as any) ?? undefined,
          tenantId,
        });
        if (!nextRing) {
          throw new Error("Sem anilhas disponíveis no momento. Cadastre um novo lote em Anilhas antes de anilhar este filhote.");
        }

        const birthDate = clutch.clutchDate; // melhor dado disponível — a postura é o evento mais próximo do nascimento real
        const inheritedSpecialty = father?.specialty_code ?? mother?.specialty_code ?? "a_definir";

        const [createdBird] = await db.insert(birds).values({
          ring: nextRing.fullCode,
          specialty_code: inheritedSpecialty,
          sex: input.sex,
          color_code: "a_definir", // placeholder — o criador completa na ficha logo em seguida
          birthDate,
          fatherId: couple.maleId,
          motherId: couple.femaleId,
          cageId,
          status: "active",
          speciesName: father?.speciesName ?? mother?.speciesName ?? null,
          breedName: father?.breedName ?? mother?.breedName ?? null,
          modality: father?.modality ?? mother?.modality ?? null,
          tenantId: tenantId ?? null,
        } as any).returning();

        const [createdChick] = await db.insert(chicks).values({
          clutchId: input.clutchId,
          ring: nextRing.fullCode,
          sex: input.sex,
          color_code: "a_definir",
          birthDate,
          ringDate: new Date(),
          status: "active",
          birdId: createdBird.id,
          tenantId: tenantId ?? null,
        }).returning();

        await markRingAsUsed(db, nextRing.ring.number, { birdId: createdBird.id, chickId: createdChick.id });

        return {
          bird: createdBird,
          chick: createdChick,
          ring: nextRing.fullCode,
          father: father ? { id: father.id, ring: father.ring } : null,
          mother: mother ? { id: mother.id, ring: mother.ring } : null,
          grandparents,
        };
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      try {
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        let query: any = db.select().from(chicks).orderBy(desc(chicks.createdAt));
        if (tenantId !== null) query = query.where(eq(chicks.tenantId, tenantId));
        return query;
      } catch (error) {
        console.error("Error listing chicks:", error);
        return [];
      }
    }),

    getByClutchId: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        try {
          return await db.select().from(chicks).where(eq(chicks.clutchId, input)).orderBy(desc(chicks.birthDate));
        } catch (error) {
          console.error("Error getting chicks by clutch:", error);
          return [];
        }
      }),

    create: protectedProcedure
      .input(z.object({
        clutchId: z.number(),
        ring: z.string(),
        sex: z.string(),
        color_code: z.string(),
        birthDate: z.date(),
        ringDate: z.date().optional(),
        weanDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        try {
          const [createdChick] = await db.insert(chicks).values({
            clutchId: input.clutchId,
            ring: input.ring,
            sex: input.sex,
            color_code: input.color_code,
            birthDate: input.birthDate,
            ringDate: input.ringDate,
            weanDate: input.weanDate,
            status: "active",
            tenantId: tenantId ?? null,
          }).returning();

          if (createdChick) {
            await markRingAsUsed(db, createdChick.ring, { chickId: createdChick.id });
          }

          return { success: true, chick: createdChick };
        } catch (error) {
          console.error("Error creating chick:", error);
          throw error;
        }
      }),

    /**
     * Atualiza o status de um filhote já cadastrado (vivo → desmamado /
     * morto / vendido / transferido). Faltava completamente antes — só
     * dava pra CRIAR um filhote, nunca registrar uma perda ou um desmame
     * bem-sucedido depois. Sem isso, nenhum relatório de "quantos
     * vingaram" tinha como ser preciso, porque o dado nunca era capturado.
     */
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["active", "weaned", "died", "sold", "transferred"]).optional(),
        weanDate: z.date().optional().nullable(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant

        const { id, ...fields } = input;
        const [existing] = await db.select({ id: chicks.id, tenantId: chicks.tenantId }).from(chicks).where(eq(chicks.id, id)).limit(1);
        if (!existing) throw new Error("Filhote não encontrado.");
        if (tenantId !== null && existing.tenantId !== tenantId) {
          throw new Error("Este filhote não pertence ao seu criadouro.");
        }

        await db.update(chicks).set({ ...fields, updatedAt: new Date() }).where(eq(chicks.id, id));
        return { success: true };
      }),
  }),

  // ===== ESTATÍSTICAS =====
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { birds: 0, couples: 0, chicks: 0, rings: 0 };

      try {
        const tenantId = getCurrentTenantId(ctx); // seguro: lança erro se usuário não-admin não tiver tenant (antes: silenciosamente via TUDO)
        // Helpers de filtro
        const birdFilter   = tenantId ? eq(birds.tenantId, tenantId)         : undefined;
        const coupleFilter = tenantId ? eq(couples.tenantId, tenantId)        : undefined;
        const chickFilter  = tenantId ? eq(chicks.tenantId, tenantId)         : undefined;
        const ringFilter   = tenantId ? eq(rings.tenantId, tenantId)          : undefined;
        const batchFilter  = tenantId ? eq(ring_batches.tenantId, tenantId)   : undefined;

        const [birdsList, couplesList, chicksList, individualRings, ringBatches] = await Promise.all([
          birdFilter
            ? db.select().from(birds).where(birdFilter)
            : db.select().from(birds),
          coupleFilter
            ? db.select().from(couples).where(coupleFilter)
            : db.select().from(couples),
          chickFilter
            ? db.select().from(chicks).where(chickFilter)
            : db.select().from(chicks),
          ringFilter
            ? db.select().from(rings).where(ringFilter)
            : db.select().from(rings),
          batchFilter
            ? db.select().from(ring_batches).where(batchFilter)
            : db.select().from(ring_batches),
        ]);

        const availableIndividualRings = individualRings.filter((r) => r.status === "available").length;
        const legacyAvailableRings     = ringBatches.reduce(
          (sum, r) => sum + Math.max(0, r.quantity_total - r.quantity_used), 0
        );

        return {
          birds:   birdsList.length,
          couples: couplesList.filter((c) => c.status === "active").length,
          chicks:  chicksList.length,
          rings:   availableIndividualRings || legacyAvailableRings,
        };
      } catch (error) {
        console.error("Error getting dashboard stats:", error);
        return { birds: 0, couples: 0, chicks: 0, rings: 0 };
      }
    }),
  }),
});
