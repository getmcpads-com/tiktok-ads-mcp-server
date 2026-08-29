/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Write tools for the TikTok Business API.
 *
 * These are registered only when `TIKTOK_ENABLE_WRITES` is set. Reading needs a
 * token with report and read scopes; everything here needs campaign management
 * scopes on the advertiser account.
 *
 * Part of tiktok-ads-mcp-server: https://github.com/getmcpads-com/tiktok-ads-mcp-server
 * Managed, multi-platform version: https://www.getmcpads.com
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TikTokConfig } from "../../config.js";

const API_BASE = "https://business-api.tiktok.com/open_api/v1.3";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/**
 * Every write is a preview until `confirm` is true.
 *
 * An assistant composes these calls, and it can pick the wrong advertiser, the
 * wrong campaign, or the wrong order of magnitude on a budget. A mandatory
 * preview makes the mistake visible before it costs money, and gives a human
 * the stopping point the protocol does not guarantee on its own.
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

/**
 * TikTok answers 200 even when the call failed. The applicative `code` field is
 * what decides, so a response is only a success when that code is 0. Trusting
 * the HTTP status alone reports imaginary successes back to the model.
 */
function check(response: unknown, context: string): unknown {
  const payload = response as { code?: number; message?: string };
  if (payload.code !== undefined && payload.code !== 0) {
    throw new Error(`${context}: ${payload.message ?? `code ${payload.code}`}`);
  }
  return response;
}

