import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useSales } from "@/hooks/use-sales";
import { useMyGoals } from "@/hooks/use-goals";
import { METAS_DEFAULT, formatBRL, CATEGORIA_ACESSORIO, parseSaleDate } from "@/lib/mock-data";
import { Trophy, Target, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/metas")({
  component: Metas,
});

function Metas() {
  const { data: vendas = [] } = useSales();
  const { data: goals = [] } = useMyGoals();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const activeGoal = (type: "diaria" | "semanal" | "mensal", focus: "total" | "acessorios") =>
    goals.find((g) => {
      if (g.target_type !== type || g.category_focus !== focus) return false;
      const ps = parseSaleDate(g.period_start);
      const pe = parseSaleDate(g.period_end);
      return ps <= today && today <= pe;
    });

  const sumIn = (from: Date, toExcl: Date) =>
    vendas
      .filter((v) => { const d = parseSaleDate(v.sale_date); return d >= from && d < toExcl; })
      .reduce((s, v) => s + Number(v.sale_value), 0);

  const accSumIn = (from: Date, toExcl: Date) =>
    vendas
      .filter((v) => v.category === CATEGORIA_ACESSORIO)
      .filter((v) => { const d = parseSaleDate(v.sale_date); return d >= from && d < toExcl; })
      .reduce((s, v) => s + Number(v.sale_value), 0);

  // Mensal — usa período da meta se houver; senão mês corrente.
  const gMes = activeGoal("mensal", "total");
  const mesFrom = gMes ? parseSaleDate(gMes.period_start) : new Date(today.getFullYear(), today.getMonth(), 1);
  const mesToExcl = gMes
    ? (() => { const d = parseSaleDate(gMes.period_end); d.setDate(d.getDate() + 1); return d; })()
    : new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const totalMes = sumIn(mesFrom, mesToExcl);
  const targetMes = gMes?.target_value ?? METAS_DEFAULT.mensal;

  // Acessórios — período da meta se houver; senão mês corrente.
  const gAcc = activeGoal("mensal", "acessorios");
  const accFrom = gAcc ? parseSaleDate(gAcc.period_start) : mesFrom;
  const accToExcl = gAcc
    ? (() => { const d = parseSaleDate(gAcc.period_end); d.setDate(d.getDate() + 1); return d; })()
    : mesToExcl;
  const acessorios = accSumIn(accFrom, accToExcl);
  const targetAcc = gAcc?.target_value ?? METAS_DEFAULT.acessoriosMensal;

  const temVendaNoPeriodoMes = sumIn(mesFrom, mesToExcl) > 0 || vendas.some((v) => {
    const d = parseSaleDate(v.sale_date); return d >= mesFrom && d < mesToExcl;
  });

  const marcos = [
    { label: "Primeira venda do mês", done: temVendaNoPeriodoMes },
    { label: "50% da meta mensal", done: totalMes >= targetMes * 0.5 },
    { label: "Meta de acessórios atingida", done: acessorios >= targetAcc },
    { label: "Meta mensal completa", done: totalMes >= targetMes },
  ];


  return (
    <AppLayout>
      <header className="mb-6 animate-vm-in">
        <h1 className="text-2xl md:text-3xl text-foreground">Metas</h1>
        <p className="text-sm text-muted-foreground mt-1">Configuração e progresso das metas mensais.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <MetaCard title="Vendas Totais (mês)" icon={<Target className="h-4 w-4" />} current={totalMes} target={targetMes} />
        <MetaCard title="Vendas de Acessórios (mês)" icon={<Target className="h-4 w-4" />} current={acessorios} target={targetAcc} />
      </div>

      {goals.length === 0 && (
        <Card className="mb-6 border-primary/30 bg-primary/5 animate-vm-in">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Nenhuma meta personalizada definida. Os valores acima são padrão — peça ao admin para configurar.
          </CardContent>
        </Card>
      )}

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
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
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
