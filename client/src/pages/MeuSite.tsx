/**
 * MeuSite.tsx — Personalização do site institucional público do canaril
 *
 * Cada canaril (tenant) tem seu próprio endereço público em /c/:slug.
 * Aqui o dono do canaril define: endereço (slug), cores, texto de
 * apresentação e galeria de fotos — sem precisar de nenhum desenvolvedor.
 */
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Globe, Save, ExternalLink, Palette, Image as ImageIcon, Copy } from "lucide-react";
import { toast } from "sonner";
import { PhotoUploader } from "@/components/PhotoUploader";

const emptyForm = {
  publicSlug: "",
  publicSiteEnabled: true,
  name: "",
  city: "",
  state: "",
  phone: "",
  email: "",
  themePrimaryColor: "#D97706",
  themeSecondaryColor: "#78350F",
  themeTagline: "",
  themeBio: "",
};

export default function MeuSite() {
  const { data: tenant, isLoading, refetch } = trpc.publicSite.mySite.useQuery();
  const [form, setForm] = useState(emptyForm);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (tenant && !initialized) {
      setForm({
        publicSlug: tenant.publicSlug || tenant.slug || "",
        publicSiteEnabled: tenant.publicSiteEnabled ?? true,
        name: tenant.name ?? "",
        city: tenant.city ?? "",
        state: tenant.state ?? "",
        phone: tenant.phone ?? "",
        email: tenant.email ?? "",
        themePrimaryColor: tenant.themePrimaryColor || "#D97706",
        themeSecondaryColor: tenant.themeSecondaryColor || "#78350F",
        themeTagline: tenant.themeTagline ?? "",
        themeBio: tenant.themeBio ?? "",
      });
      setInitialized(true);
    }
  }, [tenant, initialized]);

  const update = trpc.publicSite.updateMySite.useMutation({
    onSuccess: () => {
      toast.success("Site atualizado com sucesso!");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const patch = (p: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...p }));

  const publicUrl = form.publicSlug ? `${window.location.origin}/c/${form.publicSlug}` : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({
      publicSlug: form.publicSlug || undefined,
      publicSiteEnabled: form.publicSiteEnabled,
      name: form.name || undefined,
      city: form.city || null,
      state: form.state || null,
      phone: form.phone || null,
      email: form.email || null,
      themePrimaryColor: form.themePrimaryColor || undefined,
      themeSecondaryColor: form.themeSecondaryColor || undefined,
      themeTagline: form.themeTagline || null,
      themeBio: form.themeBio || null,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-gray-500">Carregando...</div>
      </DashboardLayout>
    );
  }

  if (!tenant) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6 text-gray-600">
              Seu usuário ainda não está vinculado a um canaril (tenant). Fale com o administrador do
              sistema para vincular sua conta antes de personalizar seu site público.
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Globe className="w-7 h-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meu Site</h1>
            <p className="text-sm text-gray-500">Personalize o site público do seu canaril — cores, capa, galeria e apresentação.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Endereço público */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Globe className="w-4 h-4" /> Endereço público</CardTitle>
              <CardDescription>O link que você vai divulgar para clientes e visitantes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="publicSiteEnabled">Site público ativo</Label>
                  <p className="text-xs text-gray-500">Quando desligado, o link fica indisponível para visitantes.</p>
                </div>
                <Switch
                  id="publicSiteEnabled"
                  checked={form.publicSiteEnabled}
                  onCheckedChange={(v) => patch({ publicSiteEnabled: v })}
                />
              </div>
              <div>
                <Label htmlFor="publicSlug">Endereço (slug)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 whitespace-nowrap">/c/</span>
                  <Input
                    id="publicSlug"
                    value={form.publicSlug}
                    onChange={(e) => patch({ publicSlug: e.target.value.toLowerCase() })}
                    placeholder="meu-canaril"
                  />
                </div>
                {publicUrl && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="text-amber-600 hover:underline flex items-center gap-1">
                      {publicUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado!"); }}
                      className="text-gray-400 hover:text-gray-700"
                      title="Copiar link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Identidade */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identidade do canaril</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome do canaril</Label>
                  <Input id="name" value={form.name} onChange={(e) => patch({ name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="tagline">Frase de apresentação</Label>
                  <Input
                    id="tagline"
                    value={form.themeTagline}
                    onChange={(e) => patch({ themeTagline: e.target.value })}
                    placeholder="Ex.: Criação especializada em Canário Belga desde 2015"
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" value={form.city} onChange={(e) => patch({ city: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="state">Estado</Label>
                  <Input id="state" value={form.state} onChange={(e) => patch({ state: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone / WhatsApp</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="email">E-mail de contato</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => patch({ email: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="bio">Sobre o canaril</Label>
                <Textarea
                  id="bio"
                  value={form.themeBio}
                  onChange={(e) => patch({ themeBio: e.target.value })}
                  rows={5}
                  maxLength={4000}
                  placeholder="Conte a história do seu canaril, especialidades, prêmios..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Cores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Palette className="w-4 h-4" /> Cores do site</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryColor">Cor principal</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="primaryColor"
                      type="color"
                      value={form.themePrimaryColor}
                      onChange={(e) => patch({ themePrimaryColor: e.target.value })}
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input value={form.themePrimaryColor} onChange={(e) => patch({ themePrimaryColor: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="secondaryColor">Cor secundária</Label>
                  <div className="flex items-center gap-2">
                    <input
                      id="secondaryColor"
                      type="color"
                      value={form.themeSecondaryColor}
                      onChange={(e) => patch({ themeSecondaryColor: e.target.value })}
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input value={form.themeSecondaryColor} onChange={(e) => patch({ themeSecondaryColor: e.target.value })} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={update.isPending} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {update.isPending ? "Salvando..." : "Salvar personalização"}
          </Button>
        </form>

        {/* Galeria — reaproveita o uploader existente (entityType "breeder") */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Galeria / Capa do site</CardTitle>
            <CardDescription>
              Envie fotos do seu criadouro. A foto marcada com a estrela vira a imagem de capa (fundo) do site público.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PhotoUploader entityType="breeder" entityId={tenant.id} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
