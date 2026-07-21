/**
 * PublicSite.tsx — Site institucional público de um canaril, por slug.
 * Acessível sem login via /c/:slug. Cada canaril cadastrado no sistema tem
 * o seu próprio, com cores/capa/galeria/bio definidos em "Meu Site".
 */
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Bird, MapPin, Phone, Mail, ArrowLeft } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

function labelFor(items: readonly { id?: string; code?: string; name: string }[], code?: string | null) {
  return items.find((i) => i.id === code || i.code === code)?.name ?? code ?? "";
}

export default function PublicSite() {
  const [, params] = useRoute("/c/:slug");
  const slug = params?.slug ?? "";

  const { data, isLoading } = trpc.publicSite.getBySlug.useQuery({ slug }, { enabled: !!slug });
  const { data: specialtiesData } = trpc.catalog.specialtiesList.useQuery();
  const { data: colorsData } = trpc.catalog.colorsList.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FBF8F3] flex items-center justify-center">
        <Bird className="w-10 h-10 text-amber-500 animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FBF8F3] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Bird className="w-12 h-12 text-gray-300" />
        <h1 className="text-xl font-semibold text-gray-700">Site não encontrado</h1>
        <p className="text-gray-500 text-sm max-w-sm">
          Este endereço não existe ou o site público deste canaril não está ativo no momento.
        </p>
        <Link href="/" className="text-amber-600 text-sm flex items-center gap-1 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
      </div>
    );
  }

  const { tenant, gallery, birds, posts, faqs } = data;
  const primary = tenant.themePrimaryColor || "#D97706";
  const secondary = tenant.themeSecondaryColor || "#78350F";
  const coverPhoto = tenant.themeBackgroundImageUrl || gallery.find((g) => g.isPrimary)?.url || gallery[0]?.url || null;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div
        className="relative flex flex-col items-center justify-center text-center px-6 py-24 text-white"
        style={{
          backgroundColor: primary,
          backgroundImage: coverPhoto ? `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${coverPhoto})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {tenant.logoUrl && (
          <img src={tenant.logoUrl} alt={tenant.name} className="w-20 h-20 rounded-full object-cover border-4 border-white mb-4 shadow-lg" />
        )}
        <h1 className="text-3xl md:text-4xl font-bold">{tenant.name}</h1>
        {tenant.themeTagline && <p className="mt-2 text-lg opacity-90 max-w-xl">{tenant.themeTagline}</p>}
        {(tenant.city || tenant.state) && (
          <p className="mt-3 text-sm opacity-80 flex items-center gap-1">
            <MapPin className="w-4 h-4" /> {[tenant.city, tenant.state].filter(Boolean).join(" - ")}
          </p>
        )}
      </div>

      {/* Sobre */}
      {tenant.themeBio && (
        <div className="max-w-2xl mx-auto px-6 py-12 text-center">
          <h2 className="text-xl font-semibold mb-3" style={{ color: secondary }}>Sobre o canaril</h2>
          <p className="text-gray-600 whitespace-pre-line leading-relaxed">{tenant.themeBio}</p>
        </div>
      )}

      {/* Galeria */}
      {gallery.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 py-8">
          <h2 className="text-xl font-semibold mb-4 text-center" style={{ color: secondary }}>Galeria</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {gallery.map((g) => (
              <img key={g.id} src={g.url} alt={g.caption ?? tenant.name} className="w-full h-40 object-cover rounded-lg shadow-sm" />
            ))}
          </div>
        </div>
      )}

      {/* Pássaros em destaque */}
      {birds.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 py-8">
          <h2 className="text-xl font-semibold mb-4 text-center" style={{ color: secondary }}>Plantel em destaque</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {birds.map((bird) => (
              <div key={bird.id} className="rounded-lg border overflow-hidden shadow-sm bg-white">
                <div className="h-32 bg-gray-100 flex items-center justify-center">
                  {bird.photoUrl ? (
                    <img src={bird.photoUrl} alt={bird.ring} className="w-full h-full object-cover" />
                  ) : (
                    <Bird className="w-8 h-8 text-gray-300" />
                  )}
                </div>
                <div className="p-2 text-xs">
                  <p className="font-semibold text-gray-800 truncate">{bird.nickname || bird.breedName || labelFor(specialtiesData ?? [], bird.specialty_code)}</p>
                  <p className="text-gray-500 truncate">{labelFor(colorsData ?? [], bird.color_code)}</p>
                  <p className="text-gray-400">{bird.ring}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blog */}
      {posts.length > 0 && (
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h2 className="text-xl font-semibold mb-4 text-center" style={{ color: secondary }}>Novidades do canaril</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map((post) => (
              <div key={post.id} className="rounded-lg border overflow-hidden shadow-sm bg-white">
                {post.coverImageUrl && <img src={post.coverImageUrl} alt={post.title} className="w-full h-36 object-cover" />}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900">{post.title}</h3>
                  {post.excerpt && <p className="text-sm text-gray-500 mt-1">{post.excerpt}</p>}
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-line line-clamp-6">{post.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Perguntas e Respostas */}
      {faqs.length > 0 && (
        <div className="max-w-2xl mx-auto px-6 py-8">
          <h2 className="text-xl font-semibold mb-4 text-center" style={{ color: secondary }}>Perguntas frequentes</h2>
          <Accordion type="single" collapsible>
            {faqs.map((faq) => (
              <AccordionItem key={faq.id} value={String(faq.id)}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {/* Contato */}
      <div className="text-center py-10 border-t mt-8" style={{ backgroundColor: "#FBF8F3" }}>
        <h2 className="text-lg font-semibold mb-3" style={{ color: secondary }}>Contato</h2>
        <div className="flex flex-col items-center gap-2 text-sm text-gray-600">
          {tenant.phone && (
            <a href={`https://wa.me/${tenant.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
              <Phone className="w-4 h-4" /> {tenant.phone}
            </a>
          )}
          {tenant.email && (
            <a href={`mailto:${tenant.email}`} className="flex items-center gap-2 hover:underline">
              <Mail className="w-4 h-4" /> {tenant.email}
            </a>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-6">Site gerado pelo sistema Canaril</p>
      </div>
    </div>
  );
}
