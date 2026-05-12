import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsAdmin } from "@/hooks/use-profile";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  getBlingStatus, saveBlingCredentials, startBlingOAuth, disconnectBling,
  triggerBlingSync, listSellerMappings, upsertSellerMapping, deleteSellerMapping,
  listIngestLog,
} from "@/lib/bling-config.functions";
import { Plug, RefreshCw, Trash2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/integracoes")({
  component: Integracoes,
  validateSearch: (s: Record<string, unknown>) => ({ ok: s.ok === "1" ? "1" : undefined }),
});

function Integracoes() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { ok } = useSearch({ from: "/_authenticated/integracoes" });

  useEffect(() => {
    if (!adminLoading && isAdmin === false) navigate({ to: "/dashboard" });
  }, [adminLoading, isAdmin, navigate]);

  useEffect(() => {
    if (ok === "1") {
      toast.success("Bling conectado com sucesso!");
      navigate({ to: "/integracoes", replace: true });
    }
  }, [ok, navigate]);

  const fnStatus = useServerFn(getBlingStatus);
  const fnSave = useServerFn(saveBlingCredentials);
  const fnStart = useServerFn(startBlingOAuth);
  const fnDisc = useServerFn(disconnectBling);
  const fnSync = useServerFn(triggerBlingSync);
  const fnListMaps = useServerFn(listSellerMappings);
  const fnUpsertMap = useServerFn(upsertSellerMapping);
  const fnDelMap = useServerFn(deleteSellerMapping);
  const fnLog = useServerFn(listIngestLog);

  const statusQ = useQuery({
    queryKey: ["bling", "status"],
    queryFn: () => fnStatus(),
    enabled: !!isAdmin,
  });

  const mapsQ = useQuery({
    queryKey: ["bling", "mappings"],
    queryFn: () => fnListMaps(),
    enabled: !!isAdmin,
  });

  const logQ = useQuery({
    queryKey: ["bling", "log"],
    queryFn: () => fnLog(),
    enabled: !!isAdmin,
    refetchInterval: 15000,
  });

  const profilesQ = useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!isAdmin,
  });

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [syncing, setSyncing] = useState(false);

  const handleSaveCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fnSave({ data: { client_id: clientId, client_secret: clientSecret } });
      toast.success("Credenciais salvas");
      setClientSecret("");
      qc.invalidateQueries({ queryKey: ["bling", "status"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleConnect = async () => {
    try {
      const r = await fnStart();
      window.location.href = r.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar Bling? Será preciso autorizar novamente.")) return;
    try {
      await fnDisc();
      toast.success("Desconectado");
      qc.invalidateQueries({ queryKey: ["bling", "status"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await fnSync();
      toast.success(`Sync: ${r.imported} importadas, ${r.skipped_duplicate} repetidas, ${r.skipped_unmapped} sem mapeamento, ${r.errors} erros`);
      qc.invalidateQueries({ queryKey: ["bling", "log"] });
      qc.invalidateQueries({ queryKey: ["bling", "status"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSyncing(false);
    }
  };

  const status = statusQ.data;
  const mappings = mapsQ.data ?? [];
  const profiles = profilesQ.data ?? [];
  const logs = logQ.data ?? [];

  return (
    <AppLayout>
      <header className="mb-6 flex items-center justify-between gap-4 animate-vm-in">
        <div>
          <h1 className="text-2xl md:text-3xl text-foreground flex items-center gap-2">
            <Plug className="h-6 w-6 text-primary" /> Integrações
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Conexão com Bling (API v3).</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin"><ArrowLeft className="h-4 w-4" /> Admin</Link>
        </Button>
      </header>

      {/* Conexão */}
      <Card className="mb-6 animate-vm-in">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            Conexão Bling
            {status?.connected ? (
              <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Desconectado</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status?.has_credentials && (
            <form onSubmit={handleSaveCreds} className="space-y-3 max-w-lg">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground">Client ID</Label>
                <Input value={clientId} onChange={e => setClientId(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground">Client Secret</Label>
                <Input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} required />
              </div>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Salvar credenciais
              </Button>
              <p className="text-xs text-muted-foreground">
                Cadastre o app em developer.bling.com.br e use como redirect URI:
                <br />
                <code className="text-foreground">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/public/bling/oauth-callback` : ""}
                </code>
              </p>
            </form>
          )}

          {status?.has_credentials && !status.connected && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Credenciais salvas. Autorize o acesso ao Bling.</p>
              <div className="flex gap-2">
                <Button onClick={handleConnect} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Conectar Bling
                </Button>
                <Button variant="ghost" onClick={() => { setClientId(""); setClientSecret(""); }}>
                  Trocar credenciais
                </Button>
              </div>
            </div>
          )}

          {status?.connected && (
            <div className="space-y-2 text-sm">
              <div className="text-muted-foreground">
                Último sync: <span className="text-foreground">{status.last_synced_at ? new Date(status.last_synced_at).toLocaleString("pt-BR") : "—"}</span>
              </div>
              <div className="text-muted-foreground">
                Token expira: <span className="text-foreground">{status.expires_at ? new Date(status.expires_at).toLocaleString("pt-BR") : "—"}</span>
              </div>
              <div className="text-muted-foreground">
                Vendedores mapeados: <span className="text-foreground">{status.mapped_sellers_count}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSync} disabled={syncing} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Sincronizando..." : "Sincronizar agora"}
                </Button>
                <Button variant="ghost" onClick={handleDisconnect}>Desconectar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mapeamento */}
      <Card className="mb-6 animate-vm-in">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Mapeamento de vendedores (ID do vendedor no Bling)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Vendedor</TableHead>
                <TableHead>ID no Bling</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map(p => {
                const m = mappings.find(mm => mm.user_id === p.id);
                return (
                  <MappingRow
                    key={p.id}
                    userId={p.id}
                    name={p.full_name ?? p.id.slice(0, 8)}
                    existing={m}
                    onSave={async (v) => {
                      try {
                        await fnUpsertMap({ data: { user_id: p.id, erp_seller_id: v } });
                        toast.success("Mapeamento salvo");
                        qc.invalidateQueries({ queryKey: ["bling", "mappings"] });
                        qc.invalidateQueries({ queryKey: ["bling", "status"] });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Erro");
                      }
                    }}
                    onDelete={async (id) => {
                      try {
                        await fnDelMap({ data: { id } });
                        toast.success("Removido");
                        qc.invalidateQueries({ queryKey: ["bling", "mappings"] });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Erro");
                      }
                    }}
                  />
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card className="animate-vm-in">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Histórico de importação (últimos 50)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Sem eventos ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Quando</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(l => (
                  <TableRow key={l.id} className="border-border">
                    <TableCell className="text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-foreground">{l.erp_order_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        l.status === "ok" ? "border-emerald-500/40 text-emerald-400"
                          : l.status === "unmapped" ? "border-amber-500/40 text-amber-400"
                          : "border-destructive/40 text-destructive"
                      }>
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{l.error ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function MappingRow({
  userId, name, existing, onSave, onDelete,
}: {
  userId: string;
  name: string;
  existing: { id: string; erp_seller_id: string } | undefined;
  onSave: (v: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const [val, setVal] = useState(existing?.erp_seller_id ?? "");
  useEffect(() => { setVal(existing?.erp_seller_id ?? ""); }, [existing?.erp_seller_id]);
  const changed = val !== (existing?.erp_seller_id ?? "");

  return (
    <TableRow className="border-border">
      <TableCell className="text-foreground">{name}</TableCell>
      <TableCell>
        <Input
          inputMode="numeric"
          placeholder="ex: 12345678"
          value={val}
          onChange={e => setVal(e.target.value.trim())}
          className="max-w-[200px]"
        />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button size="sm" disabled={!val || !changed} onClick={() => onSave(val)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Salvar
          </Button>
          {existing && (
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(existing.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// silence unused var
void userId;
