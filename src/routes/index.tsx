import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Store, Mail, Lock, User as UserIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authApi, useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await authApi.signIn(email, senha);
        if (error) throw error;
        toast.success("Bem-vindo de volta");
      } else {
        const { error } = await authApi.signUp(email, senha, nome || email.split("@")[0]);
        if (error) throw error;
        toast.success("Conta criada com sucesso");
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
      />
      <div className="relative w-full max-w-md animate-vm-in">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Store className="h-7 w-7" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl text-foreground">VM STORE</h1>
            <p className="text-sm text-muted-foreground">Gestão de metas e comissões</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-xl"
        >
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`h-9 rounded-md text-sm transition-colors ${
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "signin" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <div className="space-y-5">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-muted-foreground">Nome completo</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="nome" required value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="pl-10 h-11 bg-input border-border"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-input border-border"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha" className="text-muted-foreground">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="senha" type="password" required minLength={6} value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="pl-10 h-11 bg-input border-border"
                />
              </div>
            </div>
            <Button
              type="submit" disabled={busy}
              className="h-11 w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {busy ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </div>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Acesso interno · VM STORE © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
