import { createFileRoute } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";
import { exchangeCodeForToken } from "@/lib/bling.server";

export const Route = createFileRoute("/api/public/bling/oauth-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const cookieState = getCookie("bling_oauth_state");

        if (!code || !state || !cookieState || state !== cookieState) {
          return new Response("Invalid OAuth state", { status: 400 });
        }
        deleteCookie("bling_oauth_state", { path: "/" });

        try {
          await exchangeCodeForToken(code);
        } catch (e) {
          console.error("[bling/oauth-callback] erro", e);
          return new Response("OAuth token exchange failed. Contact your administrator.", { status: 500 });
        }


        return new Response(null, {
          status: 302,
          headers: { Location: "/admin/integracoes?ok=1" },
        });
      },
    },
  },
});
