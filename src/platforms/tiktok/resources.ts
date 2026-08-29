/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TIKTOK_METRIC_CATALOG } from "./metric-catalog.js";
import { TIKTOK_DIMENSION_CATALOG } from "./dimension-catalog.js";

const TIKTOK_TOOL_MANIFEST = [
  { name: "tiktok_health_check", tier: "P0", scope: "read-only", purpose: "Verify credentials presence, advertiser access, and advertiser info without exposing tokens." },
  { name: "tiktok_list_advertisers", tier: "existing", scope: "read-only", purpose: "List accessible advertiser accounts." },
  { name: "tiktok_get_advertiser_info", tier: "existing", scope: "read-only", purpose: "Fetch account metadata for advertiser IDs." },
  { name: "tiktok_get_campaigns", tier: "existing", scope: "read-only", purpose: "List campaigns and core settings." },
  { name: "tiktok_get_adgroups", tier: "existing", scope: "read-only", purpose: "List ad groups and delivery settings." },
  { name: "tiktok_get_ads", tier: "existing", scope: "read-only", purpose: "List ads and creative references." },
  { name: "tiktok_get_insights", tier: "existing", scope: "read-only", purpose: "Query reporting metrics with compatibility-aware planning." },
  { name: "tiktok_get_creatives", tier: "existing", scope: "read-only", purpose: "Fetch ad creative text, media IDs, and landing URLs." },
  { name: "tiktok_get_audiences", tier: "existing", scope: "read-only", purpose: "List custom and lookalike audiences." },
  { name: "tiktok_search_keywords", tier: "existing", scope: "read-only", purpose: "Fetch TikTok Search Ads keyword suggestions." },
  { name: "tiktok_validate_query", tier: "existing", scope: "local", purpose: "Validate metric/dimension compatibility before reporting calls." },
  { name: "tiktok_get_pixels", tier: "P0", scope: "read-only", purpose: "List pixels via BC pixel read endpoints first, then advertiser pixel fallback; pixel events when endpoint permissions allow." },
  { name: "tiktok_get_events", tier: "P0", scope: "read-only", purpose: "Discover pixel/app events or reporting-based tracking diagnostics, using BC pixel discovery when configured." },
  { name: "tiktok_get_delivery_status", tier: "P0", scope: "read-only", purpose: "Aggregate campaign, ad group, and ad status/operation_status." },
  { name: "tiktok_get_async_report_status", tier: "P1", scope: "read-only", purpose: "Check async report task status by task ID when status endpoints are accessible." },
  { name: "tiktok_get_video_assets", tier: "P1", scope: "read-only", purpose: "Return video IDs, ad links, preview/thumbnail/duration metadata when available." },
  { name: "tiktok_get_spark_ads", tier: "P1", scope: "read-only", purpose: "Identify Spark Ads context from accessible ad fields." },
  { name: "tiktok_get_audience_details", tier: "P1", scope: "read-only", purpose: "Fetch custom/lookalike/saved audience details when DMP endpoints are accessible." },
  { name: "tiktok_get_shop_catalog_diagnostics", tier: "P2", scope: "read-only", purpose: "Diagnose catalog, TikTok Shop, and e-commerce funnel metrics with endpoint fallbacks." },
  { name: "tiktok_get_search_ads_maturity", tier: "P2", scope: "read-only", purpose: "Assess Search Ads reporting maturity from keyword/search-term diagnostics." },
  { name: "tiktok_get_creative_fatigue_recipes", tier: "P2", scope: "read-only", purpose: "Find likely ad creative fatigue and return refresh recipes without mutation." },
  { name: "tiktok_get_audience_overlap", tier: "P2", scope: "read-only", purpose: "Compare ad group targeting, custom audiences, and saved audiences for overlap." },
  { name: "tiktok_get_spark_organic_joins", tier: "P2", scope: "read-only", purpose: "Join Spark Ads fields with paid page/post reporting and optional organic metadata endpoints." },
  { name: "tiktok_get_entities_raw", tier: "broad-read", scope: "read-only", purpose: "List campaigns, ad groups, or ads with native fields and filters." },
  { name: "tiktok_get_report_raw", tier: "broad-read", scope: "read-only", purpose: "Query newly released native report dimensions and metrics before catalog updates." },
  { name: "tiktok_get_targeting_catalog", tier: "broad-read", scope: "read-only", purpose: "Read planning, targeting, device, contextual, and Search Ads dictionaries." },
  { name: "tiktok_get_read_endpoint", tier: "broad-read", scope: "read-only", purpose: "Call a validated documented v1.3 JSON GET endpoint while blocking OAuth, mutations, downloads, and lead-record paths." },
] as const;

