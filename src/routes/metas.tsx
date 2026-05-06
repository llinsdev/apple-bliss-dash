import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useVendas } from "@/lib/vendas-store";
import { METAS, formatBRL } from "@/lib/mock-data";
import { Trophy, Target, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/metas")({
  component: Metas,
});

function Metas() {
  const vendas = useVendas();
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const doMes = vendas.filter(v => new Date(v.data) >= startMonth);
  const totalMes = doMes.reduce((s, v) => s + v.valor, 0);
  const acessorios = doMes.filter(v => v.categoria === "Acessório").reduce((s, v) => s + v.valor, 0);

  const marcos = [
    { label: "Primeira venda do mês", done: doMes.length > 0 },
    { label: "50% da meta mensal", done: totalMes >= METAS.mensal * 0.5 },
    { label: "Meta de acessórios atingida", done: acessorios >= METAS.acessoriosMensal },
    { label: "Meta mensal completa", done: totalMes >= METAS.mensal },
  ];

  return (
    <AppLayout>
      <header className="mb-6 animate-vm-in">
        <h1 className="text-2xl md:text-3xl text-foreground">Metas</h1>
        <p className="text-sm text-muted-foreground mt-1">Configuração e progresso das metas mensais.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <MetaCard title="Vendas Totais (mês)" icon={<Target className="h-4 w-4" />} current={totalMes} target={METAS.mensal} />
        <MetaCard title="Vendas de Acessórios (mês)" icon={<Target className="h-4 w-4" />} current={acessorios} target={METAS.acessoriosMensal} />
      </div>

      <Card className="animate-vm-in">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Marcos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {marcos.map((m) => (
            <div key={m.label} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className={`h-5 w-5 ${m.done ? "text-primary" : "text-muted-foreground/40"}`} />
                <span className={m.done ? "text-foreground" : "text-muted-foreground"}>{m.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{m.done ? "Conquistado" : "Pendente"}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function MetaCard({ title, icon, current, target }: { title: string; icon: React.ReactNode; current: number; target: number }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <Card className="animate-vm-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl text-foreground">{formatBRL(current)}</span>
          <span className="text-xs text-muted-foreground">/ {formatBRL(target)}</span>
        </div>
        <Progress value={pct} className="mt-3 h-2" />
        <div className="mt-2 text-xs text-primary">{pct}% atingido</div>
      </CardContent>
    </Card>
  );
}
