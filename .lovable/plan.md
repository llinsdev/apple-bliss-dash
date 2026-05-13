
## Objetivo
Manter o MVP 100% manual (sem integração obrigatória com Bling), trocar o formulário de Nova Venda conforme solicitado, e preservar dashboard, metas e demais telas funcionando.

## Solução mais simples possível
A tabela `sales` atual já tem `category`, `sale_value`, `commission_percentage` e `commission_value` (calculado por trigger). O dashboard e as metas dependem desses campos por linha/categoria. Em vez de reestruturar a tabela com `device_value/accessory_value/...` (o que quebraria dashboard e metas), fazemos o seguinte:

- O formulário aceita **um pedido** com valores opcionais de Aparelhos e Acessórios.
- Ao salvar, gravamos **1 ou 2 linhas** em `sales` (uma por categoria preenchida), todas com o mesmo `order_number`.
- Comissão é calculada pelo trigger existente (`sale_value * commission_percentage / 100`), passando 1% para Aparelhos e 6% para Acessórios.

Assim o resto do sistema (dashboard por categoria, metas, gráficos, lista) continua funcionando sem mudanças.

## Arquivos alterados

1. **Migração SQL (mínima)**
   - `ALTER TABLE public.sales ADD COLUMN order_number text;` (nullable, para não quebrar registros antigos).
   - Nada mais é tocado. Estruturas Bling (`bling_oauth`, `seller_erp_map`, `sales_ingest_log`) ficam **preservadas** para uso futuro.

2. **`src/hooks/use-sales.ts`**
   - Adicionar `order_number?: string | null` em `Sale` e `SaleInput`.
   - Adicionar mutação `useCreateOrderSale` que recebe `{ order_number, device_value?, accessory_value? }` e insere 1 ou 2 linhas (uma por categoria com valor > 0), cada uma com `commission_percentage` correto (1 / 6) e `product_name` derivado (`"Pedido #<n> — Aparelhos"` etc., para preservar a coluna NOT NULL e a UI atual da tabela).

3. **`src/routes/_authenticated/lancamentos.tsx`** (apenas o `VendaDialog`)
   - Remover campo "Produto", "Categoria" e "% Comissão".
   - Adicionar:
     - Input "Número do pedido Bling" (texto curto, obrigatório).
     - Bloco horizontal `[Aparelhos]` com input "Valor Aparelhos (R$)".
     - Bloco horizontal `[Acessórios]` com input "Valor Acessórios (R$)".
     - Resumo abaixo:
       ```
       Comissão Aparelhos: R$ X
       Comissão Acessórios: R$ Y
       Comissão Total: R$ Z
       ```
       calculado em tempo real (campos vazios = 0, sem NaN).
   - Validação: pelo menos um dos dois valores precisa ser > 0.
   - Mantém data, cores (`bg-primary` = #fd0241 atual), tipografia, estrutura de Dialog/Card. Sem fontes bold novas, sem animações novas.
   - Tabela de listagem: opcionalmente exibir o `order_number` no lugar do produto se presente — ou manter `product_name` (que já carrega "Pedido #X — Aparelhos"). Vou manter `product_name` para não mexer na tabela e atender ao requisito "sem reorganizar páginas".

4. **`src/lib/category-rules.ts`** — não é usado fora da integração Bling. Mantido como está (não removido).

## Tabelas que precisam ajuste
- **`sales`**: adicionar coluna `order_number text` (nullable). Apenas isso.
- **`bling_oauth`, `seller_erp_map`, `sales_ingest_log`**: **mantidas** (sem uso ativo no fluxo).

## Comissão (regras finais)
- Aparelhos → 1% sobre valor de aparelhos
- Acessórios → 6% sobre valor de acessórios
- Total = soma das duas
- Tudo recalculado a cada keystroke; campos vazios = 0.

## O que NÃO será feito
- Não mexer em sidebar, design tokens, dark mode, dashboard, metas, perfil, admin.
- Não remover páginas/arquivos da integração Bling (ficam dormentes).
- Não recriar tabela `sales`.
- Não adicionar animações/fontes/cores novas.

## Ordem de execução
1. Migração `ALTER TABLE sales ADD COLUMN order_number text` (aprovação do usuário).
2. Atualizar `use-sales.ts` com a nova mutação.
3. Reescrever o `VendaDialog` em `lancamentos.tsx`.
4. Verificação visual rápida no preview.
