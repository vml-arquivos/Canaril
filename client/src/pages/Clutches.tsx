import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Clutches() {
  const [openClutch, setOpenClutch] = useState(false);
  const [openChick, setOpenChick] = useState(false);
  const [selectedClutchId, setSelectedClutchId] = useState<number | null>(null);
  
  const [clutchData, setClutchData] = useState({
    coupleId: "",
    clutchDate: "",
    totalEggs: "0",
    fertilizedEggs: "0",
    infertileEggs: "0",
    lostEggs: "0",
  });

  const [chickData, setChickData] = useState({
    clutchId: "",
    ring: "",
    sex: "",
    color: "",
    birthDate: "",
  });

  const { data: clutches, refetch: refetchClutches } = trpc.management.clutches.list.useQuery();
  const { data: couples } = trpc.management.couples.list.useQuery();
  const { data: chicks, refetch: refetchChicks } = trpc.management.chicks.list.useQuery();

  const createClutch = trpc.management.clutches.create.useMutation({
    onSuccess: () => {
      toast.success("Postura registrada com sucesso!");
      refetchClutches();
      setOpenClutch(false);
      setClutchData({
        coupleId: "",
        clutchDate: "",
        totalEggs: "0",
        fertilizedEggs: "0",
        infertileEggs: "0",
        lostEggs: "0",
      });
    },
    onError: (error) => {
      toast.error("Erro ao registrar postura: " + error.message);
    },
  });

  const createChick = trpc.management.chicks.create.useMutation({
    onSuccess: () => {
      toast.success("Filhote registrado com sucesso!");
      refetchChicks();
      setOpenChick(false);
      setChickData({
        clutchId: "",
        ring: "",
        sex: "",
        color: "",
        birthDate: "",
      });
    },
    onError: (error) => {
      toast.error("Erro ao registrar filhote: " + error.message);
    },
  });

  const handleSubmitClutch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clutchData.coupleId || !clutchData.clutchDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    createClutch.mutate({
      coupleId: parseInt(clutchData.coupleId),
      clutchDate: new Date(clutchData.clutchDate),
      totalEggs: parseInt(clutchData.totalEggs),
      fertilizedEggs: parseInt(clutchData.fertilizedEggs),
      infertileEggs: parseInt(clutchData.infertileEggs),
      lostEggs: parseInt(clutchData.lostEggs),
    });
  };

  const handleSubmitChick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chickData.clutchId || !chickData.birthDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    createChick.mutate({
      clutchId: parseInt(chickData.clutchId),
      ring: chickData.ring,
      sex: chickData.sex,
      color: chickData.color,
      birthDate: new Date(chickData.birthDate),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestão de Posturas e Filhotes</h1>
            <p className="text-gray-600 mt-2">Registre posturas e acompanhe filhotes</p>
          </div>
        </div>

        <Tabs defaultValue="clutches" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="clutches">Posturas</TabsTrigger>
            <TabsTrigger value="chicks">Filhotes</TabsTrigger>
          </TabsList>

          {/* Posturas Tab */}
          <TabsContent value="clutches" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={openClutch} onOpenChange={setOpenClutch}>
                <DialogTrigger asChild>
                  <Button className="bg-yellow-600 hover:bg-yellow-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Registrar Postura
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Registrar Nova Postura</DialogTitle>
                    <DialogDescription>Preencha os dados da postura</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmitClutch} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="coupleId">Casal *</Label>
                        <Select value={clutchData.coupleId} onValueChange={(value) => setClutchData({ ...clutchData, coupleId: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {couples?.map((couple) => (
                              <SelectItem key={couple.id} value={couple.id.toString()}>
                                Gaiola {couple.cageNumber || couple.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="clutchDate">Data da Postura *</Label>
                        <Input
                          id="clutchDate"
                          type="date"
                          value={clutchData.clutchDate}
                          onChange={(e) => setClutchData({ ...clutchData, clutchDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="totalEggs">Total de Ovos</Label>
                        <Input
                          id="totalEggs"
                          type="number"
                          value={clutchData.totalEggs}
                          onChange={(e) => setClutchData({ ...clutchData, totalEggs: e.target.value })}
                          min="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="fertilizedEggs">Ovos Galados</Label>
                        <Input
                          id="fertilizedEggs"
                          type="number"
                          value={clutchData.fertilizedEggs}
                          onChange={(e) => setClutchData({ ...clutchData, fertilizedEggs: e.target.value })}
                          min="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="infertileEggs">Ovos Inférteis</Label>
                        <Input
                          id="infertileEggs"
                          type="number"
                          value={clutchData.infertileEggs}
                          onChange={(e) => setClutchData({ ...clutchData, infertileEggs: e.target.value })}
                          min="0"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lostEggs">Ovos Perdidos</Label>
                        <Input
                          id="lostEggs"
                          type="number"
                          value={clutchData.lostEggs}
                          onChange={(e) => setClutchData({ ...clutchData, lostEggs: e.target.value })}
                          min="0"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setOpenClutch(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" className="bg-yellow-600 hover:bg-yellow-700">
                        Registrar
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Posturas Registradas</CardTitle>
                <CardDescription>Total: {clutches?.length || 0} posturas</CardDescription>
              </CardHeader>
              <CardContent>
                {clutches && clutches.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Casal</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Galados</TableHead>
                          <TableHead>Inférteis</TableHead>
                          <TableHead>Perdidos</TableHead>
                          <TableHead>Filhotes</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clutches.map((clutch) => (
                          <TableRow key={clutch.id}>
                            <TableCell>Gaiola {clutch.coupleId}</TableCell>
                            <TableCell>{new Date(clutch.clutchDate).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell>{clutch.totalEggs}</TableCell>
                            <TableCell className="text-green-600">{clutch.fertilizedEggs}</TableCell>
                            <TableCell className="text-red-600">{clutch.infertileEggs}</TableCell>
                            <TableCell className="text-gray-600">{clutch.lostEggs}</TableCell>
                            <TableCell className="font-semibold">{clutch.hatchedChicks}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost">
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-600">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nenhuma postura registrada ainda.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Filhotes Tab */}
          <TabsContent value="chicks" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={openChick} onOpenChange={setOpenChick}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Registrar Filhote
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Registrar Novo Filhote</DialogTitle>
                    <DialogDescription>Preencha os dados do filhote</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmitChick} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="clutchId">Postura *</Label>
                        <Select value={chickData.clutchId} onValueChange={(value) => setChickData({ ...chickData, clutchId: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {clutches?.map((clutch) => (
                              <SelectItem key={clutch.id} value={clutch.id.toString()}>
                                Postura {new Date(clutch.clutchDate).toLocaleDateString("pt-BR")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="ring">Anilha</Label>
                        <Input
                          id="ring"
                          value={chickData.ring}
                          onChange={(e) => setChickData({ ...chickData, ring: e.target.value })}
                          placeholder="Ex: BR-2024-001"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sex">Sexo</Label>
                        <Select value={chickData.sex} onValueChange={(value) => setChickData({ ...chickData, sex: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="macho">Macho</SelectItem>
                            <SelectItem value="fêmea">Fêmea</SelectItem>
                            <SelectItem value="indeterminado">Indeterminado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="color">Cor</Label>
                        <Input
                          id="color"
                          value={chickData.color}
                          onChange={(e) => setChickData({ ...chickData, color: e.target.value })}
                          placeholder="Ex: Amarelo Intenso"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="birthDate">Data de Nascimento *</Label>
                        <Input
                          id="birthDate"
                          type="date"
                          value={chickData.birthDate}
                          onChange={(e) => setChickData({ ...chickData, birthDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setOpenChick(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                        Registrar
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Filhotes Registrados</CardTitle>
                <CardDescription>Total: {chicks?.length || 0} filhotes</CardDescription>
              </CardHeader>
              <CardContent>
                {chicks && chicks.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Anilha</TableHead>
                          <TableHead>Postura</TableHead>
                          <TableHead>Sexo</TableHead>
                          <TableHead>Cor</TableHead>
                          <TableHead>Data Nascimento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chicks.map((chick) => (
                          <TableRow key={chick.id}>
                            <TableCell className="font-mono font-semibold">{chick.ring || "-"}</TableCell>
                            <TableCell>{chick.clutchId}</TableCell>
                            <TableCell>{chick.sex || "-"}</TableCell>
                            <TableCell>{chick.color_code || "-"}</TableCell>
                            <TableCell>{new Date(chick.birthDate).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell>
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                {chick.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost">
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="text-red-600">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>Nenhum filhote registrado ainda.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
