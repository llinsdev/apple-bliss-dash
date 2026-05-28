
## Diagnóstico

### Ajuste 1 — Acesso Admin (Leandro)

Consultei o banco. O Leandro **já tem** o papel `admin`, mas também tem uma linha duplicada de `vendedor`:

```
Leandro Lins  → vendedor
Leandro Lins  → admin     ← já existe
mariano       → vendedor
dominique     → vendedor
```

A função `has_role(uid, 'admin')` retorna `true` para o Leandro (basta uma linha admin), então em tese ele **já vê as áreas de admin**. O risco real é apenas a linha duplicada de `vendedor`, que polui a UI da página `/admin` (a coluna "Papel" usa `roles.find(...)` e pode mostrar "vendedor" dependendo da ordem). 

**Solução mínima:** apagar a linha `vendedor` do Leandro. Nenhuma mudança de código, nenhuma policy nova.

```sql
DELETE FROM public.user_roles
WHERE user_id = '879bc9c8-e481-4c1e-8fda-18f116421f57'
  AND role = 'vendedor';
```

Validação das policies atuais (já estão corretas, **não mexer**):
- `user_roles_admin_write` → só admin pode INSERT/UPDATE/DELETE em `user_roles` ✅ (vendedor não consegue se promover)
- `has_role()` é SECURITY DEFINER ✅ (sem recursão)
- `handle_new_user()` insere novo usuário como `'vendedor'` por padrão ✅
- `_authenticated` redireciona não-logado; `/admin` redireciona não-admin no componente ✅

Único ponto frágil já existente: o redirect de `/admin` acontece no componente (via `useEffect`), não em `beforeLoad`. Há um flash mínimo, mas RLS protege os dados. Não é bloqueante para o dia 01/06 — fica como **IMPORTANTE**, não **CRÍTICO**.

---

### Ajuste 2 — Auditoria do sistema

**🔴 CRÍTICO (bloqueia 01/06)**

1. **Linha `vendedor` duplicada do Leandro** — descrito acima. Fix: 1 DELETE.

**🟡 IMPORTANTE (não bloqueia, mas vale corrigir antes)**

2. **Guarda de `/admin` no componente, não em `beforeLoad`** — não-admin vê um flash da página antes do redirect. Dados ficam protegidos por RLS. Fix simples: mover a checagem para `beforeLoad` da rota (~5 linhas).
3. **Cache não invalida em login/logout** — não há `onAuthStateChange` global chamando `queryClient.invalidateQueries()`. Após login com outro usuário, dados antigos podem aparecer brevemente. Hoje o `logout` faz `queryClient.clear()`, então o impacto real é pequeno. Fix: adicionar listener no `__root.tsx` (~10 linhas).
4. **Arquivos Bling órfãos** — `src/lib/bling-config.functions.ts`, `src/lib/bling.server.ts`, `src/routes/_authenticated/integracoes.tsx`, `src/routes/api/public/bling/*`, tabelas `bling_oauth`, `seller_erp_map`, `sales_ingest_log` e o link "Integrações" no `/admin`. O projeto decidiu **não integrar com Bling**. Não quebra nada, mas adiciona superfície morta. Fix opcional: remover o `<Link to="/integracoes">` do header do `/admin` (1 linha) e/ou apagar os arquivos. **Não mexer no banco** para evitar risco.

**🟢 FUTURO (não implementar agora)**

5. Trocar `useEffect` de redirect em `/admin` por `beforeLoad` em toda a app.
6. Limpar de fato as tabelas/rotas Bling do banco quando confirmado que ninguém depende delas.
7. Adicionar índice em `sales(seller_id, sale_date)` se o volume crescer.

---

### Ajuste 3 — Performance / créditos

Tudo o que será feito agora cabe em **1 migration de 1 linha** (DELETE). Sem novos arquivos, sem refator, sem mudança visual.

---

## O que vou implementar (mínimo absoluto)

**Apenas 1 mudança, no banco:**

- **Tabela afetada:** `public.user_roles`
- **Ação:** apagar a linha `(Leandro, vendedor)` para que ele apareça apenas como admin.
- **Arquivos de código alterados:** **nenhum**.

Após aplicar:
- Leandro entra no app e a sidebar mostra "Admin" (já mostrava).
- A tela `/admin` exibe o badge "admin" em vez de "vendedor".
- Vendedores comuns (Mariano, Dominique) continuam sem acesso — RLS já garante.
- Nenhum risco de promoção manual: só admin pode escrever em `user_roles`.

Os itens **IMPORTANTE** e **FUTURO** ficam apenas sugeridos — **não serão implementados** salvo se você pedir.

Posso aprovar?
