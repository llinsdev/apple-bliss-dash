export type Categoria = "Aparelho" | "Acessório";

export interface Venda {
  id: string;
  data: string; // ISO
  produto: string;
  categoria: Categoria;
  valor: number;
  comissaoPct: number;
}

export const comissaoValor = (v: Venda) => (v.valor * v.comissaoPct) / 100;

const today = new Date();
const d = (offset: number) => {
  const x = new Date(today);
  x.setDate(x.getDate() - offset);
  return x.toISOString();
};

export const vendasIniciais: Venda[] = [
  { id: "1", data: d(0), produto: "iPhone 15 Pro", categoria: "Aparelho", valor: 9499, comissaoPct: 3 },
  { id: "2", data: d(0), produto: "Capa MagSafe", categoria: "Acessório", valor: 399, comissaoPct: 8 },
  { id: "3", data: d(1), produto: "MacBook Air M3", categoria: "Aparelho", valor: 12999, comissaoPct: 2.5 },
  { id: "4", data: d(1), produto: "Carregador 20W", categoria: "Acessório", valor: 299, comissaoPct: 10 },
  { id: "5", data: d(2), produto: "iPhone 14", categoria: "Aparelho", valor: 5999, comissaoPct: 3 },
  { id: "6", data: d(3), produto: "AirPods Pro", categoria: "Acessório", valor: 2499, comissaoPct: 6 },
  { id: "7", data: d(4), produto: "iPad Pro 11", categoria: "Aparelho", valor: 10499, comissaoPct: 2.5 },
  { id: "8", data: d(5), produto: "Apple Pencil", categoria: "Acessório", valor: 1199, comissaoPct: 7 },
  { id: "9", data: d(6), produto: "iPhone 15", categoria: "Aparelho", valor: 7499, comissaoPct: 3 },
  { id: "10", data: d(6), produto: "Cabo USB-C", categoria: "Acessório", valor: 199, comissaoPct: 10 },
  { id: "11", data: d(8), produto: "MacBook Pro 14", categoria: "Aparelho", valor: 18999, comissaoPct: 2 },
  { id: "12", data: d(10), produto: "Capa Silicone", categoria: "Acessório", valor: 349, comissaoPct: 8 },
];

export const METAS = {
  diaria: 5000,
  semanal: 30000,
  mensal: 120000,
  acessoriosMensal: 15000,
};

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
