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
    const { createClient } = await import("@supabase/supabase-js");

    // Inline auth check (avoids using middleware at module scope)
    void requireSupabaseAuth;
    const request = getRequest();
    const authHeader = request?.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Response("Unauthorized", { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "");
    const tmp = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await tmp.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      throw new Response("Unauthorized", { status: 401 });
    }
    const userId = data.claims.sub;

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!existing) {
      const { error: insErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (insErr) throw new Error(insErr.message);
    }

    return { ok: true };
  },
);
