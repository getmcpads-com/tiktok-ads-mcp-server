/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TikTokApiException, TikTokClient } from "./client.js";
import { validateQuery } from "./compatibility-rules.js";
import { planQuery } from "./query-planner.js";
import { enrichWithCalculatedMetrics } from "./calculated-metrics.js";
import { getApiFieldsForMetrics } from "./metric-catalog.js";
import { formatMcpToolError } from "../../core/errors.js";
import type { TikTokConfig } from "../../config.js";
import { registerTikTokBroadReadTools } from "./broad-read.js";

const advertiserIdSchema = z.string().describe("TikTok advertiser ID");
const limitSchema = z.number().int().min(1).max(1000).optional().default(100);
const TIKTOK_API_VERSION = "v1.3";

type AgentResponseRecord = Record<string, unknown>;
type AuctionDataLevel = "AUCTION_ADVERTISER" | "AUCTION_CAMPAIGN" | "AUCTION_ADGROUP" | "AUCTION_AD";

function isAgentResponseRecord(value: unknown): value is AgentResponseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwnField(value: AgentResponseRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function getDebugRecord(payload: AgentResponseRecord): AgentResponseRecord {
  return isAgentResponseRecord(payload["debug"]) ? payload["debug"] : {};
}

function getRequestCount(payload: AgentResponseRecord): number {
  const debug = getDebugRecord(payload);
  const requestCount = debug["requestCount"];
  return typeof requestCount === "number" ? requestCount : 1;
}

function getWarnings(payload: AgentResponseRecord): unknown[] {
  if (Array.isArray(payload["warnings"])) return payload["warnings"];

  const debug = getDebugRecord(payload);
  return Array.isArray(debug["warnings"]) ? debug["warnings"] : [];
}

function withAgentResponseContract(data: unknown): unknown {
  if (!isAgentResponseRecord(data)) return data;

  return {
    ...data,
    warnings: hasOwnField(data, "warnings") ? data["warnings"] : getWarnings(data),
    limitations: hasOwnField(data, "limitations") ? data["limitations"] : [],
    nextActions: hasOwnField(data, "nextActions") ? data["nextActions"] : [],
    debug: {
      ...getDebugRecord(data),
      source: "tiktok_ads",
      apiVersion: TIKTOK_API_VERSION,
      requestCount: getRequestCount(data),
    },
  };
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(withAgentResponseContract(data), null, 2) }] };
}

function defaultDimensionForDataLevel(dataLevel: AuctionDataLevel): string {
  switch (dataLevel) {
    case "AUCTION_ADVERTISER":
      return "advertiser_id";
    case "AUCTION_ADGROUP":
      return "adgroup_id";
    case "AUCTION_AD":
      return "ad_id";
    case "AUCTION_CAMPAIGN":
    default:
      return "campaign_id";
  }
}

type ApiObject = Record<string, unknown>;

type EndpointAttempt = {
  label: string;
  endpoint: string;
  ok: boolean;
  data?: unknown;
  warning?: string;
  code?: number;
  requestId?: string;
};

function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object") {
      search.set(key, JSON.stringify(value));
    } else {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

function buildEndpoint(path: string, params: Record<string, unknown>): string {
  const query = toQueryString(params);
  return query ? `${path}?${query}` : path;
}

function describeEndpointError(label: string, error: unknown): Pick<EndpointAttempt, "warning" | "code" | "requestId"> {
  if (error instanceof TikTokApiException) {
    return {
      warning: `${label} unavailable: ${error.message}`,
      code: error.code,
      requestId: error.requestId || undefined,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return { warning: `${label} unavailable: ${message}` };
}

async function fetchOptional(
  client: TikTokClient,
  label: string,
  path: string,
  params: Record<string, unknown>,
): Promise<EndpointAttempt> {
  try {
    const data = await client.fetchUrl(buildEndpoint(path, params));
    return { label, endpoint: path, ok: true, data };
  } catch (error) {
    return {
      label,
      endpoint: path,
      ok: false,
      ...describeEndpointError(label, error),
    };
  }
}

async function fetchFirstAvailable(
  client: TikTokClient,
  attempts: Array<{ label: string; path: string; params: Record<string, unknown> }>,
): Promise<{ selected?: EndpointAttempt; attempts: EndpointAttempt[] }> {
  const completed: EndpointAttempt[] = [];
  for (const attempt of attempts) {
    const result = await fetchOptional(client, attempt.label, attempt.path, attempt.params);
    completed.push(result);
    if (result.ok) return { selected: result, attempts: completed };
  }
  return { attempts: completed };
}

function isObject(value: unknown): value is ApiObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asObject(value: unknown): ApiObject | undefined {
  return isObject(value) ? value : undefined;
}

function getDataObject(value: unknown): ApiObject {
  const root = asObject(value);
  return asObject(root?.["data"]) ?? {};
}

function getDataList<T extends ApiObject = ApiObject>(value: unknown): T[] {
  const list = getDataObject(value)["list"];
  return Array.isArray(list) ? list.filter(isObject) as T[] : [];
}

function getPageInfo(value: unknown): unknown {
  return getDataObject(value)["page_info"];
}

function fieldAsString(row: ApiObject, key: string): string | undefined {
  const value = row[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function fieldAsNumber(row: ApiObject | undefined, key: string): number | undefined {
  if (!row) return undefined;
  const value = row[key];
  return typeof value === "number" ? value : undefined;
}

function fieldAsFloat(row: ApiObject | undefined, key: string): number | undefined {
  if (!row) return undefined;
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").replace(/%$/, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function firstString(row: ApiObject | undefined, keys: string[]): string | undefined {
  if (!row) return undefined;
  for (const key of keys) {
    const value = fieldAsString(row, key);
    if (value) return value;
  }
  return undefined;
}

function stringArrayFromField(row: ApiObject, key: string): string[] {
  const value = row[key];
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).filter(Boolean);
  }
  const single = fieldAsString(row, key);
  return single ? [single] : [];
}

function valuesFromUnknown(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.flatMap(valuesFromUnknown);
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return valuesFromUnknown(JSON.parse(trimmed));
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }
  if (isObject(value)) return Object.values(value).flatMap(valuesFromUnknown);
  return [];
}

function targetingValues(row: ApiObject, keys: string[]): string[] {
  const containers = [
    row,
    asObject(row["targeting"]),
    asObject(row["targeting_info"]),
    asObject(row["targeting_spec"]),
  ].filter(Boolean) as ApiObject[];

  return unique(containers.flatMap((container) => keys.flatMap((key) => valuesFromUnknown(container[key]))));
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter(Boolean) as string[])];
}

function pixelIdsFromRows(rows: ApiObject[]): string[] {
  return unique(rows.map((row) => firstString(row, ["pixel_id", "pixel_code", "event_source_id", "pixelCode"])));
}

function countBy(rows: ApiObject[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const value = fieldAsString(row, field) ?? "UNKNOWN";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function compactObject<T extends ApiObject>(value: T): ApiObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => (
      entry !== undefined
      && entry !== null
      && (!Array.isArray(entry) || entry.length > 0)
    )),
  );
}

function attemptSummary(attempt: EndpointAttempt, includeData = false): ApiObject {
  return compactObject({
    label: attempt.label,
    endpoint: attempt.endpoint,
    ok: attempt.ok,
    data: includeData && attempt.ok ? attempt.data : undefined,
    warning: attempt.warning,
    code: attempt.code,
    requestId: attempt.requestId,
  });
}

function defaultDateRange(daysBack = 7): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - daysBack);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function deliveryDiagnostics(campaigns: ApiObject[], adgroups: ApiObject[], ads: ApiObject[]): string[] {
  const warnings: string[] = [];
  const inactiveCampaigns = campaigns.filter((row) => fieldAsString(row, "operation_status") !== "ENABLE");
  const inactiveAdgroups = adgroups.filter((row) => fieldAsString(row, "operation_status") !== "ENABLE");
  const inactiveAds = ads.filter((row) => fieldAsString(row, "operation_status") !== "ENABLE");

  if (inactiveCampaigns.length > 0) warnings.push(`${inactiveCampaigns.length} campaign(s) are not ENABLE by operation_status.`);
  if (inactiveAdgroups.length > 0) warnings.push(`${inactiveAdgroups.length} ad group(s) are not ENABLE by operation_status.`);
  if (inactiveAds.length > 0) warnings.push(`${inactiveAds.length} ad(s) are not ENABLE by operation_status.`);

  const reviewLikeAds = ads.filter((row) => {
    const status = `${fieldAsString(row, "status") ?? ""} ${fieldAsString(row, "secondary_status") ?? ""}`.toUpperCase();
    return status.includes("REVIEW") || status.includes("REJECT") || status.includes("DISAPPROV");
  });
  if (reviewLikeAds.length > 0) warnings.push(`${reviewLikeAds.length} ad(s) appear to be in review, rejected, or disapproved.`);

  return warnings;
}

function flattenApiRow(row: ApiObject): ApiObject {
  const flattened: ApiObject = {};
  const dimensions = asObject(row["dimensions"]);
  const metrics = asObject(row["metrics"]);

  if (dimensions) Object.assign(flattened, dimensions);
  if (metrics) Object.assign(flattened, metrics);

  for (const [key, value] of Object.entries(row)) {
    if (key !== "dimensions" && key !== "metrics") flattened[key] = value;
  }

  return flattened;
}

function getReportRows(value: unknown): ApiObject[] {
  return getDataList(value).map(flattenApiRow);
}

function resolveApiMetrics(metrics: string[]): string[] {
  return metrics.map((metric) => getApiFieldsForMetrics([metric])[0] ?? metric);
}

function reportParams(input: {
  advertiserId: string;
  dataLevel: string;
  dimensions: string[];
  metrics: string[];
  startDate: string;
  endDate: string;
  limit: number;
  reportType?: string;
  orderField?: string;
  orderType?: "ASC" | "DESC";
  filtering?: unknown[];
}): Record<string, unknown> {
  return compactObject({
    advertiser_id: input.advertiserId,
    service_type: "AUCTION",
    report_type: input.reportType ?? "BASIC",
    data_level: input.dataLevel,
    dimensions: input.dimensions,
    metrics: resolveApiMetrics(input.metrics),
    start_date: input.startDate,
    end_date: input.endDate,
    page_size: input.limit,
    order_field: input.orderField,
    order_type: input.orderType,
    filtering: input.filtering,
  });
}

function groupRowsBy(rows: ApiObject[], key: string): Map<string, ApiObject[]> {
  const grouped = new Map<string, ApiObject[]>();
  for (const row of rows) {
    const value = fieldAsString(row, key);
    if (!value) continue;
    const existing = grouped.get(value) ?? [];
    existing.push(row);
    grouped.set(value, existing);
  }
  return grouped;
}

function hasNumericField(rows: ApiObject[], key: string): boolean {
  return rows.some((row) => fieldAsFloat(row, key) !== undefined);
}

function sumField(rows: ApiObject[], key: string): number {
  return rows.reduce((total, row) => total + (fieldAsFloat(row, key) ?? 0), 0);
}

function sumFirstAvailableField(rows: ApiObject[], keys: string[]): { key?: string; value: number } {
  for (const key of keys) {
    if (hasNumericField(rows, key)) return { key, value: sumField(rows, key) };
  }
  return { value: 0 };
}

function listFromAttempt(attempt: EndpointAttempt | undefined): ApiObject[] {
  return attempt?.ok ? getDataList(attempt.data) : [];
}

function reportRowsFromAttempt(attempt: EndpointAttempt | undefined): ApiObject[] {
  return attempt?.ok ? getReportRows(attempt.data) : [];
}

function safeDivide(numerator: number, denominator: number): number | undefined {
  return denominator > 0 ? numerator / denominator : undefined;
}

