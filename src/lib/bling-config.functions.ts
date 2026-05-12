import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildAuthorizeUrl,
  getOAuthRow,
  runSync,
} from "./bling.server";
import { z } from "zod";
import { setCookie } from "@tanstack/react-start/server";
import { randomBytes } from "crypto";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const getBlingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const row = await getOAuthRow();
    const { count: mappedCount } = await supabaseAdmin
      .from("seller_erp_map")
      .select("id", { count: "exact", head: true })
      .eq("erp_source", "bling");
    return {
      connected: !!row.access_token,
      has_credentials: !!(row.client_id && row.client_secret),
      last_synced_at: row.last_synced_at,
      expires_at: row.expires_at,
      mapped_sellers_count: mappedCount ?? 0,
    };
  });

export const saveBlingCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      client_id: z.string().trim().min(1).max(255),
      client_secret: z.string().trim().min(1).max(500),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("bling_oauth")
      .update({
        client_id: data.client_id,
        client_secret: data.client_secret,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default");
    if (error) throw error;
    return { ok: true };
  });

export const startBlingOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const row = await getOAuthRow();
    if (!row.client_id) throw new Error("Cadastre client_id e client_secret antes.");
    const state = randomBytes(24).toString("hex");
    setCookie("bling_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return { url: buildAuthorizeUrl(row.client_id, state) };
  });

export const disconnectBling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("bling_oauth")
      .update({
        access_token: null,
        refresh_token: null,
        expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "default");
    if (error) throw error;
    return { ok: true };
  });

export const triggerBlingSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return runSync();
  });

export const listSellerMappings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("seller_erp_map")
      .select("id, user_id, erp_seller_id")
      .eq("erp_source", "bling");
    if (error) throw error;
    return data ?? [];
  });

export const upsertSellerMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      user_id: z.string().uuid(),
      erp_seller_id: z.string().trim().min(1).max(64),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("seller_erp_map")
      .upsert(
        { user_id: data.user_id, erp_source: "bling", erp_seller_id: data.erp_seller_id },
        { onConflict: "erp_source,erp_seller_id" }
      );
    if (error) throw error;
    return { ok: true };
  });

export const deleteSellerMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("seller_erp_map")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listIngestLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("sales_ingest_log")
      .select("id, erp_order_id, status, error, created_at, sale_id")
      .eq("erp_source", "bling")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });
