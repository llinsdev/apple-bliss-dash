import { createServerFn } from "@tanstack/react-start";

export const promoteSelfToAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken?: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    if (!data.accessToken) {
      return { ok: false, message: "Sessão não encontrada" };
    }

    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(data.accessToken);
    if (userErr || !userData?.user?.id) {
      return { ok: false, message: "Sessão inválida" };
    }
    const userId = userData.user.id;

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!existing) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (error) return { ok: false, message: error.message };
    }

    return { ok: true };
  });
