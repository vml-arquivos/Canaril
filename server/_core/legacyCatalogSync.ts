/**
 * legacyCatalogSync.ts — Alinha `specialties` e `colors` com o catálogo oficial
 * ============================================================================
 * DIAGNÓSTICO (2026): o sistema mantém 3 fontes de nomenclatura em paralelo:
 *   1) official_bird_classes — catálogo oficial FOB/OBJO 2026 completo
 *      (1.469 classes: 771 COR + 698 PORTE). Fonte da verdade.
 *   2) specialties / colors — tabelas "legadas", alimentadas manualmente
 *      pela migration 0002_seed_data.sql com apenas 6 raças e 13 cores
 *      genéricas (nem específicas do Canário Belga).
 *   3) SPECIALTIES / COLORS em shared/constants.ts — cópia hardcoded no
 *      frontend, usada como fallback/oferta de opções no formulário de
 *      cadastro de pássaro, com uma terceira lista ligeiramente diferente
 *      das duas anteriores.
 *
 * Isso fazia o cadastro de pássaro (Birds.tsx) pedir a "classe oficial"
 * (officialClassId, rica e correta) E também "especialidade"/"cor" legadas
 * (specialty_code/color_code, pobres e fora de sincronia) como campos
 * independentes — gerando dado duplicado, risco de inconsistência e
 * confusão de navegação.
 *
 * Esta rotina NÃO apaga nada. Ela deriva, a partir do próprio catálogo
 * oficial já presente no código (COR_CLASSES/PORTE_CLASSES), os registros
 * de specialties (44 raças de Porte) e colors (93 grupos de Cor) que ainda
 * não existem nas tabelas legadas — usando ON CONFLICT DO NOTHING, então é
 * seguro rodar em todo boot, como o seedOfficialClasses já faz.
 *
 * Efeito: specialties e colors passam a refletir a nomenclatura oficial
 * completa, e o formulário pode (num passo seguinte) parar de manter uma
 * lista hardcoded e consultar o catálogo já unificado no banco.
 * ============================================================================
 */
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { specialties, colors } from "../../drizzle/schema";
import { COR_CLASSES, PORTE_CLASSES } from "./officialClassesSeed";

const OFFICIAL_BODY = "FOB/OBJO";
const SOURCE_YEAR_NOTE = "Fonte: nomenclatura oficial FOB/OBJO, data efetiva 02/02/2026.";
const CONNECTOR_WORDS = new Set(["DO", "DA", "DE", "DOS", "DAS", "E"]);

/**
 * Chave de deduplicação tolerante a acentuação, maiúsculas/minúsculas,
 * pontuação e conectores ("do"/"da"/"de"). Sem isso, "Holandês" (legado,
 * com acento) e "HOLANDES" (derivado do catálogo oficial) ou "Frisado do
 * Norte" (legado) e "FRISADO DO NORTE" (oficial, mesma raça) virariam
 * registros duplicados em vez de reconhecidos como a mesma raça/cor.
 */
function dedupeKey(label: string): string {
  const noAccents = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return noAccents
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .filter(token => !CONNECTOR_WORDS.has(token))
    .join("");
}

/** Remove acentos e normaliza para um código estável em MAIÚSCULAS_COM_UNDERSCORE. */
function toCode(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Título com iniciais maiúsculas, preservando siglas curtas já em caixa alta (ex.: "FOB"). */
function toTitleCase(label: string): string {
  return label
    .toLowerCase()
    .split(/(\s+|-)/)
    .map(part => (/^\s+$|^-$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

/** Deduz uma família ampla de cor a partir do nome do grupo oficial, para preencher `category`. */
function guessColorCategory(groupName: string): string {
  const g = groupName.toLowerCase();
  if (g.includes("lipocrômico") || g.includes("lipocromico")) return "Lipocrômico";
  if (g.includes("ino")) return "Ino";
  if (g.includes("outras")) return "Outras";
  return "Melânico";
}

/** Deduz presença/ausência do fator vermelho a partir do nome do grupo, para preencher `genetics`. */
function guessGenetics(groupName: string): string | undefined {
  const g = groupName.toLowerCase();
  if (g.includes("com fator")) return "Com fator vermelho";
  if (g.includes("sem fator")) return "Sem fator vermelho";
  return undefined;
}

export async function syncLegacyCatalogFromOfficial(): Promise<{
  specialtiesInserted: number;
  specialtiesSkipped: number;
  colorsInserted: number;
  colorsSkipped: number;
}> {
  const db = await getDb();
  if (!db) {
    console.warn("[CatalogSync] Banco não disponível, pulando alinhamento de catálogo legado.");
    return { specialtiesInserted: 0, specialtiesSkipped: 0, colorsInserted: 0, colorsSkipped: 0 };
  }

  // Carrega o que já existe nas tabelas legadas para deduplicar por NOME
  // normalizado (não só por código) — protege contra grafias diferentes
  // da mesma raça/cor entre o cadastro manual antigo e o catálogo oficial.
  const existingSpecialties = await db
    .select({ id: specialties.id, name: specialties.name, official_body: specialties.official_body })
    .from(specialties);
  const existingColors = await db
    .select({ id: colors.id, name: colors.name, official_body: colors.official_body })
    .from(colors);

  const existingSpecialtyByKey = new Map(existingSpecialties.map(s => [dedupeKey(s.name), s]));
  const existingColorByKey = new Map(existingColors.map(c => [dedupeKey(c.name), c]));

  // ── Especialidades (raças), derivadas das classes PORTE ──────────────────
  // Deduplica por código normalizado, preferindo a variante que NÃO está
  // 100% em caixa alta (mais legível) quando houver mais de uma grafia
  // para a mesma raça no catálogo-fonte (ex.: "RAÇA ESPANHOLA" e
  // "Raça Espanhola" convergem para o mesmo código RACA_ESPANHOLA).
  const breedByCode = new Map<string, { name: string; bitola?: string }>();
  for (const cls of PORTE_CLASSES) {
    if (!cls.breedName) continue;
    const code = toCode(cls.breedName);
    const existing = breedByCode.get(code);
    const isAllCaps = cls.breedName === cls.breedName.toUpperCase();
    if (!existing || (isAllCaps === false && existing.name === existing.name.toUpperCase())) {
      breedByCode.set(code, { name: isAllCaps ? toTitleCase(cls.breedName) : cls.breedName, bitola: cls.bitola });
    }
  }

  let specialtiesInserted = 0;
  let specialtiesSkipped = 0;
  let specialtiesEnriched = 0;
  for (const [code, breed] of breedByCode) {
    const key = dedupeKey(breed.name);
    const already = existingSpecialtyByKey.get(key);
    if (already) {
      // Já existe (possivelmente com grafia diferente) — só completa o
      // vínculo com o órgão oficial se ainda não estiver preenchido.
      // Nunca sobrescreve nome/descrição já cadastrados manualmente.
      if (!already.official_body) {
        try {
          await db.update(specialties).set({ official_body: OFFICIAL_BODY }).where(eq(specialties.id, already.id));
          specialtiesEnriched++;
        } catch (error) {
          console.error(`[CatalogSync] Erro ao enriquecer especialidade existente (id ${already.id}):`, error);
        }
      }
      specialtiesSkipped++;
      continue;
    }
    try {
      const result = await db
        .insert(specialties)
        .values({
          code,
          name: breed.name,
          description: `Raça/porte reconhecido pela nomenclatura oficial FOB/OBJO 2026 (classes de Porte).${
            breed.bitola ? ` Bitola oficial de anilha: ${breed.bitola}mm.` : ""
          } ${SOURCE_YEAR_NOTE}`,
          official_body: OFFICIAL_BODY,
          status: "active",
        })
        .onConflictDoNothing()
        .returning({ id: specialties.id });
      if (result.length > 0) specialtiesInserted++;
      else specialtiesSkipped++;
    } catch (error) {
      console.error(`[CatalogSync] Erro ao inserir especialidade ${code}:`, error);
      specialtiesSkipped++;
    }
  }

  // ── Cores/mutações, derivadas dos grupos das classes COR ─────────────────
  const groupNames = [...new Set(COR_CLASSES.map(c => c.groupName).filter((g): g is string => !!g))];

  let colorsInserted = 0;
  let colorsSkipped = 0;
  let colorsEnriched = 0;
  for (const groupName of groupNames) {
    const code = toCode(groupName);
    const key = dedupeKey(groupName);
    const already = existingColorByKey.get(key);
    if (already) {
      if (!already.official_body) {
        try {
          await db.update(colors).set({ official_body: OFFICIAL_BODY }).where(eq(colors.id, already.id));
          colorsEnriched++;
        } catch (error) {
          console.error(`[CatalogSync] Erro ao enriquecer cor existente (id ${already.id}):`, error);
        }
      }
      colorsSkipped++;
      continue;
    }
    try {
      const result = await db
        .insert(colors)
        .values({
          code,
          name: groupName,
          category: guessColorCategory(groupName),
          genetics: guessGenetics(groupName),
          description: `Grupo de classificação oficial FOB/OBJO 2026 (Canário de Cor). ${SOURCE_YEAR_NOTE}`,
          official_body: OFFICIAL_BODY,
          status: "active",
        })
        .onConflictDoNothing()
        .returning({ id: colors.id });
      if (result.length > 0) colorsInserted++;
      else colorsSkipped++;
    } catch (error) {
      console.error(`[CatalogSync] Erro ao inserir cor ${code}:`, error);
      colorsSkipped++;
    }
  }

  console.log(
    `[CatalogSync] Especialidades: ${specialtiesInserted} novas, ${specialtiesEnriched} enriquecidas, ${specialtiesSkipped} já cobertas (catálogo oficial: ${breedByCode.size} raças). ` +
      `Cores: ${colorsInserted} novas, ${colorsEnriched} enriquecidas, ${colorsSkipped} já cobertas (catálogo oficial: ${groupNames.length} grupos).`
  );

  return { specialtiesInserted, specialtiesSkipped, colorsInserted, colorsSkipped };
}
