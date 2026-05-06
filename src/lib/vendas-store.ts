import { useSyncExternalStore } from "react";
import { vendasIniciais, type Venda } from "./mock-data";

let vendas: Venda[] = [...vendasIniciais];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const vendasStore = {
  get: () => vendas,
  add: (v: Omit<Venda, "id" | "data">) => {
    vendas = [{ ...v, id: crypto.randomUUID(), data: new Date().toISOString() }, ...vendas];
    emit();
  },
  update: (id: string, patch: Partial<Venda>) => {
    vendas = vendas.map((v) => (v.id === id ? { ...v, ...patch } : v));
    emit();
  },
  remove: (id: string) => {
    vendas = vendas.filter((v) => v.id !== id);
    emit();
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const useVendas = () =>
  useSyncExternalStore(vendasStore.subscribe, vendasStore.get, vendasStore.get);
