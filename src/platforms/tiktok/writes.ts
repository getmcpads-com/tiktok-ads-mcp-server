/** Copyright 2026 GetMCPAds. SPDX-License-Identifier: Apache-2.0 */
import { z } from "zod";
import type { ToolShape } from "../../tool-quality.js";
import { toMicroCurrency, toMicros, toMinorUnits, toPlainAmount } from "../../core/money.js";
const ADS_BASE = "https://googleads.googleapis.com/v25";
import { registerTikTokExtendedWrites } from "./extended-writes.js";
import { tiktokWriteApi } from "./write-api.js";
type Handler = (args: Record<string, unknown>) => Promise<unknown>;
type Collector = { tool: (n: string, d: string, s: ToolShape, h: Handler) => void };

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function ko(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

/**
 * Toute écriture est un aperçu tant que `confirm` n'est pas vrai.
 *
 * C'est un assistant qui compose ces appels : il peut se tromper de compte, de
 * campagne ou d'ordre de grandeur sur un budget. Un aperçu obligatoire rend
 * l'erreur visible avant qu'elle ne coûte de l'argent, et donne à l'humain le
 * point d'arrêt que le protocole ne garantit pas.
 */
function preview(action: string, details: Record<string, unknown>) {
  return ok({
    applied: false,
    action,
    change: details,
    message:
      "Preview only, nothing was changed. Repeat the same call with confirm: true " +
      "to apply this change to the live account.",
  });
}

const confirmSchema = z
  .boolean()
  .optional()
  .describe("Set to true to actually apply the change. Without it, the tool only previews.");

async function request(url: string, init: RequestInit, contexte: string): Promise<unknown> {
  const response = await fetch(url, { ...init, redirect: "error" });
  const body = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }
  if (!response.ok) {
    if (url.startsWith(ADS_BASE + "/")) {
      const error = (parsed as { error?: { message?: string; details?: { errors?: { errorCode?: unknown; message?: string; location?: unknown }[] }[] } })?.error;
      const details = error?.details?.flatMap(d => d.errors ?? []).map(e => ({ code: e.errorCode, message: e.message, location: e.location }));
      throw new Error(`${contexte}: ${JSON.stringify(details?.length ? details : error?.message ?? parsed).slice(0, 3000)}`);
    }
    throw new Error(`${contexte} : ${typeof parsed === "string" ? parsed.slice(0, 300) : JSON.stringify(parsed).slice(0, 300)}`);
  }
  return parsed;
}

