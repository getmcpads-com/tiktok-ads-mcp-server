/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// TIKTOK BUSINESS API CLIENT (READ-ONLY)
// ============================================
// Standalone HTTP client for TikTok Business API
// TikTok Business API client. Read paths only; writes live in writes.ts.

import { logger } from "../../core/logger.js";
import { RateLimiter } from "../../core/rate-limiter.js";
import {
  TikTokApiRequest,
  TikTokApiResponse,
  TikTokInsightRow,
  TikTokAdvertisersResponse,
  TikTokQueryPlan,
  TIKTOK_API_BASE_URL,
} from "./types.js";
import { mergeResults, buildRequestBody } from "./query-planner.js";
import { enrichWithCalculatedMetrics } from "./calculated-metrics.js";
import { findMissingMetricsInRow, getNativeMetrics } from "./metric-catalog.js";

/** Prevent Access-Token forwarding to non-TikTok hosts or API versions. */
export function assertSafeTikTokApiUrl(rawEndpoint: string): URL {
  let url: URL;
  try {
    if (/^https?:\/\//i.test(rawEndpoint)) {
      url = new URL(rawEndpoint);
    } else {
      const relative = rawEndpoint
        .replace(/^\/+/, "")
        .replace(/^open_api\/v1\.3\//, "");
      url = new URL(relative, `${TIKTOK_API_BASE_URL}/`);
    }
  } catch {
    throw new Error("TikTok endpoint must be a valid relative path or official API URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "business-api.tiktok.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new Error("TikTok API reads are restricted to https://business-api.tiktok.com.");
  }
  if (!url.pathname.startsWith("/open_api/v1.3/")) {
    throw new Error("TikTok API reads are restricted to /open_api/v1.3/.");
  }
  return url;
}

// ============================================
// ERROR HANDLING
// ============================================

export class TikTokApiException extends Error {
  code: number;
  requestId: string;

  constructor(message: string, code: number, requestId: string) {
    super(message);
    this.name = "TikTokApiException";
    this.code = code;
    this.requestId = requestId;
  }
}

/**
 * TikTok API error codes
 */
export const ERROR_CODES = {
  OK: 0,
  SYSTEM_ERROR: 40001,
  INVALID_PARAMS: 40002,
  AUTHENTICATION_ERROR: 40100,
  NO_PERMISSION: 40101,
  RATE_LIMIT_EXCEEDED: 40301,
  RESOURCE_NOT_FOUND: 40400,
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Flatten TikTok API response row from nested structure to flat object
 * TikTok returns: { metrics: { clicks: "100", spend: "50.00" }, dimensions: { ad_id: "123" } }
 * We flatten to: { clicks: "100", spend: "50.00", ad_id: "123" }
 */
function flattenTikTokRow(row: TikTokInsightRow): TikTokInsightRow {
  const flattened: TikTokInsightRow = {};

  // Flatten metrics object
  if (row.metrics && typeof row.metrics === "object") {
    Object.entries(row.metrics).forEach(([key, value]) => {
      flattened[key] = value;
    });
  }

  // Flatten dimensions object
  if (row.dimensions && typeof row.dimensions === "object") {
    Object.entries(row.dimensions).forEach(([key, value]) => {
      flattened[key] = value;
    });
  }

  // Copy any other top-level properties
  Object.entries(row).forEach(([key, value]) => {
    if (key !== "metrics" && key !== "dimensions") {
      flattened[key] = value;
    }
  });

  return flattened;
}

const API_FIELD_TO_CANONICAL_METRIC = new Map(
  getNativeMetrics()
    .filter((metric) => metric.apiField && metric.apiField !== metric.key)
    .map((metric) => [metric.apiField, metric.key] as const),
);

function canonicalizeMetricAliases(row: TikTokInsightRow): TikTokInsightRow {
  const canonicalized: TikTokInsightRow = { ...row };
  for (const [apiField, canonicalKey] of API_FIELD_TO_CANONICAL_METRIC.entries()) {
    if (canonicalized[apiField] !== undefined && canonicalized[canonicalKey] === undefined) {
      canonicalized[canonicalKey] = canonicalized[apiField];
    }
    if (apiField === "total_complete_payment_rate" && canonicalKey === "total_complete_payment_value") {
      delete canonicalized[apiField];
    }
  }
  return canonicalized;
}

function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/([?&](?:access_token|secret|app_secret)=)[^&]+/gi, "$1[redacted]")
      .replace(/(Access-Token["']?\s*:\s*["'])[^"']+/gi, "$1[redacted]");
  }

  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        /token|secret/i.test(key) ? "[redacted]" : redactSecrets(entry),
      ])
    );
  }

  return value;
}

