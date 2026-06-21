/**
 * catalog.ts — Router de Catálogo Genético
 *
 * Fornece endpoints para os selects automáticos da supercalculadora dinâmica.
 * Retorna dados do banco (official_bird_classes) e constantes compartilhadas.
 * Todos os endpoints são protectedProcedure (usuário autenticado).
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { official_bird_classes } from "../../drizzle/schema";
import { ilike, eq, and, or } from "drizzle-orm";
import {
  GENE_DEFINITIONS,
  LIPOCHROME_BASE,
  MELANIN_SERIES,
  FEATHER_CATEGORIES,
  CREST_TYPES,
  GENETIC_CERTAINTY_LEVELS,
  BIRD_MODALITIES,
  PAIRING_RULES,
  GENETIC_SOURCE_PRIORITY,
} from "../../shared/constants";

export const catalogRouter = router({
  // ──────────────────────────────────────────────────────────────────────────
  // Catálogos estáticos (sem banco)
  // ──────────────────────────────────────────────────────────────────────────

  /** Retorna todos os genes com herança, grupo e descrição */
  genes: protectedProcedure.query(() => GENE_DEFINITIONS),

  /** Retorna lipocromo base */
  lipochromes: protectedProcedure.query(() => LIPOCHROME_BASE),

  /** Retorna séries de melanina */
  melanins: protectedProcedure.query(() => MELANIN_SERIES),

  /** Retorna categorias de pena */
  featherCategories: protectedProcedure.query(() => FEATHER_CATEGORIES),

  /** Retorna tipos de crista/topete */
  crestTypes: protectedProcedure.query(() => CREST_TYPES),

  /** Retorna níveis de certeza genética */
  certaintLevels: protectedProcedure.query(() => GENETIC_CERTAINTY_LEVELS),

  /** Retorna modalidades FOB/OBJO */
  modalities: protectedProcedure.query(() => BIRD_MODALITIES),

  /** Retorna regras de cruzamento */
  pairingRules: protectedProcedure.query(() => PAIRING_RULES),

  /** Retorna prioridade de fontes genéticas */
  sourcePriority: protectedProcedure.query(() => GENETIC_SOURCE_PRIORITY),

  // ──────────────────────────────────────────────────────────────────────────
  // Classes Oficiais FOB/OBJO (banco)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Busca classes oficiais com filtros opcionais.
   * Usado nos selects de classe oficial da ficha do pássaro.
   */
  searchOfficialClasses: protectedProcedure
    .input(
      z.object({
        query: z.string().optional(),
        modality: z.enum(["COR", "PORTE"]).optional(),
        limit: z.number().min(1).max(100).default(30),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const conditions = [eq(official_bird_classes.active, true)];

      if (input.modality) {
        conditions.push(eq(official_bird_classes.modality, input.modality));
      }

      if (input.query && input.query.trim().length > 0) {
        const q = `%${input.query.trim()}%`;
        conditions.push(
          or(
            ilike(official_bird_classes.officialName, q),
            ilike(official_bird_classes.officialCode, q),
            ilike(official_bird_classes.groupName ?? "", q),
            ilike(official_bird_classes.subgroupName ?? "", q),
            ilike(official_bird_classes.breedName ?? "", q)
          )!
        );
      }

      const items = await db
        .select({
          id: official_bird_classes.id,
          officialCode: official_bird_classes.officialCode,
          officialName: official_bird_classes.officialName,
          abbreviation: official_bird_classes.abbreviation,
          modality: official_bird_classes.modality,
          groupName: official_bird_classes.groupName,
          subgroupName: official_bird_classes.subgroupName,
          breedName: official_bird_classes.breedName,
          bitola: official_bird_classes.bitola,
          categoryName: official_bird_classes.categoryName,
          interpretedTraits: official_bird_classes.interpretedTraits,
        })
        .from(official_bird_classes)
        .where(and(...conditions))
        .limit(input.limit)
        .offset(input.offset)
        .orderBy(official_bird_classes.officialCode);

      return { items, total: items.length };
    }),

  /**
   * Retorna uma classe oficial pelo código (ex: "CC0102")
   */
  getOfficialClass: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select()
        .from(official_bird_classes)
        .where(eq(official_bird_classes.officialCode, input.code))
        .limit(1);

      return row ?? null;
    }),

  /**
   * Retorna o total de classes no catálogo (para exibir na UI)
   */
  catalogStats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, cor: 0, porte: 0 };

    const all = await db
      .select({ modality: official_bird_classes.modality })
      .from(official_bird_classes)
      .where(eq(official_bird_classes.active, true));

    const cor = all.filter((r) => r.modality === "COR").length;
    const porte = all.filter((r) => r.modality === "PORTE").length;

    return { total: all.length, cor, porte };
  }),
});
