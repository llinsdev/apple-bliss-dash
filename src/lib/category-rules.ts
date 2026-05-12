import { CATEGORIA_APARELHO, CATEGORIA_ACESSORIO, type Categoria } from "./mock-data";

// Palavras-chave que identificam um APARELHO (celular). Tudo o que não casar é ACESSÓRIO.
// Edite à vontade — a lista é consultada em lowercase.
export const APARELHO_KEYWORDS = [
  "celular", "smartphone", "iphone", "aparelho",
  "galaxy", "samsung", "motorola", "moto g", "moto e",
  "xiaomi", "redmi", "poco", "realme", "asus", "zenfone",
  "nokia", "lg", "huawei", "honor", "oneplus", "infinix",
  "tcl", "multilaser", "positivo", "pixel",
];

export function categorizeProductName(name: string | null | undefined): Categoria {
  if (!name) return CATEGORIA_ACESSORIO;
  const n = name.toLowerCase();
  return APARELHO_KEYWORDS.some(k => n.includes(k)) ? CATEGORIA_APARELHO : CATEGORIA_ACESSORIO;
}
