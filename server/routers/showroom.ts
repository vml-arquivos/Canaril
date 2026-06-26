import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, photos, tenants } from "../../drizzle/schema";
import { eq, and, desc, isNull, asc } from "drizzle-orm";

/**
 * showroom.ts — Site público do Canaril Lima
 *
 * O site público é EXCLUSIVO do Canaril Lima (tenant principal — menor id).
 * Usuários de outros canaris que têm acesso ao sistema (ex.: Tiveron) NÃO
 * aparecem no site público. Seus pássaros, nome e dados ficam exclusivamente
 * na área interna do sistema — nunca no site.
 *
 * Regra: featuredBirds filtra por tenantId = tenant principal (id mínimo).
 * Se não houver tenant cadastrado, mostra apenas pássaros sem tenantId
 * (dados legados, que pertencem ao Canaril Lima).
 */
export const showroomRouter = router({
  featuredBirds: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    try {
      // Descobrir o tenant principal (Canaril Lima = menor id não deletado)
      const [principalTenant] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(isNull(tenants.deletedAt))
        .orderBy(asc(tenants.id))
        .limit(1);

      // Filtro: somente pássaros do tenant principal (ou legados sem tenant)
      const tenantFilter = principalTenant
        ? and(eq(birds.isPublic, true), eq(birds.status, "active"), eq(birds.tenantId, principalTenant.id))
        : and(eq(birds.isPublic, true), eq(birds.status, "active"), isNull(birds.tenantId));

      const publicBirds = await db
        .select()
        .from(birds)
        .where(tenantFilter)
        .orderBy(desc(birds.createdAt))
        .limit(12);

      const results = await Promise.all(
        publicBirds.map(async (bird) => {
          const [photo] = await db
            .select()
            .from(photos)
            .where(and(eq(photos.entityType, "bird"), eq(photos.entityId, bird.id), eq(photos.isPrimary, true)))
            .limit(1);

          return {
            id: bird.id,
            ring: bird.ring,
            specialty_code: bird.specialty_code,
            color_code: bird.color_code,
            sex: bird.sex,
            photoUrl: photo?.url ?? null,
          };
        })
      );

      return results;
    } catch (error) {
      console.error("Error listing featured birds:", error);
      return [];
    }
  }),
});
