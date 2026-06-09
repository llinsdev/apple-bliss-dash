import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type GoalType = "diaria" | "semanal" | "mensal";
export type GoalFocus = "total" | "acessorios";

export interface Goal {
  id: string;
  user_id: string;
  target_value: number;
  target_type: GoalType;
  category_focus: GoalFocus;
  period_start: string;
  period_end: string;
  week_number: number | null;
  created_at: string;
}

export function useMyGoals() {
  const { user } = useAuth();
  return useQuery({
    enabled: !!user,
    queryKey: ["goals", "me", user?.id],
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });
}

export function useAllGoals() {
  return useQuery({
    queryKey: ["goals", "all"],
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase.from("goals").select("*");
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });
}

export interface GoalInput {
  user_id: string;
  target_value: number;
  target_type: GoalType;
  category_focus: GoalFocus;
  period_start: string;
  period_end: string;
  week_number?: number | null;
}

export function useUpsertGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: GoalInput & { id?: string }) => {
      if (id) {
        const { error } = await supabase.from("goals").update(input).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("goals").insert(input);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}
