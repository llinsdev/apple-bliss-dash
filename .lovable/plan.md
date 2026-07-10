## Bug: Meta Semanal não recalcula ao trocar de semana

### Escopo
Somente `src/routes/_authenticated/dashboard.tsx` (bloco semanal do `SellerDashboardView` + seletor em `AdminSellerSwitcher`). Sem mexer em RLS, hooks, `useSelectedMonth`, Metas/Lançamentos/Admin, tokens de tema ou layout.

### Diagnóstico
Confirmei no banco que `goals.week_number` é **number 1..4** e cada semana tem `period_start`/`period_end` distintos (ex.: Julho/2026 → S1 01–08, S2 10–16, S3 17–23, S4 24–31). Portanto o filtro `g.week_number === selectedWeek` é compatível com o DB.

Pontos frágeis no código atual que explicam o sintoma relatado (card fica em 01/07–08/07 mesmo após clicar Semana 2):

1. **Remontagem via `key`**: `SellerDashboardView` é remontado com `key={activeId}-${selectedWeek ?? "all"}`. Isso é usado como “atalho” para resetar estado interno, mas mascara stale-closures de `useMemo` e dificulta debug. Manter, mas não confiar nele para correção lógica.
2. **`selectedWeek` sem coerção**: hoje os botões passam `number` literal — OK, mas qualquer alteração futura (ex.: `value` de `<select>`) quebraria silenciosamente. Coerção explícita `Number(w)` na origem previne regressão.
3. **Faltam dependências explícitas no cálculo semanal**: `goalSemanal`, `semanaFrom`, `semanaToExcl`, `totalSemana`, `semanaLabel` são calculados em variáveis soltas dentro do componente (não em `useMemo`). Funciona por render, mas se o filtro `goalInMonth` retornar `undefined` a UI mantém o último `semanaLabel` porque nada obriga fallback visual. Precisamos garantir fallback determinístico.
4. **Ausência de fallback claro para “sem meta na semana”**: quando `goalSemanal` é `undefined`, `semanaLabel` fica `null` → renderiza "Sem período cadastrado". Trocar por texto explícito por semana selecionada (“Semana N — sem meta cadastrada”) para eliminar ambiguidade visual reportada.

### Correção (mínima, cirúrgica)

Editar apenas `src/routes/_authenticated/dashboard.tsx`:

**A. Seletor de semanas (`AdminSellerSwitcher`)**
- Trocar `onClick={() => setSelectedWeek(w)}` por `onClick={() => setSelectedWeek(Number(w))}` (defensivo).
- Manter o `key` de remontagem como está.

**B. Cálculo semanal (`SellerDashboardView`)**
Envolver o bloco semanal em um `useMemo` único que retorna `{ goalSemanal, semanaFrom, semanaToExcl, totalSemana, semanaLabel, targetSemanal }`, com dependências:
`[goals, selectedWeek, monthStart.getTime(), monthEnd.getTime(), refDate.getTime(), vendas]`.

Lógica interna:
```
if (selectedWeek != null) {
  goalSemanal = goals.find(g =>
    g.target_type === 'semanal' &&
    g.category_focus === 'total' &&
    Number(g.week_number) === Number(selectedWeek) &&
    goalInMonth(g)
  );
} else {
  goalSemanal = activeGoal('semanal'); // período contém refDate
}

if (goalSemanal) {
  semanaFrom = parseSaleDate(goalSemanal.period_start);
  semanaToExcl = addDays(parseSaleDate(goalSemanal.period_end), 1);
  totalSemana = sumInRange(semanaFrom, semanaToExcl);
  semanaLabel = `${fmtBR(semanaFrom)} – ${fmtBR(parseSaleDate(goalSemanal.period_end))}`;
  targetSemanal = goalSemanal.target_value;
} else {
  semanaFrom = null; semanaToExcl = null;
  totalSemana = 0;
  semanaLabel = selectedWeek != null
    ? `Semana ${selectedWeek} — sem meta cadastrada`
    : 'Sem período cadastrado';
  targetSemanal = defaultTarget('semanal');
}
```

Isto garante:
- Recomputação real ao trocar `selectedWeek` (dependência explícita).
- Fallback claro quando a semana não tem meta (zera valor e mostra rótulo por semana).
- Nenhum vazamento do label da semana anterior.

**C. Escopo do gráfico/comissões**
Já usa `semanaFrom`/`semanaToExcl` quando `selectedWeek != null`. Continua igual (agora consumindo o valor derivado do `useMemo`).

### Fora do escopo
- Não introduzir seletor de semana para vendedor comum (apenas admin, como hoje).
- Não alterar `useSelectedMonth`, hooks de dados, RLS, cores, fontes ou layout.
- Não trocar `commission_value` nem regra de comissão.

### Verificação manual (após implementação)
1. Julho/2026, seller com metas 1–4: clicar S1 → 01/07–08/07 e soma coerente.
2. Clicar S2 → muda para 10/07–16/07, valores recalculam (ou zeram se sem vendas).
3. Apagar meta S3 e clicar S3 → card mostra “Semana 3 — sem meta cadastrada”, R$ 0,00, 0%.
4. Voltar a “Todas” → volta à lógica de semana que contém `refDate`.
5. Metas mensais e diária não mudam ao alternar semanas.
6. Identidade visual preservada (dark, Inter, vermelho #fd0241).

### Arquivos alterados
- `src/routes/_authenticated/dashboard.tsx` (único)
