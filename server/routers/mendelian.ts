import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bird_genotype, birds } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { predictCross, BirdGenotypeInput } from "../_core/mendelian";

const zygositySchema = z.enum(["homozygous_mutant", "heterozygous_carrier", "homozygous_normal"]);
const inheritanceSchema = z.enum(["autosomal_dominant", "autosomal_recessive", "sex_linked_recessive"]);

const mutationSchema = z.object({
  mutation: z.string(),
  inheritance: inheritanceSchema,
  zygosity: zygositySchema,
});

export const mendelianRouter = router({
  // Genótipo avançado de um pássaro (pode não existir ainda — é opcional)
  getGenotype: protectedProcedure
    .input(z.number())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [genotype] = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input));
      return genotype ?? null;
    }),

  upsertGenotype: protectedProcedure
    .input(
      z.object({
        birdId: z.number(),
        backgroundColor: z.string().optional(),
        featherType: z.enum(["intenso", "nevado"]).optional(),
        hasCrest: z.boolean().optional(),
        mutations: z.array(mutationSchema).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");
      const { birdId, ...fields } = input;

      const existing = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, birdId));
      if (existing.length === 0) {
        await db.insert(bird_genotype).values({ birdId, ...fields });
      } else {
        await db.update(bird_genotype).set({ ...fields, updatedAt: new Date() }).where(eq(bird_genotype.birdId, birdId));
      }
      return { success: true };
    }),

  /**
   * Predição de cruzamento mendeliano — exige que AMBOS os pais já tenham
   * genótipo avançado cadastrado. Diferente de genetics.predictCross
   * (que usa a tabela genetic_rules simples), este calcula de verdade via
   * Punnett, mutação por mutação, com os alertas de genes letais.
   */
  predictCross: protectedProcedure
    .input(z.object({ fatherId: z.number(), motherId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível");

      const [fatherBird] = await db.select().from(birds).where(eq(birds.id, input.fatherId));
      const [motherBird] = await db.select().from(birds).where(eq(birds.id, input.motherId));
      const [fatherGenotype] = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input.fatherId));
      const [motherGenotype] = await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input.motherId));

      if (!fatherBird || !motherBird) {
        throw new Error("Pássaro não encontrado");
      }
      if (!fatherGenotype || !motherGenotype) {
        throw new Error(
          "Cadastre o genótipo avançado dos dois pais antes de calcular a predição mendeliana (Pássaros → Ficha → Genótipo Avançado)."
        );
      }

      const fatherInput: BirdGenotypeInput = {
        sex: "macho",
        backgroundColor: fatherGenotype.backgroundColor ?? undefined,
        featherType: (fatherGenotype.featherType as "intenso" | "nevado" | null) ?? undefined,
        hasCrest: fatherGenotype.hasCrest,
        mutations: fatherGenotype.mutations ?? [],
      };
      const motherInput: BirdGenotypeInput = {
        sex: "fêmea",
        backgroundColor: motherGenotype.backgroundColor ?? undefined,
        featherType: (motherGenotype.featherType as "intenso" | "nevado" | null) ?? undefined,
        hasCrest: motherGenotype.hasCrest,
        mutations: motherGenotype.mutations ?? [],
      };

      return predictCross(fatherInput, motherInput);
    }),
});