// ============================================
// API CLIENT
// ============================================

export class TikTokClient {
  private accessToken: string;
  private apiVersion: string;
  public readonly defaultAdvertiserId?: string;
  public readonly appId?: string;
  public readonly appSecret?: string;
  private rateLimiter = new RateLimiter();

  constructor(accessToken: string, defaultAdvertiserId?: string, apiVersion: string = "v1.3", appId?: string, appSecret?: string) {
    this.accessToken = accessToken;
    this.defaultAdvertiserId = defaultAdvertiserId;
    this.apiVersion = apiVersion;
    this.appId = appId;
    this.appSecret = appSecret;
  }

  /**
   * Make a request to the TikTok API
   */
  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body?: Record<string, unknown>
  ): Promise<T> {
    return this.rateLimiter.execute(async () => {
      const url = `${TIKTOK_API_BASE_URL}/${endpoint}`;

      logger.debug("tiktok", `${method} ${redactSecrets(url)}`);
      if (body) {
        logger.debug("tiktok", `Body: ${JSON.stringify(redactSecrets(body), null, 2)}`);
      }

      const headers: Record<string, string> = {
        "Access-Token": this.accessToken,
        "Content-Type": "application/json",
      };

      const options: RequestInit = {
        method,
        headers,
        redirect: "error",
      };

      if (body && method === "POST") {
        options.body = JSON.stringify(body);
      }

      logger.debug("tiktok", `Making request to: ${redactSecrets(url)}`);
      logger.debug("tiktok", "Access-Token: [redacted]");

      const response = await fetch(url, options);
      logger.debug("tiktok", `Response status: ${response.status}`);

      if (!response.ok) {
        // Try to get error details from response body
        let errorBody = "";
        try {
          errorBody = await response.text();
          logger.error("tiktok", `Error response body: ${errorBody}`);
        } catch {
          logger.error("tiktok", "Could not read error body");
        }
        throw new TikTokApiException(
          `HTTP error ${response.status}: ${response.statusText}. Body: ${errorBody.substring(0, 200)}`,
          response.status,
          ""
        );
      }

      const data = await response.json() as Record<string, unknown>;
      logger.debug("tiktok", `Response code: ${data.code}`);

      // Check for API-level errors
      if (data.code !== 0) {
        throw new TikTokApiException(
          (data.message as string) || "Unknown API error",
          data.code as number,
          (data.request_id as string) || ""
        );
      }

      return data as T;
    });
  }

  // ============================================
  // GENERIC URL FETCH (for arbitrary API calls)
  // ============================================

  /**
   * Fetch an arbitrary TikTok API URL.
   * Useful for generic/exploratory calls from MCP tools.
   */
  public async fetchUrl(endpoint: string): Promise<unknown> {
    return this.rateLimiter.execute(async () => {
      const url = assertSafeTikTokApiUrl(endpoint);

      const safeUrl = String(redactSecrets(url.toString()));
      logger.debug("tiktok", `fetchUrl GET ${safeUrl.slice(0, 120)}`);

      const headers: Record<string, string> = {
        "Access-Token": this.accessToken,
        "Content-Type": "application/json",
      };

      const response = await fetch(url, { method: "GET", headers, redirect: "error" });

      if (!response.ok) {
        let errorBody = "";
        try {
          errorBody = await response.text();
        } catch {
          // ignore
        }
        throw new TikTokApiException(
          `HTTP error ${response.status}: ${response.statusText}. Body: ${errorBody.substring(0, 200)}`,
          response.status,
          ""
        );
      }

      const data = await response.json() as Record<string, unknown>;

      if (data.code !== undefined && data.code !== 0) {
        throw new TikTokApiException(
          (data.message as string) || "Unknown API error",
          data.code as number,
          (data.request_id as string) || ""
        );
      }

      return data;
    });
  }

  // ============================================
  // ADVERTISER METHODS
  // ============================================

  /**
   * Get list of advertiser accounts accessible to the current token
   */
  async getAdvertisers(): Promise<TikTokAdvertisersResponse> {
    const params: Record<string, string> = {
      access_token: this.accessToken,
    };
    if (this.appId) params.app_id = this.appId;
    if (this.appSecret) params.secret = this.appSecret;
    const qs = new URLSearchParams(params).toString();
    return this.request<TikTokAdvertisersResponse>(
      `oauth2/advertiser/get/?${qs}`,
      "GET"
    );
  }

  /**
   * Get advertiser info by IDs (supports multiple)
   */
  async getAdvertiserInfo(advertiserIds: string | string[]): Promise<{
    code: number;
    message: string;
    data: {
      list: Array<{
        advertiser_id: string;
        advertiser_name: string;
        status: string;
        currency: string;
        timezone: string;
        create_time: number;
      }>;
    };
  }> {
    const ids = Array.isArray(advertiserIds) ? advertiserIds : [advertiserIds];
    return this.request(
      `advertiser/info/?advertiser_ids=${JSON.stringify(ids)}`,
      "GET"
    );
  }

  // ============================================
  // ENTITY METHODS (for name enrichment)
  // ============================================

  /**
   * Fetch campaigns by IDs, returns id->name map
   */
  async getCampaignNames(advertiserId: string, campaignIds: string[]): Promise<Map<string, string>> {
    const nameMap = new Map<string, string>();
    if (campaignIds.length === 0) return nameMap;

    // TikTok allows max 100 IDs per request
    const chunks = [];
    for (let i = 0; i < campaignIds.length; i += 100) {
      chunks.push(campaignIds.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      try {
        const params = new URLSearchParams();
        params.set("advertiser_id", advertiserId);
        params.set("filtering", JSON.stringify({ campaign_ids: chunk }));
        params.set("fields", JSON.stringify(["campaign_id", "campaign_name"]));
        params.set("page_size", "100");

        const response = await this.request<{
          code: number;
          data: { list: Array<{ campaign_id: string; campaign_name: string }> };
        }>(`campaign/get/?${params.toString()}`, "GET");

        response.data?.list?.forEach((c) => {
          nameMap.set(String(c.campaign_id), c.campaign_name);
        });
      } catch (e) {
        logger.warn("tiktok", "Failed to fetch campaign names", e);
      }
    }
    return nameMap;
  }

  /**
   * Fetch ad groups by IDs, returns id->name map
   */
  async getAdGroupNames(advertiserId: string, adGroupIds: string[]): Promise<Map<string, string>> {
    const nameMap = new Map<string, string>();
    if (adGroupIds.length === 0) return nameMap;

    const chunks = [];
    for (let i = 0; i < adGroupIds.length; i += 100) {
      chunks.push(adGroupIds.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      try {
        const params = new URLSearchParams();
        params.set("advertiser_id", advertiserId);
        params.set("filtering", JSON.stringify({ adgroup_ids: chunk }));
        params.set("fields", JSON.stringify(["adgroup_id", "adgroup_name"]));
        params.set("page_size", "100");

        const response = await this.request<{
          code: number;
          data: { list: Array<{ adgroup_id: string; adgroup_name: string }> };
        }>(`adgroup/get/?${params.toString()}`, "GET");

        response.data?.list?.forEach((g) => {
          nameMap.set(String(g.adgroup_id), g.adgroup_name);
        });
      } catch (e) {
        logger.warn("tiktok", "Failed to fetch adgroup names", e);
      }
    }
    return nameMap;
  }

  /**
   * Fetch ads by IDs, returns id->name map
   */
  async getAdNames(advertiserId: string, adIds: string[]): Promise<Map<string, string>> {
    const nameMap = new Map<string, string>();
    if (adIds.length === 0) return nameMap;

    const chunks = [];
    for (let i = 0; i < adIds.length; i += 100) {
      chunks.push(adIds.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      try {
        const params = new URLSearchParams();
        params.set("advertiser_id", advertiserId);
        params.set("filtering", JSON.stringify({ ad_ids: chunk }));
        params.set("fields", JSON.stringify(["ad_id", "ad_name"]));
        params.set("page_size", "100");

        const response = await this.request<{
          code: number;
          data: { list: Array<{ ad_id: string; ad_name: string }> };
        }>(`ad/get/?${params.toString()}`, "GET");

        response.data?.list?.forEach((a) => {
          nameMap.set(String(a.ad_id), a.ad_name);
        });
      } catch (e) {
        logger.warn("tiktok", "Failed to fetch ad names", e);
      }
    }
    return nameMap;
  }

  /**
   * Enrich result rows with entity names (campaign_name, adgroup_name, ad_name)
   */
  async enrichWithEntityNames(
    rows: TikTokInsightRow[],
    advertiserId: string
  ): Promise<TikTokInsightRow[]> {
    if (rows.length === 0) return rows;

    const sampleRow = rows[0];
    const hasCampaignId = "campaign_id" in sampleRow;
    const hasAdGroupId = "adgroup_id" in sampleRow;
    const hasAdId = "ad_id" in sampleRow;

    // Collect unique IDs
    const campaignIds = hasCampaignId ? [...new Set(rows.map((r) => String(r.campaign_id)).filter(Boolean))] : [];
    const adGroupIds = hasAdGroupId ? [...new Set(rows.map((r) => String(r.adgroup_id)).filter(Boolean))] : [];
    const adIds = hasAdId ? [...new Set(rows.map((r) => String(r.ad_id)).filter(Boolean))] : [];

    logger.info("tiktok", `Enriching: ${campaignIds.length} campaigns, ${adGroupIds.length} adgroups, ${adIds.length} ads`);

    // Fetch names in parallel
    const [campaignNames, adGroupNames, adNames] = await Promise.all([
      campaignIds.length > 0 ? this.getCampaignNames(advertiserId, campaignIds) : new Map<string, string>(),
      adGroupIds.length > 0 ? this.getAdGroupNames(advertiserId, adGroupIds) : new Map<string, string>(),
      adIds.length > 0 ? this.getAdNames(advertiserId, adIds) : new Map<string, string>(),
    ]);

    // Enrich rows
    return rows.map((row) => {
      const enriched = { ...row };
      if (hasCampaignId && row.campaign_id) {
        enriched.campaign_name = campaignNames.get(String(row.campaign_id)) || "";
      }
      if (hasAdGroupId && row.adgroup_id) {
        enriched.adgroup_name = adGroupNames.get(String(row.adgroup_id)) || "";
      }
      if (hasAdId && row.ad_id) {
        enriched.ad_name = adNames.get(String(row.ad_id)) || "";
      }
      return enriched;
    });
  }

  // ============================================
  // REPORTING METHODS
  // ============================================

  /**
   * Execute a basic report query
   * TikTok Business API report/integrated/get uses GET with URL parameters
   * Arrays (dimensions, metrics, filtering) are JSON-stringified in URL params
   *
   * NOTE: Date parameters (start_date, end_date) are handled by buildRequestBody:
   * - For non-lifetime queries: dates are required and included
   * - For lifetime queries: dates are NOT included (TikTok may reject them)
   */
  async fetchBasicReport(request: TikTokApiRequest): Promise<TikTokApiResponse> {
    const body = buildRequestBody(request);
    logger.debug("tiktok", `fetchBasicReport params: ${JSON.stringify(body, null, 2)}`);

    // Build URL parameters - TikTok expects JSON-encoded arrays
    const params = new URLSearchParams();
    params.set("advertiser_id", String(body.advertiser_id));
    params.set("service_type", String(body.service_type || "AUCTION"));
    params.set("report_type", String(body.report_type || "BASIC"));
    params.set("data_level", String(body.data_level));
    params.set("dimensions", JSON.stringify(body.dimensions));
    params.set("metrics", JSON.stringify(body.metrics));

    // Dates are only in body if NOT a lifetime query (handled by buildRequestBody)
    if (body.start_date) {
      params.set("start_date", String(body.start_date));
    }
    if (body.end_date) {
      params.set("end_date", String(body.end_date));
    }
    if (body.page) {
      params.set("page", String(body.page));
    }
    if (body.page_size) {
      params.set("page_size", String(body.page_size));
    }
    if (body.query_lifetime) {
      params.set("query_lifetime", "true");
    }
    if (body.filtering && Array.isArray(body.filtering) && body.filtering.length > 0) {
      params.set("filtering", JSON.stringify(body.filtering));
    }
    if (body.order_field) {
      params.set("order_field", String(body.order_field));
      params.set("order_type", String(body.order_type || "DESC"));
    }

    logger.debug("tiktok", `Request URL params: ${params.toString()}`);

    return this.request<TikTokApiResponse>(
      `report/integrated/get/?${params.toString()}`,
      "GET"
    );
  }

  /**
   * Execute a query with automatic pagination
   */
  async fetchAllPages(request: TikTokApiRequest): Promise<TikTokInsightRow[]> {
    const allRows: TikTokInsightRow[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      const pageRequest = { ...request, page: currentPage };
      const response = await this.fetchBasicReport(pageRequest);

      if (response.data?.list) {
        allRows.push(...response.data.list);
      }

      // Check if there are more pages
      const pageInfo = response.data?.page_info;
      if (pageInfo) {
        if (currentPage === 1) {
          logger.info("tiktok", `Pagination: total_page=${pageInfo.total_page}, total_number=${pageInfo.total_number}, page_size=${pageInfo.page_size}`);
        }
        hasMore = currentPage < pageInfo.total_page;
        currentPage++;
      } else {
        hasMore = false;
      }

      // Safety limit to prevent infinite loops
      if (currentPage > 100) {
        logger.warn("tiktok", "Reached page limit of 100");
        break;
      }
    }

    logger.info("tiktok", `fetchAllPages complete: ${allRows.length} total rows across ${currentPage - 1} pages`);
    return allRows;
  }

  /**
   * Execute a planned query with result merging
   */
  async executeQueryPlan(
    plan: TikTokQueryPlan,
    fetchAll: boolean = false
  ): Promise<{
    data: TikTokInsightRow[];
    debug: {
      requestCount: number;
      totalRows: number;
      executionTimeMs: number;
      warnings: string[];
    };
  }> {
    const startTime = Date.now();
    const resultSets: TikTokInsightRow[][] = [];

    // Execute all requests
    for (const request of plan.requests) {
      try {
        const rows = fetchAll
          ? await this.fetchAllPages(request)
          : (await this.fetchBasicReport(request)).data?.list || [];
        resultSets.push(rows);
      } catch (error) {
        logger.error("tiktok", "Error executing TikTok API request", error);
        throw error;
      }
    }

    // Flatten nested TikTok response structure (metrics/dimensions objects)
    logger.debug("tiktok", `Raw result sets count: ${resultSets.length}`);
    if (resultSets.length > 0 && resultSets[0].length > 0) {
      logger.debug("tiktok", `Raw first row before flatten: ${JSON.stringify(resultSets[0][0], null, 2)}`);
    }

    const flattenedResults = resultSets.map(rows =>
      rows.map(row => flattenTikTokRow(row))
    );

    if (flattenedResults.length > 0 && flattenedResults[0].length > 0) {
      logger.debug("tiktok", `First row after flatten: ${JSON.stringify(flattenedResults[0][0], null, 2)}`);
    }

    // Merge results
    let mergedData = mergeResults(flattenedResults, plan.joinKeys);
    logger.debug("tiktok", `Merged data rows: ${mergedData.length}`);
    if (mergedData.length > 0) {
      logger.debug("tiktok", `Merged row keys: ${Object.keys(mergedData[0])}`);
    }

    // Enrich with calculated metrics
    logger.debug("tiktok", `Calculated metrics to add: ${plan.calculatedMetrics}`);
    if (plan.calculatedMetrics.length > 0) {
      mergedData = enrichWithCalculatedMetrics(mergedData, plan.calculatedMetrics);
      logger.debug("tiktok", `After enrichment, row keys: ${mergedData.length > 0 ? Object.keys(mergedData[0]) : []}`);
    }

    mergedData = mergedData.map(row => canonicalizeMetricAliases(row));

    // Debug: Check which metrics are missing from the response
    if (mergedData.length > 0) {
      const allRequestedMetrics = plan.requests.flatMap((r) => r.metrics);
      const missingMetrics = findMissingMetricsInRow(allRequestedMetrics, mergedData[0]);
      if (missingMetrics.length > 0) {
        logger.warn("tiktok", `Metrics with no data in response: ${missingMetrics}`);
      } else {
        logger.debug("tiktok", "All requested metrics have data in response");
      }
    }

    const executionTimeMs = Date.now() - startTime;

    return {
      data: mergedData,
      debug: {
        requestCount: plan.requests.length,
        totalRows: mergedData.length,
        executionTimeMs,
        warnings: plan.warnings,
      },
    };
  }
}
