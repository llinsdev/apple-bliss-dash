import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Categoria } from "@/lib/mock-data";

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
}

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
      });
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
