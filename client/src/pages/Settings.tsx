import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Settings as SettingsIcon, Save } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { data: settings, refetch } = trpc.settings.get.useQuery();
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    state: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    description: "",
  });

  // Preenche o formulário assim que os dados chegam do servidor.
  useEffect(() => {
    if (settings) {
      setFormData({
        name: settings.name ?? "",
        city: settings.city ?? "",
        state: settings.state ?? "",
        address: settings.address ?? "",
        phone: settings.phone ?? "",
        email: settings.email ?? "",
        website: settings.website ?? "",
        description: settings.description ?? "",
      });
    }
  }, [settings]);

  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas! A Home e a Ficha de Gaiola já refletem os novos dados.");
      refetch();
    },
    onError: (error) => toast.error("Erro ao salvar: " + error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Informe o nome do criadouro");
      return;
    }
    updateSettings.mutate(formData);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-gray-700" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
            <p className="text-gray-600 mt-1">
              Dados do criadouro — usados na página inicial pública e na ficha de gaiola impressa
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Criadouro</CardTitle>
            <CardDescription>Essas informações aparecem para quem visita seu site e nas fichas impressas</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Criadouro *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Canário Lima"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="state">UF</Label>
                  <Input
                    id="state"
                    maxLength={2}
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                    placeholder="Ex: DF"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, número, bairro"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(61) 99999-9999" />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="website">Site</Label>
                <Input id="website" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="www.seudominio.com.br" />
              </div>
              <div>
                <Label htmlFor="description">Descrição (aparece na página inicial)</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Conte um pouco sobre o criadouro..."
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={updateSettings.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {updateSettings.isPending ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
