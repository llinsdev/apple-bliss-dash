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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { vendasStore, useVendas } from "@/lib/vendas-store";
import { comissaoValor, formatBRL, type Categoria, type Venda } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/lancamentos")({
  component: Lancamentos,
});

function Lancamentos() {
  const vendas = useVendas();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Venda | null>(null);

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
                  {new Date(v.data).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-foreground">{v.produto}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={v.categoria === "Aparelho" ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}>
                    {v.categoria}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-foreground">{formatBRL(v.valor)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{v.comissaoPct}%</TableCell>
                <TableCell className="text-right text-primary">{formatBRL(comissaoValor(v))}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(v); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => { vendasStore.remove(v.id); toast.success("Venda removida"); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
}

function VendaDialog({ editing, onClose }: { editing: Venda | null; onClose: () => void }) {
  const [produto, setProduto] = useState(editing?.produto ?? "");
  const [categoria, setCategoria] = useState<Categoria>(editing?.categoria ?? "Aparelho");
  const [valor, setValor] = useState(editing?.valor.toString() ?? "");
  const [pct, setPct] = useState(editing?.comissaoPct.toString() ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(valor);
    const p = parseFloat(pct);
    if (!produto || isNaN(v) || isNaN(p)) return;
    if (editing) {
      vendasStore.update(editing.id, { produto, categoria, valor: v, comissaoPct: p });
      toast.success("Venda atualizada");
    } else {
      vendasStore.add({ produto, categoria, valor: v, comissaoPct: p });
      toast.success("Venda registrada");
    }
    onClose();
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
          <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {editing ? "Salvar" : "Registrar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
