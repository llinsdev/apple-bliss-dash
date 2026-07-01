# Gerenciamento global por mês

## Fonte única de verdade

Criar `src/lib/selected-month.tsx` com:

- `SelectedMonthProvider` (Context) que expõe `{ year, month, setMonth, next, prev, startDate, endDateExcl, label }`.
- Estado inicial = mês atual (`new Date()`).
- Persistir em `sessionStorage` (chave `vm.selectedMonth`) para sobreviver a navegações internas — não altera banco.
- Hook `useSelectedMonth()`.

O provider é montado uma única vez em `src/routes/_authenticated.tsx`, envolvendo o `<Outlet />`. Assim Dashboard, Metas, Admin e Lançamentos compartilham o mesmo estado sem prop-drilling.

## Seletor visual

Novo componente `src/components/month-selector.tsx` — apenas botões `‹  Junho 2026  ›` usando `Button` (variant `ghost`/`outline`) já existentes. Sem novas cores, sem nova tipografia.

Inserido no topo de:
- `dashboard.tsx` (logo abaixo do `<header>`)
- `metas.tsx` (logo abaixo do `<header>`)

Não aparece em `lancamentos.tsx` (a tela lista o histórico completo, comportamento atual) nem em `admin.tsx` (CRUD de metas — filtros existentes preservados).

## Alterações por arquivo (mínimas)

### `src/routes/_authenticated.tsx`
Envolver `<Outlet />` com `<SelectedMonthProvider>`.

### `src/routes/_authenticated/dashboard.tsx`
- Renderizar `<MonthSelector />` no topo.
- Substituir o cálculo "hoje" pelo **último dia do mês selecionado se o mês selecionado ≠ mês atual, senão hoje** (`refDate`). Isso preserva o comportamento atual quando o usuário está no mês corrente.
- `activeGoal(type)` passa a considerar metas cujo período intercepta `[startDate, endDateExcl)` em vez de conter `today`.
- Meta diária: usa `refDate` (último dia do mês selecionado ou hoje).
- Meta mensal: usa `[startDate, endDateExcl)` do mês selecionado quando não houver meta mensal cadastrada.
- Meta semanal + filtro Semana 1–4: continua usando `week_number`, mas restrito às metas semanais cujo `period_start` cai dentro do mês selecionado.
- Comissões, gráfico "Vendas no período" e demais totais filtram vendas por `[startDate, endDateExcl)` quando nenhuma semana estiver selecionada.

### `src/routes/_authenticated/metas.tsx`
- Renderizar `<MonthSelector />` no topo.
- Usar `[startDate, endDateExcl)` do mês selecionado para totalMes/acessórios quando não houver meta cadastrada para aquele mês.
- `activeGoal` passa a buscar metas cujo período intercepta o mês selecionado.
- Se `goals.filter(mês selecionado).length === 0`, mostrar aviso "Nenhuma meta cadastrada para este mês." (mantém o card padrão sem quebrar).

### `src/routes/_authenticated/admin.tsx`
- No `GoalDialog`, quando `editing == null`, pré-preencher `period_start`/`period_end` com o primeiro/último dia do mês selecionado (via `useSelectedMonth()`). Admin ainda pode alterar as datas.
- Nenhuma outra mudança — CRUD e "Vendas (mês)" continuam usando mês corrente do calendário (comportamento admin atual).

## Migração de banco

**Nenhuma migration necessária.**
As metas já possuem `period_start`/`period_end` e `week_number`. O mês de referência é derivado de `period_start` no cliente (`getFullYear`/`getMonth`), então metas antigas continuam funcionando automaticamente.

## Filtros preservados

O filtro de semana e o seletor de vendedor no Dashboard Admin permanecem em `useState` local dentro do `AdminSellerSwitcher`. Ao trocar o mês, esses estados **não são resetados** — apenas o mês muda; se a semana selecionada não existir no novo mês, o card mostra "Sem período cadastrado" (comportamento atual quando não há meta).

## Regras respeitadas

- Sem alterações visuais além do seletor.
- Sem alteração de RLS, schema, triggers, tipos gerados, cores, tipografia.
- Sem alteração em `use-sales.ts`, `use-goals.ts`, `mock-data.ts`, `lancamentos.tsx`.
- Trocar mês só altera período de consulta em memória; nenhum write no banco.

## Detalhes técnicos

```ts
// selected-month.tsx (essência)
const [{ y, m }, set] = useState(() => {
  const s = sessionStorage.getItem("vm.selectedMonth");
  if (s) { const [y, m] = s.split("-").map(Number); return { y, m }; }
  const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() };
});
const startDate = new Date(y, m, 1);
const endDateExcl = new Date(y, m + 1, 1);
const label = startDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
```

Regra de "meta pertence ao mês selecionado":
```ts
const goalInMonth = (g: Goal) => {
  const ps = parseSaleDate(g.period_start);
  return ps >= startDate && ps < endDateExcl;
};
```
