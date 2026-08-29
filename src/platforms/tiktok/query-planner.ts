/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// TIKTOK BUSINESS API QUERY PLANNER
// ============================================
// Plans and splits queries for optimal API requests, merges results

import {
  TikTokQueryRequest,
  TikTokApiRequest,
  TikTokQueryPlan,
  TikTokInsightRow,
  DataLevel,
  TIKTOK_API_BASE_URL,
  MAX_METRICS_PER_REQUEST,
} from "./types.js";
import {
  getMetricDefinition,
  getApiFieldsForMetrics,
  getRequiredFieldsForMetrics,
} from "./metric-catalog.js";
import { getApiFieldsForDimensions } from "./dimension-catalog.js";
import {
  validateQuery,
  groupCompatibleMetrics,
  getRecommendedDataLevel,
} from "./compatibility-rules.js";
import { logger } from "../../core/logger.js";

// ============================================
// INLINED DATE UTILITIES
// ============================================

/**
 * Parse a YYYY-MM-DD date string into a Date object (local time, midnight).
 * Returns null if the string is not a valid date.
 */
function parseDateString(dateStr: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  // Verify the date components match (catches invalid dates like Feb 30)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

// ============================================
// QUERY PLANNING
// ============================================

/**
 * Plan a TikTok query, splitting if necessary and identifying join keys
 */
export function planQuery(request: TikTokQueryRequest): TikTokQueryPlan {
  const warnings: string[] = [];
  const errors: string[] = [];
  const requests: TikTokApiRequest[] = [];

  // Validate the query first
  const validation = validateQuery(
    request.metrics,
    request.dimensions,
    request.dataLevel,
    request.queryLifetime
  );

  if (!validation.valid) {
    errors.push(...validation.errors);
  }
  warnings.push(...validation.warnings);

  // If there are validation errors, return early
  if (errors.length > 0) {
    return {
      requests: [],
      calculatedMetrics: [],
      joinKeys: [],
      warnings,
      errors,
    };
  }

  // Separate calculated metrics from native metrics
  const calculatedMetrics = request.metrics.filter((m) => {
    const def = getMetricDefinition(m);
    return def?.type === "calculated";
  });

  const nativeMetrics = request.metrics.filter((m) => {
    const def = getMetricDefinition(m);
    return def?.type !== "calculated";
  });

  // Check for unrecognized metrics
  const unrecognizedMetrics = request.metrics.filter((m) => !getMetricDefinition(m));
  if (unrecognizedMetrics.length > 0) {
    logger.warn("tiktok", "Unrecognized metrics (not in catalog)", { unrecognizedMetrics });
    warnings.push(`Unrecognized metrics: ${unrecognizedMetrics.join(", ")}`);
  }

  logger.debug("tiktok", "Resolved query metric groups", {
    nativeMetrics,
    calculatedMetrics,
  });

  // Get all required fields (including dependencies for calculated metrics)
  const requiredFields = getRequiredFieldsForMetrics(request.metrics);
  logger.debug("tiktok", "Resolved required API fields", { requiredFields });

  // Group metrics by compatibility
  const metricGroups = groupCompatibleMetrics(requiredFields, request.dimensions);

  // Determine join keys based on dimensions
  const joinKeys = determineJoinKeys(request.dimensions);

  // Create API requests for each metric group
  for (const metricGroup of metricGroups) {
    // Split if too many metrics
    const chunks = chunkArray(metricGroup, MAX_METRICS_PER_REQUEST);

    for (const chunk of chunks) {
      const apiRequest = createApiRequest(request, chunk);
      requests.push(apiRequest);
    }
  }

  // Add warning if multiple requests needed
  if (requests.length > 1) {
    warnings.push(
      `Query split into ${requests.length} requests due to metric compatibility or limits. ` +
      `Results will be merged using keys: ${joinKeys.join(", ")}`
    );
  }

  return {
    requests,
    calculatedMetrics,
    joinKeys,
    warnings,
    errors,
  };
}

/**
 * Create a single API request from query parameters
 */
function createApiRequest(
  request: TikTokQueryRequest,
  metrics: string[]
): TikTokApiRequest {
  const apiDimensions = getApiFieldsForDimensions(request.dimensions);
  const apiMetrics = getApiFieldsForMetrics(metrics);

  logger.debug("tiktok", "Create API request", {
    inputDimensions: request.dimensions,
    apiDimensions,
    inputMetrics: metrics,
    apiMetrics,
  });

  // Warn if dimensions were filtered out
  if (request.dimensions.length !== apiDimensions.length) {
    const missingDims = request.dimensions.filter(d => !apiDimensions.includes(d));
    logger.warn("tiktok", "Dimensions were filtered out", {
      filteredCount: request.dimensions.length - apiDimensions.length,
      missingDims,
    });
  }

  // Warn if metrics were filtered out
  if (metrics.length !== apiMetrics.length) {
    const missingMetrics = metrics.filter(m => !apiMetrics.includes(m));
    logger.warn("tiktok", "Metrics were filtered out (not found in catalog)", {
      filteredCount: metrics.length - apiMetrics.length,
      missingMetrics,
    });
  }

  return {
    type: "basic",
    advertiser_id: request.advertiserId,
    service_type: request.serviceType || "AUCTION",
    report_type: request.reportType || "BASIC",
    data_level: request.dataLevel,
    dimensions: apiDimensions,
    metrics: apiMetrics,
    start_date: request.startDate,
    end_date: request.endDate,
    filtering: request.filtering,
    query_lifetime: request.queryLifetime,
    page: request.page || 1,
    page_size: request.pageSize || 100,
    order_field: request.orderField,
    order_type: request.orderType,
  };
}

/**
 * Determine join keys based on dimensions
 */
function determineJoinKeys(dimensions: string[]): string[] {
  // Primary join keys are ID dimensions and time dimensions
  const keys: string[] = [];

  // Add ID dimension (should only be one)
  const idDimensions = ["advertiser_id", "campaign_id", "adgroup_id", "ad_id"];
  for (const dim of dimensions) {
    if (idDimensions.includes(dim)) {
      keys.push(dim);
      break;
    }
  }

  // Add time dimension if present
  if (dimensions.includes("stat_time_day")) {
    keys.push("stat_time_day");
  } else if (dimensions.includes("stat_time_hour")) {
    keys.push("stat_time_hour");
  }

  // Add other dimensions that create unique rows
  const otherDimensions = ["country_code", "ad_type", "search_terms", "search_keyword", "match_type"];
  for (const dim of dimensions) {
    if (otherDimensions.includes(dim) && !keys.includes(dim)) {
      keys.push(dim);
    }
  }

  return keys;
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ============================================
// RESULT MERGING
// ============================================

/**
 * Merge results from multiple API responses
 */
export function mergeResults(
  resultSets: TikTokInsightRow[][],
  joinKeys: string[]
): TikTokInsightRow[] {
  if (resultSets.length === 0) return [];
  if (resultSets.length === 1) return resultSets[0];

  // Create a map using join keys
  const mergedMap = new Map<string, TikTokInsightRow>();

  for (const results of resultSets) {
    for (const row of results) {
      const key = createJoinKey(row, joinKeys);
      const existing = mergedMap.get(key);

      if (existing) {
        // Merge row data into existing
        mergedMap.set(key, { ...existing, ...row });
      } else {
        mergedMap.set(key, { ...row });
      }
    }
  }

  return Array.from(mergedMap.values());
}

/**
 * Create a composite key from row and join keys
 */
function createJoinKey(row: TikTokInsightRow, joinKeys: string[]): string {
  return joinKeys.map((key) => String(row[key] ?? "")).join("|");
}

// ============================================
// REQUEST BUILDING
// ============================================

/**
 * Build the full API URL for a request
 */
export function buildApiUrl(_request: TikTokApiRequest): string {
  return `${TIKTOK_API_BASE_URL}/report/integrated/get/`;
}

/**
 * Build the request body for the TikTok API
 * NOTE: When query_lifetime is true, dates should NOT be included in the request
 * as TikTok API may reject queries with both lifetime and date parameters.
 */
export function buildRequestBody(request: TikTokApiRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    advertiser_id: request.advertiser_id,
    service_type: request.service_type,
    report_type: request.report_type,
    data_level: request.data_level,
    dimensions: request.dimensions,
    metrics: request.metrics,
    page: request.page,
    page_size: request.page_size,
  };

  // Only include dates if NOT a lifetime query
  // TikTok API requires dates for non-lifetime queries but may reject them for lifetime queries
  if (request.query_lifetime) {
    body.query_lifetime = true;
  } else {
    // Dates are required for non-lifetime queries
    if (request.start_date) {
      body.start_date = request.start_date;
    }
    if (request.end_date) {
      body.end_date = request.end_date;
    }
  }

  if (request.filtering && request.filtering.length > 0) {
    body.filtering = request.filtering;
  }

  if (request.order_field) {
    body.order_field = request.order_field;
    body.order_type = request.order_type || "DESC";
  }

  return body;
}

// ============================================
// QUERY PREVIEW
// ============================================

/**
 * Generate a preview of the planned requests (for debugging UI)
 */
export function generateQueryPreview(plan: TikTokQueryPlan): string {
  const lines: string[] = [];

  lines.push(`=== Query Plan ===`);
  lines.push(`Total Requests: ${plan.requests.length}`);
  lines.push(`Calculated Metrics: ${plan.calculatedMetrics.length > 0 ? plan.calculatedMetrics.join(", ") : "None"}`);
  lines.push(`Join Keys: ${plan.joinKeys.join(", ")}`);
  lines.push("");

  if (plan.errors.length > 0) {
    lines.push(`Errors:`);
    plan.errors.forEach((e) => lines.push(`  - ${e}`));
    lines.push("");
  }

  if (plan.warnings.length > 0) {
    lines.push(`Warnings:`);
    plan.warnings.forEach((w) => lines.push(`  - ${w}`));
    lines.push("");
  }

  plan.requests.forEach((req, i) => {
    lines.push(`--- Request ${i + 1} ---`);
    lines.push(`Type: ${req.type}`);
    lines.push(`Data Level: ${req.data_level}`);
    lines.push(`Dimensions: ${req.dimensions.join(", ")}`);
    lines.push(`Metrics: ${req.metrics.join(", ")}`);
    lines.push(`Date Range: ${req.start_date} to ${req.end_date}`);
    if (req.query_lifetime) {
      lines.push(`Lifetime Query: Yes`);
    }
    if (req.filtering && req.filtering.length > 0) {
      lines.push(`Filters: ${req.filtering.length}`);
    }
    lines.push("");
  });

  return lines.join("\n");
}

// ============================================
// EXECUTION HELPERS
// ============================================

/**
 * Execute a query plan and return merged results
 * This is a stub - actual HTTP calls are in tiktokClient.ts
 */
export interface QueryExecutionResult {
  data: TikTokInsightRow[];
  debug: {
    requestCount: number;
    totalRows: number;
    executionTimeMs: number;
    warnings: string[];
  };
}

/**
 * Validate request parameters before execution
 */
export function validateRequestParams(request: TikTokQueryRequest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!request.advertiserId) {
    errors.push("advertiserId is required");
  }

  if (!request.dataLevel) {
    errors.push("dataLevel is required");
  }

  if (!request.metrics || request.metrics.length === 0) {
    errors.push("At least one metric is required");
  }

  if (!request.dimensions || request.dimensions.length === 0) {
    errors.push("At least one dimension is required");
  }

  // Date validation (unless lifetime query)
  if (!request.queryLifetime) {
    if (!request.startDate) {
      errors.push("startDate is required for non-lifetime queries");
    }
    if (!request.endDate) {
      errors.push("endDate is required for non-lifetime queries");
    }

    // Validate date format and validity using parseDateString
    // This handles both format validation and date validity (e.g., no Feb 30)
    const startParsed = request.startDate ? parseDateString(request.startDate) : null;
    const endParsed = request.endDate ? parseDateString(request.endDate) : null;

    if (request.startDate && !startParsed) {
      errors.push("startDate must be a valid date in YYYY-MM-DD format");
    }
    if (request.endDate && !endParsed) {
      errors.push("endDate must be a valid date in YYYY-MM-DD format");
    }

    // Validate date range
    if (startParsed && endParsed) {
      if (startParsed > endParsed) {
        errors.push("startDate must be before or equal to endDate");
      }

      // Check max range (365 days)
      const daysDiff = Math.ceil((endParsed.getTime() - startParsed.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 365) {
        errors.push("Date range cannot exceed 365 days");
      }

      // Check if end date is not too far in the future (TikTok API limitation)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (endParsed > today) {
        // Only warn, don't error - TikTok may accept dates slightly in the future
        warnings.push("endDate is in the future. TikTok API may return incomplete data.");
      }
    }
  }

  // Validate data level format
  const validLevels: DataLevel[] = [
    "AUCTION_ADVERTISER",
    "AUCTION_CAMPAIGN",
    "AUCTION_ADGROUP",
    "AUCTION_AD",
    "RESERVATION_ADVERTISER",
    "RESERVATION_CAMPAIGN",
    "RESERVATION_ADGROUP",
    "RESERVATION_AD",
  ];
  if (request.dataLevel && !validLevels.includes(request.dataLevel)) {
    errors.push(`Invalid dataLevel: ${request.dataLevel}`);
  }

  // Validate page size
  if (request.pageSize && (request.pageSize < 1 || request.pageSize > 1000)) {
    errors.push("pageSize must be between 1 and 1000");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Create a basic query request with defaults
 */
export function createQueryRequest(
  advertiserId: string,
  metrics: string[],
  dimensions: string[],
  startDate: string,
  endDate: string,
  options?: Partial<TikTokQueryRequest>
): TikTokQueryRequest {
  const dataLevel = getRecommendedDataLevel(dimensions);

  return {
    advertiserId,
    serviceType: "AUCTION",
    reportType: "BASIC",
    dataLevel,
    metrics,
    dimensions,
    startDate,
    endDate,
    page: 1,
    pageSize: 100,
    ...options,
  };
}

/**
 * Create a lifetime query request
 */
export function createLifetimeQueryRequest(
  advertiserId: string,
  metrics: string[],
  dimensions: string[],
  options?: Partial<TikTokQueryRequest>
): TikTokQueryRequest {
  // Filter out dimensions incompatible with lifetime queries
  const lifetimeCompatibleDimensions = dimensions.filter(
    (d) => !["stat_time_day", "stat_time_hour", "country_code"].includes(d)
  );

  const dataLevel = getRecommendedDataLevel(lifetimeCompatibleDimensions);

  return {
    advertiserId,
    serviceType: "AUCTION",
    reportType: "BASIC",
    dataLevel,
    metrics,
    dimensions: lifetimeCompatibleDimensions,
    startDate: "", // Not needed for lifetime
    endDate: "", // Not needed for lifetime
    queryLifetime: true,
    page: 1,
    pageSize: 100,
    ...options,
  };
}
