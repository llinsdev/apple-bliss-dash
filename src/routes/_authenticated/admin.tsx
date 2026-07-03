import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useIsAdmin } from "@/hooks/use-profile";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSales } from "@/hooks/use-sales";
import {
  useAllGoals, useUpsertGoal, useDeleteGoal,
  type Goal, type GoalType, type GoalFocus,
} from "@/hooks/use-goals";
import { formatBRL, parseSaleDate } from "@/lib/mock-data";
import { useSelectedMonth } from "@/lib/selected-month";
import { ShieldCheck, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { MonthSelector } from "@/components/month-selector";

const ALLOWED_SELLER_IDS = new Set<string>([
  "a97a9546-65d8-420f-9a32-d02afe7060f0", // Mariano
  "9d6b8f6b-2dc3-4e6a-8ee0-43af047231d0", // Dominique
]);

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: Admin,
});

interface ProfileRow { id: string; full_name: string | null }
interface RoleRow { user_id: string; role: "admin" | "vendedor" }

function Admin() {
  const navigate = useNavigate();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();

  useEffect(() => {
    if (!adminLoading && isAdmin === false) {
      navigate({ to: "/dashboard" });
    }
  }, [adminLoading, isAdmin, navigate]);

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
    queryKey: ["admin", "user_roles"],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const { data: sales = [] } = useSales();
  const { data: goals = [] } = useAllGoals();
  const del = useDeleteGoal();

  const [editing, setEditing] = useState<Goal | null>(null);
  const [openGoal, setOpenGoal] = useState(false);
  const [defaultUserId, setDefaultUserId] = useState<string | null>(null);

  const { startDate: startMonth, endDateExcl: nextMonth } = useSelectedMonth();

  const totalsByUser = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sales) {
      const dt = parseSaleDate(s.sale_date);
      if (dt >= startMonth && dt < nextMonth) {
        m.set(s.seller_id, (m.get(s.seller_id) ?? 0) + Number(s.sale_value));
      }
    }
    return m;
  }, [sales, startMonth, nextMonth]);


  const profiles = profilesQ.data ?? [];
  const roles = rolesQ.data ?? [];
  const roleOf = (uid: string) => roles.find(r => r.user_id === uid)?.role ?? "vendedor";
  const adminIds = useMemo(
    () => new Set(roles.filter(r => r.role === "admin").map(r => r.user_id)),
    [roles],
  );
  const eligibleSellers = useMemo(
    () => profiles
      .filter(p => ALLOWED_SELLER_IDS.has(p.id) && !adminIds.has(p.id))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR")),
    [profiles, adminIds],
  );

  return (
    <AppLayout>
      <header className="mb-6 flex items-center justify-between gap-4 animate-vm-in">
        <div>
          <h1 className="text-2xl md:text-3xl text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Admin
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de vendedores e metas.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/integracoes">Integrações</Link>
        </Button>
      </header>

      <MonthSelector />

      <Card className="mb-6 animate-vm-in">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Vendedores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Vendas (mês)</TableHead>
                <TableHead className="text-right">Metas</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eligibleSellers.map(p => {
                const userGoals = goals.filter(g => g.user_id === p.id);
                return (
                  <TableRow key={p.id} className="border-border">
                    <TableCell className="text-foreground">{p.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleOf(p.id) === "admin" ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}>
                        {roleOf(p.id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-foreground">{formatBRL(totalsByUser.get(p.id) ?? 0)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{userGoals.length}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { setEditing(null); setDefaultUserId(p.id); setOpenGoal(true); }}
                      >
                        <Plus className="h-4 w-4" /> Meta
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <GoalsByMonth
        goals={goals}
        profiles={profiles}
        onEdit={(g) => { setEditing(g); setDefaultUserId(g.user_id); setOpenGoal(true); }}
        onDelete={(id) => del.mutate(id, {
          onSuccess: () => toast.success("Meta removida"),
          onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
        })}
      />


      <Dialog open={openGoal} onOpenChange={(v) => { setOpenGoal(v); if (!v) setEditing(null); }}>
        <GoalDialog
          editing={editing}
          defaultUserId={defaultUserId}
          profiles={eligibleSellers}
          adminIds={adminIds}
          onClose={() => { setOpenGoal(false); setEditing(null); }}
        />
      </Dialog>
    </AppLayout>
  );
}

function GoalDialog({
  editing, defaultUserId, profiles, adminIds, onClose,
}: {
  editing: Goal | null;
  defaultUserId: string | null;
  profiles: ProfileRow[];
  adminIds: Set<string>;
  onClose: () => void;
}) {
  const upsert = useUpsertGoal();
  const { year, month } = useSelectedMonth();
  const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const monthStartISO = toISO(new Date(year, month, 1));
  const monthEndISO = toISO(new Date(year, month + 1, 0));
  const weekRangeISO = (wn: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDay = Math.min(1 + (wn - 1) * 7, daysInMonth);
    const endDay = Math.min(startDay + 6, daysInMonth);
    return { s: toISO(new Date(year, month, startDay)), e: toISO(new Date(year, month, endDay)) };
  };
  const initialType: GoalType = editing?.target_type ?? "mensal";
  const initialWeek = editing?.week_number ? String(editing.week_number) : "1";
  const initialRange =
    !editing && initialType === "semanal"
      ? weekRangeISO(parseInt(initialWeek, 10))
      : { s: monthStartISO, e: monthEndISO };
  const [userId, setUserId] = useState(editing?.user_id ?? defaultUserId ?? "");
  const [value, setValue] = useState(editing ? String(editing.target_value) : "");
  const [type, setType] = useState<GoalType>(initialType);
  const [focus, setFocus] = useState<GoalFocus>(editing?.category_focus ?? "total");
  const [start, setStart] = useState(editing?.period_start ?? initialRange.s);
  const [end, setEnd] = useState(editing?.period_end ?? initialRange.e);
  const [weekNumber, setWeekNumber] = useState<string>(initialWeek);

  // Ao alternar tipo/semana em uma NOVA meta, ajusta o intervalo automaticamente.
  useEffect(() => {
    if (editing) return;
    if (type === "semanal") {
      const r = weekRangeISO(parseInt(weekNumber, 10) || 1);
      setStart(r.s); setEnd(r.e);
    } else {
      setStart(monthStartISO); setEnd(monthEndISO);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, weekNumber, year, month]);


  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(value);
    if (!userId || isNaN(v)) return;
    const wn = type === "semanal" ? parseInt(weekNumber, 10) : null;
    upsert.mutate(
      { id: editing?.id, user_id: userId, target_value: v, target_type: type, category_focus: focus, period_start: start, period_end: end, week_number: wn },
      {
        onSuccess: () => { toast.success(editing ? "Meta atualizada" : "Meta criada"); onClose(); },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
      },
    );
  };

  return (
    <DialogContent className="bg-card border-border">
      <DialogHeader>
        <DialogTitle className="text-foreground">{editing ? "Editar meta" : "Nova meta"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Vendedor</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0,8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as GoalType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diaria">Diária</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Foco</Label>
            <Select value={focus} onValueChange={(v) => setFocus(v as GoalFocus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Total</SelectItem>
                <SelectItem value="acessorios">Acessórios</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Valor alvo (R$)</Label>
          <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Início</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Fim</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
        </div>
        {type === "semanal" && (
          <div className="space-y-2">
            <Label className="text-muted-foreground">Semana</Label>
            <Select value={weekNumber} onValueChange={setWeekNumber}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Semana 1</SelectItem>
                <SelectItem value="2">Semana 2</SelectItem>
                <SelectItem value="3">Semana 3</SelectItem>
                <SelectItem value="4">Semana 4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={upsert.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {upsert.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function GoalsByMonth({
  goals, profiles, onEdit, onDelete,
}: {
  goals: Goal[];
  profiles: ProfileRow[];
  onEdit: (g: Goal) => void;
  onDelete: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; year: number; month: number; items: Goal[] }>();
    for (const g of goals) {
      const d = parseSaleDate(g.period_start);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m).padStart(2, "0")}`;
      let entry = map.get(key);
      if (!entry) {
        const label = new Date(y, m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        entry = { label: label.charAt(0).toUpperCase() + label.slice(1), year: y, month: m, items: [] };
        map.set(key, entry);
      }
      entry.items.push(g);
    }
    const orderKey = (g: Goal) => {
      const t = g.target_type === "mensal" ? 0 : g.target_type === "semanal" ? 1 : 2;
      const f = g.category_focus === "total" ? 0 : 1;
      const w = g.week_number ?? 0;
      return t * 100 + f * 10 + w;
    };
    for (const entry of map.values()) {
      entry.items.sort((a, b) => orderKey(a) - orderKey(b));
    }
    return Array.from(map.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [goals]);

  if (goals.length === 0) {
    return (
      <Card className="animate-vm-in">
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          Nenhuma meta cadastrada ainda.
        </CardContent>
      </Card>
    );
  }

  const labelTipo = (g: Goal) => {
    if (g.target_type === "semanal") return `Semana ${g.week_number ?? "?"}`;
    if (g.target_type === "mensal") return g.category_focus === "acessorios" ? "Meta Acessórios" : "Meta Geral";
    return "Diária";
  };

  return (
    <div className="space-y-4">
      {groups.map(group => (
        <Card key={`${group.year}-${group.month}`} className="animate-vm-in">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Foco</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Alvo</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map(g => (
                  <TableRow key={g.id} className="border-border">
                    <TableCell className="text-foreground">{labelTipo(g)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {profiles.find(p => p.id === g.user_id)?.full_name ?? g.user_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{g.category_focus === "total" ? "Total" : "Acessórios"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {parseSaleDate(g.period_start).toLocaleDateString("pt-BR")} → {parseSaleDate(g.period_end).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right text-primary">{formatBRL(Number(g.target_value))}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(g)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(g.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

