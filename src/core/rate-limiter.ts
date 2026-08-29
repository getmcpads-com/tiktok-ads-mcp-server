/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { RateLimitError } from "./errors.js";
import { logger } from "./logger.js";

interface RequestRecord { timestamps: number[]; }

export class RateLimiter {
  private records = new Map<string, RequestRecord>();
  private maxPerSecond = 10;
  private maxPerMinute = 600;
  private maxRetries = 3;

  async acquire(): Promise<void> {
    let record = this.records.get("tiktok");
    if (!record) { record = { timestamps: [] }; this.records.set("tiktok", record); }
    const now = Date.now();
    record.timestamps = record.timestamps.filter((t) => now - t < 60_000);
    const lastSecond = record.timestamps.filter((t) => now - t < 1000);
    if (lastSecond.length >= this.maxPerSecond) {
      const waitMs = 1000 - (now - lastSecond[0]!) + 50;
      logger.debug("tiktok", `Rate limit: waiting ${waitMs}ms (per-second)`);
      await sleep(waitMs);
    }
    if (record.timestamps.length >= this.maxPerMinute) {
      const waitMs = 60_000 - (now - record.timestamps[0]!) + 100;
      logger.warn("tiktok", `Rate limit: waiting ${waitMs}ms (per-minute)`);
      await sleep(waitMs);
    }
    record.timestamps.push(Date.now());
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      await this.acquire();
      try { return await fn(); }
      catch (error) {
        if (isRateLimitError(error) && attempt < this.maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500), 30_000);
          logger.warn("tiktok", `Rate limited (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${backoff}ms`);
          await sleep(backoff);
          continue;
        }
        throw error;
      }
    }
    throw new RateLimitError();
  }
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof Error) return error.message.toLowerCase().includes("rate limit");
  return false;
}

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
