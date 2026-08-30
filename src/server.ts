/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TikTokConfig } from "./config.js";
import { registerTikTok } from "./platforms/tiktok/index.js";
import { logger } from "./core/logger.js";

export const PACKAGE_VERSION = "1.0.2";

export function createServer(config: TikTokConfig): McpServer {
  const server = new McpServer(
    { name: "tiktok-ads-mcp", version: PACKAGE_VERSION },
    { capabilities: { tools: { listChanged: true }, resources: { subscribe: false, listChanged: true } } },
  );

  registerTikTok(server, config);

  logger.system(
    `tiktok-ads-mcp v${PACKAGE_VERSION} ready, writes ${config.enableWrites ? "enabled" : "disabled"}`,
  );
  return server;
}
