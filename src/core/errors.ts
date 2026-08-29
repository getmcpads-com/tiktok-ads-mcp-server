/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
export class PlatformApiError extends Error {
  constructor(
    public readonly platform: string,
    public readonly code: number,
    message: string,
    public readonly isRateLimit: boolean = false,
    public readonly isAuth: boolean = false,
    public readonly isPermission: boolean = false,
    public readonly suggestion: string = "",
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "PlatformApiError";
  }

  toMcpError() {
    return {
      error: this.message,
      platform: this.platform,
      code: this.code,
      isRateLimit: this.isRateLimit,
      isAuth: this.isAuth,
      isPermission: this.isPermission,
      suggestion: this.suggestion,
      ...(this.retryAfter !== undefined && { retryAfter: this.retryAfter }),
    };
  }
}

export class RateLimitError extends PlatformApiError {
  constructor(retryAfter?: number) {
    super("tiktok", 429, "Rate limit exceeded for TikTok", true, false, false,
      retryAfter ? `Wait ${retryAfter}s and retry` : "Wait and retry with exponential backoff", retryAfter);
    this.name = "RateLimitError";
  }
}

export class AuthError extends PlatformApiError {
  constructor(message?: string) {
    super("tiktok", 401, message ?? "Authentication failed for TikTok. Check your access token.",
      false, true, false, "Verify your TIKTOK_ACCESS_TOKEN is valid");
    this.name = "AuthError";
  }
}

export function formatMcpToolError(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  if (error instanceof PlatformApiError) {
    return { content: [{ type: "text", text: JSON.stringify(error.toMcpError(), null, 2) }], isError: true };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }], isError: true };
}
