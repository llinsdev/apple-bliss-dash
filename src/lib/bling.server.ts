// Server-only helpers for Bling API v3 integration.
// Do NOT import this file from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { categorizeProductName } from "./category-rules";

const BLING_AUTH_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";
const BLING_TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";
const BLING_API_URL = "https://api.bling.com.br/Api/v3";

// Situação 9 = "Atendido" no Bling (pedido finalizado).
const SITUACAO_ATENDIDO = 9;

export interface BlingOAuthRow {
  id: string;
  client_id: string | null;
  client_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  last_synced_at: string | null;
}

export async function getOAuthRow(): Promise<BlingOAuthRow> {
  const { data, error } = await supabaseAdmin
    .from("bling_oauth")
    .select("*")
    .eq("id", "default")
    .single();
  if (error) throw error;
  return data as unknown as BlingOAuthRow;
}

export function buildAuthorizeUrl(clientId: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    state,
  });
  return `${BLING_AUTH_URL}?${params.toString()}`;
}

function basicAuth(clientId: string, clientSecret: string): string {
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
}

export async function exchangeCodeForToken(code: string): Promise<void> {
  const row = await getOAuthRow();
  if (!row.client_id || !row.client_secret) {
    throw new Error("client_id/client_secret não configurados");
  }
  const res = await fetch(BLING_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "Authorization": basicAuth(row.client_id, row.client_secret),
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code }).toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Bling token exchange falhou (${res.status}): ${txt}`);
  }
  const json = (await res.json()) as TokenResponse;
  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();
  const { error } = await supabaseAdmin
    .from("bling_oauth")
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default");
  if (error) throw error;
}

async function refreshToken(row: BlingOAuthRow): Promise<string> {
  if (!row.client_id || !row.client_secret || !row.refresh_token) {
    throw new Error("Credenciais Bling incompletas — reconecte.");
  }
  const res = await fetch(BLING_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "Authorization": basicAuth(row.client_id, row.client_secret),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }).toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Bling refresh falhou (${res.status}): ${txt}`);
  }
  const json = (await res.json()) as TokenResponse;
  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();
  await supabaseAdmin
    .from("bling_oauth")
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default");
  return json.access_token;
}

export async function getValidToken(): Promise<string> {
  const row = await getOAuthRow();
  if (!row.access_token) throw new Error("Bling não conectado.");
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  // Renova 5 min antes do vencimento.
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    return refreshToken(row);
  }
  return row.access_token;
}

interface BlingPedidoResumo {
  id: number;
  numero?: number;
  data?: string;
}

export async function listPedidosSince(
  token: string,
  sinceISO: string,
  page: number,
): Promise<BlingPedidoResumo[]> {
  const dataInicial = sinceISO.slice(0, 10); // YYYY-MM-DD
  const params = new URLSearchParams({
    pagina: String(page),
    limite: "100",
    dataAlteracaoInicial: dataInicial,
  });
  params.append("idsSituacoes[]", String(SITUACAO_ATENDIDO));
  const res = await fetch(`${BLING_API_URL}/pedidos/vendas?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Bling list falhou (${res.status}): ${txt}`);
  }
  const json = await res.json() as { data?: BlingPedidoResumo[] };
  return json.data ?? [];
}

interface BlingPedidoDetalhe {
  id: number;
  numero?: number;
  data?: string;
  total?: number;
  vendedor?: { id: number } | null;
  itens?: Array<{ descricao?: string; valor?: number; quantidade?: number }>;
}

export async function getPedido(token: string, id: number): Promise<BlingPedidoDetalhe> {
  const res = await fetch(`${BLING_API_URL}/pedidos/vendas/${id}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Bling get pedido ${id} falhou (${res.status}): ${txt}`);
  }
  const json = await res.json() as { data?: BlingPedidoDetalhe };
  if (!json.data) throw new Error(`Pedido ${id} sem data`);
  return json.data;
}

interface IngestResult {
  imported: number;
  skipped_duplicate: number;
  skipped_unmapped: number;
  errors: number;
}

const DEFAULT_COMMISSION_APARELHO = 3;
const DEFAULT_COMMISSION_ACESSORIO = 10;

