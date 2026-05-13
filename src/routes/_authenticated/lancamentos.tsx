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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import {
  useSales, useCreateOrderSale, useDeleteSale,
  APARELHO_COMISSAO_PCT, ACESSORIO_COMISSAO_PCT,
} from "@/hooks/use-sales";
import { formatBRL, CATEGORIA_APARELHO } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  component: Lancamentos,
});

function Lancamentos() {
  const { data: vendas = [], isLoading } = useSales();
  const del = useDeleteSale();
  const [open, setOpen] = useState(false);

  return (
    <AppLayout>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 animate-vm-in">
        <div>
          <h1 className="text-2xl md:text-3xl text-foreground">Lançamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Histórico de vendas e comissões.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4" /> Adicionar venda
            </Button>
          </DialogTrigger>
          <VendaDialog onClose={() => setOpen(false)} />
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
                    <Badge variant="outline" className={v.category === CATEGORIA_APARELHO ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}>
                      {v.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-foreground">{formatBRL(Number(v.sale_value))}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{Number(v.commission_percentage)}%</TableCell>
                  <TableCell className="text-right text-primary">{formatBRL(Number(v.commission_value))}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
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

function VendaDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateOrderSale();
  const [orderNumber, setOrderNumber] = useState("");
  const [aparelhos, setAparelhos] = useState("");
  const [acessorios, setAcessorios] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  const aparelhosNum = Number.parseFloat(aparelhos) || 0;
  const acessoriosNum = Number.parseFloat(acessorios) || 0;
  const comissaoAparelhos = aparelhosNum * (APARELHO_COMISSAO_PCT / 100);
  const comissaoAcessorios = acessoriosNum * (ACESSORIO_COMISSAO_PCT / 100);
  const comissaoTotal = comissaoAparelhos + comissaoAcessorios;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) return;
    if (aparelhosNum <= 0 && acessoriosNum <= 0) {
      toast.error("Informe o valor de aparelhos e/ou acessórios");
      return;
    }
    create.mutate(
      {
        order_number: orderNumber.trim(),
        device_value: aparelhosNum,
        accessory_value: acessoriosNum,
        sale_date: data,
      },
      {
        onSuccess: () => { toast.success("Venda registrada"); onClose(); },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
      },
    );
  };

  return (
    <DialogContent className="bg-card border-border">
      <DialogHeader>
        <DialogTitle className="text-foreground">Nova venda</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Número do pedido Bling</Label>
            <Input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Ex: 123456"
              maxLength={64}
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-2">
            <Label className="text-muted-foreground">Aparelhos</Label>
            <Input
              type="number" step="0.01" min="0" inputMode="decimal"
              value={aparelhos} onChange={(e) => setAparelhos(e.target.value)}
              placeholder="R$ 0,00"
            />
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-2">
            <Label className="text-muted-foreground">Acessórios</Label>
            <Input
              type="number" step="0.01" min="0" inputMode="decimal"
              value={acessorios} onChange={(e) => setAcessorios(e.target.value)}
              placeholder="R$ 0,00"
            />
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Comissão Aparelhos ({APARELHO_COMISSAO_PCT}%)</span>
            <span className="text-foreground">{formatBRL(comissaoAparelhos)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Comissão Acessórios ({ACESSORIO_COMISSAO_PCT}%)</span>
            <span className="text-foreground">{formatBRL(comissaoAcessorios)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 mt-2">
            <span className="text-muted-foreground">Comissão Total</span>
            <span className="text-primary">{formatBRL(comissaoTotal)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={create.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {create.isPending ? "Salvando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