const TIKTOK_RECIPES = [
  {
    name: "health_check",
    goal: "Confirm the MCP token/app credentials can read TikTok Ads data.",
    steps: [
      "Call tiktok_health_check.",
      "If advertiser listing works but advertiser info fails, verify advertiser-level permission for the selected advertiser.",
      "Never ask the tool to print tokens; it only returns presence booleans.",
    ],
  },
  {
    name: "tracking_inventory",
    goal: "Inventory pixels, events, and tracking diagnostics.",
    steps: [
      "Call tiktok_get_pixels with includeEvents=true. If TIKTOK_BC_ID is configured, the tool tries /bc/pixel/get/ before /pixel/list/.",
      "Call tiktok_get_events for reporting fallback by custom_event_type and event_source_id, using BC pixel discovery when available.",
      "Use /bc/pixel/link/get/ as read-only context only; never call /bc/pixel/link/update/ or /bc/pixel/transfer/ from the MCP.",
      "Treat endpoint warnings as permission/API-version diagnostics, not necessarily account failure.",
    ],
  },
  {
    name: "delivery_status_triage",
    goal: "Find paused, disabled, rejected, or non-delivering objects.",
    steps: [
      "Call tiktok_get_delivery_status for the advertiser.",
      "Review summary.status, summary.operationStatus, and diagnostics.",
      "Use tiktok_get_insights for spend/impression confirmation if status looks enabled but delivery is flat.",
    ],
  },
  {
    name: "async_report_status",
    goal: "Check a TikTok async report task without creating a new task.",
    endpointCandidates: [
      "GET /report/task/check/",
      "GET /report/task/get/",
      "GET /report/task/list/",
    ],
    steps: [
      "Call tiktok_get_async_report_status with advertiserId and taskId.",
      "If all candidates warn, the current API version/token likely lacks async report status access.",
      "This MCP intentionally does not create report tasks because it is read-only.",
    ],
  },
  {
    name: "creative_video_inventory",
    goal: "Map active ads to video assets, landing URLs, and creative copy.",
    steps: [
      "Call tiktok_get_video_assets for advertiser, optionally filtered by adIds or adgroupId.",
      "Use warnings to distinguish missing material endpoint permissions from ads with no video_id.",
      "Call tiktok_get_spark_ads when Spark post context is needed.",
    ],
  },
  {
    name: "audience_inventory",
    goal: "Inspect custom, lookalike, and saved audiences without mutation.",
    steps: [
      "Call tiktok_get_audiences for a quick list.",
      "Call tiktok_get_audience_details for richer custom/lookalike details and saved audiences.",
      "Expect DMP detail endpoints to vary by account permission.",
    ],
  },
  {
    name: "shop_catalog_diagnostics",
    goal: "Check TikTok Shop/catalog funnel health when commerce endpoints or reporting dimensions are available.",
    endpointCandidates: [
      "GET /report/integrated/get/ with report_type=CATALOG",
      "GET /report/integrated/get/ with Shop auction metrics",
      "GET /catalog/get/ or /catalog/list/",
      "GET /catalog/product/get/ and /catalog/product_set/list/ when catalogId is supplied",
    ],
    steps: [
      "Call tiktok_get_shop_catalog_diagnostics with advertiserId and a recent date range.",
      "Review selectedReport and attempts to see whether catalog reporting or Shop auction reporting was used.",
      "Use warnings as permission/API-version diagnostics; this workflow never creates products, catalogs, or feeds.",
    ],
  },
  {
    name: "search_ads_maturity",
    goal: "Assess whether Search Ads are measurable enough for keyword mining and match-type optimization.",
    steps: [
      "Call tiktok_get_search_ads_maturity with dataLevel=AUCTION_ADGROUP for operating diagnostics.",
      "Review maturityScore, matchTypes, highSpendTerms, and lowCtrTerms.",
      "Pass seedKeywords only when keyword recommendation endpoint diagnostics are useful.",
    ],
  },
  {
    name: "creative_fatigue",
    goal: "Identify ad creatives where performance is decaying and get read-only refresh recipes.",
    steps: [
      "Call tiktok_get_creative_fatigue_recipes over the last 14 to 30 days.",
      "Prioritize candidates with CTR decline, CPC increase, completion-rate decline, or high frequency.",
      "Use recipes to brief new creative tests outside this MCP; this MCP does not upload or edit creatives.",
    ],
  },
  {
    name: "audience_overlap",
    goal: "Find audience and targeting overlap that can distort delivery or fatigue diagnostics.",
    steps: [
      "Call tiktok_get_audience_overlap for a campaign or selected ad group IDs.",
      "Review audienceReuse for repeated custom/saved audiences and pairwiseOverlap for similar targeting.",
      "Use overlap findings before interpreting fatigue or budget scaling recommendations.",
    ],
  },
  {
    name: "spark_organic_join",
    goal: "Connect Spark Ads to accessible identity/post IDs and paid page-level reporting.",
    endpointCandidates: [
      "GET /ad/get/ with Spark/identity fields",
      "GET /report/integrated/get/ with page_id",
      "GET /identity/get/ when Organic/Spark permissions allow it",
      "GET /tt_video/info/ when Organic/Spark video permissions allow it",
      "Optional experimental probes: /identity/list/, /identity/authorized/list/, /spark/ad/post/get/, /spark_ads/video/list/",
    ],
    steps: [
      "Call tiktok_get_spark_organic_joins for Spark-like ads or an ad group.",
      "Production default: includeOrganicEndpoints=true and includeExperimentalEndpoints=false.",
      "Use discoveredIds and joins to map paid ads to identity, page, post, and video IDs.",
      "Keep includeExperimentalEndpoints=false by default to avoid 404-prone endpoint probes.",
      "Treat /identity/get/ and /tt_video/info/ warnings as Organic/Spark API permission diagnostics; paid joins from ad fields may still be useful.",
    ],
  },
  {
    name: "forward_compatible_read",
    goal: "Reach current TikTok GET data that is newer than the curated MCP catalogs.",
    steps: [
      "Use tiktok_get_entities_raw for native campaign, ad group, and ad fields.",
      "Use tiktok_get_report_raw for native report fields that are not yet in tiktok://metrics.",
      "Use tiktok_get_targeting_catalog for documented targeting and Search Ads planning dictionaries.",
      "Use tiktok_get_read_endpoint only for a documented JSON GET endpoint; mutation-like, OAuth, download, and lead-record paths are rejected.",
    ],
  },
] as const;

