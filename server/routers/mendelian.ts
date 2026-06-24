import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bird_genotype, birds } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { predictCross, BirdGenotypeInput } from "../_core/mendelian";
import { calculateCOIForPair, classifyCOIRisk, PedigreeBird } from "../_core/genetics";
import { SPECIALTIES, COLORS } from "../../shared/constants";

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

      // ── Validação backend: fêmea NÃO pode ser portadora de gene sex-linked
      if (fields.mutations && fields.mutations.length > 0) {
        const [bird] = await db.select().from(birds).where(eq(birds.id, birdId)).limit(1);
        if (bird?.sex === "fêmea") {
          const invalidMutation = fields.mutations.find(
            (m) => m.inheritance === "sex_linked_recessive" && m.zygosity === "heterozygous_carrier"
          );
          if (invalidMutation) {
            throw new Error(
              `Genótipo inválido: fêmeas não podem ser portadoras silenciosas de genes ligados ao sexo (${invalidMutation.mutation}). ` +
              `No sistema ZZ/ZW, a fêmea tem apenas um cromossomo Z — ela é visual (Z⁺W) ou normal (Z⁻W), nunca portadora silenciosa.`
            );
          }
        }
      }

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

  /**
   * Sugestão de Melhores Combinações Genéticas
   *
   * Dado um pássaro do plantel, retorna os outros pássaros (sexo oposto,
   * com Genótipo Avançado cadastrado) ranqueados por quão bem combinariam
   * com ele — considerando dois critérios juntos:
   *
   *  1. Consanguinidade (COI): quanto menor, melhor — evita aumentar
   *     parentesco entre os filhotes.
   *  2. Risco mendeliano: roda o mesmo motor de Punnett do modo avançado
   *     pra cada candidato e penaliza fortemente combinações letais
   *     (crista × crista, branco dominante × branco dominante) e
   *     moderadamente combinações de plumagem arriscadas (nevado × nevado).
   *
   * Não inventa "casal perfeito" — é uma sugestão objetiva, com a razão
   * de cada ponto explicada, pra o criador decidir.
   */
  suggestMatches: protectedProcedure
    .input(z.object({ birdId: z.number(), limit: z.number().min(1).max(20).default(5) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { target: null, candidates: [] };

      const [target] = await db.select().from(birds).where(eq(birds.id, input.birdId));
      if (!target) throw new Error("Pássaro não encontrado");

      const targetGenotype = (await db.select().from(bird_genotype).where(eq(bird_genotype.birdId, input.birdId)))[0];

      const oppositeSex = target.sex === "macho" ? "fêmea" : "macho";
      const tenantId = (ctx.user as any)?.tenantId ?? null;

      // Filtrar pássaros do próprio tenant
      const activeBirdsQuery = tenantId
        ? and(eq(birds.status, "active"), eq(birds.tenantId, tenantId))
        : eq(birds.status, "active");
      const allBirds = await db.select().from(birds).where(activeBirdsQuery);
      const allGenotypes = await db.select().from(bird_genotype);
      const genotypeByBird = new Map(allGenotypes.map((g) => [g.birdId, g]));

      const birdMap: Map<number, PedigreeBird> = new Map(
        allBirds.map((b) => [b.id, { id: b.id, ring: b.ring, specialty_code: b.specialty_code, color_code: b.color_code, sex: b.sex, fatherId: b.fatherId, motherId: b.motherId }])
      );

      const candidates: Array<{
        id: number;
        ring: string;
        specialtyName: string;
        colorName: string;
        coi: number;
        coiRisk: "low" | "moderate" | "high";
        hasGenotype: boolean;
        warnings: string[];
        compatibilityScore: number; // 0 a 100 — maior é melhor
        highlights: string[]; // pontos positivos da combinação
      }> = [];

      for (const candidate of allBirds) {
        if (candidate.id === target.id) continue;
        if (candidate.sex !== oppositeSex) continue;
        // evita sugerir um pássaro já no mesmo casal ativo do alvo, ou
        // pais/filhos diretos (já cobertos pelo COI, mas isso filtra o
        // caso degenerado de sugerir o próprio pai/mãe/filho como par)
        if (candidate.id === target.fatherId || candidate.id === target.motherId) continue;
        if (target.id === candidate.fatherId || target.id === candidate.motherId) continue;

        const fatherId = target.sex === "macho" ? target.id : candidate.id;
        const motherId = target.sex === "macho" ? candidate.id : target.id;
        const coi = calculateCOIForPair(fatherId, motherId, birdMap, 5);
        const coiRisk = classifyCOIRisk(coi);

        const candidateGenotype = genotypeByBird.get(candidate.id);
        const warnings: string[] = [];
        const highlights: string[] = [];
        let score = 100;

        // Penaliza por consanguinidade
        if (coiRisk === "high") { score -= 50; warnings.push(`Consanguinidade alta (${(coi * 100).toFixed(1)}%)`); }
        else if (coiRisk === "moderate") { score -= 20; warnings.push(`Consanguinidade moderada (${(coi * 100).toFixed(1)}%)`); }
        else if (coi === 0) { highlights.push("Sem parentesco detectado"); }

        // Se os dois têm Genótipo Avançado, roda o motor de Punnett de
        // verdade pra checar genes letais e plumagem
        if (targetGenotype && candidateGenotype) {
          const fatherGeno = target.sex === "macho" ? targetGenotype : candidateGenotype;
          const motherGeno = target.sex === "macho" ? candidateGenotype : targetGenotype;

          const fatherInput: BirdGenotypeInput = {
            sex: "macho",
            backgroundColor: fatherGeno.backgroundColor ?? undefined,
            featherType: (fatherGeno.featherType as "intenso" | "nevado" | null) ?? undefined,
            hasCrest: fatherGeno.hasCrest,
            mutations: fatherGeno.mutations ?? [],
          };
          const motherInput: BirdGenotypeInput = {
            sex: "fêmea",
            backgroundColor: motherGeno.backgroundColor ?? undefined,
            featherType: (motherGeno.featherType as "intenso" | "nevado" | null) ?? undefined,
            hasCrest: motherGeno.hasCrest,
            mutations: motherGeno.mutations ?? [],
          };

          const prediction = predictCross(fatherInput, motherInput);
          for (const w of prediction.warnings) {
            if (w.type === "crista" || w.type === "branco_dominante") {
              score -= 60;
              warnings.push(w.message);
            } else {
              score -= 15;
              warnings.push(w.message);
            }
          }
          if (fatherInput.featherType && motherInput.featherType && fatherInput.featherType !== motherInput.featherType) {
            highlights.push("Plumagem complementar (intenso × nevado) — combinação recomendada");
            score += 5;
          }
          if (prediction.mutations.length > 0) {
            highlights.push(`${prediction.mutations.length} traço(s) em comum pra calcular filhotes prováveis`);
          }
        }

        candidates.push({
          id: candidate.id,
          ring: candidate.ring,
          specialtyName: SPECIALTIES.find((s) => s.id === candidate.specialty_code)?.name ?? candidate.specialty_code,
          colorName: COLORS.find((c) => c.id === candidate.color_code)?.name ?? candidate.color_code,
          coi,
          coiRisk,
          hasGenotype: !!candidateGenotype,
          warnings,
          compatibilityScore: Math.max(0, Math.min(100, score)),
          highlights,
        });
      }

      candidates.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

      return {
        target: {
          id: target.id,
          ring: target.ring,
          hasGenotype: !!targetGenotype,
        },
        candidates: candidates.slice(0, input.limit),
      };
    }),
});