export async function ingestPedido(pedido: BlingPedidoDetalhe): Promise<"imported" | "duplicate" | "unmapped" | "error"> {
  const erpOrderId = String(pedido.id);

  // Idempotência: já existe log para este pedido?
  const { data: existing } = await supabaseAdmin
    .from("sales_ingest_log")
    .select("id, status")
    .eq("erp_source", "bling")
    .eq("erp_order_id", erpOrderId)
    .maybeSingle();
  if (existing && existing.status === "ok") return "duplicate";

  const erpSellerId = pedido.vendedor?.id ? String(pedido.vendedor.id) : null;

  if (!erpSellerId) {
    await supabaseAdmin.from("sales_ingest_log").upsert(
      {
        erp_source: "bling",
        erp_order_id: erpOrderId,
        status: "unmapped",
        error: "Pedido sem vendedor",
        payload: pedido as unknown as Record<string, unknown>,
      },
      { onConflict: "erp_source,erp_order_id" }
    );
    return "unmapped";
  }

  const { data: mapping } = await supabaseAdmin
    .from("seller_erp_map")
    .select("user_id")
    .eq("erp_source", "bling")
    .eq("erp_seller_id", erpSellerId)
    .maybeSingle();

  if (!mapping) {
    await supabaseAdmin.from("sales_ingest_log").upsert(
      {
        erp_source: "bling",
        erp_order_id: erpOrderId,
        status: "unmapped",
        error: `Vendedor Bling ${erpSellerId} não mapeado`,
        payload: pedido as unknown as Record<string, unknown>,
      },
      { onConflict: "erp_source,erp_order_id" }
    );
    return "unmapped";
  }

  // Cria uma venda por item do pedido. Se não houver itens, cria 1 venda com total.
  const itens = pedido.itens && pedido.itens.length > 0
    ? pedido.itens
    : [{ descricao: `Pedido ${pedido.numero ?? pedido.id}`, valor: pedido.total ?? 0, quantidade: 1 }];

  try {
    const inserts = itens.map((item) => {
      const valor = Number(item.valor ?? 0) * Number(item.quantidade ?? 1);
      const categoria = categorizeProductName(item.descricao);
      const pct = categoria === "Aparelho" ? DEFAULT_COMMISSION_APARELHO : DEFAULT_COMMISSION_ACESSORIO;
      return {
        seller_id: mapping.user_id,
        product_name: item.descricao ?? "Item sem nome",
        category: categoria,
        sale_value: valor,
        commission_percentage: pct,
        sale_date: pedido.data ? pedido.data.slice(0, 10) : new Date().toISOString().slice(0, 10),
      };
    });

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("sales")
      .insert(inserts)
      .select("id");
    if (insErr) throw insErr;

    await supabaseAdmin.from("sales_ingest_log").upsert(
      {
        erp_source: "bling",
        erp_order_id: erpOrderId,
        status: "ok",
        error: null,
        payload: pedido as unknown as Record<string, unknown>,
        sale_id: inserted?.[0]?.id ?? null,
      },
      { onConflict: "erp_source,erp_order_id" }
    );
    return "imported";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin.from("sales_ingest_log").upsert(
      {
        erp_source: "bling",
        erp_order_id: erpOrderId,
        status: "error",
        error: msg,
        payload: pedido as unknown as Record<string, unknown>,
      },
      { onConflict: "erp_source,erp_order_id" }
    );
    return "error";
  }
}

export async function runSync(): Promise<IngestResult> {
  const token = await getValidToken();
  const row = await getOAuthRow();
  const since = row.last_synced_at ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const result: IngestResult = { imported: 0, skipped_duplicate: 0, skipped_unmapped: 0, errors: 0 };
  let page = 1;
  let maxPedidoDate: string | null = null;

  // Limita 10 páginas por execução = 1000 pedidos. Suficiente p/ ciclo de 5min.
  while (page <= 10) {
    const resumos = await listPedidosSince(token, since, page);
    if (resumos.length === 0) break;

    for (const resumo of resumos) {
      try {
        const pedido = await getPedido(token, resumo.id);
        if (pedido.data && (!maxPedidoDate || pedido.data > maxPedidoDate)) {
          maxPedidoDate = pedido.data;
        }
        const outcome = await ingestPedido(pedido);
        if (outcome === "imported") result.imported++;
        else if (outcome === "duplicate") result.skipped_duplicate++;
        else if (outcome === "unmapped") result.skipped_unmapped++;
        else result.errors++;
      } catch (e) {
        result.errors++;
        console.error("[bling] erro pedido", resumo.id, e);
      }
    }

    if (resumos.length < 100) break;
    page++;
  }

  if (maxPedidoDate) {
    await supabaseAdmin
      .from("bling_oauth")
      .update({ last_synced_at: new Date(maxPedidoDate).toISOString(), updated_at: new Date().toISOString() })
      .eq("id", "default");
  }
  return result;
}
