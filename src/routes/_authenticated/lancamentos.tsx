import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  useSales, useCreateSale, useUpdateSale, useDeleteSale, type Sale,
} from "@/hooks/use-sales";
import { formatBRL, type Categoria } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  component: Lancamentos,
});

function Lancamentos() {
  const { data: vendas = [], isLoading } = useSales();
  const del = useDeleteSale();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);

  return (
    <AppLayout>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 animate-vm-in">
        <div>
          <h1 className="text-2xl md:text-3xl text-foreground">Lançamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Histórico de vendas e comissões.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4" /> Adicionar venda
            </Button>
          </DialogTrigger>
          <VendaDialog editing={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </header>

      <Card className="overflow-hidden animate-vm-in">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : vendas.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhuma venda registrada ainda.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">% Comissão</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map(v => (
                <TableRow key={v.id} className="border-border">
                  <TableCell className="text-muted-foreground">
                    {new Date(v.sale_date).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-foreground">{v.product_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={v.category === "Aparelho" ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}>
                      {v.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-foreground">{formatBRL(Number(v.sale_value))}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{Number(v.commission_percentage)}%</TableCell>
                  <TableCell className="text-right text-primary">{formatBRL(Number(v.commission_value))}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(v); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          del.mutate(v.id, {
                            onSuccess: () => toast.success("Venda removida"),
                            onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao remover"),
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  );
}

function VendaDialog({ editing, onClose }: { editing: Sale | null; onClose: () => void }) {
  const create = useCreateSale();
  const update = useUpdateSale();
  const [produto, setProduto] = useState(editing?.product_name ?? "");
  const [categoria, setCategoria] = useState<Categoria>(editing?.category ?? "Aparelho");
  const [valor, setValor] = useState(editing ? String(editing.sale_value) : "");
  const [pct, setPct] = useState(editing ? String(editing.commission_percentage) : "");
  const [data, setData] = useState(editing?.sale_date ?? new Date().toISOString().slice(0, 10));

  const busy = create.isPending || update.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(valor);
    const p = parseFloat(pct);
    if (!produto || isNaN(v) || isNaN(p)) return;
    const payload = {
      product_name: produto,
      category: categoria,
      sale_value: v,
      commission_percentage: p,
      sale_date: data,
    };
    if (editing) {
      update.mutate({ id: editing.id, patch: payload }, {
        onSuccess: () => { toast.success("Venda atualizada"); onClose(); },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
      });
    } else {
      create.mutate(payload, {
        onSuccess: () => { toast.success("Venda registrada"); onClose(); },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
      });
    }
  };

  return (
    <DialogContent className="bg-card border-border">
      <DialogHeader>
        <DialogTitle className="text-foreground">{editing ? "Editar venda" : "Nova venda"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Produto</Label>
          <Input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex: iPhone 15 Pro" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Categoria</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Aparelho">Aparelho</SelectItem>
                <SelectItem value="Acessório">Acessório</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Valor (R$)</Label>
            <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">% Comissão</Label>
            <Input type="number" step="0.1" value={pct} onChange={(e) => setPct(e.target.value)} required />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {busy ? "Salvando..." : editing ? "Salvar" : "Registrar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
