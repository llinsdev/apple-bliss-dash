## Plano de Integração Backend — VM STORE

Conectar o frontend existente ao Lovable Cloud (Supabase) preservando 100% do design (dark mode, `#fd0241`, Inter, componentes shadcn já criados).

### 1. Ativar Lovable Cloud
Habilitar Cloud no projeto (gera `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e os clientes em `src/integrations/supabase/`).

### 2. Schema (migration)

**Enum**
```
create type public.app_role as enum ('admin', 'vendedor');
```

**Tabelas**
- `profiles` — `id uuid pk references auth.users on delete cascade`, `full_name text`, `created_at timestamptz default now()`
- `user_roles` — `id uuid pk`, `user_id uuid → auth.users`, `role app_role`, `unique(user_id, role)` *(roles separados, nunca em profiles — evita escalonamento de privilégio)*
- `sales` — `id uuid pk`, `seller_id uuid → profiles`, `product_name text`, `category text check in ('Aparelho','Acessório')`, `sale_value numeric(12,2)`, `commission_percentage numeric(5,2)`, `commission_value numeric(12,2)`, `sale_date date default current_date`, `created_at timestamptz default now()`
- `goals` — `id uuid pk`, `user_id uuid → profiles`, `target_value numeric`, `target_type text check in ('diaria','semanal','mensal')`, `category_focus text check in ('total','acessorios')`, `period_start date`, `period_end date`, `created_at timestamptz default now()`

**Funções e triggers**
- `public.has_role(_user_id uuid, _role app_role) returns boolean` — `security definer`, `stable`, usada em todas as policies (evita recursão).
- `handle_new_user()` trigger em `auth.users` — cria linha em `profiles` e atribui role `vendedor` em `user_roles` automaticamente no signup.
- `set_commission_value()` trigger BEFORE INSERT/UPDATE em `sales` — calcula `commission_value = sale_value * commission_percentage / 100` no servidor (validação autoritativa).

### 3. RLS Policies
Todas as tabelas com `enable row level security`.

- **profiles**: SELECT → próprio registro OU `has_role(auth.uid(),'admin')`. UPDATE → próprio registro.
- **user_roles**: SELECT → próprio OU admin. INSERT/UPDATE/DELETE → apenas admin.
- **sales**: SELECT → `seller_id = auth.uid()` OU admin. INSERT → `seller_id = auth.uid()` OU admin. UPDATE/DELETE → próprio OU admin.
- **goals**: SELECT → `user_id = auth.uid()` OU admin. INSERT/UPDATE/DELETE → apenas admin.

### 4. Frontend — substituições

**Auth (`src/lib/auth.ts` → reescrita)**
- Hook `useAuth()` com `supabase.auth.onAuthStateChange` + `getSession` (listener antes de getSession).
- Métodos `signIn`, `signUp` (cadastra como vendedor automaticamente via trigger), `signOut`.

**Login (`src/routes/index.tsx`)**
- Adiciona toggle "Entrar / Criar conta" (mantém visual atual).
- `signUp` usa `emailRedirectTo: window.location.origin`.
- Toasts de erro/sucesso.
- Dica: desabilitar "Confirm email" no Cloud para acesso imediato.

**Guard de rotas**
- Criar `src/routes/_authenticated.tsx` (layout pathless) com `beforeLoad` que checa sessão Supabase e redireciona para `/` se ausente.
- Mover `dashboard.tsx`, `lancamentos.tsx`, `metas.tsx`, `perfil.tsx` para `src/routes/_authenticated/` (mesmo conteúdo, novo path).

**Data layer (substitui `vendas-store.ts` mockado)**
- `src/hooks/use-sales.ts`: `useQuery(['sales', filters])` com Supabase.
- `src/hooks/use-goals.ts`, `src/hooks/use-profile.ts`, `src/hooks/use-is-admin.ts` (consulta `user_roles`).
- Mutations (`useMutation`) para create/update/delete em `sales` e `goals` com `queryClient.invalidateQueries` + toasts.
- Configurar `QueryClientProvider` no `__root.tsx` (já temos QueryClient no router).

**Telas atualizadas**
- `dashboard.tsx`: KPIs, gráficos e comissões alimentados por `useSales()` + `useGoals()`. Admin vê agregado de todos; vendedor vê só os seus (filtro automático via RLS).
- `lancamentos.tsx`: tabela e diálogo usam mutations reais; estados de loading; toasts de erro/sucesso.
- `metas.tsx`: leitura de `goals` reais; admin vê botão "Editar metas" abrindo dialog.
- `perfil.tsx`: mostra `full_name`, e-mail, role; logout via `supabase.auth.signOut`.

**Nova tela admin (`src/routes/_authenticated/admin.tsx`)**
- Guard extra: `beforeLoad` checa `has_role admin`; senão redireciona para `/dashboard`.
- Item de menu no `app-layout` visível só para admin (via `useIsAdmin`).
- Conteúdo:
  - Lista de vendedores (`profiles` + roles) com totais de vendas do mês.
  - Gestão de metas: criar/editar `goals` por vendedor (dialog com target_value, target_type, category_focus, período).
  - Filtro por vendedor reaproveitando o Dashboard/Lançamentos.

### 5. Detalhes técnicos
- Usar `import { supabase } from '@/integrations/supabase/client'` em hooks/componentes.
- `commission_value` calculado pelo trigger no banco — front envia só `sale_value` e `commission_percentage`.
- `category` segue strings em PT-BR ("Aparelho" / "Acessório") como já no UI.
- Datas: usar `sale_date` para filtros do dashboard (range diário/semanal/mensal).
- Manter `mock-data.ts` apenas para constantes auxiliares (`formatBRL`, `comissaoValor` helper) — remover seed de vendas.

### 6. Preservação visual
Nenhuma alteração em `styles.css`, tokens, tipografia ou componentes shadcn. Toasts via `sonner` (já instalado). Skeletons usam o componente shadcn existente para loading.

### Entregáveis
1. Migration SQL com enum, tabelas, função `has_role`, triggers e RLS.
2. Reescrita de `auth.ts` + guard `_authenticated`.
3. Hooks de dados (`use-sales`, `use-goals`, `use-profile`, `use-is-admin`).
4. Refatoração de Login, Dashboard, Lançamentos, Metas, Perfil.
5. Nova tela `/admin` com gestão de vendedores e metas.
6. Atualização do `app-layout` (item Admin condicional + logout real).
