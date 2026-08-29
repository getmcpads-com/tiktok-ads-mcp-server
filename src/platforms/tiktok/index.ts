/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TikTokConfig } from "../../config.js";
import { registerTikTokTools } from "./tools.js";
import { registerTikTokResources } from "./resources.js";
import { registerTikTokWrites } from "./writes.js";
import { logger } from "../../core/logger.js";

export function registerTikTok(server: McpServer, config: TikTokConfig): void {
  registerTikTokTools(server, config);
  registerTikTokResources(server, config.enableWrites ?? false);
  logger.info("tiktok", "Registered 27 read tools and 5 resources");

  if (config.enableWrites) {
    registerTikTokWrites(server, config);
    logger.info("tiktok", "Registered 5 write tools (every one previews before it applies)");
  }
}
