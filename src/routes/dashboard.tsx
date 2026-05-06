import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useVendas } from "@/lib/vendas-store";
import { METAS, comissaoValor, formatBRL } from "@/lib/mock-data";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, Wallet, Smartphone, Headphones } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

type Range = "hoje" | "7" | "30";

function Dashboard() {
  const vendas = useVendas();
  const [range, setRange] = useState<Range>("7");

  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 6); startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalIn = (from: Date) =>
    vendas.filter((v) => new Date(v.data) >= from).reduce((s, v) => s + v.valor, 0);

  const totalDia = totalIn(startOfDay);
  const totalSemana = totalIn(startOfWeek);
  const totalMes = totalIn(startOfMonth);

  const comissoes = vendas.reduce((s, v) => s + comissaoValor(v), 0);
  const comissoesAparelhos = vendas.filter(v => v.categoria === "Aparelho").reduce((s, v) => s + comissaoValor(v), 0);
  const comissoesAcessorios = comissoes - comissoesAparelhos;

  const lineData = useMemo(() => {
    const days = range === "hoje" ? 1 : range === "7" ? 7 : 30;
    return Array.from({ length: days }).map((_, i) => {
      const day = new Date(now); day.setDate(now.getDate() - (days - 1 - i)); day.setHours(0, 0, 0, 0);
      const next = new Date(day); next.setDate(day.getDate() + 1);
      const total = vendas
        .filter(v => { const d = new Date(v.data); return d >= day && d < next; })
        .reduce((s, v) => s + v.valor, 0);
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
    <AppLayout>
      <header className="mb-8 animate-vm-in">
        <h1 className="text-2xl md:text-3xl text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe o progresso de metas e comissões em tempo real.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3 mb-6">
        <KpiCard title="Meta Diária" current={totalDia} target={METAS.diaria} delay={0} />
        <KpiCard title="Meta Semanal" current={totalSemana} target={METAS.semanal} delay={80} />
        <KpiCard title="Meta Mensal" current={totalMes} target={METAS.mensal} delay={160} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-1 animate-vm-in" style={{ animationDelay: "240ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Comissões Acumuladas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-foreground">{formatBRL(comissoes)}</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniStat icon={<Smartphone className="h-4 w-4" />} label="Aparelhos" value={formatBRL(comissoesAparelhos)} />
              <MiniStat icon={<Headphones className="h-4 w-4" />} label="Acessórios" value={formatBRL(comissoesAcessorios)} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 animate-vm-in" style={{ animationDelay: "320ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Comissões por categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} stroke="none">
                  {pieData.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i]} />))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <Card className="animate-vm-in" style={{ animationDelay: "400ms" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Vendas no período
          </CardTitle>
          <div className="flex gap-1 rounded-lg bg-secondary p-1">
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
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                formatter={(v: number) => formatBRL(v)}
              />
              <Line type="monotone" dataKey="valor" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--primary)" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function KpiCard({ title, current, target, delay }: { title: string; current: number; target: number; delay: number }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <Card className="animate-vm-in" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
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

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}
