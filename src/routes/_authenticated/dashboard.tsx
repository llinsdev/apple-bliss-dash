import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSales, type Sale } from "@/hooks/use-sales";
import { useMyGoals, useAllGoals, type Goal } from "@/hooks/use-goals";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { METAS_DEFAULT, formatBRL, CATEGORIA_APARELHO, parseSaleDate } from "@/lib/mock-data";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, Wallet, Smartphone, Headphones } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Range = "hoje" | "7" | "30";

interface ProfileRow { id: string; full_name: string | null }
interface RoleRow { user_id: string; role: string }

function Dashboard() {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: allVendas = [], isLoading } = useSales();
  const { data: myGoals = [] } = useMyGoals();
  const { data: allGoals = [] } = useAllGoals();
  const qc = useQueryClient();

  // Atualização automática por polling (a cada 30s) — evita expor eventos
  // de vendas de outros vendedores via Realtime.
  useEffect(() => {
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["sales"] });
    }, 30000);
    return () => clearInterval(id);
  }, [qc]);

  // Vendedores não-admin (exclui Leandro/admin automaticamente via role)
  const profilesQ = useQuery({
    enabled: !!isAdmin,
    queryKey: ["admin", "profiles"],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const rolesQ = useQuery({
    enabled: !!isAdmin,
    queryKey: ["admin", "user_roles"],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const sellers = useMemo(() => {
    const profiles = profilesQ.data ?? [];
    const adminIds = new Set((rolesQ.data ?? []).filter(r => r.role === "admin").map(r => r.user_id));
    return profiles
      .filter(p => !adminIds.has(p.id))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR"));
  }, [profilesQ.data, rolesQ.data]);

  return (
    <AppLayout>
      <header className="mb-8 animate-vm-in">
        <h1 className="text-2xl md:text-3xl text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin
            ? "Acompanhe o desempenho de cada vendedor em tempo real."
            : "Acompanhe o progresso de metas e comissões em tempo real."}
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {[0,1,2].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : isAdmin ? (
        <AdminSellerSwitcher sellers={sellers} sales={allVendas} allGoals={allGoals} />
      ) : user ? (
        <SellerDashboardView
          sellerId={user.id}
          sales={allVendas}
          goals={myGoals}
        />
      ) : null}
    </AppLayout>
  );
}

function AdminSellerSwitcher({
  sellers,
  sales,
  allGoals,
}: {
  sellers: ProfileRow[];
  sales: Sale[];
  allGoals: Goal[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? sellers[0]?.id ?? null;
  const activeGoals = useMemo(
    () => (activeId ? allGoals.filter((g) => g.user_id === activeId) : []),
    [allGoals, activeId],
  );

  if (sellers.length === 0) {
    return <div className="text-sm text-muted-foreground">Nenhum vendedor encontrado.</div>;
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap gap-2 rounded-lg bg-secondary p-1 w-fit">
        {sellers.map((s) => (
          <Button
            key={s.id}
            variant={activeId === s.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedId(s.id)}
            className={
              activeId === s.id
                ? "bg-primary hover:bg-primary/90 text-primary-foreground h-8"
                : "h-8 text-muted-foreground hover:text-foreground"
            }
          >
            {s.full_name ?? "—"}
          </Button>
        ))}
      </div>
      {activeId && (
        <SellerDashboardView
          key={activeId}
          sellerId={activeId}
          sales={sales}
          goals={activeGoals}
        />
      )}
    </div>
  );
}

function SellerDashboardView({
  sellerId,
  sales,
  goals,
}: {
  sellerId: string;
  sales: Sale[];
  goals: Goal[];
}) {
  const [range, setRange] = useState<Range>("7");

  const vendas = useMemo(
    () => sales.filter((v) => v.seller_id === sellerId),
    [sales, sellerId],
  );

  const goalFor = (type: "diaria" | "semanal" | "mensal", focus: "total" | "acessorios" = "total") =>
    goals.find((g) => g.target_type === type && g.category_focus === focus)?.target_value ??
    (focus === "acessorios" ? METAS_DEFAULT.acessoriosMensal :
      type === "diaria" ? METAS_DEFAULT.diaria :
      type === "semanal" ? METAS_DEFAULT.semanal : METAS_DEFAULT.mensal);

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 6); startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalIn = (from: Date) =>
    vendas.filter((v) => new Date(v.sale_date) >= from).reduce((s, v) => s + Number(v.sale_value), 0);

  const totalDia = totalIn(startOfDay);
  const totalSemana = totalIn(startOfWeek);
  const totalMes = totalIn(startOfMonth);

  const comissoes = vendas.reduce((s, v) => s + Number(v.commission_value), 0);
  const comissoesAparelhos = vendas.filter(v => v.category === CATEGORIA_APARELHO).reduce((s, v) => s + Number(v.commission_value), 0);
  const comissoesAcessorios = comissoes - comissoesAparelhos;

  const lineData = useMemo(() => {
    const days = range === "hoje" ? 1 : range === "7" ? 7 : 30;
    return Array.from({ length: days }).map((_, i) => {
      const day = new Date(); day.setDate(day.getDate() - (days - 1 - i)); day.setHours(0, 0, 0, 0);
      const next = new Date(day); next.setDate(day.getDate() + 1);
      const total = vendas
        .filter(v => { const d = new Date(v.sale_date); return d >= day && d < next; })
        .reduce((s, v) => s + Number(v.sale_value), 0);
      return {
        label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        valor: total,
      };
    });
  }, [vendas, range]);

  const pieData = [
    { name: "Aparelhos", value: Math.round(comissoesAparelhos) },
    { name: "Acessórios", value: Math.round(comissoesAcessorios) },
  ];
  const PIE_COLORS = ["var(--primary)", "var(--chart-2)"];

  return (
    <div className="min-w-0">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
        <KpiCard title="Meta Diária" current={totalDia} target={goalFor("diaria")} delay={0} />
        <KpiCard title="Meta Semanal" current={totalSemana} target={goalFor("semanal")} delay={80} />
        <KpiCard title="Meta Mensal" current={totalMes} target={goalFor("mensal")} delay={160} />
      </section>

      <section className="grid gap-3 lg:grid-cols-3 mb-4">
        <Card className="lg:col-span-1 animate-vm-in min-w-0" style={{ animationDelay: "240ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary shrink-0" /> <span className="truncate">Comissões Acumuladas</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-foreground truncate">{formatBRL(comissoes)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniStat icon={<Smartphone className="h-4 w-4" />} label="Aparelhos" value={formatBRL(comissoesAparelhos)} />
              <MiniStat icon={<Headphones className="h-4 w-4" />} label="Acessórios" value={formatBRL(comissoesAcessorios)} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 animate-vm-in min-w-0" style={{ animationDelay: "320ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground truncate">Comissões por categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} stroke="none">
                  {pieData.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i]} />))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                  formatter={(v: number, name: string, item: { payload?: { name?: string } }) => {
                    const idx = pieData.findIndex(d => d.name === (item?.payload?.name ?? name));
                    const color = PIE_COLORS[idx] ?? "var(--foreground)";
                    return [<span style={{ color }}>{formatBRL(v)}</span>, <span style={{ color }}>{name}</span>];
                  }}
                />
                <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <Card className="animate-vm-in min-w-0" style={{ animationDelay: "400ms" }}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2 min-w-0">
            <TrendingUp className="h-4 w-4 text-primary shrink-0" /> <span className="truncate">Vendas no período</span>
          </CardTitle>
          <div className="flex gap-1 rounded-lg bg-secondary p-1 shrink-0">
            {(["hoje","7","30"] as const).map(r => (
              <Button
                key={r}
                variant={range === r ? "default" : "ghost"}
                size="sm"
                onClick={() => setRange(r)}
                className={range === r ? "bg-primary hover:bg-primary/90 text-primary-foreground h-7" : "h-7 text-muted-foreground hover:text-foreground"}
              >
                {r === "hoje" ? "Hoje" : `${r} dias`}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} width={48} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                formatter={(v: number) => formatBRL(v)}
              />
              <Line type="monotone" dataKey="valor" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--primary)" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ title, current, target, delay }: { title: string; current: number; target: number; delay: number }) {

  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <Card className="animate-vm-in min-w-0 overflow-hidden" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground truncate">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <span className="text-xl text-foreground truncate">{formatBRL(current)}</span>
          <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">/ {formatBRL(target)}</span>
        </div>
        <Progress value={pct} className="mt-3 h-2" />
        <div className="mt-2 text-xs text-primary">{pct}% atingido</div>
      </CardContent>
    </Card>
  );
}


function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}
