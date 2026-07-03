
# Plano de implementação — mudanças mínimas

Escopo: apenas os itens 1–3 do brief. Sem refactor, sem RLS, sem novas tabelas, sem mudanças visuais além do texto dos botões e do MonthSelector no Admin.

---

## 1) `src/routes/_authenticated/admin.tsx`

### 1.1 Allow-list + eligibleSellers
- Adicionar no topo do arquivo (fora do componente):
  ```ts
  const ALLOWED_SELLER_IDS = new Set([
    "a97a9546-65d8-420f-9a32-d02afe7060f0", // Mariano
    "9d6b8f6b-2dc3-4e6a-8ee0-43af047231d0", // Dominique
  ]);
  ```
- Dentro de `Admin()`, derivar:
  ```ts
  const adminIds = useMemo(
    () => new Set(roles.filter(r => r.role === "admin").map(r => r.user_id)),
    [roles],
  );
  const eligibleSellers = useMemo(
    () => profiles
      .filter(p => ALLOWED_SELLER_IDS.has(p.id) && !adminIds.has(p.id))
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR")),
    [profiles, adminIds],
  );
  ```
- Substituir o `profiles.map(...)` da tabela "Vendedores" por `eligibleSellers.map(...)` (mantendo colunas e classes atuais).
- Passar `profiles={eligibleSellers}` para `GoalDialog` (o `Select` de vendedor passa a listar só Mariano/Dominique).
- `GoalsByMonth` continua recebendo `profiles={profiles}` completo (para conseguir mostrar o nome em metas antigas eventualmente atribuídas a admin, sem apagá-las).

### 1.2 Guard rails no GoalDialog
- Receber também `adminIds: Set<string>` como prop (ou derivar novamente).
- Calcular:
  ```ts
  const isAllowed = ALLOWED_SELLER_IDS.has(userId);
  const isAdminTarget = adminIds.has(userId);
  const blockReason = !userId
    ? null
    : isAdminTarget
      ? "Não é permitido criar metas para administradores."
      : !isAllowed
        ? "Apenas Mariano e Dominique podem receber metas no MVP."
        : null;
  ```
- No `submit`: `if (blockReason) return;`
- No botão salvar: `disabled={upsert.isPending || !!blockReason || !userId}`
- Renderizar `blockReason` como `<p className="text-xs text-muted-foreground">…</p>` logo acima do `DialogFooter` (não altera cores/tema).

### 1.3 MonthSelector visível
- Importar `MonthSelector` (`@/components/month-selector`).
- Renderizar `<MonthSelector />` **logo abaixo do `<header>`** (padrão das outras telas). Nenhuma outra mudança de layout.

---

## 2) `src/routes/_authenticated/dashboard.tsx`

Alterações **apenas** no toggle do card "Vendas no período" (linhas ~405–417):
- Labels:
  - `"hoje"` → `"Hoje"` (mantém)
  - `"7"` → `"Últ. 7d"`
  - `"30"` → `"Últ. 30d"`
- Adicionar `disabled={!isCurrentMonth}` em cada botão do toggle. `isCurrentMonth` já está disponível via `useSelectedMonth()` no componente.
- Nada muda em cálculos, metas semanais, filtros ou gráfico.

---

## 3) Fora do escopo (não tocar)

- `useSales`, `useAllGoals`, `useMyGoals` — inalterados.
- RLS, migrações, schemas — inalterados.
- `metas.tsx`, `lancamentos.tsx` — inalterados.
- `selected-month.tsx`, `MonthSelector` — inalterados.
- Cores, fonte, dark mode — inalterados.

---

## Entregáveis pós-implementação

**A) Arquivos alterados**
- `src/routes/_authenticated/admin.tsx` — allow-list, eligibleSellers, guard rails no GoalDialog, `<MonthSelector />` no header.
- `src/routes/_authenticated/dashboard.tsx` — rótulos "Últ. 7d/30d" e `disabled` quando não é mês atual.

**B) Checklist de validação manual**
- [ ] Admin: `MonthSelector` aparece no topo e ao trocar o mês, "Vendas (mês)" atualiza.
- [ ] Admin: tabela e `Select` de vendedor mostram apenas Mariano e Dominique.
- [ ] Admin: com admin selecionado no dialog, botão "Salvar" fica desabilitado com mensagem sobre administradores.
- [ ] Admin: com user fora do allow-list, botão "Salvar" fica desabilitado com a mensagem do MVP.
- [ ] Admin: metas antigas continuam aparecendo em `GoalsByMonth` (nenhuma exclusão).
- [ ] Dashboard: botões renderizam como "Hoje / Últ. 7d / Últ. 30d".
- [ ] Dashboard: em mês diferente do atual, os três botões ficam desabilitados.
- [ ] Identidade visual mantida (dark, Inter, vermelho `#fd0241`).
