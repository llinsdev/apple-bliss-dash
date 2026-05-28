import { createFileRoute } from "@tanstack/react-router";
import { runSync } from "@/lib/bling.server";

export const Route = createFileRoute("/api/public/bling/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Requer o token dedicado BLING_CRON_TOKEN (server-only).
        const customToken = process.env.BLING_CRON_TOKEN;
        if (!customToken) {
          console.error("[bling/sync] BLING_CRON_TOKEN não configurado");
          return new Response("Unauthorized", { status: 401 });
        }
        const provided = request.headers.get("apikey") || request.headers.get("x-cron-token");
        if (!provided || provided !== customToken) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const result = await runSync();
          return Response.json(result);
        } catch (e) {
          console.error("[bling/sync] erro", e);
          return new Response("Sync failed. Contact your administrator.", { status: 500 });
        }
      },

    },
  },
});
