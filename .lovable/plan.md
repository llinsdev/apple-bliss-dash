## Reformulação — Bling API v3 (polling OAuth)

A Parte 1 (índices + admin client-side + constantes de categoria) **já foi implementada** no turno anterior. Plano abaixo substitui apenas a Parte 2.

### Por que mudou
Bling API v3 = OAuth 2.0. Não é webhook. Vamos:
1. Guardar `access_token` + `refresh_token` em uma tabela (refresh a cada ~6h)
2. Cron `pg_cron` a cada 5 min chama nosso endpoint
3. Endpoint consulta `/Api/v3/pedidos/vendas` filtrando por `dataAlteracaoInicial` (último sync) e `idsSituacoes` = atendido/finalizado
4. Para cada pedido novo → mapeia vendedor (id Bling) → insere em `sales`

---

### A. Migrations

**`bling_oauth` (singleton — 1 linha)**
- `id` (sempre `'default'`, PK)
- `client_id text`, `client_secret text` (admin cola na UI; ficam em DB com RLS só admin)
- `access_token text`, `refresh_token text`, `expires_at timestamptz`
- `last_synced_at timestamptz` (data do pedido mais recente já importado)
- RLS: somente admin

**Estender `seller_erp_map`**
Já criado. Vai armazenar `erp_seller_id = <id numérico do vendedor no Bling>`.

**`sales_ingest_log`**
Já criado. Idempotência por `erp_order_id` (id do pedido Bling).

---

### B. Secret
- `BLING_CRON_TOKEN` — token aleatório que o endpoint exige no header `apikey` para evitar abuso (não usamos client_secret pra isso porque o endpoint é público).

> Não precisamos mais do `BLING_WEBHOOK_SECRET`. O `client_id`/`client_secret` ficam na tabela `bling_oauth` (admin cola na UI; lidos só pelo server).

---

### C. OAuth bootstrap (uma única vez)
Bling API v3 usa Authorization Code Flow:
1. Admin abre `/admin/integracoes` → clica "Conectar Bling"
2. Redireciona para `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=...&state=...`
3. Bling redireciona de volta para `/api/public/bling/oauth-callback?code=...&state=...`
4. Server route troca `code` por `access_token` + `refresh_token`, salva em `bling_oauth`

Detalhes técnicos:
- `state` armazenado em cookie HMAC-assinado (não em sessão de DB), validado no callback
- Header Auth na troca: `Basic base64(client_id:client_secret)`
- `redirect_uri` cadastrada no painel Bling: `https://project--18116462-0346-45e4-ad9f-c9c3691c02ba.lovable.app/api/public/bling/oauth-callback`

---

### D. Server functions / routes

**`src/lib/bling.server.ts`** (server-only):
- `getValidToken()` — lê `bling_oauth`; se `expires_at < now() + 5min` faz refresh via `/oauth/token` (`grant_type=refresh_token`) e atualiza row
- `fetchSalesSince(date)` — chama `GET /Api/v3/pedidos/vendas?dataAlteracaoInicial=...&idsSituacoes[]=9` (9 = atendido) com paginação `pagina`, `limite=100`
- `mapAndInsertSale(pedido)` — busca `seller_erp_map` por `erp_seller_id = pedido.vendedor.id`; categoriza produto; insere em `sales` via `supabaseAdmin`; grava `sales_ingest_log`

**`src/lib/bling-config.functions.ts`** (server fns chamadas pela UI admin):
- `saveBlingCredentials({ client_id, client_secret })`
- `getBlingStatus()` → `{ connected, last_synced_at, expires_at, mapped_sellers_count }`
- `disconnectBling()`
- `triggerSyncNow()` — força execução do polling fora do cron
- Todas protegidas por `requireSupabaseAuth` + check de `has_role admin`

**`src/routes/api/public/bling/oauth-callback.ts`** — server route:
- Valida `state`, troca `code` por tokens, salva, redireciona para `/admin/integracoes?ok=1`

**`src/routes/api/public/bling/sync.ts`** — server route (chamado pelo cron):
- Verifica header `apikey` contra `BLING_CRON_TOKEN`
- Chama `fetchSalesSince(last_synced_at)` paginando
- Para cada pedido novo, `mapAndInsertSale`
- Atualiza `last_synced_at`
- Retorna `{ imported, skipped_unmapped, errors }`

---

### E. pg_cron job
A cada 5 min chama `/api/public/bling/sync` com `apikey: BLING_CRON_TOKEN`. Pattern padrão `*/5 * * * *`.

---

### F. UI — `/admin/integracoes`
Nova sub-página (link no header do Admin). Conteúdo:

1. **Card "Conexão Bling"**
   - Se `!connected`: form para colar `client_id` + `client_secret` → botão "Salvar e conectar" → abre OAuth do Bling
   - Se `connected`: badge verde + último sync + botões "Sincronizar agora" / "Desconectar"

2. **Card "Mapeamento de vendedores"**
   - Tabela com vendedores do app
   - Para cada um: input numérico `ID do vendedor no Bling` + salvar
   - Avisa quando um pedido cai em `unmapped_seller`

3. **Card "Histórico de importação"** (`sales_ingest_log`)
   - Últimos 50 eventos com status (ok / unmapped_seller / error)
   - Filtro por status
   - Erros expansíveis (mostra `error` + trecho do `payload`)

---

### G. Categorização Aparelho/Acessório
Regra simples no `mapAndInsertSale`:
- Se nome do produto contém qualquer palavra de uma lista (`celular`, `smartphone`, `iphone`, `aparelho`, `motorola`, `samsung`, `xiaomi`, modelos…) → `CATEGORIA_APARELHO`
- Senão → `CATEGORIA_ACESSORIO`
- Lista de palavras fica em `src/lib/category-rules.ts` (frontend-safe constants) → fácil de editar depois sem mexer em server

---

### Ordem de execução
1. Migration `bling_oauth` (+ confirmar `seller_erp_map` e `sales_ingest_log` existentes)
2. Pedir secret `BLING_CRON_TOKEN`
3. `bling.server.ts` + server fns admin
4. Route OAuth callback
5. Route sync + agendar pg_cron
6. UI `/admin/integracoes`
7. Você cadastra app no Bling, cola credentials, conecta, mapeia vendedores
8. Aguardar primeiro ciclo de 5 min e validar `sales_ingest_log`

### O que você precisa preparar fora do app
- Criar app Bling em https://developer.bling.com.br → pegar `client_id` + `client_secret`
- Cadastrar a redirect URI: `https://project--18116462-0346-45e4-ad9f-c9c3691c02ba.lovable.app/api/public/bling/oauth-callback`
- Anotar o id Bling de cada vendedor (vamos preencher na tela de mapeamento)
