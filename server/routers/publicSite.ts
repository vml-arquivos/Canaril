/**
 * publicSite.ts — Site institucional público de cada canaril (multi-tenant)
 * ============================================================================
 * Cada canaril (tenant) cadastrado no sistema pode ativar e personalizar seu
 * próprio site público, acessível em /c/:slug — sem precisar de login.
 *
 * Duas metades neste router:
 *   1) `mySite` / `updateMySite` / `galleryUpload` etc. — procedures
 *      PROTEGIDAS, sempre restritas ao tenant do usuário autenticado
 *      (nunca recebem tenantId pelo input, sempre via getCallerTenantId).
 *      É o painel de personalização dentro do sistema.
 *   2) `getBySlug` — procedure PÚBLICA (sem login), usada pela página
 *      /c/:slug para renderizar o site. Só retorna dados de tenants com
 *      publicSiteEnabled = true, e só pássaros com isPublic = true — nunca
 *      expõe dados internos (financeiro, anilhas, casais, etc.).
 *
 * Reaproveita a infraestrutura já existente:
 *   - tabela `tenants` (slug/publicSlug já existiam; tema visual foi
 *     adicionado por 0021_tenant_site_theme.sql, aditivo)
 *   - tabela `photos` com entityType "breeder" (já previsto no schema mas
 *     não usado por nenhuma tela ainda) para logo/capa/galeria do canaril
 *   - `birds.isPublic` (já usado por showroom.ts) para os pássaros em vitrine
 * ============================================================================
 */
