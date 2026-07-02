import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useSales } from "@/hooks/use-sales";
import { useMyGoals, useAllGoals, type Goal } from "@/hooks/use-goals";
import { useIsAdmin } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { METAS_DEFAULT, formatBRL, CATEGORIA_ACESSORIO, parseSaleDate } from "@/lib/mock-data";
import { useSelectedMonth } from "@/lib/selected-month";
import { MonthSelector } from "@/components/month-selector";
import { Trophy, Target, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/metas")({
  component: Metas,
});

interface RoleRow { user_id: string; role: string }

function Metas() {
  const { data: isAdmin } = useIsAdmin();
  const { data: vendasAll = [] } = useSales();
  const { data: myGoals = [] } = useMyGoals();
  const { data: allGoals = [] } = useAllGoals();
  const { startDate: monthStart, endDateExcl: monthEnd } = useSelectedMonth();

  // Para o admin: descobrir quais user_ids são vendedores (exclui admin/Leandro).
  const rolesQ = useQuery({
    enabled: !!isAdmin,
    queryKey: ["admin", "user_roles"],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const sellerIds = useMemo(() => {
    if (!isAdmin) return null;
    const roles = rolesQ.data ?? [];
    const adminIds = new Set(roles.filter(r => r.role === "admin").map(r => r.user_id));
    const sellerSet = new Set(
      roles.filter(r => r.role === "vendedor" && !adminIds.has(r.user_id)).map(r => r.user_id),
    );
    return sellerSet;
  }, [isAdmin, rolesQ.data]);

  // Vendas e metas no escopo (admin = consolidado dos vendedores; vendedor = próprias).
  const vendas = useMemo(() => {
    if (sellerIds) return vendasAll.filter(v => sellerIds.has(v.seller_id));
    return vendasAll;
  }, [vendasAll, sellerIds]);

  const goals = useMemo(() => {
    if (sellerIds) return allGoals.filter(g => sellerIds.has(g.user_id));
    return myGoals;
  }, [sellerIds, allGoals, myGoals]);

  const goalInMonth = (g: Goal) => {
    const ps = parseSaleDate(g.period_start);
    return ps >= monthStart && ps < monthEnd;
  };

  const sumIn = (from: Date, toExcl: Date) =>
    vendas
      .filter(v => { const d = parseSaleDate(v.sale_date); return d >= from && d < toExcl; })
      .reduce((s, v) => s + Number(v.sale_value), 0);

  const accSumIn = (from: Date, toExcl: Date) =>
    vendas
      .filter(v => v.category === CATEGORIA_ACESSORIO)
      .filter(v => { const d = parseSaleDate(v.sale_date); return d >= from && d < toExcl; })
      .reduce((s, v) => s + Number(v.sale_value), 0);

  // Meta Geral (mensal total): soma dos targets dos vendedores no mês.
  const mensaisTotal = goals.filter(g => g.target_type === "mensal" && g.category_focus === "total" && goalInMonth(g));
  const targetMes = mensaisTotal.length > 0
    ? mensaisTotal.reduce((s, g) => s + Number(g.target_value), 0)
    : (sellerIds ? METAS_DEFAULT.mensal * Math.max(1, sellerIds.size) : METAS_DEFAULT.mensal);
  const totalMes = sumIn(monthStart, monthEnd);
  const restanteMes = Math.max(0, targetMes - totalMes);

  // Meta Acessórios (mensal): idem.
  const mensaisAcc = goals.filter(g => g.target_type === "mensal" && g.category_focus === "acessorios" && goalInMonth(g));
  const targetAcc = mensaisAcc.length > 0
    ? mensaisAcc.reduce((s, g) => s + Number(g.target_value), 0)
    : (sellerIds ? METAS_DEFAULT.acessoriosMensal * Math.max(1, sellerIds.size) : METAS_DEFAULT.acessoriosMensal);
  const totalAcc = accSumIn(monthStart, monthEnd);
  const restanteAcc = Math.max(0, targetAcc - totalAcc);

  const temVendaNoMes = vendas.some(v => {
    const d = parseSaleDate(v.sale_date); return d >= monthStart && d < monthEnd;
  });

  const marcos = [
    { label: "Primeira venda do mês", done: temVendaNoMes },
    { label: "50% da meta mensal", done: totalMes >= targetMes * 0.5 },
    { label: "Meta de acessórios atingida", done: totalAcc >= targetAcc },
    { label: "Meta mensal completa", done: totalMes >= targetMes },
  ];

  const goalsDoMes = goals.filter(goalInMonth);
  const escopoLabel = isAdmin ? "Consolidado dos vendedores (exclui admin)." : "Suas metas e vendas.";

  return (
    <AppLayout>
      <header className="mb-4 animate-vm-in">
        <h1 className="text-2xl md:text-3xl text-foreground">Metas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhamento das metas mensais. {escopoLabel}
        </p>
      </header>

      <MonthSelector />

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <MetaCard
          title="Meta Geral (mês)"
          icon={<Target className="h-4 w-4" />}
          current={totalMes}
          target={targetMes}
          remaining={restanteMes}
        />
        <MetaCard
          title="Meta de Acessórios (mês)"
          icon={<Target className="h-4 w-4" />}
          current={totalAcc}
          target={targetAcc}
          remaining={restanteAcc}
        />
      </div>

      {goalsDoMes.length === 0 && (
        <Card className="mb-6 border-primary/30 bg-primary/5 animate-vm-in">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Nenhuma meta cadastrada para este mês. Os valores acima são padrão — peça ao admin para configurar.
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

function MetaCard({
  title, icon, current, target, remaining,
}: {
  title: string; icon: React.ReactNode; current: number; target: number; remaining: number;
}) {
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
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-primary">{pct}% atingido</span>
          <span className="text-muted-foreground">Restante: {formatBRL(remaining)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