/** Budgets are sent in the account currency, rounded to two decimals. */
function toPlainAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Expected a positive amount, received "${amount}".`);
  }
  return Number(amount.toFixed(2));
}

async function request(url: string, init: RequestInit, context: string): Promise<unknown> {
  const response = await fetch(url, init);
  const body = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }
  if (!response.ok) {
    const detail = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
    throw new Error(`${context}: ${detail.slice(0, 300)}`);
  }
  return check(parsed, context);
}

export function registerTikTokWrites(server: McpServer, config: TikTokConfig): void {
  const headers = {
    "Access-Token": config.accessToken,
    "content-type": "application/json",
  };
  const post = (path: string, payload: Record<string, unknown>, context: string) =>
    request(`${API_BASE}${path}`, { method: "POST", headers, body: JSON.stringify(payload) }, context);

  // ── Status: pause / reactivate ────────────────────────────────────
  server.tool(
    "tiktok_update_campaign_status",
    "Pause or reactivate a TikTok campaign. Previews by default: without confirm: true, " +
      "the tool describes the change without applying it.",
    {
      advertiserId: z.string().describe("TikTok advertiser ID."),
      campaignId: z.string().describe("Campaign ID."),
      status: z.enum(["ENABLE", "DISABLE"]).describe("ENABLE reactivates, DISABLE pauses delivery."),
      confirm: confirmSchema,
    },
    async (a: Record<string, unknown>) => {
      const { advertiserId, campaignId, status, confirm } = a as Record<string, string | boolean>;
      if (!confirm) {
        return preview("tiktok_update_campaign_status", {
          advertiser: advertiserId, campaign: campaignId, newStatus: status,
        });
      }
      const result = await post("/campaign/status/update/", {
        advertiser_id: advertiserId, campaign_ids: [campaignId], operation_status: status,
      }, "TikTok campaign status");
      return ok({ applied: true, action: "tiktok_update_campaign_status", result });
    },
  );

  server.tool(
    "tiktok_update_adgroup_status",
    "Pause or reactivate a TikTok ad group. Previews by default.",
    {
      advertiserId: z.string().describe("TikTok advertiser ID."),
      adGroupId: z.string().describe("Ad group ID."),
      status: z.enum(["ENABLE", "DISABLE"]).describe("ENABLE reactivates, DISABLE pauses delivery."),
      confirm: confirmSchema,
    },
    async (a: Record<string, unknown>) => {
      const { advertiserId, adGroupId, status, confirm } = a as Record<string, string | boolean>;
      if (!confirm) {
        return preview("tiktok_update_adgroup_status", {
          advertiser: advertiserId, adGroup: adGroupId, newStatus: status,
        });
      }
      const result = await post("/adgroup/status/update/", {
        advertiser_id: advertiserId, adgroup_ids: [adGroupId], operation_status: status,
      }, "TikTok ad group status");
      return ok({ applied: true, action: "tiktok_update_adgroup_status", result });
    },
  );

  // ── Create campaign (always disabled) ─────────────────────────────
  server.tool(
    "tiktok_create_campaign",
    "Create a TikTok campaign. It is always created DISABLE and there is no option to " +
      "create it running. Previews by default.",
    {
      advertiserId: z.string().describe("TikTok advertiser ID."),
      name: z.string().min(1).max(512).describe("Campaign name."),
      objective: z
        .enum([
          "REACH",
          "TRAFFIC",
          "VIDEO_VIEWS",
          "LEAD_GENERATION",
          "WEB_CONVERSIONS",
          "PRODUCT_SALES",
          "ENGAGEMENT",
        ])
        .describe("Objective type."),
      budget: z.number().positive().describe("Budget in the account currency."),
      budgetMode: z
        .enum(["BUDGET_MODE_DAY", "BUDGET_MODE_TOTAL"])
        .optional()
        .describe("Daily by default."),
      confirm: confirmSchema,
    },
    async (a: Record<string, unknown>) => {
      const { advertiserId, name, objective, budget, budgetMode, confirm } = a;
      const mode = String(budgetMode ?? "BUDGET_MODE_DAY");
      const amount = toPlainAmount(Number(budget));
      if (!confirm) {
        return preview("tiktok_create_campaign", {
          advertiser: advertiserId, name, objective, budget: amount,
          budgetMode: mode, status: "DISABLE",
        });
      }
      const result = await post("/campaign/create/", {
        advertiser_id: advertiserId,
        campaign_name: name,
        objective_type: objective,
        budget_mode: mode,
        budget: amount,
        operation_status: "DISABLE",
      }, "TikTok campaign creation");
      return ok({ applied: true, action: "tiktok_create_campaign", status: "DISABLE", result });
    },
  );

  // ── Budgets ───────────────────────────────────────────────────────
  server.tool(
    "tiktok_update_campaign_budget",
    "Change a TikTok campaign budget, in the account currency. Previews by default.",
    {
      advertiserId: z.string().describe("TikTok advertiser ID."),
      campaignId: z.string().describe("Campaign ID."),
      budget: z.number().positive().describe("New budget, in the account currency."),
      confirm: confirmSchema,
    },
    async (a: Record<string, unknown>) => {
      const { advertiserId, campaignId, budget, confirm } = a;
      const amount = toPlainAmount(Number(budget));
      if (!confirm) {
        return preview("tiktok_update_campaign_budget", {
          advertiser: advertiserId, campaign: campaignId, newBudget: amount,
        });
      }
      const result = await post("/campaign/update/", {
        advertiser_id: advertiserId, campaign_id: campaignId, budget: amount,
      }, "TikTok campaign budget");
      return ok({ applied: true, action: "tiktok_update_campaign_budget", result });
    },
  );

  server.tool(
    "tiktok_update_adgroup_budget",
    "Change the budget of a TikTok ad group, in the account currency. Previews by default.",
    {
      advertiserId: z.string().describe("TikTok advertiser ID."),
      adGroupId: z.string().describe("Ad group ID."),
      budget: z.number().positive().describe("New budget, in the account currency."),
      budgetMode: z
        .enum(["BUDGET_MODE_DAY", "BUDGET_MODE_TOTAL"])
        .optional()
        .describe("Whether the budget is daily or total. Daily by default."),
      confirm: confirmSchema,
    },
    async (a: Record<string, unknown>) => {
      const { advertiserId, adGroupId, budget, budgetMode, confirm } = a;
      const mode = String(budgetMode ?? "BUDGET_MODE_DAY");
      const amount = toPlainAmount(Number(budget));
      if (!confirm) {
        return preview("tiktok_update_adgroup_budget", {
          advertiser: advertiserId, adGroup: adGroupId, newBudget: amount, budgetMode: mode,
        });
      }
      const result = await post("/adgroup/update/", {
        advertiser_id: advertiserId, adgroup_id: adGroupId, budget: amount, budget_mode: mode,
      }, "TikTok ad group budget");
      return ok({ applied: true, action: "tiktok_update_adgroup_budget", result });
    },
  );
}
