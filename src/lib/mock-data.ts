export const CATEGORIA_APARELHO = "Aparelho" as const;
export const CATEGORIA_ACESSORIO = "Acessório" as const;

export type Categoria = typeof CATEGORIA_APARELHO | typeof CATEGORIA_ACESSORIO;

export const CATEGORIAS: Categoria[] = [CATEGORIA_APARELHO, CATEGORIA_ACESSORIO];

export const formatBRL = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Metas padrão (fallback exibido quando o admin ainda não cadastrou metas)
export const METAS_DEFAULT = {
  diaria: 5000,
  semanal: 30000,
  mensal: 120000,
  acessoriosMensal: 15000,
};