export function registerTikTokWrites(c: Collector, config: Record<string, string>): void {
  registerTikTokExtendedWrites(c, config);
  const api = tiktokWriteApi(config);
  const destination = c;
  c = { tool(n,d,s,h) { destination.tool(n,d,s,async raw => {
    try {
      const a=z.object(s).strict().parse(raw) as Record<string, any>;
      api.scope(a.advertiserId);
      if(a.confirm){
        await api.info(a.advertiserId);
        if(a.campaignId) await api.entity(a.advertiserId,'campaign',a.campaignId);
        if(a.adGroupId){const group=await api.entity(a.advertiserId,'adgroup',a.adGroupId);if(a.budget!==undefined){const parent=await api.entity(a.advertiserId,'campaign',String(group.campaign_id));if(parent.budget_optimize_on)throw new Error('Campaign budget optimization is enabled; edit the campaign budget instead.');}}
      }
      return await h(a);
    } catch(error) { const e=error as Error & {code?:number;requestId?:string;outcome?:string};return {isError:true,content:[{type:'text' as const,text:JSON.stringify({error:e.message,code:e.code,requestId:e.requestId,outcome:e.outcome||'not_applied',retrySafe:false})}]}; }
  }); } };
  // Legacy tools share the same scoped transport and uncertain-outcome handling.
  const request = (url:string, init:RequestInit, _context:string) => api.call(url.slice(api.base.length+1),'POST',JSON.parse(String(init.body)));
  const base = api.base;
  const headers = { "Access-Token": config.accessToken, "content-type": "application/json" };

  const check = (r: unknown, contexte: string) => {
    const p = r as { code?: number; message?: string };
    // TikTok répond 200 même en erreur : le code applicatif fait foi.
    if (p.code !== undefined && p.code !== 0) throw new Error(`${contexte} : ${p.message ?? p.code}`);
    return r;
  };

  c.tool(
    "tiktok_update_campaign_status",
    "Pause or reactivate a TikTok campaign. Previews by default.",
    {
      advertiserId: z.string().describe("TikTok advertiser ID."),
      campaignId: z.string().describe("Campaign ID."),
      status: z.enum(["ENABLE", "DISABLE"]).describe("ENABLE reactivates, DISABLE pauses."),
      confirm: confirmSchema,
    },
    async (a) => {
      const { advertiserId, campaignId, status, confirm } = a as Record<string, string | boolean>;
      if (!confirm) return preview("tiktok_update_campaign_status", { advertiser: advertiserId, campaign: campaignId, newStatus: status });
      const r = await request(
        `${base}/campaign/status/update/`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ advertiser_id: advertiserId, campaign_ids: [campaignId], operation_status: status }),
        },
        "TikTok campaign status",
      );
      return ok({ applied: true, action: "tiktok_update_campaign_status", result: check(r, "TikTok") });
    },
  );

  c.tool(
    "tiktok_create_campaign",
    "Create a TikTok campaign. It is always created disabled and there is no option to " +
      "create it running. Previews by default.",
    {
      advertiserId: z.string().describe("TikTok advertiser ID."),
      name: z.string().describe("Name to set. This is the only thing the call changes."),
      objective: z
        .enum(["REACH", "TRAFFIC", "VIDEO_VIEWS", "LEAD_GENERATION", "WEB_CONVERSIONS", "PRODUCT_SALES", "ENGAGEMENT"])
        .describe("Objective type."),
      budget: z.number().positive().describe("Budget in the account currency."),
      budgetMode: z
        .enum(["BUDGET_MODE_DAY", "BUDGET_MODE_TOTAL"])
        .optional()
        .describe("Daily by default."),
      confirm: confirmSchema,
    },
    async (a) => {
      const { advertiserId, name, objective, budget, budgetMode, confirm } = a as Record<string, unknown>;
      const mode = String(budgetMode ?? "BUDGET_MODE_DAY");
      if (!confirm) {
        return preview("tiktok_create_campaign", { advertiser: advertiserId, name, objective, budget, budgetMode: mode, status: "DISABLE" });
      }
      const r = await request(
        `${base}/campaign/create/`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            advertiser_id: advertiserId,
            campaign_name: name,
            objective_type: objective,
            budget_mode: mode,
            budget,
            operation_status: "DISABLE",
          }),
        },
        "TikTok campaign creation",
      );
      return ok({ applied: true, action: "tiktok_create_campaign", status: "DISABLE", result: check(r, "TikTok") });
    },
  );

  c.tool(
    "tiktok_update_campaign_budget",
    "Change a TikTok campaign budget, in the account currency. Previews by default.",
    {
      advertiserId: z.string().describe("TikTok advertiser ID."),
      campaignId: z.string().describe("Campaign ID."),
      budget: z.number().positive().describe("New budget, in the account currency."),
      confirm: confirmSchema,
    },
    async (a) => {
      const { advertiserId, campaignId, budget, confirm } = a as Record<string, string | number | boolean>;
      if (!confirm) return preview("tiktok_update_campaign_budget", { advertiser: advertiserId, campaign: campaignId, newBudget: budget });
      const r = await request(
        `${base}/campaign/update/`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ advertiser_id: advertiserId, campaign_id: campaignId, budget }),
        },
        "TikTok campaign budget",
      );
      return ok({ applied: true, action: "tiktok_update_campaign_budget", result: check(r, "TikTok") });
    },
  );

  c.tool(
    "tiktok_update_adgroup_status",
    "Pause or reactivate a TikTok ad group. Previews by default.",
    {
      advertiserId: z.string().describe("TikTok advertiser ID."),
      adGroupId: z.string().describe("Ad group ID."),
      status: z.enum(["ENABLE", "DISABLE"]).describe("ENABLE reactivates, DISABLE pauses."),
      confirm: confirmSchema,
    },
    async (a) => {
      const { advertiserId, adGroupId, status, confirm } = a as Record<string, string | boolean>;
      if (!confirm) return preview("tiktok_update_adgroup_status", { advertiser: advertiserId, adGroup: adGroupId, newStatus: status });
      const r = await request(
        `${base}/adgroup/status/update/`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ advertiser_id: advertiserId, adgroup_ids: [adGroupId], operation_status: status }),
        },
        "TikTok ad group status",
      );
      return ok({ applied: true, action: "tiktok_update_adgroup_status", result: check(r, "TikTok") });
    },
  );

  c.tool(
    "tiktok_update_adgroup_budget",
    "Change the budget of a TikTok ad group. Amount in the account currency, sent as is. " +
      "Previews by default.",
    {
      advertiserId: z.string().describe("TikTok advertiser ID."),
      adGroupId: z.string().describe("Ad group ID."),
      budget: z.number().positive().describe("New budget, in the account currency."),
      budgetMode: z.enum(["BUDGET_MODE_DAY", "BUDGET_MODE_TOTAL"]).optional().default("BUDGET_MODE_DAY").describe("Whether the budget is daily or total."),
      confirm: confirmSchema,
    },
    async (a) => {
      const { advertiserId, adGroupId, budget, budgetMode, confirm } = a as Record<string, string | number | boolean>;
      const amount = toPlainAmount(Number(budget));
      if (!confirm) {
        return preview("tiktok_update_adgroup_budget", { advertiser: advertiserId, adGroup: adGroupId, newBudget: amount, budgetMode });
      }
      const r = await request(
        `${base}/adgroup/update/`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ advertiser_id: advertiserId, adgroup_id: adGroupId, budget: amount, budget_mode: budgetMode }),
        },
        "TikTok ad group budget",
      );
      return ok({ applied: true, action: "tiktok_update_adgroup_budget", result: check(r, "TikTok") });
    },
  );
}

// ───────────────────────────── Pinterest ─────────────────────────────


/**
 * Ajoute les outils d'écriture d'une plateforme.
 *
 * GA4 et Search Console n'en ont pas : ce sont des sources de mesure, et le
 * produit ne promet d'écritures que sur les plateformes publicitaires.
 */