import { z } from "zod";
import { and, asc, desc, eq, isNull, ne, or } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router, getCallerTenantId } from "../_core/trpc";
import { getDb } from "../db";
import { tenants, birds, photos, site_posts, site_faqs } from "../../drizzle/schema";

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const publicSiteRouter = router({
  // ── Painel de personalização (autenticado, sempre o próprio tenant) ──────

  /** Retorna a configuração de site do canaril do usuário logado. */
  mySite: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = getCallerTenantId(ctx);
    if (!tenantId) return null;

    const db = await getDb();
    if (!db) return null;

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    return tenant ?? null;
  }),

  /** Sugere um slug disponível a partir do nome do canaril (ex.: para o primeiro preenchimento). */
  suggestSlug: protectedProcedure
    .input(z.object({ name: z.string().min(2) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return slugify(input.name);

      const base = slugify(input.name) || "canaril";
      let candidate = base;
      let attempt = 1;
      // Tenta até achar um slug livre (limite de segurança: 50 tentativas)
      while (attempt < 50) {
        const [taken] = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(or(eq(tenants.slug, candidate), eq(tenants.publicSlug, candidate)))
          .limit(1);
        if (!taken) return candidate;
        attempt++;
        candidate = `${base}-${attempt}`;
      }
      return `${base}-${Date.now()}`;
    }),

  /** Atualiza a personalização do site do PRÓPRIO canaril do usuário logado. */
  updateMySite: protectedProcedure
    .input(
      z.object({
        publicSlug: z.string().min(3).max(80).regex(SLUG_REGEX, "Use apenas letras minúsculas, números e hífens.").optional(),
        publicSiteEnabled: z.boolean().optional(),
        name: z.string().min(2).max(200).optional(),
        city: z.string().max(100).optional().nullable(),
        state: z.string().max(50).optional().nullable(),
        phone: z.string().max(30).optional().nullable(),
        email: z.string().email().max(200).optional().nullable(),
        logoUrl: z.string().url().optional().nullable(),
        themePrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB).").optional(),
        themeSecondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB).").optional(),
        themeBackgroundImageUrl: z.string().url().optional().nullable(),
        themeTagline: z.string().max(200).optional().nullable(),
        themeBio: z.string().max(4000).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = getCallerTenantId(ctx);
      if (!tenantId) {
        throw new Error("Seu usuário ainda não está vinculado a um canaril. Fale com o administrador do sistema.");
      }

      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      if (input.publicSlug) {
        const [clash] = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(or(eq(tenants.slug, input.publicSlug), eq(tenants.publicSlug, input.publicSlug)))
          .limit(1);
        if (clash && clash.id !== tenantId) {
          throw new Error(`O endereço "${input.publicSlug}" já está em uso por outro canaril. Escolha outro.`);
        }
      }

      const [updated] = await db.update(tenants).set(input).where(eq(tenants.id, tenantId)).returning();
      return updated;
    }),

  /** Lista as fotos de galeria/capa do canaril do usuário logado (entityType "breeder"). */
  myGallery: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = getCallerTenantId(ctx);
    if (!tenantId) return [];
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.entityType, "breeder"), eq(photos.entityId, tenantId)))
      .orderBy(desc(photos.isPrimary), photos.displayOrder, desc(photos.createdAt));
  }),

  // ── Blog do site institucional (self-service, por tenant) ────────────────

  /** Lista TODOS os posts do próprio canaril (publicados ou não) para edição. */
  myPosts: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = getCallerTenantId(ctx);
    if (!tenantId) return [];
    const db = await getDb();
    if (!db) return [];
    return db.select().from(site_posts).where(eq(site_posts.tenantId, tenantId)).orderBy(asc(site_posts.displayOrder), desc(site_posts.createdAt));
  }),

  upsertPost: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        title: z.string().min(2).max(200),
        slug: z.string().min(2).max(200).optional(),
        coverImageUrl: z.string().url().optional().nullable(),
        excerpt: z.string().max(300).optional().nullable(),
        content: z.string().min(1).max(20000),
        published: z.boolean().optional(),
        displayOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = getCallerTenantId(ctx);
      if (!tenantId) throw new Error("Seu usuário ainda não está vinculado a um canaril.");
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      const slug = slugify(input.slug || input.title) || `post-${Date.now()}`;

      const [clash] = await db
        .select({ id: site_posts.id })
        .from(site_posts)
        .where(and(eq(site_posts.tenantId, tenantId), eq(site_posts.slug, slug), input.id ? ne(site_posts.id, input.id) : undefined));
      if (clash) throw new Error(`Já existe um post com o endereço "${slug}". Ajuste o título ou o slug.`);

      if (input.id) {
        const [existing] = await db.select({ id: site_posts.id }).from(site_posts).where(and(eq(site_posts.id, input.id), eq(site_posts.tenantId, tenantId)));
        if (!existing) throw new Error("Post não encontrado ou não pertence ao seu canaril.");
        const [updated] = await db
          .update(site_posts)
          .set({ title: input.title, slug, coverImageUrl: input.coverImageUrl, excerpt: input.excerpt, content: input.content, published: input.published, displayOrder: input.displayOrder })
          .where(eq(site_posts.id, input.id))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(site_posts)
        .values({
          tenantId,
          title: input.title,
          slug,
          coverImageUrl: input.coverImageUrl ?? null,
          excerpt: input.excerpt ?? null,
          content: input.content,
          published: input.published ?? true,
          displayOrder: input.displayOrder ?? 0,
        })
        .returning();
      return created;
    }),

  deletePost: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getCallerTenantId(ctx);
      if (!tenantId) throw new Error("Seu usuário ainda não está vinculado a um canaril.");
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");
      await db.delete(site_posts).where(and(eq(site_posts.id, input.id), eq(site_posts.tenantId, tenantId)));
      return { success: true };
    }),

  // ── Perguntas e Respostas do site institucional (self-service) ───────────

  myFaqs: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = getCallerTenantId(ctx);
    if (!tenantId) return [];
    const db = await getDb();
    if (!db) return [];
    return db.select().from(site_faqs).where(eq(site_faqs.tenantId, tenantId)).orderBy(asc(site_faqs.displayOrder), asc(site_faqs.id));
  }),

  upsertFaq: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        question: z.string().min(2).max(300),
        answer: z.string().min(1).max(5000),
        published: z.boolean().optional(),
        displayOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = getCallerTenantId(ctx);
      if (!tenantId) throw new Error("Seu usuário ainda não está vinculado a um canaril.");
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");

      if (input.id) {
        const [existing] = await db.select({ id: site_faqs.id }).from(site_faqs).where(and(eq(site_faqs.id, input.id), eq(site_faqs.tenantId, tenantId)));
        if (!existing) throw new Error("Pergunta não encontrada ou não pertence ao seu canaril.");
        const [updated] = await db
          .update(site_faqs)
          .set({ question: input.question, answer: input.answer, published: input.published, displayOrder: input.displayOrder })
          .where(eq(site_faqs.id, input.id))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(site_faqs)
        .values({
          tenantId,
          question: input.question,
          answer: input.answer,
          published: input.published ?? true,
          displayOrder: input.displayOrder ?? 0,
        })
        .returning();
      return created;
    }),

  deleteFaq: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const tenantId = getCallerTenantId(ctx);
      if (!tenantId) throw new Error("Seu usuário ainda não está vinculado a um canaril.");
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não disponível.");
      await db.delete(site_faqs).where(and(eq(site_faqs.id, input.id), eq(site_faqs.tenantId, tenantId)));
      return { success: true };
    }),

  // ── Site público (sem login) ──────────────────────────────────────────────

  /**
   * Retorna os dados públicos do site pelo slug (aceita `publicSlug` OU o
   * `slug` interno do tenant, para não depender de o dono ter preenchido o
   * campo específico). Só responde se publicSiteEnabled = true.
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const cleanSlug = input.slug.trim().toLowerCase();
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(
          and(
            or(eq(tenants.publicSlug, cleanSlug), eq(tenants.slug, cleanSlug)),
            eq(tenants.publicSiteEnabled, true),
            isNull(tenants.deletedAt)
          )
        )
        .limit(1);

      if (!tenant) return null;

      const [featuredBirds, gallery, posts, faqs] = await Promise.all([
        db
          .select({
            id: birds.id,
            ring: birds.ring,
            nickname: birds.nickname,
            breedName: birds.breedName,
            specialty_code: birds.specialty_code,
            color_code: birds.color_code,
            sex: birds.sex,
          })
          .from(birds)
          .where(and(eq(birds.isPublic, true), eq(birds.status, "active"), eq(birds.tenantId, tenant.id)))
          .orderBy(desc(birds.createdAt))
          .limit(24),
        db
          .select()
          .from(photos)
          .where(and(eq(photos.entityType, "breeder"), eq(photos.entityId, tenant.id)))
          .orderBy(desc(photos.isPrimary), photos.displayOrder, desc(photos.createdAt))
          .limit(30),
        db
          .select()
          .from(site_posts)
          .where(and(eq(site_posts.tenantId, tenant.id), eq(site_posts.published, true)))
          .orderBy(asc(site_posts.displayOrder), desc(site_posts.createdAt))
          .limit(50),
        db
          .select()
          .from(site_faqs)
          .where(and(eq(site_faqs.tenantId, tenant.id), eq(site_faqs.published, true)))
          .orderBy(asc(site_faqs.displayOrder), asc(site_faqs.id))
          .limit(100),
      ]);

      // Foto principal de cada pássaro em destaque, numa única consulta
      const birdIds = featuredBirds.map((b) => b.id);
      const birdPhotos = birdIds.length
        ? await db.select().from(photos).where(and(eq(photos.entityType, "bird"), eq(photos.isPrimary, true)))
        : [];
      const photoByBirdId = new Map(birdPhotos.map((p) => [p.entityId, p.url]));

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.publicSlug || tenant.slug,
          city: tenant.city,
          state: tenant.state,
          phone: tenant.phone,
          email: tenant.email,
          logoUrl: tenant.logoUrl,
          themePrimaryColor: tenant.themePrimaryColor || "#D97706",
          themeSecondaryColor: tenant.themeSecondaryColor || "#78350F",
          themeBackgroundImageUrl: tenant.themeBackgroundImageUrl,
          themeTagline: tenant.themeTagline,
          themeBio: tenant.themeBio,
        },
        gallery: gallery.map((g) => ({ id: g.id, url: g.url, caption: g.caption, isPrimary: g.isPrimary })),
        posts: posts.map((p) => ({ id: p.id, title: p.title, slug: p.slug, coverImageUrl: p.coverImageUrl, excerpt: p.excerpt, content: p.content, createdAt: p.createdAt })),
        faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
        birds: featuredBirds.map((b) => ({ ...b, photoUrl: photoByBirdId.get(b.id) ?? null })),
      };
    }),
});
