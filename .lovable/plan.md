## Correção do Dashboard ADMIN — mesmo visual do vendedor, lado a lado

### O que muda
Apenas `src/routes/_authenticated/dashboard.tsx`. Sem migrations, sem novos componentes de UI, sem novos hooks, sem alterar sidebar/tema.

### Componentes reutilizados (já existem no arquivo)
- `KpiCard` (Meta Diária / Semanal / Mensal)
- `MiniStat` (comissões aparelhos/acessórios)
- Card de "Comissões Acumuladas" + `PieChart` de categorias
- `LineChart` de "Vendas no período" com seletor Hoje/7/30
- Hooks já em uso: `useSales`, `useAllGoals`, `useIsAdmin`, `supabase` realtime

### Refatoração mínima (sem duplicar lógica)
1. Extrair o conteúdo atual do `Dashboard` (KPIs + comissões + pie + line) em um componente local `SellerDashboardView({ sellerId, sellerName, sales, goals })` dentro do mesmo arquivo.
   - Toda a lógica de `totalDia/Semana/Mes`, `goalFor`, `lineData`, `pieData` passa a viver dentro dele, parametrizada por `sellerId`.
2. O `Dashboard` (vendedor) passa a renderizar `<SellerDashboardView sellerId={user.id} sellerName="Meu painel" sales={allVendas} goals={myGoals} />` — mesmo visual de hoje, zero mudança perceptível.
3. Para o admin, substituir o atual `AdminSellersPanel` (cards resumidos) por um grid `grid-cols-1 xl:grid-cols-2` que renderiza um `SellerDashboardView` por vendedor, lado a lado.

### Como separar Mariano × Dominique e excluir Leandro
- Buscar perfis + roles via Supabase: `profiles` join lógico com `user_roles` (query separada de `user_roles` já cacheada).
- Filtro: incluir apenas perfis cujo `user_id` **não** tenha role `admin`. Isso exclui Leandro automaticamente (sem hard-code de nome), garantindo robustez se houver troca de admin.
- Ordenar alfabeticamente para layout estável (Dominique, Mariano).
- Cada vendedor recebe seu subconjunto de `sales` (filtrado por `seller_id`) e `goals` (filtrado por `user_id`) — uma única query global de `sales`/`goals`, sem N+1.

### Tempo real
Mantém o `supabase.channel("sales-admin-dashboard")` já implementado, com `invalidateQueries(['sales'])`. Como cada `SellerDashboardView` deriva de `allVendas` via `useMemo`, todos atualizam automaticamente em nova venda.

### Modo admin vs vendedor (mesma rota)
```
if (isAdmin) {
  // header + grid xl:grid-cols-2 de SellerDashboardView (Mariano, Dominique)
} else {
  // header + <SellerDashboardView sellerId={user.id} ... />  (igual ao atual)
}
```

### Performance
- 1 query `sales` (já existe) + 1 `goals` (já existe) + 1 `profiles` + 1 `user_roles` — todas cacheadas pelo React Query.
- Nenhum gráfico novo. Recharts reutilizado. Realtime único (canal compartilhado).
- Sem novos arquivos.

### Fora de escopo
Sidebar, tema, identidade visual, novos componentes, migrations.
