import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Bird } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      utils.auth.me.setData(undefined, data.user);
      await utils.auth.me.invalidate();
      toast.success("Login realizado com sucesso!");
      setLocation("/dashboard", { replace: true });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao fazer login");
    },
  });

  const loading = loginMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Preencha email e senha");
      return;
    }

    await loginMutation.mutateAsync({
      email: email.trim(),
      password,
    }).catch(() => undefined);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-3 rounded-full">
              <Bird className="w-8 h-8 text-white" />
            </div>
          </div>
          {/* Altera a marca da tela de login para refletir a identidade institucional */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Canaril Lima</h1>
          <p className="text-gray-600">Gestão Profissional de Criadouro</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader>
            <CardTitle>Bem-vindo ao Painel</CardTitle>
            <CardDescription>
              Faça login para acessar o sistema de gestão
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@seudominio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  className="border-gray-300 focus:border-amber-500 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                    className="border-gray-300 focus:border-amber-500 focus:ring-amber-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold py-2 rounded-lg transition-all"
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <div className="mt-6 bg-amber-50 rounded-lg p-4 border border-amber-200">
              <p className="text-xs text-amber-800 text-center">
                Use o e-mail e a senha definidos nas variáveis ADMIN_EMAIL e ADMIN_PASSWORD.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
