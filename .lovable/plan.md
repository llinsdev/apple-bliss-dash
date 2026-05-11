## Parte 1 — Fechar os IMPORTANTES da auditoria

### 1. Índice em `sales(seller_id, sale_date DESC)`
Migration simples para acelerar consultas do dashboard e da página `/lancamentos` à medida que o volume crescer.

### 2. Mover checagem de admin do `beforeLoad` SSR para client
Hoje `src/routes/_authenticated/admin.tsx` faz query no Supabase dentro do `beforeLoad`, que roda durante SSR sem sessão hidratada → risco de redirect indevido / flicker. Trocar por:
- `beforeLoad` apenas garante usuário logado (já coberto pelo layout `_authenticated`)
- Dentro do componente `Admin`, usar `useIsAdmin()` + redirect client-side para `/dashboard` se `false`

### 3. Constantes de categoria
Criar em `src/lib/mock-data.ts`:
```ts
export const CATEGORIA_APARELHO = "Aparelho";
export const CATEGORIA_ACESSORIO = "Acessório";
```
E substituir as strings literais em `lancamentos.tsx`, `dashboard.tsx`, `admin.tsx`, hooks de metas.

---

## Parte 2 — Integração ERP Bling (webhook em tempo real)

### Arquitetura

```
Bling (venda criada) ──webhook──▶ /api/public/bling/webhook
                                       │
                                       ├─ valida assinatura HMAC
                                       ├─ mapeia vendedor pelo email/id do ERP
                                       └─ INSERT em sales (supabaseAdmin)
```

### Passos

**A. Tabela de mapeamento vendedor ERP → app**
Migration nova `seller_erp_map`:
- `user_id uuid` (FK lógica para profiles)
- `erp_seller_id text` (id ou email do vendedor no Bling)
- `erp_source text default 'bling'`
- UNIQUE (`erp_source`, `erp_seller_id`)
- RLS: admin total, vendedor lê o próprio

**B. Tabela de auditoria `sales_ingest_log`**
Para idempotência e debug:
- `erp_order_id text UNIQUE` (evita inserção duplicada se Bling reentregar)
- `payload jsonb`
- `status text` (`ok` | `unmapped_seller` | `error`)
- `error text`
- `sale_id uuid` (quando criou venda)
- RLS: só admin

**C. Secret**
- `BLING_WEBHOOK_SECRET` — chave HMAC que vamos configurar no painel do Bling

**D. Endpoint público**
`src/routes/api/public/bling/webhook.ts` (TanStack server route):
1. Lê body raw + header de assinatura do Bling
2. Verifica HMAC com `timingSafeEqual` — 401 se inválido
3. Faz `JSON.parse`; valida com Zod (`numero`, `total`, `vendedor.email`, `itens[]`, etc.)
4. Checa `sales_ingest_log` por `erp_order_id` — se já existe, retorna 200 (idempotente)
5. Busca `user_id` em `seller_erp_map` pelo email/id
   - Se não achar: grava log `unmapped_seller` e retorna 200 (não trava o ERP)
6. Calcula comissão (% padrão configurável; usar coluna existente)
7. Insere em `sales` via `supabaseAdmin` (bypassa RLS)
8. Grava log `ok` com `sale_id`

**E. UI Admin → aba "Integrações"**
Nova aba/subpágina em `/admin`:
- Card "Bling": URL do webhook a copiar (`https://project--<id>.lovable.app/api/public/bling/webhook`) + status do secret
- CRUD de `seller_erp_map`: select de vendedor (profiles) + input email Bling
- Tabela `sales_ingest_log` com últimos 50 eventos, filtro por status, botão "Reprocessar" para `unmapped_seller`

**F. Documentação inline**
Bloco de instruções na aba Integrações: passo a passo no painel Bling (Configurações → Integrações → Webhooks → evento "Pedido de venda" → URL + secret).

### Detalhes técnicos

- Bling envia POST JSON; verificar formato exato na doc oficial (campo `data` aninhado em alguns eventos)
- Assinatura: Bling usa header customizado; confirmar no momento da implementação e ajustar
- Endpoint é `/api/public/*` → não passa por auth do app (correto para webhook)
- Toda escrita usa `supabaseAdmin` apenas DENTRO do handler após validar assinatura
- Mapeamento por email é mais robusto (id do vendedor pode mudar entre versões)
- Mapeamento de categoria do produto (Aparelho/Acessório): aba Integrações terá regra simples por palavra-chave no nome do produto, com fallback para "Acessório"

### Pré-requisitos para a fase 2
1. Você adicionar o secret `BLING_WEBHOOK_SECRET` quando solicitado
2. Após publicar, configurar no painel Bling a URL + secret
3. Cadastrar pelo menos 1 vendedor em `seller_erp_map` para o primeiro teste

---

## Ordem de execução sugerida

**Agora (Parte 1):** itens 1, 2, 3 — pequenos, ~10 min
**Em seguida (Parte 2):** migrations A+B → secret → endpoint → UI Integrações → teste com payload de exemplo do Bling
