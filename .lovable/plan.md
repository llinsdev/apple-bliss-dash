# Auditoria Técnica — VM STORE MVP

## Diagnóstico (problema → impacto → solução mínima)

### CRÍTICO — bloqueia ou quebra o MVP em produção

**1. Brecha de segurança: `promoteSelfToAdmin` permite qualquer usuário virar admin**
- Problema: `src/lib/promote-admin.functions.ts` aceita o token do próprio usuário e usa `supabaseAdmin` (service role) para inserir `role='admin'` em `user_roles` sem nenhuma checagem de autorização. Não exige nenhum claim, secret de bootstrap, allowlist de e-mail ou role pré-existente.
- Impacto: privilege escalation total. Qualquer usuário cadastrado se promove a admin via UI ou chamando o endpoint diretamente. Em produção isso compromete metas, dados de outros vendedores e o painel `/admin`.
- Solução mínima: assim que você for promovido, **remover** o botão em `perfil.tsx`, o arquivo `promote-admin.functions.ts` e o uso de `useServerFn` correspondente. Deixar a criação de admins apenas via SQL/migration. (Já estava combinado — só formalizando.)

**2. Não há caminho oficial para criar o 1º admin**
- Problema: `handle_new_user` insere sempre `role='vendedor'`. A política `user_roles_admin_write` só permite escrita por quem já é admin → impossível criar o primeiro admin pelo app sem a brecha acima.
- Impacto: depois de remover `promote-admin`, ninguém vira admin novamente.
- Solução mínima: rodar uma migration única (`INSERT INTO user_roles(user_id, role) VALUES ('<seu uid>','admin') ON CONFLICT DO NOTHING;`) sempre que precisar promover alguém. Não exige código — só SQL.

**3. Dashboard mistura "totais da loja" com dados filtrados pelo RLS**
- Problema: `dashboard.tsx` usa `useSales()` (sem filtro por seller) e mostra "Acompanhe o progresso de metas e comissões em tempo real". Para vendedor, RLS filtra automaticamente para as próprias vendas; para admin, retorna TODAS. O texto e os KPIs (Meta Diária/Semanal/Mensal) passam a impressão de visão pessoal, mas o admin vê números agregados da loja inteira misturados com `useMyGoals` (metas do próprio admin, que normalmente não tem).
- Impacto: admin vê KPIs incoerentes (vendas totais da loja vs. meta padrão); vendedor está OK. Risco de confusão e decisões erradas no MVP.
- Solução mínima: no dashboard, filtrar `vendas` por `user.id` no client (ou criar `useMySales`) antes de calcular totais e gráficos. Não muda UI.

**4. Confirmação de e-mail pode estar travando signup**
- Problema: `index.tsx` faz `navigate({ to: "/dashboard" })` logo após `authApi.signUp`. Se o projeto Lovable Cloud estiver com "Confirm email" habilitado, o `signUp` retorna sem sessão e o usuário cai no `_authenticated` → redirect de volta para `/`, sem feedback claro.
- Impacto: usuários novos parecem "não conseguir entrar".
- Solução mínima: verificar a config de Auth (auto-confirm para MVP interno, já que só funcionários usam) ou exibir toast "verifique seu e-mail" e não navegar quando `data.session` for `null`.

### IMPORTANTE — corrigir antes do lançamento, mas não bloqueante

**5. Logout não limpa cache do React Query**
- Problema: `app-layout.tsx` e `perfil.tsx` chamam `authApi.signOut()` + `navigate('/')`, mas não invalidam `queryClient`. Cache de `is-admin`, `profile`, `sales` pode vazar para o próximo login na mesma aba.
- Solução mínima: chamar `queryClient.clear()` no signOut (uma linha em ambos os pontos).

**6. `useIsAdmin` re-renderiza/refetcha a cada montagem**
- Problema: a query não tem `staleTime`. Como `AppLayout` (que usa `useIsAdmin`) está em todas as páginas autenticadas, a cada navegação o sidebar pisca o item "Admin" entrando/saindo.
- Solução mínima: adicionar `staleTime: 60_000` em `useIsAdmin` e `useProfile`.

**7. `/admin` faz checagem dupla de role com `maybeSingle` no `beforeLoad`**
- Problema: roda no SSR/prerender também. Hoje funciona porque `_authenticated` filtra antes, mas é frágil — se um dia mudar a ordem de loaders, quebra com 401.
- Solução mínima: deixar a checagem só no client (ex.: redirecionar dentro do componente se `useIsAdmin().data === false`), ou mover para um layout `_authenticated/_admin.tsx` consistente com o padrão TanStack.

**8. `ESC`/inconsistência de métricas com filtro de categoria**
- Problema: `dashboard.tsx` filtra `v.category === "Aparelho"` para separar comissões. Hoje funciona porque a categoria é `"Aparelho" | "Acessório"`, mas `goals.category_focus` usa `"total" | "acessorios"` (sem cedilha). Strings diferentes para a mesma ideia → fácil divergir no futuro.
- Solução mínima: registrar essa convenção em comentário/constante (`CATEGORIA_APARELHO`, `CATEGORIA_ACESSORIO`) — sem mudar UI.

**9. Tabela `sales` sem índice em `seller_id` e `sale_date`**
- Problema: queries sempre filtram por `seller_id` (via RLS) e ordenam por `sale_date`. Sem índice composto, isso fica lento em poucas centenas de vendas.
- Solução mínima: migration `CREATE INDEX sales_seller_date_idx ON sales(seller_id, sale_date DESC);`

### FUTURO — pode esperar pós-MVP

- Realtime: o dashboard promete "tempo real", mas não há subscription. Adicionar `supabase.channel('sales')` quando relevante.
- Página `/reset-password` não existe — quando habilitar recuperação de senha, criar a rota pública e o fluxo `resetPasswordForEmail`.
- `useMyGoals` retorna metas do admin também — quando admin precisar simular vendedor, criar seletor de "ver como".
- Validar com Zod inputs de `lancamentos` e `metas` (hoje só checagem `isNaN`).
- CHECK/trigger no banco para garantir `sale_value > 0` e `commission_percentage between 0 and 100`.
- Soft delete de vendas (auditoria).
- Adicionar testes de RLS (script SQL com `SET ROLE` simulando vendedor/admin).

---

## Caminho mais curto para fechar o MVP

1. **Promover seu usuário a admin via SQL** (migration única).
2. **Remover** o botão "Ativar Modo Admin", `promote-admin.functions.ts` e import em `perfil.tsx`. Fecha a brecha #1 e #2 ao mesmo tempo.
3. **Filtrar `useSales` por `user.id` no dashboard** (corrige #3, sem alterar UI).
4. **Verificar config de Auth** (auto-confirm ON para o MVP interno) — corrige #4.
5. Adicionar `queryClient.clear()` no signOut e `staleTime` em `useIsAdmin/useProfile` (#5, #6).

Tudo isso é texto/configuração + mudanças pequenas em 3-4 arquivos. Sem refactor, sem mudança visual, sem novas dependências.

---

## Próximo passo

Quando aprovar este plano, eu executo na ordem 1 → 5 e devolvo um diff curto. Cada item é independente; se preferir, pulamos algum.
