## Objetivo
Mostrar no Dashboard, apenas para ADMIN, uma seção com cards lado a lado de cada vendedor (nome, total vendido no mês, comissão total, metas atingidas), atualizando em tempo real via Supabase Realtime. Vendedor comum continua vendo apenas o próprio dashboard atual.

## Componentes alterados
- `src/routes/_authenticated/dashboard.tsx` — única alteração de UI. Adicionar, condicionalmente quando `useIsAdmin()` for `true`, uma nova `<section>` no topo (ou final) com grid de cards `SellerCard` reaproveitando `Card`/`CardHeader`/`CardContent` e `Progress` já existentes. Não muda layout do dashboard pessoal — apenas anexa um bloco extra para admin.

## Dados
- Reutilizar hooks existentes:
  - `useSales()` — já retorna **todas** as vendas (RLS já permite admin ler tudo).
  - `useAllGoals()` (de `src/hooks/use-goals.ts`, já usado em `/admin`).
  - Query nova mínima inline: `profiles (id, full_name)` — mesma usada na página admin.
- Agregar no client (em `useMemo`): agrupar `sales` por `seller_id` no mês corrente → total vendido, comissão total, e contagem de metas atingidas (comparando soma do vendedor no período da meta com `target_value`).
- Nada de queries novas pesadas — todos os dados já estão (ou podem ser) carregados via React Query com cache.

## Tempo real
- Já existe `useSales` com React Query. Adicionar um `useEffect` (dentro do bloco admin) que assina o canal Supabase Realtime na tabela `sales` e invalida a query `["sales"]`:
  ```ts
  supabase.channel('sales-admin')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' },
        () => qc.invalidateQueries({ queryKey: ['sales'] }))
    .subscribe()
  ```
- Requer migration única: `ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;` (e `REPLICA IDENTITY FULL` para garantir payload completo, embora não seja usado aqui).
- Sem polling. Sem novos componentes pesados.

## Segurança
- Bloco só renderiza se `useIsAdmin()` retornar true. RLS de `sales` já permite admin ler tudo (`has_role(auth.uid(),'admin')`), então vendedor comum nem recebe os dados extras.

## Solução mais simples
1. Migration: habilitar realtime na tabela `sales`.
2. Editar `dashboard.tsx`: adicionar `useIsAdmin`, `useAllGoals`, query de profiles, efeito de realtime, e uma seção `{isAdmin && <AdminSellersPanel />}` com grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` de cards mínimos.

Sem novos arquivos, sem refator, sem mudança visual no resto da página.