export function registerTikTokResources(server: McpServer, enableWrites = false): void {
  server.resource("tiktok-manifest", "tiktok://manifest", async () => ({
    contents: [{
      uri: "tiktok://manifest",
      mimeType: "application/json",
      text: JSON.stringify({
        platform: "tiktok_ads",
        apiVersion: "v1.3",
        mode: enableWrites ? "read-write" : "read-only",
        writesEnabled: enableWrites,
        noMutationPolicy: enableWrites
          ? "Read tools only call read endpoints. Write tools can change campaign and ad group status and budgets, and create disabled campaigns. Every write returns a preview and applies only when the caller repeats the call with confirm: true."
          : "Tools only call GET/read endpoints and never create, update, delete, upload, or mutate TikTok objects. Write tools exist but are disabled unless TIKTOK_ENABLE_WRITES is set.",
        tools: TIKTOK_TOOL_MANIFEST,
        resources: [
          "tiktok://manifest",
          "tiktok://recipes",
          "tiktok://metrics",
          "tiktok://dimensions",
          "tiktok://compatibility",
        ],
        security: {
          tokensExposed: false,
          secretsExposed: false,
        },
      }, null, 2),
    }],
  }));

  server.resource("tiktok-recipes", "tiktok://recipes", async () => ({
    contents: [{
      uri: "tiktok://recipes",
      mimeType: "application/json",
      text: JSON.stringify({
        description: "Agent-ready TikTok Ads read-only workflows and endpoint fallbacks.",
        recipes: TIKTOK_RECIPES,
      }, null, 2),
    }],
  }));

  server.resource("tiktok-metrics", "tiktok://metrics", async () => ({
    contents: [{
      uri: "tiktok://metrics",
      mimeType: "application/json",
      text: JSON.stringify(
        TIKTOK_METRIC_CATALOG.map((m) => ({
          key: m.key, name: m.name, description: m.description,
          category: m.category, type: m.type, format: m.format,
        })),
        null, 2,
      ),
    }],
  }));

  server.resource("tiktok-dimensions", "tiktok://dimensions", async () => ({
    contents: [{
      uri: "tiktok://dimensions",
      mimeType: "application/json",
      text: JSON.stringify(
        TIKTOK_DIMENSION_CATALOG.map((d) => ({
          key: d.key, name: d.name, description: d.description,
          category: d.category,
          ...(d.groupingRules && { groupingRules: d.groupingRules }),
          ...(d.supportsLifetime !== undefined && { supportsLifetime: d.supportsLifetime }),
        })),
        null, 2,
      ),
    }],
  }));

  server.resource("tiktok-compatibility", "tiktok://compatibility", async () => ({
    contents: [{
      uri: "tiktok://compatibility",
      mimeType: "application/json",
      text: JSON.stringify({
        description: "TikTok dimension grouping rules: only 1 ID dimension + 1 time dimension per request. The query planner splits automatically.",
        idDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id"],
        timeDimensions: ["stat_time_day", "stat_time_hour"],
        lifetimeExcluded: ["stat_time_day", "stat_time_hour", "country_code"],
      }, null, 2),
    }],
  }));
}
