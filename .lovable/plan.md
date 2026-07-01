# Auditoria — Mês Global, Semanas e Metas

> Diagnóstico apenas. Nenhuma alteração será feita sem sua aprovação.

## ✅ Correto

- **Fonte única do mês** (`src/lib/selected-month.tsx`) — contexto persistido em `sessionStorage`, com `startDate`/`endDateExcl`/`isCurrentMonth` e `useRefDate` bem definidos.
- **Provider global** montado em `_authenticated.tsx` — todas as telas autenticadas compartilham o mesmo mês.
- **Dashboard vendedor**: KPIs Diária / Semanal / Mensal usam o mês selecionado via `goalInMonth` + `refDate`.
- **Filtro de semana no Dashboard Admin**: usa `week_number` + `goalInMonth`, respeitando o período salvo na meta (nunca "últimos 7 dias" nem datas hardcoded).
- **Escopo de comissões e gráfico** no Dashboard: quando uma semana está selecionada, restringe corretamente ao período `[semanaFrom, semanaToExcl)`; caso contrário, ao mês selecionado.
- **Metas**: `activeGoal` usa a mesma regra `goalInMonth` do Dashboard; banner "Nenhuma meta cadastrada para este mês" aparece quando não há metas.
- **Persistência de filtros ao trocar mês**: `selectedId` (vendedor) e `selectedWeek` são estado local do `AdminSellerSwitcher` — não resetam quando o mês muda. `sessionStorage` mantém o mês entre navegações.
- **Cálculo de comissão**: fórmula única (`APARELHO_COMISSAO_PCT=1%`, `ACESSORIO_COMISSAO_PCT=6%`) aplicada em `use-sales.ts`; trigger recomputa `commission_value` no banco.
- **Leandro (admin)**: excluído do seletor de vendedores no Dashboard via `user_roles.role='admin'`.
- **Parsing de datas**: `parseSaleDate` uniforme em todas as telas — sem desvio UTC.

---

## ⚠️ Problemas encontrados

### 1. `Vendas (mês)` da tabela Admin ignora o mês selecionado — **Crítico**
- **Arquivo:** `src/routes/_authenticated/admin.tsx` (linhas 85-102).
- **Causa:** `startMonth`/`nextMonth` são derivados de `new Date()` (mês atual do sistema), não de `useSelectedMonth()`.
- **Impacto:** ao navegar para Junho/Maio no seletor global, a coluna "Vendas (mês)" continua mostrando os valores de **Julho**. Contradiz a promessa "todas as telas usam o mesmo período".

### 2. Gráfico "Vendas no período" com botões `Hoje / 7 / 30` usa `new Date()` — **Médio**
- **Arquivo:** `src/routes/_authenticated/dashboard.tsx` (linhas 323-334, ramo final do `lineData`).
- **Causa:** quando o mês selecionado é o **atual**, o gráfico volta a usar `new Date()` em vez de `refDate`. Se o usuário estiver no mês atual mas mudar para outro e voltar, funciona; mas se o relógio virar meia-noite durante a sessão, o gráfico e os KPIs podem divergir por um dia.
- **Impacto:** divergência sutil entre `refDate` (KPI Diária) e o gráfico em corner cases.

### 3. Query duplicada de `user_roles` — **Baixo (performance)**
- **Arquivos:** `dashboard.tsx` (`queryKey: ["admin","user_roles"]`) e `admin.tsx` (`queryKey: ["admin","roles"]`).
- **Causa:** chaves diferentes para a mesma consulta → duas requisições ao invés de uma cacheada.
- **Impacto:** requisição extra ao abrir Admin depois do Dashboard (ou vice-versa).

### 4. `useAllGoals()` é chamado para todos os usuários no Dashboard — **Baixo**
- **Arquivo:** `dashboard.tsx` linha 37.
- **Causa:** hook executado mesmo para vendedores não-admin (RLS filtra no servidor, então retorna só as metas do próprio usuário, mas ainda assim é uma consulta desnecessária além de `useMyGoals`).
- **Impacto:** requisição redundante para vendedores.

### 5. `GoalDialog` para metas **semanais** pré-preenche o mês inteiro — **Médio (UX)**
- **Arquivo:** `admin.tsx` linhas 245-253.
- **Causa:** `defaultStart`/`defaultEnd` sempre usam 1º e último dia do mês, mesmo quando `type === "semanal"`. O admin precisa lembrar de ajustar manualmente para 7 dias por semana.
- **Impacto:** metas semanais podem ser cadastradas cobrindo o mês inteiro por engano, quebrando a leitura de `[semanaFrom, semanaToExcl)`.

### 6. Fallback silencioso `METAS_DEFAULT` no Dashboard — **Baixo**
- **Arquivo:** `dashboard.tsx` linhas 220-223, 235, 262, 277.
- **Causa:** quando não existe meta para o mês, o KPI mostra `METAS_DEFAULT` sem qualquer aviso (a tela Metas mostra banner; o Dashboard não).
- **Impacto:** o vendedor pode achar que a meta cadastrada é 5.000/30.000/120.000, quando na verdade o admin ainda não cadastrou nada para o mês selecionado.

### 7. `Lançamentos` não tem seletor de mês — **Baixo (por decisão)**
- **Arquivo:** `src/routes/_authenticated/lancamentos.tsx`.
- **Causa:** a tela lista **todas** as vendas do vendedor, sem respeitar o mês global.
- **Impacto:** aparente inconsistência com Dashboard/Metas. Se for intencional (histórico completo), documentar; caso contrário, aplicar o filtro.

---

## 💡 Melhorias recomendadas

### Fazer agora (correções mínimas, sem impacto visual)
1. **Corrigir #1**: substituir `startMonth`/`nextMonth` locais em `admin.tsx` por `useSelectedMonth()`.
2. **Corrigir #2**: no ramo "mês atual" de `lineData`, usar `refDate` como âncora do dia final em vez de `new Date()`.
3. **Corrigir #3**: unificar a queryKey de `user_roles` (`["admin","user_roles"]`) nos dois arquivos.
4. **Corrigir #5**: quando `type === "semanal"` no `GoalDialog`, pré-preencher `start`/`end` como intervalo de 7 dias dentro do mês selecionado com base em `weekNumber`.

### Fazer depois
5. **#4** — remover `useAllGoals()` do Dashboard vendedor (usar apenas para o ramo admin).
6. **#6** — mostrar no Dashboard o mesmo banner de "Nenhuma meta cadastrada para este mês" que existe em Metas.
7. **#7** — decidir se `Lançamentos` filtra pelo mês global; se sim, aplicar o mesmo `MonthSelector`.

---

## Conclusão

A arquitetura do mês global e do filtro semanal está **coerente e bem centralizada**. As três telas críticas (Dashboard, Metas, Admin) compartilham `parseSaleDate`, `useSelectedMonth` e a regra `goalInMonth`.

O único problema **crítico** é a coluna `Vendas (mês)` da tabela Admin ignorando o mês selecionado (item #1). Os demais são pontuais e não bloqueiam a evolução do MVP.

Deseja que eu implemente apenas as correções da seção **"Fazer agora"** (itens #1 a #4)?
