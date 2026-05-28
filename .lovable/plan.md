Ajustes simples no VM STORE: edição de nome no Perfil, logo sem container na sidebar e logo na tela de login.

## Ajuste 1 — Edição do nome no Perfil
- Em `src/routes/_authenticated/perfil.tsx`, adicionar estado local com `useState` para editar `full_name`.
- Incluir input inline abaixo do nome atual e botão "Salvar".
- Ao salvar, chamar `supabase.from('profiles').update({ full_name })` e invalidar cache do React Query para refletir em todo o sistema.
- Apenas o próprio usuário pode alterar seu nome; admin já tem controle total via RLS existente.

## Ajuste 2 — Logotipo sem fundo na sidebar
- Em `src/components/app-layout.tsx`, remover o wrapper `<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">` atrás do logo.
- Manter apenas o `<img src={vmLogo}>` com alinhamento flex do container pai.
- Preservar tamanho geral da navbar/sidebar e espaçamentos existentes.

## Ajuste 3 — Logotipo na tela de login
- Em `src/routes/index.tsx`, substituir o ícone `<Store className="h-7 w-7" />` dentro do quadrado vermelho por `<img src={vmLogo} alt="VM STORE" className="h-10 w-auto" />`.
- Remover o container quadrado (`rounded-2xl bg-primary text-primary-foreground shadow-lg`) ou adaptá-lo para conter a imagem de forma clean, sem fundo adicional.
- Manter centralização e estrutura do formulário intacta.

## Tabelas afetadas
- `profiles` — apenas UPDATE no campo `full_name`. Nenhuma tabela nova.

## Nota
Nenhum layout novo, nenhuma refatoração, nenhuma alteração visual além dos três pontos acima.