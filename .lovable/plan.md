## Bug encontrado
Campo `sale_date` é `DATE` (ex.: `"2026-06-02"`). `new Date("2026-06-02")` é parseado como UTC 00:00, que no Brasil (UTC−3) vira 01/06 21:00 local. Por isso:
- Meta **diária** não conta a venda de hoje (cai em "ontem").
- Meta **mensal** subconta vendas do dia 1.
- Meta **semanal** parece OK porque a janela de 7 dias absorve o desvio.
- Marco "Primeira venda do mês" em `metas.tsx` falha pelo mesmo motivo.
- Gráfico diário do dashboard também desloca valores.

## Atualização em tempo real
Já está coberta:
- Mutations (`useCreateSale`, `useCreateOrderSale`, `useDeleteSale`, `useUpsertGoal`, `useDeleteGoal`) invalidam `["sales"]` / `["goals"]` → dashboard e tela Metas atualizam na hora para quem lançou.
- Polling de 30 s em `dashboard.tsx` cobre cross-session sem expor realtime de outros vendedores (decisão de segurança anterior).

Não é necessário mexer em Supabase/RLS.

## Auditoria rápida
- Comissão: calculada no trigger do banco (`set_commission_value`), OK.
- Filtro por vendedor: `vendas.filter(seller_id === sellerId)`, OK.
- Permissões: RLS já corrigida (admin-only UPDATE em sales).
- Sem NaN/loops detectados; cards usam fallback `METAS_DEFAULT`.

Único bug funcional crítico = parsing de data.

## Alterações
1. `src/lib/mock-data.ts` — adicionar helper:
   ```ts
   export const parseSaleDate = (s: string) => new Date(`${s}T00:00:00`);
   ```
2. `src/routes/_authenticated/dashboard.tsx` — em `SellerDashboardView`, trocar todos os `new Date(v.sale_date)` por `parseSaleDate(v.sale_date)` (função `totalIn` e `lineData`).
3. `src/routes/_authenticated/metas.tsx` — usar `parseSaleDate` no filtro `doMes`.
4. `src/routes/_authenticated/lancamentos.tsx` — usar `parseSaleDate` na coluna Data para exibir o dia correto.

## Fora do escopo
- Design, dark mode, componentes, layout, sidebar.
- Realtime via canal Supabase (mantém polling 30 s).
- Schema, RLS, triggers.

## Validação
Após o patch:
- Lançar venda hoje → Meta Diária, Semanal e Mensal aumentam imediatamente.
- Marco "Primeira venda do mês" marca como concluído.
- Tela Metas reflete novos valores na hora.
- Comissão e filtro por vendedor inalterados.
