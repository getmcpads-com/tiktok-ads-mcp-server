/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from "zod";
import { logger } from "./core/logger.js";

const configSchema = z.object({
  accessToken: z.string().min(1, "TIKTOK_ACCESS_TOKEN is required"),
  appId: z.string().min(1, "TIKTOK_APP_ID is required"),
  appSecret: z.string().optional(),
  defaultAdvertiserId: z.string().optional(),
  defaultBusinessCenterId: z.string().optional(),
  /** Write tools are registered only when this is true. */
  enableWrites: z.boolean().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type TikTokConfig = z.infer<typeof configSchema>;

export function loadConfig(): TikTokConfig {
  const raw = {
    accessToken: process.env["TIKTOK_ACCESS_TOKEN"] ?? "",
    appId: process.env["TIKTOK_APP_ID"] ?? "",
    appSecret: process.env["TIKTOK_APP_SECRET"] || undefined,
    defaultAdvertiserId: process.env["TIKTOK_ADVERTISER_ID"] || undefined,
    defaultBusinessCenterId: process.env["TIKTOK_BC_ID"] || process.env["TIKTOK_BUSINESS_CENTER_ID"] || undefined,
    enableWrites: isTruthy(process.env["TIKTOK_ENABLE_WRITES"]),
    logLevel: process.env["LOG_LEVEL"] ?? "info",
  };

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.message).join(", ");
    logger.error("config", `Missing TikTok credentials: ${missing}`);
    throw new Error(`Missing TikTok credentials: ${missing}`);
  }

  return result.data;
}

/** Accepts the spellings people actually type in an MCP client config. */
function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}
