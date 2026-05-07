import { createServerFn } from "@tanstack/react-start";

export const promoteSelfToAdmin = createServerFn({ method: "POST" }).handler(
  async () => {
    const { requireSupabaseAuth } = await import(
      "@/integrations/supabase/auth-middleware"
    );
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { getRequest } = await import("@tanstack/react-start/server");

    void requireSupabaseAuth;

    const request = getRequest();
    const authHeader = request?.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Response("Unauthorized", { status: 401 });
    }
    const token = authHeader.slice(7);

    const { data: userData, error: userErr } =
      await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      throw new Response("Unauthorized", { status: 401 });
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
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  },
);
