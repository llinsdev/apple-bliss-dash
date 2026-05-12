import { createFileRoute } from "@tanstack/react-router";
import { runSync } from "@/lib/bling.server";

export const Route = createFileRoute("/api/public/bling/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.BLING_CRON_TOKEN;
        if (!expected) return new Response("Server not configured", { status: 500 });
        const apikey = request.headers.get("apikey") || request.headers.get("x-cron-token");
        if (apikey !== expected) return new Response("Unauthorized", { status: 401 });

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