function percentChange(previous: number, current: number): number | undefined {
  if (previous === 0) return current === 0 ? 0 : undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function round(value: number | undefined, digits = 4): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function jaccard(left: string[], right: string[]): number | undefined {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 && b.size === 0) return undefined;
  const intersection = [...a].filter((entry) => b.has(entry)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : undefined;
}

export function registerTikTokTools(server: McpServer, config: TikTokConfig): void {
  const client = new TikTokClient(config.accessToken, config.defaultAdvertiserId, "v1.3", config.appId, config.appSecret);

  // ── P0. tiktok_health_check ────────────────────────────────────────
  server.tool(
    "tiktok_health_check",
    "Read-only health check for TikTok credentials, accessible advertisers, and advertiser info. Never returns tokens or secrets.",
    {
      advertiserId: advertiserIdSchema.optional().describe("Advertiser ID to verify. Defaults to TIKTOK_ADVERTISER_ID, then the first accessible advertiser."),
    },
    async ({ advertiserId }) => {
      try {
        const warnings: string[] = [];
        const requestedAdvertiserId = advertiserId ?? config.defaultAdvertiserId;

        let advertisers: unknown;
        let advertiserList: ApiObject[] = [];
        let advertisersCheck: ApiObject;
        try {
          advertisers = await client.getAdvertisers();
          advertiserList = getDataList(advertisers);
          advertisersCheck = {
            ok: true,
            count: advertiserList.length,
            advertisers: advertiserList.map((row) => compactObject({
              advertiser_id: fieldAsString(row, "advertiser_id"),
              advertiser_name: fieldAsString(row, "advertiser_name"),
              status: fieldAsString(row, "status"),
              currency: fieldAsString(row, "currency"),
              timezone: fieldAsString(row, "timezone"),
            })),
          };
        } catch (error) {
          const details = describeEndpointError("advertiser listing", error);
          warnings.push(details.warning ?? "Advertiser listing unavailable.");
          advertisersCheck = { ok: false, ...details };
        }

        const resolvedAdvertiserId = requestedAdvertiserId ?? firstString(advertiserList[0], ["advertiser_id"]);
        let advertiserInfoCheck: ApiObject = {
          ok: false,
          warning: "No advertiserId was provided and no accessible advertiser could be selected.",
        };

        if (resolvedAdvertiserId) {
          try {
            const info = await client.getAdvertiserInfo([resolvedAdvertiserId]);
            advertiserInfoCheck = {
              ok: true,
              advertiserId: resolvedAdvertiserId,
              data: info,
            };
          } catch (error) {
            const details = describeEndpointError("advertiser info", error);
            warnings.push(details.warning ?? "Advertiser info unavailable.");
            advertiserInfoCheck = { ok: false, advertiserId: resolvedAdvertiserId, ...details };
          }
        } else {
          warnings.push(String(advertiserInfoCheck["warning"]));
        }

        const credentials = {
          accessTokenConfigured: Boolean(config.accessToken),
          appIdConfigured: Boolean(config.appId),
          appSecretConfigured: Boolean(config.appSecret),
          defaultAdvertiserIdConfigured: Boolean(config.defaultAdvertiserId),
          defaultAdvertiserId: config.defaultAdvertiserId,
        };

        return ok({
          status: warnings.length === 0 ? "ok" : "degraded",
          credentials,
          selectedAdvertiserId: resolvedAdvertiserId,
          checks: {
            advertisers: advertisersCheck,
            advertiserInfo: advertiserInfoCheck,
          },
          warnings,
          security: {
            tokensReturned: false,
            secretsReturned: false,
          },
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── 1. tiktok_list_advertisers ─────────────────────────────────────
  server.tool(
    "tiktok_list_advertisers",
    "List all TikTok advertiser accounts accessible with the current token. Returns advertiser ID, name, and status.",
    {},
    async () => {
      try {
        const advertisers = await client.getAdvertisers();
        return ok(advertisers);
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── 2. tiktok_get_advertiser_info ──────────────────────────────────
  server.tool(
    "tiktok_get_advertiser_info",
    "Get detailed information for specific TikTok advertiser accounts: currency, timezone, status, balance.",
    { advertiserIds: z.array(z.string()).min(1).describe("One or more advertiser IDs") },
    async ({ advertiserIds }) => {
      try {
        const info = await client.getAdvertiserInfo(advertiserIds);
        return ok(info);
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── 3. tiktok_get_campaigns ────────────────────────────────────────
  server.tool(
    "tiktok_get_campaigns",
    "List campaigns for a TikTok advertiser account. Returns campaign ID, name, status, budget, and objective.",
    {
      advertiserId: advertiserIdSchema,
      statusFilter: z.enum(["CAMPAIGN_STATUS_ENABLE", "CAMPAIGN_STATUS_DISABLE", "CAMPAIGN_STATUS_DELETE"]).optional(),
      limit: limitSchema,
    },
    async ({ advertiserId, statusFilter, limit }) => {
      try {
        const params: Record<string, string> = {
          advertiser_id: advertiserId,
          page_size: String(limit),
          fields: JSON.stringify(["campaign_id", "campaign_name", "campaign_type", "budget", "budget_mode", "status", "operation_status", "objective_type", "create_time", "modify_time"]),
        };
        if (statusFilter) params.filtering = JSON.stringify({ status: statusFilter });
        const result = await client.fetchUrl(`/campaign/get/?${new URLSearchParams(params).toString()}`);
        return ok(result);
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── 4. tiktok_get_adgroups ─────────────────────────────────────────
  server.tool(
    "tiktok_get_adgroups",
    "List ad groups for a TikTok advertiser. Returns targeting, budget, optimization goal, and schedule info.",
    {
      advertiserId: advertiserIdSchema,
      campaignId: z.string().optional().describe("Filter by campaign ID"),
      limit: limitSchema,
    },
    async ({ advertiserId, campaignId, limit }) => {
      try {
        const params: Record<string, string> = {
          advertiser_id: advertiserId,
          page_size: String(limit),
          fields: JSON.stringify(["adgroup_id", "adgroup_name", "campaign_id", "operation_status", "budget", "budget_mode", "optimization_goal", "bid_type", "bid_price", "placement_type", "schedule_start_time", "schedule_end_time"]),
        };
        if (campaignId) params.filtering = JSON.stringify({ campaign_ids: [campaignId] });
        const result = await client.fetchUrl(`/adgroup/get/?${new URLSearchParams(params).toString()}`);
        return ok(result);
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── 5. tiktok_get_ads ──────────────────────────────────────────────
  server.tool(
    "tiktok_get_ads",
    "List ads for a TikTok advertiser. Returns ad ID, name, operation status, and creative info.",
    {
      advertiserId: advertiserIdSchema,
      adgroupId: z.string().optional().describe("Filter by ad group ID"),
      limit: limitSchema,
    },
    async ({ advertiserId, adgroupId, limit }) => {
      try {
        const params: Record<string, string> = {
          advertiser_id: advertiserId,
          page_size: String(limit),
          fields: JSON.stringify(["ad_id", "ad_name", "adgroup_id", "campaign_id", "operation_status", "creative_type", "ad_text", "image_ids", "video_id", "landing_page_url", "call_to_action"]),
        };
        if (adgroupId) params.filtering = JSON.stringify({ adgroup_ids: [adgroupId] });
        const result = await client.fetchUrl(`/ad/get/?${new URLSearchParams(params).toString()}`);
        return ok(result);
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── 6. tiktok_get_insights ─────────────────────────────────────────
  server.tool(
    "tiktok_get_insights",
    `Query TikTok Ads performance insights. Supports 400+ metrics with intelligent query planning.
Use tiktok://metrics resource to see available metrics. Use tiktok://dimensions for dimensions.
The query planner automatically splits requests when dimension combinations are incompatible (only 1 ID dimension + 1 time dimension allowed per request).`,
    {
      advertiserId: advertiserIdSchema,
      metrics: z.array(z.string()).min(1).describe("Metric keys from tiktok://metrics (e.g., spend, impressions, clicks)"),
      dimensions: z.array(z.string()).optional().describe("Dimension keys from tiktok://dimensions (e.g., stat_time_day, campaign_id)"),
      dataLevel: z.enum(["AUCTION_ADVERTISER", "AUCTION_CAMPAIGN", "AUCTION_ADGROUP", "AUCTION_AD"]).optional().default("AUCTION_CAMPAIGN"),
      startDate: z.string().describe("Start date YYYY-MM-DD"),
      endDate: z.string().describe("End date YYYY-MM-DD"),
      queryLifetime: z.boolean().optional().default(false).describe("Query lifetime metrics (cannot use time dimensions)"),
      limit: z.number().int().min(1).max(1000).optional().default(500),
    },
    async ({ advertiserId, metrics, dimensions, dataLevel, startDate, endDate, queryLifetime, limit }) => {
      try {
        const startTime = Date.now();
        const resolvedDataLevel = dataLevel as AuctionDataLevel;
        const effectiveDimensions = dimensions && dimensions.length > 0
          ? dimensions
          : [defaultDimensionForDataLevel(resolvedDataLevel)];

        const plan = planQuery({
          advertiserId,
          serviceType: "AUCTION",
          reportType: "BASIC",
          dataLevel: resolvedDataLevel,
          dimensions: effectiveDimensions,
          metrics,
          startDate,
          endDate,
          queryLifetime,
          pageSize: limit,
        });

        if (plan.errors.length > 0) {
          return ok({
            error: "Query validation failed",
            errors: plan.errors,
            warnings: plan.warnings,
            suggestion: "Check tiktok://compatibility for dimension grouping rules",
          });
        }

        const result = await client.executeQueryPlan(plan, true);

        // Enrich with calculated metrics
        let data = result.data ?? [];
        if (plan.calculatedMetrics.length > 0) {
          data = enrichWithCalculatedMetrics(data, plan.calculatedMetrics);
        }

        // Enrich with entity names
        if (effectiveDimensions.some(d => ["campaign_id", "adgroup_id", "ad_id"].includes(d))) {
          data = await client.enrichWithEntityNames(data, advertiserId);
        }

        return ok({
          data,
          rowCount: data.length,
          debug: {
            requestCount: plan.requests.length,
            executionTimeMs: Date.now() - startTime,
            warnings: [
              ...plan.warnings,
              ...(!dimensions || dimensions.length === 0 ? [`No dimension provided; defaulted to ${effectiveDimensions[0]} because TikTok reports require at least one dimension.`] : []),
            ],
            calculatedMetrics: plan.calculatedMetrics,
          },
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── 7. tiktok_get_creatives ────────────────────────────────────────
  server.tool(
    "tiktok_get_creatives",
    "Get creative details (video, image, text) for specific ads in a TikTok advertiser account.",
    {
      advertiserId: advertiserIdSchema,
      adIds: z.array(z.string()).optional().describe("Specific ad IDs to get creatives for"),
      limit: limitSchema,
    },
    async ({ advertiserId, adIds, limit }) => {
      try {
        const params: Record<string, string> = {
          advertiser_id: advertiserId,
          page_size: String(limit),
          fields: JSON.stringify(["ad_id", "ad_name", "creative_type", "ad_text", "ad_texts", "video_id", "image_ids", "landing_page_url", "landing_page_urls", "call_to_action", "display_name", "avatar_icon_web_uri"]),
        };
        if (adIds && adIds.length > 0) params.filtering = JSON.stringify({ ad_ids: adIds });
        const result = await client.fetchUrl(`/ad/get/?${new URLSearchParams(params).toString()}`);
        return ok(result);
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── 8. tiktok_get_audiences ────────────────────────────────────────
  server.tool(
    "tiktok_get_audiences",
    "List custom and lookalike audiences for a TikTok advertiser account.",
    {
      advertiserId: advertiserIdSchema,
      limit: limitSchema,
    },
    async ({ advertiserId, limit }) => {
      try {
        const params: Record<string, string> = {
          advertiser_id: advertiserId,
          page_size: String(limit),
        };
        const result = await client.fetchUrl(`/dmp/custom_audience/list/?${new URLSearchParams(params).toString()}`);
        return ok(result);
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── 9. tiktok_search_keywords ──────────────────────────────────────
  server.tool(
    "tiktok_search_keywords",
    "Get keyword suggestions for TikTok Search Ads. Returns recommended keywords with search volume estimates.",
    {
      advertiserId: advertiserIdSchema,
      keywords: z.array(z.string()).min(1).describe("Seed keywords to get suggestions for"),
      limit: z.number().int().min(1).max(50).optional().default(20),
    },
    async ({ advertiserId, keywords, limit }) => {
      try {
        const params: Record<string, string> = {
          advertiser_id: advertiserId,
          keywords: JSON.stringify(keywords),
          page_size: String(limit),
        };
        const result = await client.fetchUrl(`/search/keyword/recommend/?${new URLSearchParams(params).toString()}`);
        return ok(result);
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── 10. tiktok_validate_query ──────────────────────────────────────
  server.tool(
    "tiktok_validate_query",
    "Validate a TikTok metric/dimension combination BEFORE executing. Checks dimension grouping rules, lifetime compatibility, and metric/dimension compatibility.",
    {
      metrics: z.array(z.string()).min(1).describe("Metric keys to validate"),
      dimensions: z.array(z.string()).optional().describe("Dimension keys to validate"),
      dataLevel: z.enum(["AUCTION_ADVERTISER", "AUCTION_CAMPAIGN", "AUCTION_ADGROUP", "AUCTION_AD"]).optional().default("AUCTION_CAMPAIGN"),
      queryLifetime: z.boolean().optional().default(false),
    },
    async ({ metrics, dimensions, dataLevel, queryLifetime }) => {
      try {
        const resolvedDataLevel = dataLevel as AuctionDataLevel;
        const effectiveDimensions = dimensions && dimensions.length > 0
          ? dimensions
          : [defaultDimensionForDataLevel(resolvedDataLevel)];
        const result = validateQuery(
          metrics,
          effectiveDimensions,
          resolvedDataLevel,
          queryLifetime,
        );
        return ok({
          ...result,
          dimensions: effectiveDimensions,
          warnings: [
            ...result.warnings,
            ...(!dimensions || dimensions.length === 0 ? [`No dimension provided; defaulted to ${effectiveDimensions[0]} because TikTok reports require at least one dimension.`] : []),
          ],
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── P0. tiktok_get_pixels ──────────────────────────────────────────
  server.tool(
    "tiktok_get_pixels",
    "List TikTok pixels and, when permissions allow it, pixel event metadata for an advertiser. Falls back with explicit warnings when endpoints are unavailable.",
    {
      advertiserId: advertiserIdSchema,
      bcId: z.string().optional().describe("Optional Business Center ID. Defaults to TIKTOK_BC_ID/TIKTOK_BUSINESS_CENTER_ID for BC pixel endpoints."),
      pixelIds: z.array(z.string()).optional().describe("Optional pixel IDs/codes to inspect. If omitted, the tool discovers pixels from BC pixel endpoints first, then advertiser pixel/list."),
      includeEvents: z.boolean().optional().default(true).describe("Also try to fetch pixel events for discovered or provided pixel IDs."),
      limit: limitSchema,
    },
    async ({ advertiserId, bcId, pixelIds, includeEvents, limit }) => {
      try {
        const warnings: string[] = [];
        const effectiveBcId = bcId ?? config.defaultBusinessCenterId;
        const pixelInventoryAttempts = await fetchFirstAvailable(client, [
          ...(effectiveBcId ? [{
            label: "business center pixel get",
            path: "/bc/pixel/get/",
            params: {
              advertiser_id: advertiserId,
              bc_id: effectiveBcId,
              page_size: limit,
            },
          }] : []),
          {
            label: "advertiser pixel list",
            path: "/pixel/list/",
            params: {
              advertiser_id: advertiserId,
              page_size: limit,
            },
          },
        ]);
        if (!pixelInventoryAttempts.selected) {
          for (const attempt of pixelInventoryAttempts.attempts) {
            if (attempt.warning) warnings.push(attempt.warning);
          }
        }

        const pixelsAttempt = pixelInventoryAttempts.selected;
        const pixelRows = pixelsAttempt?.ok ? getDataList(pixelsAttempt.data) : [];
        const discoveredPixelIds = unique([
          ...(pixelIds ?? []),
          ...pixelIdsFromRows(pixelRows),
        ]);

        const linkAttempts: EndpointAttempt[] = [];
        if (effectiveBcId) {
          for (const pixelId of discoveredPixelIds.slice(0, Math.min(limit, 20))) {
            linkAttempts.push(await fetchOptional(client, `business center pixel links for ${pixelId}`, "/bc/pixel/link/get/", {
              advertiser_id: advertiserId,
              bc_id: effectiveBcId,
              pixel_code: pixelId,
              page_size: limit,
            }));
          }
        }

        const eventAttempts: EndpointAttempt[] = [];
        if (includeEvents) {
          for (const pixelId of discoveredPixelIds) {
            const result = await fetchOptional(client, `pixel events for ${pixelId}`, "/pixel/event/list/", {
              advertiser_id: advertiserId,
              pixel_id: pixelId,
              page_size: limit,
            });
            eventAttempts.push(result);
            if (!result.ok && result.warning) warnings.push(result.warning);
          }

          if (discoveredPixelIds.length === 0) {
            warnings.push("No pixel IDs were provided or discovered, so pixel event lookup was skipped.");
          }
        }

        return ok({
          advertiserId,
          bcId: effectiveBcId,
          pixels: {
            ok: Boolean(pixelsAttempt?.ok),
            source: pixelsAttempt?.label,
            data: pixelsAttempt?.ok ? pixelsAttempt.data : undefined,
            pageInfo: pixelsAttempt?.ok ? getPageInfo(pixelsAttempt.data) : undefined,
          },
          inventoryAttempts: pixelInventoryAttempts.attempts.map((attempt) => compactObject({
            label: attempt.label,
            endpoint: attempt.endpoint,
            ok: attempt.ok,
            warning: attempt.warning,
            code: attempt.code,
            requestId: attempt.requestId,
          })),
          pixelIds: discoveredPixelIds,
          links: linkAttempts.map((attempt) => compactObject({
            pixelId: attempt.label.replace("business center pixel links for ", ""),
            ok: attempt.ok,
            endpoint: attempt.endpoint,
            data: attempt.ok ? attempt.data : undefined,
            warning: attempt.warning,
            code: attempt.code,
            requestId: attempt.requestId,
          })),
          events: eventAttempts.map((attempt) => compactObject({
            pixelId: attempt.label.replace("pixel events for ", ""),
            ok: attempt.ok,
            endpoint: attempt.endpoint,
            data: attempt.ok ? attempt.data : undefined,
            warning: attempt.warning,
            code: attempt.code,
            requestId: attempt.requestId,
          })),
          warnings,
          permissionNote: "Configured TikTok pixel scopes are Business Center pixel scopes. /bc/pixel/get/ and /bc/pixel/link/get/ are read-only; /bc/pixel/link/update/ and /bc/pixel/transfer/ are write/admin flows and are intentionally not used by this read-only MCP.",
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── P0. tiktok_get_events ──────────────────────────────────────────
  server.tool(
    "tiktok_get_events",
    "Discover pixel/app events or accessible tracking diagnostics for an advertiser. Uses best-effort endpoint checks plus reporting dimensions as fallback.",
    {
      advertiserId: advertiserIdSchema,
      bcId: z.string().optional().describe("Optional Business Center ID. Defaults to TIKTOK_BC_ID/TIKTOK_BUSINESS_CENTER_ID for BC pixel discovery."),
      pixelId: z.string().optional().describe("Optional pixel ID for pixel event lookup."),
      appId: z.string().optional().describe("Optional TikTok app ID for app event lookup when the endpoint is available."),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD for tracking diagnostics. Defaults to 7 days ago."),
      endDate: z.string().optional().describe("End date YYYY-MM-DD for tracking diagnostics. Defaults to today."),
      limit: limitSchema,
    },
    async ({ advertiserId, bcId, pixelId, appId, startDate, endDate, limit }) => {
      try {
        const dates = defaultDateRange();
        const effectiveStartDate = startDate ?? dates.startDate;
        const effectiveEndDate = endDate ?? dates.endDate;
        const warnings: string[] = [];
        const attempts: EndpointAttempt[] = [];
        const effectiveBcId = bcId ?? config.defaultBusinessCenterId;

        if (pixelId) {
          attempts.push(await fetchOptional(client, "pixel event list", "/pixel/event/list/", {
            advertiser_id: advertiserId,
            pixel_id: pixelId,
            page_size: limit,
          }));
        } else {
          const pixelInventory = await fetchFirstAvailable(client, [
            ...(effectiveBcId ? [{
              label: "business center pixel get for event discovery",
              path: "/bc/pixel/get/",
              params: {
                advertiser_id: advertiserId,
                bc_id: effectiveBcId,
                page_size: limit,
              },
            }] : []),
            {
              label: "advertiser pixel list for event discovery",
              path: "/pixel/list/",
              params: {
                advertiser_id: advertiserId,
                page_size: limit,
              },
            },
          ]);
          attempts.push(...pixelInventory.attempts);
          const discoveredPixelIds = pixelInventory.selected?.ok
            ? pixelIdsFromRows(getDataList(pixelInventory.selected.data)).slice(0, 10)
            : [];
          for (const discoveredPixelId of discoveredPixelIds) {
            attempts.push(await fetchOptional(client, `pixel events for ${discoveredPixelId}`, "/pixel/event/list/", {
              advertiser_id: advertiserId,
              pixel_id: discoveredPixelId,
              page_size: limit,
            }));
          }
        }

        attempts.push(await fetchOptional(client, "app list", "/app/list/", {
          advertiser_id: advertiserId,
          page_size: limit,
        }));

        if (appId) {
          attempts.push(await fetchOptional(client, "app event list", "/app/event/list/", {
            advertiser_id: advertiserId,
            app_id: appId,
            page_size: limit,
          }));
        }

        const diagnostics = await fetchFirstAvailable(client, [
          {
            label: "tracking diagnostics by event and source",
            path: "/report/integrated/get/",
            params: {
              advertiser_id: advertiserId,
              service_type: "AUCTION",
              report_type: "BASIC",
              data_level: "AUCTION_ADVERTISER",
              dimensions: ["custom_event_type", "event_source_id"],
              metrics: ["conversion", "complete_payment", "app_install"],
              start_date: effectiveStartDate,
              end_date: effectiveEndDate,
              page_size: Math.min(limit, 1000),
            },
          },
          {
            label: "tracking diagnostics by event type",
            path: "/report/integrated/get/",
            params: {
              advertiser_id: advertiserId,
              service_type: "AUCTION",
              report_type: "BASIC",
              data_level: "AUCTION_ADVERTISER",
              dimensions: ["custom_event_type"],
              metrics: ["conversion", "complete_payment", "app_install"],
              start_date: effectiveStartDate,
              end_date: effectiveEndDate,
              page_size: Math.min(limit, 1000),
            },
          },
          {
            label: "tracking diagnostics by event source",
            path: "/report/integrated/get/",
            params: {
              advertiser_id: advertiserId,
              service_type: "AUCTION",
              report_type: "BASIC",
              data_level: "AUCTION_ADVERTISER",
              dimensions: ["event_source_id"],
              metrics: ["conversion", "complete_payment", "app_install"],
              start_date: effectiveStartDate,
              end_date: effectiveEndDate,
              page_size: Math.min(limit, 1000),
            },
          },
          {
            label: "tracking diagnostics aggregate",
            path: "/report/integrated/get/",
            params: {
              advertiser_id: advertiserId,
              service_type: "AUCTION",
              report_type: "BASIC",
              data_level: "AUCTION_ADVERTISER",
              dimensions: [],
              metrics: ["conversion", "complete_payment", "app_install"],
              start_date: effectiveStartDate,
              end_date: effectiveEndDate,
              page_size: Math.min(limit, 1000),
            },
          },
        ]);
        attempts.push(...diagnostics.attempts);

        for (const attempt of attempts) {
          if (!attempt.ok && attempt.warning) warnings.push(attempt.warning);
        }

        return ok({
          advertiserId,
          dateRange: { startDate: effectiveStartDate, endDate: effectiveEndDate },
          sources: attempts.map((attempt) => compactObject({
            label: attempt.label,
            endpoint: attempt.endpoint,
            ok: attempt.ok,
            data: attempt.ok ? attempt.data : undefined,
            warning: attempt.warning,
            code: attempt.code,
            requestId: attempt.requestId,
          })),
          warnings,
          fallbackNote: diagnostics.selected?.ok
            ? `Used ${diagnostics.selected.label} as tracking diagnostics.`
            : "Direct event endpoints and reporting diagnostics may require additional TikTok permissions.",
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── P0. tiktok_get_delivery_status ─────────────────────────────────
  server.tool(
    "tiktok_get_delivery_status",
    "Aggregate campaign, ad group, and ad delivery status/operation_status with simple diagnostics.",
    {
      advertiserId: advertiserIdSchema,
      campaignId: z.string().optional().describe("Optional campaign ID filter."),
      adgroupId: z.string().optional().describe("Optional ad group ID filter."),
      includeAds: z.boolean().optional().default(true).describe("Include ad-level status diagnostics."),
      limit: limitSchema,
    },
    async ({ advertiserId, campaignId, adgroupId, includeAds, limit }) => {
      try {
        const warnings: string[] = [];

        const campaignFiltering = campaignId ? { campaign_ids: [campaignId] } : undefined;
        const campaignsAttempt = await fetchOptional(client, "campaign delivery status", "/campaign/get/", {
          advertiser_id: advertiserId,
          page_size: limit,
          fields: ["campaign_id", "campaign_name", "operation_status", "objective_type", "budget", "budget_mode", "create_time", "modify_time"],
          filtering: campaignFiltering,
        });
        if (!campaignsAttempt.ok && campaignsAttempt.warning) warnings.push(campaignsAttempt.warning);
        const campaigns = campaignsAttempt.ok ? getDataList(campaignsAttempt.data) : [];

        const adgroupFiltering = compactObject({
          campaign_ids: campaignId ? [campaignId] : undefined,
          adgroup_ids: adgroupId ? [adgroupId] : undefined,
        });
        const adgroupsAttempt = await fetchOptional(client, "ad group delivery status", "/adgroup/get/", {
          advertiser_id: advertiserId,
          page_size: limit,
          fields: ["adgroup_id", "adgroup_name", "campaign_id", "operation_status", "optimization_goal", "billing_event", "budget", "budget_mode", "schedule_start_time", "schedule_end_time"],
          ...(Object.keys(adgroupFiltering).length > 0 && { filtering: adgroupFiltering }),
        });
        if (!adgroupsAttempt.ok && adgroupsAttempt.warning) warnings.push(adgroupsAttempt.warning);
        const adgroups = adgroupsAttempt.ok ? getDataList(adgroupsAttempt.data) : [];

        const adsFiltering = compactObject({
          campaign_ids: campaignId ? [campaignId] : undefined,
          adgroup_ids: adgroupId ? [adgroupId] : undefined,
        });
        const adsAttempt = includeAds
          ? await fetchOptional(client, "ad delivery status", "/ad/get/", {
            advertiser_id: advertiserId,
            page_size: limit,
            fields: ["ad_id", "ad_name", "adgroup_id", "campaign_id", "operation_status", "creative_type", "modify_time"],
            ...(Object.keys(adsFiltering).length > 0 && { filtering: adsFiltering }),
          })
          : undefined;
        if (adsAttempt && !adsAttempt.ok && adsAttempt.warning) warnings.push(adsAttempt.warning);
        const ads = adsAttempt?.ok ? getDataList(adsAttempt.data) : [];

        const diagnostics = deliveryDiagnostics(campaigns, adgroups, ads);

        return ok({
          advertiserId,
          filters: compactObject({ campaignId, adgroupId }),
          summary: {
            campaigns: {
              count: campaigns.length,
              status: countBy(campaigns, "status"),
              operationStatus: countBy(campaigns, "operation_status"),
            },
            adgroups: {
              count: adgroups.length,
              status: countBy(adgroups, "status"),
              operationStatus: countBy(adgroups, "operation_status"),
              secondaryStatus: countBy(adgroups, "secondary_status"),
            },
            ads: {
              count: ads.length,
              status: countBy(ads, "status"),
              operationStatus: countBy(ads, "operation_status"),
              secondaryStatus: countBy(ads, "secondary_status"),
            },
          },
          diagnostics,
          data: compactObject({
            campaigns: campaignsAttempt.ok ? campaignsAttempt.data : undefined,
            adgroups: adgroupsAttempt.ok ? adgroupsAttempt.data : undefined,
            ads: adsAttempt?.ok ? adsAttempt.data : undefined,
          }),
          warnings,
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── P1. tiktok_get_async_report_status ─────────────────────────────
  server.tool(
    "tiktok_get_async_report_status",
    "Check a TikTok async report task status by taskId when async report endpoints are available. No report creation or mutation is performed.",
    {
      advertiserId: advertiserIdSchema,
      taskId: z.string().describe("Async report task ID returned by TikTok report task creation outside this read-only MCP."),
    },
    async ({ advertiserId, taskId }) => {
      try {
        const { selected, attempts } = await fetchFirstAvailable(client, [
          { label: "async report task check", path: "/report/task/check/", params: { advertiser_id: advertiserId, task_id: taskId } },
          { label: "async report task get", path: "/report/task/get/", params: { advertiser_id: advertiserId, task_id: taskId } },
          { label: "async report task list filter", path: "/report/task/list/", params: { advertiser_id: advertiserId, task_id: taskId } },
        ]);

        return ok({
          advertiserId,
          taskId,
          status: selected?.ok ? "available" : "unavailable",
          data: selected?.data,
          attempts: attempts.map((attempt) => compactObject({
            label: attempt.label,
            endpoint: attempt.endpoint,
            ok: attempt.ok,
            warning: attempt.warning,
            code: attempt.code,
            requestId: attempt.requestId,
          })),
          warnings: selected?.ok ? [] : [
            "Async report status endpoints were not accessible with the current token/API version.",
            "See tiktok://recipes for the read-only async report status recipe and expected endpoint candidates.",
          ],
          resource: "tiktok://recipes",
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── P1. tiktok_get_video_assets ────────────────────────────────────
  server.tool(
    "tiktok_get_video_assets",
    "Return ad-linked TikTok video asset metadata from ad/get and video material endpoints when available.",
    {
      advertiserId: advertiserIdSchema,
      adIds: z.array(z.string()).optional().describe("Optional ad IDs to inspect."),
      adgroupId: z.string().optional().describe("Optional ad group ID filter."),
      videoIds: z.array(z.string()).optional().describe("Optional video IDs to look up directly in material endpoints."),
      limit: limitSchema,
    },
    async ({ advertiserId, adIds, adgroupId, videoIds, limit }) => {
      try {
        const warnings: string[] = [];
        const adFiltering = compactObject({
          ad_ids: adIds,
          adgroup_ids: adgroupId ? [adgroupId] : undefined,
        });
        const adAttempt = await fetchOptional(client, "ad creative video fields", "/ad/get/", {
          advertiser_id: advertiserId,
          page_size: limit,
          fields: ["ad_id", "ad_name", "adgroup_id", "campaign_id", "operation_status", "creative_type", "ad_text", "ad_texts", "video_id", "landing_page_url", "landing_page_urls", "call_to_action", "display_name", "tiktok_item_id"],
          ...(Object.keys(adFiltering).length > 0 && { filtering: adFiltering }),
        });
        if (!adAttempt.ok && adAttempt.warning) warnings.push(adAttempt.warning);

        const ads = adAttempt.ok ? getDataList(adAttempt.data) : [];
        const fetchedAdIds = unique(ads.map((row) => fieldAsString(row, "ad_id")));
        const discoveredVideoIds = unique([
          ...(videoIds ?? []),
          ...ads.flatMap((row) => stringArrayFromField(row, "video_id")),
          ...ads.flatMap((row) => stringArrayFromField(row, "video_ids")),
        ]);
        const adIdsWithVideo = unique(ads
          .filter((row) => stringArrayFromField(row, "video_id").length > 0 || stringArrayFromField(row, "video_ids").length > 0)
          .map((row) => fieldAsString(row, "ad_id")));
        const requestedAdIdsWithoutFetchedAd = (adIds ?? []).filter((id) => !fetchedAdIds.includes(id));
        const fetchedAdIdsWithoutVideo = fetchedAdIds.filter((id) => !adIdsWithVideo.includes(id));
        if (adIds && requestedAdIdsWithoutFetchedAd.length > 0) {
          warnings.push(`${requestedAdIdsWithoutFetchedAd.length} requested adIds were not returned by /ad/get/. They may be inaccessible, deleted, or outside the advertiser scope.`);
        }
        if (fetchedAdIdsWithoutVideo.length > 0) {
          warnings.push(`${fetchedAdIdsWithoutVideo.length} fetched ads did not expose video_id/video_ids. For Spark/static/image ads, use tiktok_get_spark_organic_joins or inspect landing_page_url directly from ad fields.`);
        }

        const materialAttempts: EndpointAttempt[] = [];
        if (discoveredVideoIds.length > 0) {
          materialAttempts.push(await fetchOptional(client, "video material info", "/file/video/ad/info/", {
            advertiser_id: advertiserId,
            video_ids: discoveredVideoIds.slice(0, 100),
          }));
          materialAttempts.push(await fetchOptional(client, "video material search", "/file/video/ad/search/", {
            advertiser_id: advertiserId,
            video_ids: discoveredVideoIds.slice(0, 100),
            page_size: Math.min(limit, 100),
          }));
        } else {
          warnings.push("No video IDs were provided or discovered from ads.");
        }

        for (const attempt of materialAttempts) {
          if (!attempt.ok && attempt.warning) warnings.push(attempt.warning);
        }

        const materialRows = materialAttempts.flatMap((attempt) => attempt.ok ? getDataList(attempt.data) : []);
        const materialByVideoId = new Map<string, ApiObject>();
        for (const row of materialRows) {
          const videoId = firstString(row, ["video_id", "material_id", "id"]);
          if (videoId && !materialByVideoId.has(videoId)) materialByVideoId.set(videoId, row);
        }

        const assets = discoveredVideoIds.map((videoId) => {
          const linkedAds = ads.filter((row) => stringArrayFromField(row, "video_id").includes(videoId) || stringArrayFromField(row, "video_ids").includes(videoId));
          const material = materialByVideoId.get(videoId);
          const nestedVideoInfo = asObject(material?.["video_info"]);
          const videoInfo = nestedVideoInfo ?? material;

          return compactObject({
            video_id: videoId,
            duration: fieldAsNumber(videoInfo, "duration"),
            preview_url: firstString(videoInfo, ["preview_url", "preview", "preview_web_uri", "video_url"]),
            thumbnail_url: firstString(videoInfo, ["thumbnail_url", "cover_image_url", "cover_url", "poster_url"]),
            width: fieldAsNumber(videoInfo, "width"),
            height: fieldAsNumber(videoInfo, "height"),
            file_name: firstString(videoInfo, ["file_name", "filename", "video_name"]),
            linked_ads: linkedAds.map((row) => compactObject({
              ad_id: fieldAsString(row, "ad_id"),
              ad_name: fieldAsString(row, "ad_name"),
              campaign_id: fieldAsString(row, "campaign_id"),
              adgroup_id: fieldAsString(row, "adgroup_id"),
              ad_text: fieldAsString(row, "ad_text"),
              ad_texts: row["ad_texts"],
              landing_page_url: fieldAsString(row, "landing_page_url"),
              landing_page_urls: row["landing_page_urls"],
              call_to_action: fieldAsString(row, "call_to_action"),
              tiktok_item_id: fieldAsString(row, "tiktok_item_id"),
            })),
            raw_material: material,
          });
        });

        return ok({
          advertiserId,
          videoIds: discoveredVideoIds,
          assets,
          adCoverage: {
            requestedAdIds: adIds?.length ?? null,
            fetchedAds: fetchedAdIds.length,
            adIdsWithVideo: adIdsWithVideo.length,
            fetchedAdIdsWithoutVideo,
            requestedAdIdsWithoutFetchedAd,
          },
          source: {
            ads: adAttempt.ok ? adAttempt.data : undefined,
            materialAttempts: materialAttempts.map((attempt) => compactObject({
              label: attempt.label,
              endpoint: attempt.endpoint,
              ok: attempt.ok,
              warning: attempt.warning,
              code: attempt.code,
              requestId: attempt.requestId,
            })),
          },
          warnings,
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── P1. tiktok_get_spark_ads ───────────────────────────────────────
  server.tool(
    "tiktok_get_spark_ads",
    "Return Spark Ads context from ad fields when available, with a conservative fallback if Spark-specific fields are not supported.",
    {
      advertiserId: advertiserIdSchema,
      adIds: z.array(z.string()).optional().describe("Optional ad IDs to inspect."),
      adgroupId: z.string().optional().describe("Optional ad group ID filter."),
      limit: limitSchema,
    },
    async ({ advertiserId, adIds, adgroupId, limit }) => {
      try {
        const filtering = compactObject({
          ad_ids: adIds,
          adgroup_ids: adgroupId ? [adgroupId] : undefined,
        });
        const commonParams = {
          advertiser_id: advertiserId,
          page_size: limit,
          ...(Object.keys(filtering).length > 0 && { filtering }),
        };
        const expanded = await fetchOptional(client, "spark ad fields", "/ad/get/", {
          ...commonParams,
          fields: ["ad_id", "ad_name", "campaign_id", "adgroup_id", "operation_status", "creative_type", "ad_text", "video_id", "landing_page_url", "identity_type", "identity_id", "identity_authorized_bc_id", "tiktok_item_id"],
        });
        const fallback = expanded.ok ? undefined : await fetchOptional(client, "conservative ad fields", "/ad/get/", {
          ...commonParams,
          fields: ["ad_id", "ad_name", "campaign_id", "adgroup_id", "operation_status", "creative_type", "ad_text", "video_id", "landing_page_url"],
        });
        const selected = expanded.ok ? expanded : fallback;
        const ads = selected?.ok ? getDataList(selected.data) : [];
        const sparkAds = ads.filter((row) => {
          const marker = [
            fieldAsString(row, "tiktok_item_id"),
            fieldAsString(row, "identity_type"),
          ].join(" ").toUpperCase();
          return marker.includes("SPARK") || Boolean(fieldAsString(row, "tiktok_item_id"));
        });

        const warnings = [
          ...(!expanded.ok && expanded.warning ? [expanded.warning] : []),
          ...(fallback && !fallback.ok && fallback.warning ? [fallback.warning] : []),
          ...(expanded.ok ? [] : ["Spark-specific fields were unavailable; returned conservative ad fields where possible."]),
          ...(sparkAds.length === 0 ? ["No Spark Ads markers were found in accessible ad fields."] : []),
        ];

        return ok({
          advertiserId,
          sparkAds: sparkAds.map((row) => compactObject({
            ad_id: fieldAsString(row, "ad_id"),
            ad_name: fieldAsString(row, "ad_name"),
            campaign_id: fieldAsString(row, "campaign_id"),
            adgroup_id: fieldAsString(row, "adgroup_id"),
            status: fieldAsString(row, "status"),
            operation_status: fieldAsString(row, "operation_status"),
            identity_type: fieldAsString(row, "identity_type"),
            identity_id: fieldAsString(row, "identity_id"),
            identity_authorized_bc_id: fieldAsString(row, "identity_authorized_bc_id"),
            tiktok_item_id: fieldAsString(row, "tiktok_item_id"),
            video_id: fieldAsString(row, "video_id"),
            ad_text: fieldAsString(row, "ad_text"),
            landing_page_url: fieldAsString(row, "landing_page_url"),
            raw: row,
          })),
          source: {
            selectedEndpoint: selected?.endpoint,
            expandedAttempt: compactObject({
              ok: expanded.ok,
              endpoint: expanded.endpoint,
              warning: expanded.warning,
              code: expanded.code,
              requestId: expanded.requestId,
            }),
            fallbackAttempt: fallback ? compactObject({
              ok: fallback.ok,
              endpoint: fallback.endpoint,
              warning: fallback.warning,
              code: fallback.code,
              requestId: fallback.requestId,
            }) : undefined,
          },
          warnings,
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // ── P1. tiktok_get_audience_details ────────────────────────────────
  server.tool(
    "tiktok_get_audience_details",
    "Get custom/lookalike/saved audience details where TikTok DMP endpoints are accessible. Read-only only.",
    {
      advertiserId: advertiserIdSchema,
      audienceIds: z.array(z.string()).optional().describe("Optional custom/lookalike audience IDs. If omitted, lists available audiences."),
      includeSavedAudiences: z.boolean().optional().default(true).describe("Also include saved audience targeting details when available."),
      limit: limitSchema,
    },
    async ({ advertiserId, audienceIds, includeSavedAudiences, limit }) => {
      try {
        const warnings: string[] = [];
        const customAttempts: EndpointAttempt[] = [];

        if (audienceIds && audienceIds.length > 0) {
          customAttempts.push(await fetchOptional(client, "custom audience detail by audience_ids", "/dmp/custom_audience/get/", {
            advertiser_id: advertiserId,
            audience_ids: audienceIds,
          }));
          customAttempts.push(await fetchOptional(client, "custom audience detail by custom_audience_ids", "/dmp/custom_audience/get/", {
            advertiser_id: advertiserId,
            custom_audience_ids: audienceIds,
          }));
        }

        const listAttempt = await fetchOptional(client, "custom audience list", "/dmp/custom_audience/list/", {
          advertiser_id: advertiserId,
          page_size: limit,
        });
        customAttempts.push(listAttempt);

        const savedAttempt = includeSavedAudiences
          ? await fetchOptional(client, "saved audience list", "/dmp/saved_audience/list/", {
            advertiser_id: advertiserId,
            page_size: limit,
          })
          : undefined;

        for (const attempt of customAttempts) {
          if (!attempt.ok && attempt.warning) warnings.push(attempt.warning);
        }
        if (savedAttempt && !savedAttempt.ok && savedAttempt.warning) warnings.push(savedAttempt.warning);

        const customAudienceRows = customAttempts.flatMap((attempt) => attempt.ok ? getDataList(attempt.data) : []);
        const dedupedCustomAudiences = new Map<string, ApiObject>();
        for (const row of customAudienceRows) {
          const id = firstString(row, ["audience_id", "custom_audience_id"]);
          if (id && !dedupedCustomAudiences.has(id)) dedupedCustomAudiences.set(id, row);
        }

        const savedAudienceRows = savedAttempt?.ok ? getDataList(savedAttempt.data) : [];

        return ok({
          advertiserId,
          requestedAudienceIds: audienceIds,
          customAudiences: [...dedupedCustomAudiences.values()].map((row) => compactObject({
            audience_id: firstString(row, ["audience_id", "custom_audience_id"]),
            name: fieldAsString(row, "name"),
            audience_type: fieldAsString(row, "audience_type"),
            subtype: fieldAsString(row, "subtype"),
            status: fieldAsString(row, "status"),
            cover_num: row["cover_num"],
            is_creator: row["is_creator"],
            is_valid: row["is_valid"],
            retention_days: row["retention_days"],
            lookalike_spec: row["lookalike_spec"],
            create_time: fieldAsString(row, "create_time"),
            raw: row,
          })),
          savedAudiences: savedAudienceRows.map((row) => compactObject({
            saved_audience_id: fieldAsString(row, "saved_audience_id"),
            name: fieldAsString(row, "name"),
            create_time: fieldAsString(row, "create_time"),
            modify_time: fieldAsString(row, "modify_time"),
            targeting: row["targeting"],
            raw: row,
          })),
          attempts: [
            ...customAttempts,
            ...(savedAttempt ? [savedAttempt] : []),
          ].map((attempt) => compactObject({
            label: attempt.label,
            endpoint: attempt.endpoint,
            ok: attempt.ok,
            warning: attempt.warning,
            code: attempt.code,
            requestId: attempt.requestId,
          })),
          warnings,
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // -- P2. tiktok_get_shop_catalog_diagnostics ------------------------
  server.tool(
    "tiktok_get_shop_catalog_diagnostics",
    "Read-only TikTok Shop/catalog/e-commerce diagnostics. Tries catalog reporting first, then Shop auction metrics, and returns endpoint warnings when catalog permissions are unavailable.",
    {
      advertiserId: advertiserIdSchema,
      startDate: z.string().optional().describe("Start date YYYY-MM-DD. Defaults to 14 days ago."),
      endDate: z.string().optional().describe("End date YYYY-MM-DD. Defaults to today."),
      dimension: z.enum(["catalog_id", "product_id", "sku_id", "product_set_id", "campaign_id", "adgroup_id", "ad_id"]).optional().default("product_id"),
      includeDaily: z.boolean().optional().default(false).describe("Add stat_time_day to report dimensions where supported."),
      catalogId: z.string().optional().describe("Optional catalog ID for product/product-set inventory endpoint attempts."),
      bcId: z.string().optional().describe("Optional TikTok Business Center ID. Defaults to TIKTOK_BC_ID/TIKTOK_BUSINESS_CENTER_ID, then advertiser discovery."),
      productIds: z.array(z.string()).optional().describe("Optional product IDs to filter report rows where supported."),
      limit: limitSchema,
    },
    async ({ advertiserId, startDate, endDate, dimension, includeDaily, catalogId, bcId, productIds, limit }) => {
      try {
        const dates = defaultDateRange(14);
        const effectiveStartDate = startDate ?? dates.startDate;
        const effectiveEndDate = endDate ?? dates.endDate;
        const filtering = productIds && productIds.length > 0
          ? [{ field_name: "product_id", filter_type: "IN", filter_value: productIds }]
          : undefined;
        const reportDimensions = unique([dimension, includeDaily ? "stat_time_day" : undefined]);
        const catalogMetrics = [
          "spend",
          "impressions",
          "clicks",
          "ctr",
          "cpc",
          "complete_payment",
          "total_complete_payment_value",
          "web_event_add_to_cart",
          "initiate_checkout",
          "cost_per_complete_payment",
        ];
        const shopMetrics = [
          "spend",
          "impressions",
          "clicks",
          "product_details_page_browse_shop",
          "add_to_cart_shop",
          "checkout_shop",
          "complete_payment_shop",
          "onsite_complete_payment_value",
          "cost_per_complete_payment_shop",
          "onsite_shopping_roas",
          "shop_total_items_purchased",
        ];
        const safeMetrics = ["spend", "impressions", "clicks", "ctr", "cpc", "cpm"];

        const report = await fetchFirstAvailable(client, [
          {
            label: `catalog report by ${dimension}`,
            path: "/report/integrated/get/",
            params: reportParams({
              advertiserId,
              reportType: "CATALOG",
              dataLevel: "AUCTION_AD",
              dimensions: reportDimensions,
              metrics: catalogMetrics,
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              limit,
              filtering,
            }),
          },
          {
            label: "catalog report by campaign with safe metrics",
            path: "/report/integrated/get/",
            params: reportParams({
              advertiserId,
              reportType: "CATALOG",
              dataLevel: "AUCTION_CAMPAIGN",
              dimensions: unique(["campaign_id", includeDaily ? "stat_time_day" : undefined]),
              metrics: safeMetrics,
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              limit,
            }),
          },
          {
            label: "shop auction report by ad with shop metrics",
            path: "/report/integrated/get/",
            params: reportParams({
              advertiserId,
              dataLevel: "AUCTION_AD",
              dimensions: unique(["ad_id", includeDaily ? "stat_time_day" : undefined]),
              metrics: shopMetrics,
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              limit,
            }),
          },
          {
            label: "shop auction report by campaign with safe metrics",
            path: "/report/integrated/get/",
            params: reportParams({
              advertiserId,
              dataLevel: "AUCTION_CAMPAIGN",
              dimensions: unique(["campaign_id", includeDaily ? "stat_time_day" : undefined]),
              metrics: safeMetrics,
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              limit,
            }),
          },
        ]);

        const advertiserInfoAttempt = await fetchOptional(client, "advertiser info for business center discovery", "/advertiser/info/", {
          advertiser_ids: [advertiserId],
        });
        let advertiserListAttempt: EndpointAttempt;
        try {
          advertiserListAttempt = {
            label: "oauth advertiser list for business center discovery",
            endpoint: "oauth2/advertiser/get",
            ok: true,
            data: await client.getAdvertisers(),
          };
        } catch (error) {
          advertiserListAttempt = {
            label: "oauth advertiser list for business center discovery",
            endpoint: "oauth2/advertiser/get",
            ok: false,
            ...describeEndpointError("oauth advertiser list for business center discovery", error),
          };
        }
        const advertiserRows = [
          ...listFromAttempt(advertiserInfoAttempt),
          ...listFromAttempt(advertiserListAttempt),
        ];
        const matchingAdvertiser = advertiserRows.find((row) => fieldAsString(row, "advertiser_id") === advertiserId)
          ?? advertiserRows[0];
        const discoveredBcId = bcId
          ?? config.defaultBusinessCenterId
          ?? firstString(matchingAdvertiser, ["bc_id", "business_center_id", "bc_advertiser_id"]);
        const catalogInventory = await fetchFirstAvailable(client, [
          {
            label: "catalog get by business center",
            path: "/catalog/get/",
            params: compactObject({ advertiser_id: advertiserId, bc_id: discoveredBcId, page_size: limit }),
          },
          {
            label: "catalog get by advertiser only",
            path: "/catalog/get/",
            params: { advertiser_id: advertiserId, page_size: limit },
          },
        ]);

        const productAttempts: EndpointAttempt[] = [];
        if (catalogId) {
          productAttempts.push(await fetchOptional(client, "catalog product get", "/catalog/product/get/", {
            advertiser_id: advertiserId,
            bc_id: discoveredBcId,
            catalog_id: catalogId,
            product_ids: productIds,
            page_size: limit,
          }));
          productAttempts.push(await fetchOptional(client, "catalog product set list", "/catalog/product_set/list/", {
            advertiser_id: advertiserId,
            bc_id: discoveredBcId,
            catalog_id: catalogId,
            page_size: limit,
          }));
        }

        const reportRows = report.selected?.ok ? getReportRows(report.selected.data) : [];
        const impressions = sumFirstAvailableField(reportRows, ["impressions"]);
        const clicks = sumFirstAvailableField(reportRows, ["clicks"]);
        const spend = sumFirstAvailableField(reportRows, ["spend"]);
        const productViews = sumFirstAvailableField(reportRows, ["onsite_on_web_detail", "product_details_page_browse_shop", "product_details_page_browse"]);
        const addToCart = sumFirstAvailableField(reportRows, ["onsite_on_web_cart", "add_to_cart_shop", "web_event_add_to_cart"]);
        const checkout = sumFirstAvailableField(reportRows, ["onsite_initiate_checkout_count", "checkout_shop", "initiate_checkout"]);
        const purchases = sumFirstAvailableField(reportRows, ["onsite_shopping", "complete_payment_shop", "complete_payment"]);
        const purchaseValue = sumFirstAvailableField(reportRows, ["total_onsite_shopping_value", "onsite_complete_payment_value", "total_complete_payment_value"]);

        const allAttempts = [
          advertiserInfoAttempt,
          advertiserListAttempt,
          ...report.attempts,
          ...catalogInventory.attempts,
          ...productAttempts,
        ];
        const warnings = [
          ...allAttempts.flatMap((attempt) => attempt.warning ? [attempt.warning] : []),
          ...(!discoveredBcId ? ["No bcId was provided, configured, or discovered. Catalog inventory endpoints may require bc_id; pass bcId explicitly if known or set TIKTOK_BC_ID."] : []),
          ...(!catalogId ? ["catalogId was not provided, so product and product-set endpoint checks were skipped."] : []),
        ];

        return ok({
          advertiserId,
          businessCenterId: discoveredBcId,
          dateRange: { startDate: effectiveStartDate, endDate: effectiveEndDate },
          selectedReport: report.selected ? attemptSummary(report.selected) : undefined,
          summary: {
            rowCount: reportRows.length,
            impressions,
            clicks,
            spend,
            productViews,
            addToCart,
            checkout,
            purchases,
            purchaseValue,
            clickThroughRate: round(safeDivide(clicks.value, impressions.value), 6),
            productViewRateFromClicks: round(safeDivide(productViews.value, clicks.value), 6),
            cartRateFromProductViews: round(safeDivide(addToCart.value, productViews.value), 6),
            purchaseRateFromProductViews: round(safeDivide(purchases.value, productViews.value), 6),
            roas: round(safeDivide(purchaseValue.value, spend.value), 4),
            averageOrderValue: round(safeDivide(purchaseValue.value, purchases.value), 4),
          },
          topRows: reportRows.slice(0, 25),
          inventory: {
            selectedCatalogEndpoint: catalogInventory.selected ? attemptSummary(catalogInventory.selected, true) : undefined,
            productEndpointAttempts: productAttempts.map((attempt) => attemptSummary(attempt)),
          },
          attempts: allAttempts.map((attempt) => attemptSummary(attempt)),
          warnings,
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // -- P2. tiktok_get_search_ads_maturity -----------------------------
  server.tool(
    "tiktok_get_search_ads_maturity",
    "Diagnose TikTok Search Ads maturity from keyword/search-term reporting and optional keyword recommendation endpoints. Read-only diagnostics only.",
    {
      advertiserId: advertiserIdSchema,
      startDate: z.string().optional().describe("Start date YYYY-MM-DD. Defaults to 14 days ago."),
      endDate: z.string().optional().describe("End date YYYY-MM-DD. Defaults to today."),
      dataLevel: z.enum(["AUCTION_ADVERTISER", "AUCTION_CAMPAIGN", "AUCTION_ADGROUP"]).optional().default("AUCTION_ADGROUP"),
      seedKeywords: z.array(z.string()).optional().describe("Optional seed keywords for keyword recommendation endpoint diagnostics."),
      limit: limitSchema,
    },
    async ({ advertiserId, startDate, endDate, dataLevel, seedKeywords, limit }) => {
      try {
        const dates = defaultDateRange(14);
        const effectiveStartDate = startDate ?? dates.startDate;
        const effectiveEndDate = endDate ?? dates.endDate;
        const idDimensionByLevel = {
          AUCTION_ADVERTISER: "advertiser_id",
          AUCTION_CAMPAIGN: "campaign_id",
          AUCTION_ADGROUP: "adgroup_id",
        } as const;
        const idDimension = idDimensionByLevel[dataLevel];
        const searchMetrics = ["spend", "impressions", "clicks", "ctr", "cpc", "cpm"];

        const keywordReport = await fetchFirstAvailable(client, [
          {
            label: "search keyword report",
            path: "/report/integrated/get/",
            params: reportParams({
              advertiserId,
              dataLevel,
              dimensions: [idDimension, "search_keyword"],
              metrics: searchMetrics,
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              limit,
            }),
          },
          {
            label: "search keyword report with match type",
            path: "/report/integrated/get/",
            params: reportParams({
              advertiserId,
              dataLevel,
              dimensions: [idDimension, "search_keyword", "match_type"],
              metrics: searchMetrics,
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              limit,
            }),
          },
        ]);

        const termsReport = await fetchFirstAvailable(client, [
          {
            label: "search terms report",
            path: "/report/integrated/get/",
            params: reportParams({
              advertiserId,
              dataLevel,
              dimensions: [idDimension, "search_terms"],
              metrics: searchMetrics,
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              limit,
            }),
          },
          {
            label: "standalone search terms report",
            path: "/report/integrated/get/",
            params: reportParams({
              advertiserId,
              dataLevel,
              dimensions: ["search_terms"],
              metrics: searchMetrics,
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              limit,
            }),
          },
        ]);

        const keywordRecommendations = seedKeywords && seedKeywords.length > 0
          ? await fetchOptional(client, "keyword recommendation", "/search/keyword/recommend/", {
            advertiser_id: advertiserId,
            keywords: seedKeywords,
            page_size: Math.min(limit, 50),
          })
          : undefined;

        const keywordRows = keywordReport.selected?.ok ? getReportRows(keywordReport.selected.data) : [];
        const termRows = termsReport.selected?.ok ? getReportRows(termsReport.selected.data) : [];
        const scoringRows = keywordRows.length > 0 ? keywordRows : termRows;
        const spend = sumFirstAvailableField(scoringRows, ["spend"]);
        const impressions = sumFirstAvailableField(scoringRows, ["impressions"]);
        const clicks = sumFirstAvailableField(scoringRows, ["clicks"]);
        const matchTypes = countBy(keywordRows, "match_type");
        const lowCtrTerms = termRows
          .filter((row) => (fieldAsFloat(row, "impressions") ?? 0) >= 100 && (fieldAsFloat(row, "ctr") ?? 0) < 1)
          .slice(0, 20);
        const highSpendTerms = [...termRows]
          .sort((a, b) => (fieldAsFloat(b, "spend") ?? 0) - (fieldAsFloat(a, "spend") ?? 0))
          .slice(0, 20);

        const signals = [
          { name: "search_keyword_reporting", ok: keywordRows.length > 0, detail: `${keywordRows.length} keyword row(s)` },
          { name: "search_term_mining", ok: termRows.length > 0, detail: `${termRows.length} search-term row(s)` },
          { name: "match_type_visibility", ok: Object.keys(matchTypes).filter((key) => key !== "UNKNOWN").length > 0, detail: matchTypes },
          { name: "measurable_search_spend", ok: spend.value > 0, detail: spend },
          { name: "keyword_recommendations", ok: Boolean(keywordRecommendations?.ok), detail: keywordRecommendations ? attemptSummary(keywordRecommendations) : "seedKeywords not provided" },
        ];
        const maturityScore = Math.round((signals.filter((signal) => signal.ok).length / signals.length) * 100);

        const recommendations = [
          ...(keywordRows.length === 0 ? ["Enable or verify Search Ads keyword reporting access; keyword-level maturity cannot be assessed from current endpoints."] : []),
          ...(termRows.length === 0 ? ["Add search-term mining to the weekly workflow once search_terms reporting is available."] : []),
          ...(Object.keys(matchTypes).filter((key) => key !== "UNKNOWN").length < 2 ? ["Broaden diagnostics by comparing exact, phrase, and broad match_type rows when available."] : []),
          ...(lowCtrTerms.length > 0 ? ["Review low-CTR search terms for negative intent and creative-message mismatch."] : []),
          ...(keywordRecommendations?.ok ? ["Use recommendation rows as expansion candidates, then validate with search_terms performance before scaling."] : []),
        ];
        const attempts = [
          ...keywordReport.attempts,
          ...termsReport.attempts,
          ...(keywordRecommendations ? [keywordRecommendations] : []),
        ];

        return ok({
          advertiserId,
          dateRange: { startDate: effectiveStartDate, endDate: effectiveEndDate },
          maturityScore,
          signals,
          totals: {
            spend,
            impressions,
            clicks,
            ctr: round(safeDivide(clicks.value, impressions.value), 6),
          },
          matchTypes,
          mining: {
            highSpendTerms,
            lowCtrTerms,
          },
          recommendations,
          attempts: attempts.map((attempt) => attemptSummary(attempt)),
          warnings: attempts.flatMap((attempt) => attempt.warning ? [attempt.warning] : []),
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // -- P2. tiktok_get_creative_fatigue_recipes ------------------------
  server.tool(
    "tiktok_get_creative_fatigue_recipes",
    "Find likely creative fatigue patterns from ad-level daily reporting and return read-only refresh recipes. Does not create, edit, or upload creatives.",
    {
      advertiserId: advertiserIdSchema,
      startDate: z.string().optional().describe("Start date YYYY-MM-DD. Defaults to 14 days ago."),
      endDate: z.string().optional().describe("End date YYYY-MM-DD. Defaults to today."),
      minImpressions: z.number().int().min(1).optional().default(1000),
      declineThresholdPct: z.number().min(1).max(95).optional().default(25),
      limit: limitSchema,
    },
    async ({ advertiserId, startDate, endDate, minImpressions, declineThresholdPct, limit }) => {
      try {
        const dates = defaultDateRange(14);
        const effectiveStartDate = startDate ?? dates.startDate;
        const effectiveEndDate = endDate ?? dates.endDate;
        const fullMetrics = [
          "spend",
          "impressions",
          "clicks",
          "ctr",
          "cpc",
          "cpm",
          "reach",
          "frequency",
          "video_play_actions",
          "video_watched_2s",
          "video_views_p50",
          "video_views_p100",
          "likes",
          "comments",
          "shares",
        ];
        const report = await fetchFirstAvailable(client, [
          {
            label: "ad daily creative fatigue report",
            path: "/report/integrated/get/",
            params: reportParams({
              advertiserId,
              dataLevel: "AUCTION_AD",
              dimensions: ["ad_id", "stat_time_day"],
              metrics: fullMetrics,
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              limit,
            }),
          },
          {
            label: "ad daily basic fatigue report",
            path: "/report/integrated/get/",
            params: reportParams({
              advertiserId,
              dataLevel: "AUCTION_AD",
              dimensions: ["ad_id", "stat_time_day"],
              metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "cpm"],
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              limit,
            }),
          },
        ]);

        const adsAttempt = await fetchOptional(client, "ad creative fields", "/ad/get/", {
          advertiser_id: advertiserId,
          page_size: limit,
          fields: ["ad_id", "ad_name", "campaign_id", "adgroup_id", "creative_type", "ad_text", "video_id", "landing_page_url", "call_to_action", "modify_time", "create_time"],
        });

        const rows = report.selected?.ok ? getReportRows(report.selected.data) : [];
        const adRows = adsAttempt.ok ? getDataList(adsAttempt.data) : [];
        const adInfoById = new Map<string, ApiObject>();
        for (const ad of adRows) {
          const adId = fieldAsString(ad, "ad_id");
          if (adId) adInfoById.set(adId, ad);
        }

        const summarizePeriod = (periodRows: ApiObject[]) => {
          const impressions = sumFirstAvailableField(periodRows, ["impressions"]);
          const clicks = sumFirstAvailableField(periodRows, ["clicks"]);
          const spend = sumFirstAvailableField(periodRows, ["spend"]);
          const reach = sumFirstAvailableField(periodRows, ["reach"]);
          const videoStarts = sumFirstAvailableField(periodRows, ["video_play_actions"]);
          const twoSecondViews = sumFirstAvailableField(periodRows, ["video_watched_2s"]);
          const completions = sumFirstAvailableField(periodRows, ["video_views_p100"]);
          const frequencyValues = periodRows.map((row) => fieldAsFloat(row, "frequency")).filter((value): value is number => value !== undefined);
          const averageFrequency = frequencyValues.length > 0
            ? frequencyValues.reduce((total, value) => total + value, 0) / frequencyValues.length
            : undefined;
          return {
            impressions,
            clicks,
            spend,
            reach,
            ctr: round(safeDivide(clicks.value, impressions.value), 6),
            cpc: round(safeDivide(spend.value, clicks.value), 4),
            cpm: round(impressions.value > 0 ? (spend.value / impressions.value) * 1000 : undefined, 4),
            frequency: round(reach.value > 0 ? safeDivide(impressions.value, reach.value) : averageFrequency, 4),
            hookRate: round(safeDivide(twoSecondViews.value, impressions.value), 6),
            completionRate: round(safeDivide(completions.value, videoStarts.value), 6),
          };
        };

        const fatigueCandidates = [...groupRowsBy(rows, "ad_id").entries()].map(([adId, adReportRows]) => {
          const sortedRows = [...adReportRows].sort((a, b) => (fieldAsString(a, "stat_time_day") ?? "").localeCompare(fieldAsString(b, "stat_time_day") ?? ""));
          const splitAt = Math.max(1, Math.floor(sortedRows.length / 2));
          const firstPeriod = summarizePeriod(sortedRows.slice(0, splitAt));
          const secondPeriod = summarizePeriod(sortedRows.slice(splitAt));
          const totalImpressions = firstPeriod.impressions.value + secondPeriod.impressions.value;
          const ctrDropPct = firstPeriod.ctr !== undefined && secondPeriod.ctr !== undefined
            ? percentChange(firstPeriod.ctr, secondPeriod.ctr)
            : undefined;
          const cpcIncreasePct = firstPeriod.cpc !== undefined && secondPeriod.cpc !== undefined
            ? percentChange(firstPeriod.cpc, secondPeriod.cpc)
            : undefined;
          const completionDropPct = firstPeriod.completionRate !== undefined && secondPeriod.completionRate !== undefined
            ? percentChange(firstPeriod.completionRate, secondPeriod.completionRate)
            : undefined;
          const reasons = [
            ...(ctrDropPct !== undefined && ctrDropPct <= -declineThresholdPct ? [`CTR declined ${round(Math.abs(ctrDropPct), 2)}%.`] : []),
            ...(cpcIncreasePct !== undefined && cpcIncreasePct >= declineThresholdPct ? [`CPC increased ${round(cpcIncreasePct, 2)}%.`] : []),
            ...(completionDropPct !== undefined && completionDropPct <= -declineThresholdPct ? [`Completion rate declined ${round(Math.abs(completionDropPct), 2)}%.`] : []),
            ...(secondPeriod.frequency !== undefined && secondPeriod.frequency >= 3 ? [`Frequency is elevated at ${secondPeriod.frequency}.`] : []),
          ];
          const adInfo = adInfoById.get(adId);
          const score = totalImpressions >= minImpressions ? Math.min(100, reasons.length * 25 + (secondPeriod.frequency ?? 0) * 5) : 0;

          return compactObject({
            ad_id: adId,
            ad_name: firstString(adInfo, ["ad_name"]),
            campaign_id: firstString(adInfo, ["campaign_id"]),
            adgroup_id: firstString(adInfo, ["adgroup_id"]),
            creative_type: firstString(adInfo, ["creative_type"]),
            video_id: firstString(adInfo, ["video_id"]),
            ad_text: firstString(adInfo, ["ad_text"]),
            landing_page_url: firstString(adInfo, ["landing_page_url"]),
            totalImpressions,
            fatigueScore: round(score, 2),
            reasons,
            firstPeriod,
            secondPeriod,
            deltas: {
              ctrDropPct: round(ctrDropPct, 2),
              cpcIncreasePct: round(cpcIncreasePct, 2),
              completionDropPct: round(completionDropPct, 2),
            },
            recipes: reasons.length > 0 ? [
              "Refresh the first 2 seconds/hook while keeping the same offer for controlled comparison.",
              "Test a new opening visual or UGC angle against the current winner.",
              "Check comments/search terms for objections and turn the strongest objection into a new hook.",
              "If frequency is high, inspect audience overlap before increasing budget.",
            ] : [],
          });
        })
          .filter((candidate) => (fieldAsFloat(candidate, "fatigueScore") ?? 0) > 0)
          .sort((a, b) => (fieldAsFloat(b, "fatigueScore") ?? 0) - (fieldAsFloat(a, "fatigueScore") ?? 0))
          .slice(0, 25);

        const attempts = [
          ...report.attempts,
          adsAttempt,
        ];

        return ok({
          advertiserId,
          dateRange: { startDate: effectiveStartDate, endDate: effectiveEndDate },
          thresholds: { minImpressions, declineThresholdPct },
          rowCount: rows.length,
          candidates: fatigueCandidates,
          attempts: attempts.map((attempt) => attemptSummary(attempt)),
          warnings: attempts.flatMap((attempt) => attempt.warning ? [attempt.warning] : []),
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // -- P2. tiktok_get_audience_overlap --------------------------------
  server.tool(
    "tiktok_get_audience_overlap",
    "Read-only audience overlap diagnostics across ad groups, custom audiences, saved audiences, and targeting fields.",
    {
      advertiserId: advertiserIdSchema,
      campaignId: z.string().optional().describe("Optional campaign ID filter."),
      adgroupIds: z.array(z.string()).optional().describe("Optional ad group IDs to compare."),
      includeSavedAudiences: z.boolean().optional().default(true),
      overlapThreshold: z.number().min(0).max(1).optional().default(0.65),
      limit: limitSchema,
    },
    async ({ advertiserId, campaignId, adgroupIds, includeSavedAudiences, overlapThreshold, limit }) => {
      try {
        const filtering = compactObject({
          campaign_ids: campaignId ? [campaignId] : undefined,
          adgroup_ids: adgroupIds,
        });
        const adgroups = await fetchFirstAvailable(client, [
          {
            label: "ad group targeting fields",
            path: "/adgroup/get/",
            params: {
              advertiser_id: advertiserId,
              page_size: limit,
              fields: [
                "adgroup_id",
                "adgroup_name",
                "campaign_id",
                "placement_type",
                "audience_ids",
                "excluded_audience_ids",
                "location_ids",
                "age_groups",
                "gender",
                "languages",
                "interest_category_ids",
                "operating_systems",
                "device_price_ranges",
                "network_types",
              ],
              ...(Object.keys(filtering).length > 0 && { filtering }),
            },
          },
          {
            label: "ad group conservative fields",
            path: "/adgroup/get/",
            params: {
              advertiser_id: advertiserId,
              page_size: limit,
              fields: ["adgroup_id", "adgroup_name", "campaign_id", "placement_type"],
              ...(Object.keys(filtering).length > 0 && { filtering }),
            },
          },
        ]);

        const customAudiences = await fetchOptional(client, "custom audience list", "/dmp/custom_audience/list/", {
          advertiser_id: advertiserId,
          page_size: limit,
        });
        const savedAudiences = includeSavedAudiences
          ? await fetchOptional(client, "saved audience list", "/dmp/saved_audience/list/", {
            advertiser_id: advertiserId,
            page_size: limit,
          })
          : undefined;

        const adgroupRows = adgroups.selected?.ok ? getDataList(adgroups.selected.data) : [];
        const audienceNameById = new Map<string, string>();
        for (const row of customAudiences.ok ? getDataList(customAudiences.data) : []) {
          const id = firstString(row, ["audience_id", "custom_audience_id"]);
          const name = firstString(row, ["name", "audience_name"]);
          if (id && name) audienceNameById.set(id, name);
        }
        for (const row of savedAudiences?.ok ? getDataList(savedAudiences.data) : []) {
          const id = firstString(row, ["saved_audience_id", "audience_id"]);
          const name = firstString(row, ["name", "audience_name"]);
          if (id && name) audienceNameById.set(id, name);
        }

        const targetingFields = [
          { key: "location_ids", aliases: ["location_ids", "country_ids", "region_ids"] },
          { key: "age_groups", aliases: ["age_groups", "age"] },
          { key: "gender", aliases: ["gender", "genders"] },
          { key: "languages", aliases: ["languages", "language_ids"] },
          { key: "interest_category_ids", aliases: ["interest_category_ids", "interest_ids"] },
          { key: "behavior_category_ids", aliases: ["behavior_category_ids", "behavior_ids"] },
          { key: "operating_systems", aliases: ["operating_systems", "operating_system"] },
          { key: "device_price_ranges", aliases: ["device_price_ranges"] },
          { key: "network_types", aliases: ["network_types"] },
        ];

        const normalized = adgroupRows.map((row) => {
          const includedAudienceIds = targetingValues(row, ["custom_audience_ids", "audience_ids", "included_custom_audience_ids"]);
          const excludedAudienceIds = targetingValues(row, ["excluded_custom_audience_ids", "excluded_audience_ids"]);
          const targeting = Object.fromEntries(
            targetingFields.map((field) => [field.key, targetingValues(row, field.aliases)]),
          );
          return {
            adgroup_id: fieldAsString(row, "adgroup_id") ?? "",
            adgroup_name: fieldAsString(row, "adgroup_name"),
            campaign_id: fieldAsString(row, "campaign_id"),
            status: fieldAsString(row, "status"),
            operation_status: fieldAsString(row, "operation_status"),
            includedAudienceIds,
            excludedAudienceIds,
            targeting,
          };
        }).filter((row) => row.adgroup_id);

        const audienceReuseMap = new Map<string, typeof normalized>();
        for (const row of normalized) {
          for (const audienceId of row.includedAudienceIds) {
            const existing = audienceReuseMap.get(audienceId) ?? [];
            existing.push(row);
            audienceReuseMap.set(audienceId, existing);
          }
        }
        const audienceReuse = [...audienceReuseMap.entries()]
          .filter(([, rowsForAudience]) => rowsForAudience.length > 1)
          .map(([audienceId, rowsForAudience]) => compactObject({
            audience_id: audienceId,
            audience_name: audienceNameById.get(audienceId),
            adgroup_count: rowsForAudience.length,
            adgroups: rowsForAudience.map((row) => compactObject({
              adgroup_id: row.adgroup_id,
              adgroup_name: row.adgroup_name,
              campaign_id: row.campaign_id,
            })),
          }));

        const pairwiseOverlap: ApiObject[] = [];
        for (let i = 0; i < normalized.length; i += 1) {
          for (let j = i + 1; j < normalized.length; j += 1) {
            const left = normalized[i];
            const right = normalized[j];
            const fieldScores = targetingFields.map((field) => {
              const score = jaccard(left.targeting[field.key] ?? [], right.targeting[field.key] ?? []);
              return score === undefined ? undefined : { field: field.key, score: round(score, 4) };
            }).filter(Boolean) as Array<{ field: string; score: number }>;
            const averageOverlap = fieldScores.length > 0
              ? fieldScores.reduce((total, entry) => total + entry.score, 0) / fieldScores.length
              : 0;
            const sharedAudienceIds = left.includedAudienceIds.filter((audienceId) => right.includedAudienceIds.includes(audienceId));

            if (averageOverlap >= overlapThreshold || sharedAudienceIds.length > 0) {
              pairwiseOverlap.push(compactObject({
                left: compactObject({ adgroup_id: left.adgroup_id, adgroup_name: left.adgroup_name, campaign_id: left.campaign_id }),
                right: compactObject({ adgroup_id: right.adgroup_id, adgroup_name: right.adgroup_name, campaign_id: right.campaign_id }),
                averageTargetingOverlap: round(averageOverlap, 4),
                fieldScores,
                sharedAudienceIds: sharedAudienceIds.map((audienceId) => compactObject({
                  audience_id: audienceId,
                  audience_name: audienceNameById.get(audienceId),
                })),
              }));
            }
          }
        }

        const attempts = [
          ...adgroups.attempts,
          customAudiences,
          ...(savedAudiences ? [savedAudiences] : []),
        ];

        return ok({
          advertiserId,
          filters: compactObject({ campaignId, adgroupIds }),
          comparedAdgroupCount: normalized.length,
          audienceReuse,
          pairwiseOverlap: pairwiseOverlap
            .sort((a, b) => (fieldAsFloat(b, "averageTargetingOverlap") ?? 0) - (fieldAsFloat(a, "averageTargetingOverlap") ?? 0))
            .slice(0, 50),
          adgroups: normalized,
          attempts: attempts.map((attempt) => attemptSummary(attempt)),
          warnings: attempts.flatMap((attempt) => attempt.warning ? [attempt.warning] : []),
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // -- P2. tiktok_get_spark_organic_joins -----------------------------
  server.tool(
    "tiktok_get_spark_organic_joins",
    "Join accessible Spark Ads fields with paid page/post reporting and optional organic identity/post endpoints when permissions allow. Read-only only.",
    {
      advertiserId: advertiserIdSchema,
      adIds: z.array(z.string()).optional().describe("Optional ad IDs to inspect."),
      adgroupId: z.string().optional().describe("Optional ad group ID filter."),
      includeOrganicEndpoints: z.boolean().optional().default(true).describe("Try identity/post metadata endpoints when Spark IDs are discovered."),
      includeExperimentalEndpoints: z.boolean().optional().default(false).describe("Also try undocumented/unstable Organic API endpoint candidates that may return 404. Disabled by default to keep warnings actionable."),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD for page_id reporting. Defaults to 14 days ago."),
      endDate: z.string().optional().describe("End date YYYY-MM-DD for page_id reporting. Defaults to today."),
      limit: limitSchema,
    },
    async ({ advertiserId, adIds, adgroupId, includeOrganicEndpoints, includeExperimentalEndpoints, startDate, endDate, limit }) => {
      try {
        const dates = defaultDateRange(14);
        const effectiveStartDate = startDate ?? dates.startDate;
        const effectiveEndDate = endDate ?? dates.endDate;
        const filtering = compactObject({
          ad_ids: adIds,
          adgroup_ids: adgroupId ? [adgroupId] : undefined,
        });
        const commonParams = {
          advertiser_id: advertiserId,
          page_size: limit,
          ...(Object.keys(filtering).length > 0 && { filtering }),
        };
        const ads = await fetchFirstAvailable(client, [
          {
            label: "spark organic ad fields",
            path: "/ad/get/",
            params: {
              ...commonParams,
              fields: [
                "ad_id",
                "ad_name",
                "campaign_id",
                "adgroup_id",
                "creative_type",
                "ad_text",
                "video_id",
                "landing_page_url",
                "identity_type",
                "identity_id",
                "identity_authorized_bc_id",
                "tiktok_item_id",
                "page_id",
              ],
            },
          },
          {
            label: "conservative ad fields for spark join",
            path: "/ad/get/",
            params: {
              ...commonParams,
              fields: ["ad_id", "ad_name", "campaign_id", "adgroup_id", "creative_type", "ad_text", "video_id", "landing_page_url"],
            },
          },
        ]);

        const adRows = ads.selected?.ok ? getDataList(ads.selected.data) : [];
        const pageIds = unique(adRows.map((row) => firstString(row, ["page_id", "identity_id", "identity_authorized_bc_id"])));
        const postIds = unique(adRows.map((row) => firstString(row, ["tiktok_item_id", "item_id", "post_id"])));
        const videoIds = unique(adRows.map((row) => firstString(row, ["video_id"])));

        const pageReport = await fetchFirstAvailable(client, [
          {
            label: "paid page_id report with safe metrics",
            path: "/report/integrated/get/",
            params: reportParams({
              advertiserId,
              dataLevel: "AUCTION_AD",
              dimensions: ["page_id"],
              metrics: ["spend", "impressions", "clicks", "ctr", "cpc"],
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              limit,
            }),
          },
          {
            label: "paid page_id report with engagement metrics",
            path: "/report/integrated/get/",
            params: reportParams({
              advertiserId,
              dataLevel: "AUCTION_AD",
              dimensions: ["page_id"],
              metrics: ["spend", "impressions", "clicks", "likes", "comments", "shares", "follows", "profile_visits"],
              startDate: effectiveStartDate,
              endDate: effectiveEndDate,
              limit,
            }),
          },
        ]);

        const identityLookup = includeOrganicEndpoints && pageIds.length > 0
          ? await fetchFirstAvailable(client, [
            { label: "identity get by ids", path: "/identity/get/", params: { advertiser_id: advertiserId, identity_ids: pageIds.slice(0, 100) } },
            ...(includeExperimentalEndpoints ? [
              { label: "identity list (experimental)", path: "/identity/list/", params: { advertiser_id: advertiserId, page_size: limit } },
              { label: "authorized identity list (experimental)", path: "/identity/authorized/list/", params: { advertiser_id: advertiserId, page_size: limit } },
            ] : []),
          ])
          : undefined;

        const postLookup = includeOrganicEndpoints && postIds.length > 0
          ? await fetchFirstAvailable(client, [
            { label: "organic video info", path: "/tt_video/info/", params: { advertiser_id: advertiserId, item_ids: postIds.slice(0, 100) } },
            ...(includeExperimentalEndpoints ? [
              { label: "spark post get (experimental)", path: "/spark/ad/post/get/", params: { advertiser_id: advertiserId, tiktok_item_ids: postIds.slice(0, 100) } },
              { label: "spark video list (experimental)", path: "/spark_ads/video/list/", params: { advertiser_id: advertiserId, page_size: limit } },
            ] : []),
          ])
          : undefined;

        const pageReportRows = reportRowsFromAttempt(pageReport.selected);
        const pageMetricsById = new Map<string, ApiObject>();
        for (const row of pageReportRows) {
          const pageId = fieldAsString(row, "page_id");
          if (pageId) pageMetricsById.set(pageId, row);
        }

        const identityRows = identityLookup?.selected?.ok ? getDataList(identityLookup.selected.data) : [];
        const identitiesById = new Map<string, ApiObject>();
        for (const row of identityRows) {
          const id = firstString(row, ["identity_id", "page_id", "tiktok_user_id", "bc_id"]);
          if (id && !identitiesById.has(id)) identitiesById.set(id, row);
        }

        const postRows = postLookup?.selected?.ok ? getDataList(postLookup.selected.data) : [];
        const postsById = new Map<string, ApiObject>();
        for (const row of postRows) {
          const id = firstString(row, ["tiktok_item_id", "spark_ad_post_id", "item_id", "post_id", "video_id"]);
          if (id && !postsById.has(id)) postsById.set(id, row);
        }

        const joins = adRows.map((row) => {
          const pageId = firstString(row, ["page_id", "identity_id", "identity_authorized_bc_id"]);
          const postId = firstString(row, ["tiktok_item_id", "item_id", "post_id"]);
          const paidPageMetrics = pageId ? pageMetricsById.get(pageId) : undefined;
          return compactObject({
            ad_id: fieldAsString(row, "ad_id"),
            ad_name: fieldAsString(row, "ad_name"),
            campaign_id: fieldAsString(row, "campaign_id"),
            adgroup_id: fieldAsString(row, "adgroup_id"),
            creative_type: fieldAsString(row, "creative_type"),
            identity_type: fieldAsString(row, "identity_type"),
            identity_id: pageId,
            tiktok_item_id: postId,
            video_id: fieldAsString(row, "video_id"),
            isSparkLike: Boolean(postId || fieldAsString(row, "is_spark_ad") === "true" || `${fieldAsString(row, "identity_type") ?? ""}`.toUpperCase().includes("SPARK")),
            paidPageMetrics,
            identity: pageId ? identitiesById.get(pageId) : undefined,
            organicPost: postId ? postsById.get(postId) : undefined,
            rawAd: row,
          });
        });

        const attempts = [
          ...ads.attempts,
          ...pageReport.attempts,
          ...(identityLookup ? identityLookup.attempts : []),
          ...(postLookup ? postLookup.attempts : []),
        ];
        const warnings = [
          ...attempts.flatMap((attempt) => attempt.warning ? [attempt.warning] : []),
          ...(includeOrganicEndpoints && pageIds.length === 0 ? ["No page/identity IDs were discovered from accessible ad fields, so identity endpoint checks were skipped."] : []),
          ...(includeOrganicEndpoints && postIds.length === 0 ? ["No Spark post IDs were discovered from accessible ad fields, so post endpoint checks were skipped."] : []),
        ];

        return ok({
          advertiserId,
          dateRange: { startDate: effectiveStartDate, endDate: effectiveEndDate },
          discoveredIds: { pageIds, postIds, videoIds },
          joins,
          endpointNote: !includeOrganicEndpoints
            ? "Organic identity/post/video enrichment endpoints were skipped because includeOrganicEndpoints=false. The response contains paid ad fields, discovered Spark-like IDs, and paid page reporting only."
            : includeExperimentalEndpoints
              ? "Organic identity/post endpoint candidates are permission and API-version dependent; warnings identify unavailable candidates."
              : "Only stable Organic/Spark enrichment candidates were attempted. Pass includeExperimentalEndpoints=true to probe undocumented/unstable 404-prone endpoint candidates.",
          attempts: attempts.map((attempt) => attemptSummary(attempt)),
          warnings,
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  registerTikTokBroadReadTools(server, client, ok);
}
