Plano para corrigir o Dashboard ADMIN sem alterar identidade visual:

1. **Componente reutilizado**
   - Reutilizar o `SellerDashboardView` já extraído do dashboard do vendedor.
   - Ele continuará sendo responsável por exibir metas, comissões e gráficos com os mesmos cards, tipografia, cores e componentes atuais.

2. **Troca entre vendedores**
   - No modo admin, substituir a grade lado a lado por um seletor simples no topo.
   - Usar botões/tabs simples com os vendedores não-admin encontrados no banco.
   - Mostrar somente Dominique e Mariano; Leandro será excluído por role admin como já acontece hoje.

3. **Evitar renderização duplicada**
   - Renderizar apenas um `<SellerDashboardView />` por vez, usando o vendedor selecionado.
   - Remover o `map` que cria vários dashboards simultâneos.
   - Filtrar metas e vendas apenas para o vendedor ativo antes de passar para o componente.

4. **Performance e realtime**
   - Manter as queries atuais de `sales`, `goals`, `profiles` e `user_roles`, sem adicionar novas consultas.
   - Manter o realtime atual invalidando `sales` quando houver nova venda.
   - Como apenas um dashboard estará montado, apenas um conjunto de gráficos será renderizado.

5. **Responsividade**
   - O seletor ficará em layout flexível com quebra de linha em telas pequenas.
   - O dashboard selecionado ocupará largura total, evitando cortes, sobreposição e gráficos comprimidos.