import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIA_APARELHO, CATEGORIA_ACESSORIO, type Categoria } from "@/lib/mock-data";

export interface Sale {
  id: string;
  seller_id: string;
  product_name: string;
  category: Categoria;
  sale_value: number;
  commission_percentage: number;
  commission_value: number;
  sale_date: string;
  created_at: string;
  order_number: string | null;
}

export const APARELHO_COMISSAO_PCT = 1;
export const ACESSORIO_COMISSAO_PCT = 6;

export function useSales() {
  return useQuery({
    queryKey: ["sales"],
    queryFn: async (): Promise<Sale[]> => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("sale_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });
}

export interface SaleInput {
  product_name: string;
  category: Categoria;
  sale_value: number;
  commission_percentage: number;
  sale_date?: string;
  order_number?: string | null;
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaleInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");
      const { error } = await supabase.from("sales").insert({
        seller_id: userData.user.id,
        product_name: input.product_name,
        category: input.category,
        sale_value: input.sale_value,
        commission_percentage: input.commission_percentage,
        commission_value: 0, // será sobrescrito pelo trigger
        sale_date: input.sale_date ?? new Date().toISOString().slice(0, 10),
        order_number: input.order_number ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
}

export interface OrderSaleInput {
  order_number: string;
  device_value?: number;
  accessory_value?: number;
  sale_date?: string;
}

export function useCreateOrderSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OrderSaleInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");
      const sale_date = input.sale_date ?? new Date().toISOString().slice(0, 10);
      type Row = {
        seller_id: string; product_name: string; category: Categoria;
        sale_value: number; commission_percentage: number; commission_value: number;
        sale_date: string; order_number: string;
      };
      const rows: Row[] = [];
      const dev = Number(input.device_value ?? 0);
      const acc = Number(input.accessory_value ?? 0);
      if (dev > 0) {
        rows.push({
          seller_id: userData.user.id,
          product_name: `Pedido #${input.order_number} — Aparelhos`,
          category: CATEGORIA_APARELHO,
          sale_value: dev,
          commission_percentage: APARELHO_COMISSAO_PCT,
          commission_value: 0,
          sale_date,
          order_number: input.order_number,
        });
      }
      if (acc > 0) {
        rows.push({
          seller_id: userData.user.id,
          product_name: `Pedido #${input.order_number} — Acessórios`,
          category: CATEGORIA_ACESSORIO,
          sale_value: acc,
          commission_percentage: ACESSORIO_COMISSAO_PCT,
          commission_value: 0,
          sale_date,
          order_number: input.order_number,
        });
      }
      if (rows.length === 0) throw new Error("Informe ao menos um valor");
      const { error } = await supabase.from("sales").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
}

export function useUpdateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SaleInput> }) => {
      const { error } = await supabase.from("sales").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
}

export function useDeleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
}
