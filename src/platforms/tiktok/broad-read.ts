/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatMcpToolError } from "../../core/errors.js";
import type { TikTokClient } from "./client.js";

type ToolResult = { content: Array<{ type: "text"; text: string }> };
type SuccessResponder = (data: unknown) => ToolResult;

const identifierSchema = z.string().trim().min(1).max(120)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "Use a TikTok API field identifier");
const advertiserIdSchema = z.string().trim().min(1).max(100).regex(/^\d+$/, "Advertiser ID must contain digits only");
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const BARE_READ_ENDPOINTS = new Set([
  "business/benchmark",
  "business/video/settings",
  "discovery/trending/search/keyword",
  "search/region",
  "targeting/search",
  "tool/action_category",
  "tool/carrier",
  "tool/device_model",
  "tool/diagnosis/search/health",
  "tool/interest_category",
  "tool/language",
  "tool/open_url",
  "tool/os_version",
  "tool/phone_region_code",
  "tool/region",
  "tool/search_keyword/keyword_idea",
  "tool/targeting/list",
  "tool/timezone",
  "tool/url_validate",
  "tool/vbo_status",
]);

const READ_TERMINALS = new Set([
  "available", "benchmark", "check", "diagnosis", "discover",
  "detail", "get", "health", "history", "info", "keyword", "label", "list",
  "log", "overlap", "public", "query", "rank", "recommend", "result", "results",
  "search", "settings", "status", "suggestion", "timezone", "verify", "video_list",
  "trending_list", "authorized", "suggestcover",
]);

const MUTATION_SEGMENTS = new Set([
  "add", "apply", "authorize", "cancel", "confirm", "create", "delete", "disable",
  "edit", "enable", "end", "finish", "hide", "like", "manage", "promote", "publish",
  "remove", "reply", "submit", "subscribe", "transfer", "unsubscribe", "update", "upload",
]);

const READ_AFTER_MUTATION_EXCEPTIONS = new Set([
  "business/post/authorize/status",
  "business/publish/status",
  "dmp/custom_audience/apply/log",
  "tool/brand_safety/partner/authorize/status",
]);

const targetingCatalogSchema = z.enum([
  "locations",
  "languages",
  "targeting_search",
  "interest_categories",
  "interest_keywords",
  "action_categories",
  "hashtags",
  "search_keyword_recommendations",
  "search_keyword_ideas",
  "search_campaign_health",
  "os_versions",
  "device_models",
  "carriers",
  "internet_service_providers",
  "contextual_tags",
  "content_exclusions",
  "timezones",
]);

const TARGETING_ENDPOINTS: Record<z.infer<typeof targetingCatalogSchema>, string> = {
  locations: "tool/region",
  languages: "tool/language",
  targeting_search: "targeting/search",
  interest_categories: "tool/interest_category",
  interest_keywords: "tool/interest_keyword/recommend",
  action_categories: "tool/action_category",
  hashtags: "tool/hashtag/recommend",
  search_keyword_recommendations: "tool/search_keyword/recommend",
  search_keyword_ideas: "tool/search_keyword/keyword_idea",
  search_campaign_health: "tool/diagnosis/search/health",
  os_versions: "tool/os_version",
  device_models: "tool/device_model",
  carriers: "tool/carrier",
  internet_service_providers: "tool/targeting/list",
  contextual_tags: "tool/contextual_tag/get",
  content_exclusions: "tool/content_exclusion/get",
  timezones: "tool/timezone",
};

export function normalizeTikTokReadEndpoint(rawPath: string): string {
  let path = rawPath.trim().replace(/^\/+|\/+$/g, "");
  path = path.replace(/^open_api\/v1\.3\//, "");
  if (!path || path.length > 300 || !/^[A-Za-z0-9_/-]+$/.test(path) || path.includes("//") || path.includes("..")) {
    throw new Error("Invalid TikTok read endpoint path.");
  }

  const normalized = path.toLowerCase();
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "oauth" || segment === "oauth2" || /^(access|refresh|revoke)_token$/.test(segment))) {
    throw new Error("OAuth/token endpoints are not available through the generic read tool.");
  }
  if (segments.some((segment) => segment === "download")) {
    throw new Error("Download endpoints are not available through the JSON-only generic read tool.");
  }
  if (segments.some((segment) => segment === "lead" || segment === "leads")) {
    throw new Error("Lead-record endpoints are not available through the generic read tool.");
  }

  const terminal = segments.at(-1) ?? "";
  const hasMutationSegment = segments.some((segment) => MUTATION_SEGMENTS.has(segment));
  if (MUTATION_SEGMENTS.has(terminal) || (hasMutationSegment && !READ_AFTER_MUTATION_EXCEPTIONS.has(normalized))) {
    throw new Error("Mutation-like TikTok endpoints are blocked; only documented GET/read endpoints are allowed.");
  }

  const hasReadTerminal = READ_TERMINALS.has(terminal)
    || /_(get|list|info|search|recommend|check|history|status|result|results)$/.test(terminal);
  if (!BARE_READ_ENDPOINTS.has(normalized) && !hasReadTerminal) {
    throw new Error("Endpoint is not recognized as a GET/read endpoint. Use a path ending in get, list, info, search, recommend, check, status, or another documented read terminal.");
  }

  return normalized;
}

