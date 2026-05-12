import { createFileRoute } from "@tanstack/react-router";
import { runSync } from "@/lib/bling.server";

export const Route = createFileRoute("/api/public/bling/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Aceita o token customizado (BLING_CRON_TOKEN) ou a anon key como apikey.
        const customToken = process.env.BLING_CRON_TOKEN;
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey") || request.headers.get("x-cron-token");
        const ok = !!provided && (provided === customToken || provided === anonKey);
        if (!ok) return new Response("Unauthorized", { status: 401 });

        try {
          const result = await runSync();
          return Response.json(result);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro";
          console.error("[bling/sync] erro", e);
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
