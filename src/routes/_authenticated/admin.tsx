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
    queryKey: ["admin", "roles"],
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

  const { startMonth, nextMonth } = useMemo(() => {
    const d = new Date();
    return {
      startMonth: new Date(d.getFullYear(), d.getMonth(), 1),
      nextMonth: new Date(d.getFullYear(), d.getMonth() + 1, 1),
    };
  }, []);

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
              {profiles.map(p => {
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

      <Card className="animate-vm-in">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm text-muted-foreground">Metas cadastradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {goals.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhuma meta cadastrada ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Foco</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Alvo</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map(g => (
                  <TableRow key={g.id} className="border-border">
                    <TableCell className="text-foreground">
                      {profiles.find(p => p.id === g.user_id)?.full_name ?? g.user_id.slice(0,8)}
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">{g.target_type}</TableCell>
                    <TableCell className="text-muted-foreground">{g.category_focus === "total" ? "Total" : "Acessórios"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(g.period_start).toLocaleDateString("pt-BR")} → {new Date(g.period_end).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right text-primary">{formatBRL(Number(g.target_value))}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => { setEditing(g); setDefaultUserId(g.user_id); setOpenGoal(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => del.mutate(g.id, {
                            onSuccess: () => toast.success("Meta removida"),
                            onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
                          })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={openGoal} onOpenChange={(v) => { setOpenGoal(v); if (!v) setEditing(null); }}>
        <GoalDialog
          editing={editing}
          defaultUserId={defaultUserId}
          profiles={profiles}
          onClose={() => { setOpenGoal(false); setEditing(null); }}
        />
      </Dialog>
    </AppLayout>
  );
}

function GoalDialog({
  editing, defaultUserId, profiles, onClose,
}: {
  editing: Goal | null;
  defaultUserId: string | null;
  profiles: ProfileRow[];
  onClose: () => void;
}) {
  const upsert = useUpsertGoal();
  const { year, month } = useSelectedMonth();
  const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const defaultStart = toISO(new Date(year, month, 1));
  const defaultEnd = toISO(new Date(year, month + 1, 0));
  const [userId, setUserId] = useState(editing?.user_id ?? defaultUserId ?? "");
  const [value, setValue] = useState(editing ? String(editing.target_value) : "");
  const [type, setType] = useState<GoalType>(editing?.target_type ?? "mensal");
  const [focus, setFocus] = useState<GoalFocus>(editing?.category_focus ?? "total");
  const [start, setStart] = useState(editing?.period_start ?? defaultStart);
  const [end, setEnd] = useState(editing?.period_end ?? defaultEnd);
  const [weekNumber, setWeekNumber] = useState<string>(editing?.week_number ? String(editing.week_number) : "1");

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
