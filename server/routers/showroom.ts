import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { birds, photos } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Router público (sem autenticação) usado pela Home institucional. Expõe
 * estritamente o subconjunto de dados que o criador marcou como público
 * (birds.isPublic = true) — nunca a lista completa do plantel, dados de
 * contato de outros criadores, ou qualquer informação operacional.
 */
export const showroomRouter = router({
  featuredBirds: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    try {
      const publicBirds = await db
        .select()
        .from(birds)
        .where(and(eq(birds.isPublic, true), eq(birds.status, "active")))
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