function validateJsonValue(value: unknown, depth = 0): void {
  if (depth > 4) throw new Error("TikTok parameter nesting is limited to four levels.");
  if (value === null || typeof value === "boolean" || typeof value === "number") return;
  if (typeof value === "string") {
    if (value.length > 5_000) throw new Error("TikTok string parameters are limited to 5,000 characters.");
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 500) throw new Error("TikTok array parameters are limited to 500 values.");
    value.forEach((entry) => validateJsonValue(entry, depth + 1));
    return;
  }
  if (typeof value === "object" && value) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 100) throw new Error("TikTok object parameters are limited to 100 keys.");
    for (const [key, entry] of entries) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid TikTok parameter key: ${key}`);
      validateJsonValue(entry, depth + 1);
    }
    return;
  }
  throw new Error("TikTok parameters must be JSON-compatible values.");
}

export function buildTikTokReadEndpoint(rawPath: string, rawParams: Record<string, unknown> = {}): string {
  const path = normalizeTikTokReadEndpoint(rawPath);
  const entries = Object.entries(rawParams);
  if (entries.length > 100) throw new Error("A TikTok read can contain at most 100 parameters.");
  const search = new URLSearchParams();
  for (const [key, value] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid TikTok parameter key: ${key}`);
    if (/token|secret|password/i.test(key)) throw new Error(`Sensitive parameter ${key} is not accepted; credentials come from MCP configuration.`);
    if (value === undefined) continue;
    validateJsonValue(value);
    search.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  if (search.toString().length > 25_000) throw new Error("Encoded TikTok query parameters exceed 25,000 characters.");
  return `/${path}/?${search.toString()}`;
}

function validateDates(startDate: string | undefined, endDate: string | undefined, queryLifetime: boolean): void {
  if (queryLifetime) {
    if (startDate || endDate) throw new Error("Omit startDate and endDate when queryLifetime=true.");
    return;
  }
  if (!startDate || !endDate) throw new Error("startDate and endDate are required unless queryLifetime=true.");
  if (startDate > endDate) throw new Error("startDate must be on or before endDate.");
}

