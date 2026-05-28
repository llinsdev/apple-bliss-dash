import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Mail, Briefcase } from "lucide-react";
import { authApi, useAuth } from "@/lib/auth";
import { useProfile, useIsAdmin } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: Perfil,
});

function Perfil() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: isAdmin } = useIsAdmin();
  const queryClient = useQueryClient();

  const fullName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Usuário";
  const initials = fullName.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  const [nome, setNome] = useState(fullName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNome(fullName);
  }, [fullName]);

  const salvarNome = async () => {
    if (!user || !nome.trim() || nome.trim() === fullName) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: nome.trim() })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar nome");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success("Nome atualizado");
  };

  return (
    <AppLayout>
      <header className="mb-6 animate-vm-in">
        <h1 className="text-2xl md:text-3xl text-foreground">Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Seus dados de acesso.</p>
      </header>

      <Card className="animate-vm-in max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-foreground text-lg">{fullName}</CardTitle>
              <p className="text-sm text-muted-foreground">VM STORE · Apple Specialist</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
            <Label htmlFor="nome" className="text-muted-foreground text-xs">Nome de exibição</Label>
            <div className="flex gap-2">
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="h-9 bg-input border-border"
                placeholder="Seu nome"
              />
              <Button
                onClick={salvarNome}
                disabled={saving || !nome.trim() || nome.trim() === fullName}
                className="h-9 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
          <Row icon={<Mail className="h-4 w-4" />} label="E-mail" value={user?.email ?? "—"} />
          <Row icon={<Briefcase className="h-4 w-4" />} label="Cargo" value={isAdmin ? "Admin" : "Vendedor"} />
          <Button
            variant="outline"
            className="mt-4 w-full border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
            onClick={async () => {
              await authApi.signOut();
              queryClient.clear();
              toast.success("Sessão encerrada");
              navigate({ to: "/" });
            }}
          >
            <LogOut className="h-4 w-4" /> Sair da conta
          </Button>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
      <div className="flex items-center gap-3 text-muted-foreground text-sm">{icon}{label}</div>
      <div className="text-foreground text-sm">{value}</div>
    </div>
  );
}
