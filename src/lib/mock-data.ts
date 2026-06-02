export const CATEGORIA_APARELHO = "Aparelho" as const;
export const CATEGORIA_ACESSORIO = "Acessório" as const;

export type Categoria = typeof CATEGORIA_APARELHO | typeof CATEGORIA_ACESSORIO;

export const CATEGORIAS: Categoria[] = [CATEGORIA_APARELHO, CATEGORIA_ACESSORIO];

// Interpreta uma data YYYY-MM-DD do Postgres como meia-noite LOCAL
// (evita o desvio de UTC que joga vendas do dia atual para o dia anterior).
export const parseSaleDate = (s: string) => new Date(`${s}T00:00:00`);

export const formatBRL = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Metas padrão (fallback exibido quando o admin ainda não cadastrou metas)
export const METAS_DEFAULT = {
  diaria: 5000,
  semanal: 30000,
  mensal: 120000,
  acessoriosMensal: 15000,
};