export function registerTikTokBroadReadTools(
  server: McpServer,
  client: TikTokClient,
  ok: SuccessResponder,
): void {
  server.tool(
    "tiktok_get_entities_raw",
    "List TikTok campaigns, ad groups, or ads with caller-selected native fields, filtering, sorting, and pagination. This GET-only escape hatch exposes newly released entity fields without waiting for the MCP's curated schemas.",
    {
      advertiserId: advertiserIdSchema,
      entityType: z.enum(["campaign", "adgroup", "ad"]),
      fields: z.array(identifierSchema).min(1).max(100),
      filtering: z.record(z.unknown()).optional().describe("Native TikTok filtering object, for example {campaign_ids:[\"...\"]}"),
      page: z.number().int().min(1).max(10_000).optional().default(1),
      pageSize: z.number().int().min(1).max(1000).optional().default(100),
      orderField: identifierSchema.optional(),
      orderType: z.enum(["ASC", "DESC"]).optional(),
    },
    async ({ advertiserId, entityType, fields, filtering, page, pageSize, orderField, orderType }) => {
      try {
        const endpoint = buildTikTokReadEndpoint(`${entityType}/get`, {
          advertiser_id: advertiserId,
          fields: [...new Set(fields)],
          filtering,
          page,
          page_size: pageSize,
          order_field: orderField,
          order_type: orderField ? (orderType ?? "DESC") : undefined,
        });
        const data = await client.fetchUrl(endpoint);
        return ok({ data, entityType, requestedFields: [...new Set(fields)], nativeFields: true });
      } catch (error) {
        return formatMcpToolError(error);
      }
    },
  );

  server.tool(
    "tiktok_get_report_raw",
    "Run a native TikTok synchronous report with caller-selected dimensions and metrics. Use when a current API field is not yet in tiktok://metrics; unlike tiktok_get_insights, this tool does not calculate aliases or auto-split incompatible selections.",
    {
      advertiserId: advertiserIdSchema,
      serviceType: z.enum(["AUCTION", "RESERVATION"]).optional().default("AUCTION"),
      reportType: z.enum(["BASIC", "AUDIENCE", "PLAYABLE_MATERIAL", "CATALOG", "BC"]).optional().default("BASIC"),
      dataLevel: z.enum([
        "AUCTION_ADVERTISER", "AUCTION_CAMPAIGN", "AUCTION_ADGROUP", "AUCTION_AD",
        "RESERVATION_ADVERTISER", "RESERVATION_CAMPAIGN", "RESERVATION_ADGROUP", "RESERVATION_AD",
      ]),
      dimensions: z.array(identifierSchema).min(1).max(20),
      metrics: z.array(identifierSchema).min(1).max(100),
      startDate: dateSchema.optional(),
      endDate: dateSchema.optional(),
      queryLifetime: z.boolean().optional().default(false),
      filtering: z.array(z.object({
        field_name: identifierSchema,
        filter_type: z.enum(["IN", "NOT_IN", "CONTAIN_ANY_OF", "BETWEEN", "GREATER_THAN", "LOWER_THAN"]),
        filter_value: z.union([z.string().max(2_000), z.array(z.string().max(500)).max(500), z.object({ start: z.string().max(100), end: z.string().max(100) })]),
      })).max(20).optional(),
      page: z.number().int().min(1).max(10_000).optional().default(1),
      pageSize: z.number().int().min(1).max(1000).optional().default(1000),
      orderField: identifierSchema.optional(),
      orderType: z.enum(["ASC", "DESC"]).optional(),
    },
    async ({ advertiserId, serviceType, reportType, dataLevel, dimensions, metrics, startDate, endDate, queryLifetime, filtering, page, pageSize, orderField, orderType }) => {
      try {
        validateDates(startDate, endDate, queryLifetime);
        const endpoint = buildTikTokReadEndpoint("report/integrated/get", {
          advertiser_id: advertiserId,
          service_type: serviceType,
          report_type: reportType,
          data_level: dataLevel,
          dimensions: [...new Set(dimensions)],
          metrics: [...new Set(metrics)],
          start_date: queryLifetime ? undefined : startDate,
          end_date: queryLifetime ? undefined : endDate,
          query_lifetime: queryLifetime || undefined,
          filtering,
          page,
          page_size: pageSize,
          order_field: orderField,
          order_type: orderField ? (orderType ?? "DESC") : undefined,
        });
        const data = await client.fetchUrl(endpoint);
        return ok({ data, nativeFields: true, autoSplit: false, requestedDimensions: [...new Set(dimensions)], requestedMetrics: [...new Set(metrics)] });
      } catch (error) {
        return formatMcpToolError(error);
      }
    },
  );

  server.tool(
    "tiktok_get_targeting_catalog",
    "Read TikTok targeting and planning catalogs: locations, languages, interests, behaviors, hashtags, Search Ads keyword ideas/health, devices, carriers, contextual tags, content exclusions, and time zones.",
    {
      catalog: targetingCatalogSchema,
      advertiserId: advertiserIdSchema.optional(),
      query: z.string().trim().min(1).max(500).optional(),
      parameters: z.record(z.unknown()).optional().describe("Additional native parameters documented for the selected GET endpoint"),
    },
    async ({ catalog, advertiserId, query, parameters }) => {
      try {
        const endpoint = buildTikTokReadEndpoint(TARGETING_ENDPOINTS[catalog], {
          ...(parameters ?? {}),
          ...(advertiserId ? { advertiser_id: advertiserId } : {}),
          ...(query ? { keyword: query } : {}),
        });
        const data = await client.fetchUrl(endpoint);
        return ok({ data, catalog, endpoint: TARGETING_ENDPOINTS[catalog], readOnly: true });
      } catch (error) {
        return formatMcpToolError(error);
      }
    },
  );

  server.tool(
    "tiktok_get_read_endpoint",
    "Advanced GET-only TikTok Business API escape hatch for documented JSON read endpoints not yet modeled by a specialized MCP tool. Relative v1.3 paths and JSON-compatible query parameters are validated; OAuth, mutations, downloads, and lead-record paths are blocked.",
    {
      endpoint: z.string().trim().min(1).max(300).describe("Relative endpoint such as split_test/result/get, file/video/ad/info, store/list, or business/video/list"),
      parameters: z.record(z.unknown()).optional(),
    },
    async ({ endpoint, parameters }) => {
      try {
        const resolvedEndpoint = buildTikTokReadEndpoint(endpoint, parameters ?? {});
        const data = await client.fetchUrl(resolvedEndpoint);
        return ok({ data, endpoint: normalizeTikTokReadEndpoint(endpoint), method: "GET", readOnly: true });
      } catch (error) {
        return formatMcpToolError(error);
      }
    },
  );
}
