/**
 * aiContextBuilder.ts
 *
 * Monta o contexto rico do criadouro para o Assistente IA:
 * - Estatísticas gerais do plantel
 * - Pássaros ativos com raça/cor/genética
 * - Casais em reprodução
 * - Posturas ativas
 * - Histórico de saúde recente (últimos 30 dias)
 * - Filhotes da temporada atual
 */

import { getDb } from "../db";
import {
  birds, couples, clutches, chicks,
  health_records, breeding_reminders,
} from "../../drizzle/schema";
import { eq, and, gte, desc, count, isNull } from "drizzle-orm";

export interface CriadouroContext {
  summary: string;
  tenantId: number;
  generatedAt: string;
  stats: {
    totalBirds: number;
    activeCouples: number;
    activeClutches: number;
    chicksThisSeason: number;
    pendingReminders: number;
    recentHealthEvents: number;
  };
}

const contextCache = new Map<number, { ctx: CriadouroContext; ts: number }>();
const CACHE_TTL_MS = 60_000;

export async function buildCriadouroContext(tenantId: number): Promise<CriadouroContext> {
  const cached = contextCache.get(tenantId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.ctx;

  const db = await getDb();
  if (!db) {
    return {
      summary: "Banco de dados temporariamente indisponível.",
      tenantId,
      generatedAt: new Date().toISOString(),
      stats: { totalBirds: 0, activeCouples: 0, activeClutches: 0, chicksThisSeason: 0, pendingReminders: 0, recentHealthEvents: 0 },
    };
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000);
  const currentYear = new Date().getFullYear();
  const seasonStart = new Date(`${currentYear}-01-01`);

  const [
    allBirds,
    activeCouplesList,
    activeClutchesList,
    recentHealth,
    pendingRemindersRows,
    chicksRows,
  ] = await Promise.all([
    db.select({
      id: birds.id,
      ring: birds.ring,
      sex: birds.sex,
      status: birds.status,
      modality: birds.modality,
      specialty_code: birds.specialty_code,
      color_code: birds.color_code,
    }).from(birds).where(eq(birds.tenantId, tenantId)),

    db.select({
      id: couples.id,
      status: couples.status,
      cageNumber: couples.cageNumber,
      maleId: couples.maleId,
      femaleId: couples.femaleId,
    }).from(couples).where(and(eq(couples.tenantId, tenantId), eq(couples.status, "active"))),

    db.select({
      id: clutches.id,
      totalEggs: clutches.totalEggs,
      fertilizedEggs: clutches.fertilizedEggs,
      hatchedChicks: clutches.hatchedChicks,
    }).from(clutches).where(
      and(eq(clutches.tenantId, tenantId), isNull(clutches.deletedAt))
    ).limit(20),

    db.select({
      birdId: health_records.birdId,
      type: health_records.type,
      description: health_records.description,
      date: health_records.date,
    }).from(health_records)
      .innerJoin(birds, eq(health_records.birdId, birds.id))
      .where(and(
        eq(birds.tenantId, tenantId),
        isNull(birds.deletedAt),
        gte(health_records.date, thirtyDaysAgo),
      ))
      .orderBy(desc(health_records.date))
      .limit(20),

    db.select({ cnt: count() }).from(breeding_reminders)
      .innerJoin(couples, eq(breeding_reminders.coupleId, couples.id))
      .where(and(
        eq(couples.tenantId, tenantId),
        isNull(couples.deletedAt),
        eq(breeding_reminders.completed, false),
      )),

    db.select({ cnt: count() }).from(chicks)
      .where(and(
        eq(chicks.tenantId, tenantId),
        gte(chicks.createdAt, seasonStart),
        isNull(chicks.deletedAt),
      )),
  ]);

  const activeBirds = allBirds.filter((b) => b.status === "active");
  const males = activeBirds.filter((b) => b.sex === "macho");
  const females = activeBirds.filter((b) => b.sex === "fêmea");

  const byModality: Record<string, number> = {};
  for (const b of activeBirds) {
    const m = b.modality ?? "indefinida";
    byModality[m] = (byModality[m] ?? 0) + 1;
  }

  const byColor: Record<string, number> = {};
  for (const b of activeBirds) {
    const k = b.specialty_code || b.color_code || "sem classificação";
    byColor[k] = (byColor[k] ?? 0) + 1;
  }
  const top5Colors = Object.entries(byColor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `${k}(${v})`)
    .join(", ");

  const healthByType: Record<string, number> = {};
  for (const h of recentHealth) {
    healthByType[h.type] = (healthByType[h.type] ?? 0) + 1;
  }
  const healthSummary = Object.entries(healthByType)
    .map(([t, c]) => `${t}:${c}`)
    .join(", ");

  const totalEggsActive = activeClutchesList.reduce((s, c) => s + (c.totalEggs ?? 0), 0);

  const stats = {
    totalBirds: activeBirds.length,
    activeCouples: activeCouplesList.length,
    activeClutches: activeClutchesList.length,
    chicksThisSeason: chicksRows[0]?.cnt ?? 0,
    pendingReminders: pendingRemindersRows[0]?.cnt ?? 0,
    recentHealthEvents: recentHealth.length,
  };

  const couplesText = activeCouplesList.length === 0
    ? "Nenhum casal ativo no momento."
    : `${activeCouplesList.length} casais ativos, distribuídos em gaiolas: ${
        activeCouplesList.slice(0, 8).map((c) => c.cageNumber).join(", ")
      }${activeCouplesList.length > 8 ? " e outros" : ""}.`;

  const clutchText = activeClutchesList.length === 0
    ? "Nenhuma postura recente."
    : `${activeClutchesList.length} posturas registradas, total de ${totalEggsActive} ovos.`;

  const summary = `
=== CONTEXTO DO CRIADOURO (${new Date().toLocaleDateString("pt-BR")}) ===

PLANTEL ATIVO:
- Total de pássaros ativos: ${activeBirds.length} (${males.length} machos, ${females.length} fêmeas)
- Modalidades: ${Object.entries(byModality).map(([k,v])=>`${k}:${v}`).join(", ") || "não classificados"}
- Principais raças/cores: ${top5Colors || "não classificados"}
- Total incluindo inativos: ${allBirds.length}

REPRODUÇÃO:
- Casais em acasalamento: ${stats.activeCouples}
- ${couplesText}
- ${clutchText}
- Filhotes nesta temporada (${currentYear}): ${stats.chicksThisSeason}
- Lembretes reprodutivos pendentes: ${stats.pendingReminders}

SAÚDE (últimos 30 dias):
- Eventos de saúde registrados: ${stats.recentHealthEvents}
${healthSummary ? `- Por tipo: ${healthSummary}` : "- Nenhum evento de saúde registrado."}

=== BASE DE CONHECIMENTO DO ASSISTENTE ===
Você é o Assistente IA do Canaril — especialista em canários domésticos (Serinus canaria domestica).

ÁREAS DE EXPERTISE:
• Raças: 771 classes COR (lipocromos, melaninas, feo, opalino, topázio, eumo, ônix, cobalto, jaspe, mogno, mulato, acetinado, asas cinza, bico amarelo) e 698 classes PORTE (37 raças FOB/OBJO 2026)
• Genética: sistema ZZ/ZW (machos ZZ, fêmeas ZW). Diferencie rigorosamente fenótipo visual, portador e genótipo. Ágata, Canela, Isabelino, Pastel, Acetinado, Marfim, Asa Cinza e Inos lipocrômicos são tratados como fatores sexo-ligados na base documental do sistema; Branco, Opalino e Feo como fatores autossômicos recessivos; Intenso e Branco Dominante como dominantes.
• COI: apresente o coeficiente calculado e a genealogia usada; não transforme faixas de risco em diagnóstico biológico absoluto.
• Cruzamentos de risco: explique a regra configurada e sua fonte/versionamento. Não invente probabilidades nem trate regras tradicionais como gene causal confirmado.
• Saúde: doenças respiratórias, coccidiose, ácaros, candidíase, muda de penas
• Reprodução: ciclos, incubação (13-14 dias), anilhamento (5-7 dias), desmame (30-35 dias)
• Alimentação: dieta por fase (reprodução, muda, descanso, canto)

INSTRUÇÕES:
1. Use os dados reais do criadouro acima quando relevante para a resposta
2. Seja preciso e conciso — respostas focadas, sem repetição
3. Para diagnósticos clínicos sérios, SEMPRE recomende veterinário especializado em aves
4. Quando houver dúvida sobre genética, seja honesto sobre incerteza
5. Responda em português brasileiro
`.trim();

  const ctx: CriadouroContext = { summary, tenantId, generatedAt: new Date().toISOString(), stats };
  contextCache.set(tenantId, { ctx, ts: Date.now() });
  return ctx;
}
