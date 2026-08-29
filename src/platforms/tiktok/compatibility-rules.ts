/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// TIKTOK BUSINESS API COMPATIBILITY RULES
// ============================================
// Validation rules for metric/dimension combinations

import { DataLevel, ValidationResult } from "./types.js";
import {
  getMetricDefinition,
  TIKTOK_METRIC_CATALOG,
} from "./metric-catalog.js";
import {
  LIFETIME_INCOMPATIBLE_DIMENSIONS,
  TIKTOK_DIMENSION_CATALOG,
} from "./dimension-catalog.js";

// ============================================
// DIMENSION GROUPING RULES
// ============================================

/**
 * ID dimensions - only one can be used per request
 */
export const ID_DIMENSIONS = [
  "advertiser_id",
  "campaign_id",
  "adgroup_id",
  "ad_id",
];

/**
 * Time dimensions - only one can be used per request
 */
export const TIME_DIMENSIONS = [
  "stat_time_day",
  "stat_time_hour",
];

/**
 * Search dimensions - supported at ADVERTISER, CAMPAIGN, and ADGROUP levels (NOT AD level)
 * Can be used standalone or combined with any ID dimension except ad_id
 */
export const SEARCH_DIMENSIONS_LIST = [
  "search_terms",
  "search_keyword",
  "match_type",
];

/**
 * Dimensions that require ad_id only
 */
export const ASSET_REQUIRES_AD = [
  "video_material_id",
  "image_id",
];

// ============================================
// METRIC RESTRICTIONS BY DIMENSION
// ============================================

/**
 * Metrics that are only available with specific dimensions
 */
export const DIMENSION_SPECIFIC_METRICS: Record<string, string[]> = {
  search_terms: [
    "spend",
    "impressions",
    "clicks",
    "ctr",
    "cpm",
    "cpc",
    "reach",
    "video_play_actions",
    "video_views_p25",
    "video_views_p50",
    "video_views_p75",
    "video_views_p100",
    "engagements",
    "likes",
    "comments",
    "shares",
  ],
  search_keyword: [
    "spend",
    "cpc",
    "cpm",
    "impressions",
    "clicks",
    "ctr",
  ],
  match_type: [
    "spend",
    "cpc",
    "cpm",
    "impressions",
    "clicks",
    "ctr",
  ],
};

/**
 * Metrics that are NOT available with lifetime queries
 */
export const LIFETIME_INCOMPATIBLE_METRICS: string[] = [
  // Time-series specific metrics
  "stat_time_day",
  "stat_time_hour",
];

// ============================================
// DATA LEVEL RESTRICTIONS
// ============================================

/**
 * Dimensions available at each data level
 */
export const DIMENSIONS_BY_LEVEL: Record<DataLevel, string[]> = {
  AUCTION_ADVERTISER: ["advertiser_id", "stat_time_day", "stat_time_hour", "country_code", "ad_type", "search_terms", "search_keyword", "match_type", "custom_event_type", "event_source_id"],
  AUCTION_CAMPAIGN: ["campaign_id", "stat_time_day", "stat_time_hour", "country_code", "ad_type", "search_terms", "search_keyword", "match_type", "custom_event_type", "event_source_id"],
  AUCTION_ADGROUP: ["adgroup_id", "stat_time_day", "stat_time_hour", "country_code", "ad_type", "search_terms", "search_keyword", "match_type", "custom_event_type", "event_source_id"],
  AUCTION_AD: ["ad_id", "stat_time_day", "stat_time_hour", "country_code", "ad_type", "video_material_id", "image_id", "custom_event_type", "event_source_id", "page_id"],
  RESERVATION_ADVERTISER: ["advertiser_id"],
  RESERVATION_CAMPAIGN: ["campaign_id", "stat_time_day", "stat_time_hour", "country_code"],
  RESERVATION_ADGROUP: ["adgroup_id", "stat_time_day", "stat_time_hour", "country_code"],
  RESERVATION_AD: ["ad_id", "stat_time_day", "stat_time_hour", "country_code", "video_material_id", "image_id"],
};

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate that only one ID dimension is used
 */
export function validateIdDimensions(dimensions: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const usedIdDimensions = dimensions.filter((d) => ID_DIMENSIONS.includes(d));

  if (usedIdDimensions.length > 1) {
    errors.push(`Only one ID dimension allowed per request. Found: ${usedIdDimensions.join(", ")}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate that only one time dimension is used
 */
export function validateTimeDimensions(dimensions: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const usedTimeDimensions = dimensions.filter((d) => TIME_DIMENSIONS.includes(d));

  if (usedTimeDimensions.length > 1) {
    errors.push(`Only one time dimension allowed per request. Found: ${usedTimeDimensions.join(", ")}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate dimension requirements (e.g., search dims cannot be used with ad_id, match_type requires search_keyword)
 */
export function validateDimensionRequirements(dimensions: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check search dimensions cannot be used with ad_id (not supported at AD level)
  const hasSearchDimension = dimensions.some((d) => SEARCH_DIMENSIONS_LIST.includes(d));
  if (hasSearchDimension && dimensions.includes("ad_id")) {
    errors.push("Search dimensions (search_terms, search_keyword, match_type) cannot be used with ad_id. They are supported at ADVERTISER, CAMPAIGN, and ADGROUP levels only.");
  }

  // Check match_type requires search_keyword
  if (dimensions.includes("match_type") && !dimensions.includes("search_keyword")) {
    errors.push("match_type dimension requires search_keyword dimension");
  }

  // Check asset dimensions
  const hasAssetDimension = dimensions.some((d) => ASSET_REQUIRES_AD.includes(d));
  if (hasAssetDimension && !dimensions.includes("ad_id")) {
    errors.push("Asset dimensions (video_material_id, image_id) require ad_id");
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate dimensions are available at the specified data level
 */
export function validateDimensionsForLevel(dimensions: string[], dataLevel: DataLevel): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const availableDimensions = DIMENSIONS_BY_LEVEL[dataLevel] || [];

  for (const dim of dimensions) {
    if (!availableDimensions.includes(dim)) {
      errors.push(`Dimension "${dim}" is not available at data level ${dataLevel}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate dimensions for lifetime query
 */
export function validateDimensionsForLifetime(dimensions: string[], queryLifetime: boolean): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (queryLifetime) {
    const incompatible = dimensions.filter((d) => LIFETIME_INCOMPATIBLE_DIMENSIONS.includes(d));
    if (incompatible.length > 0) {
      errors.push(`Lifetime queries cannot use dimensions: ${incompatible.join(", ")}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate metric compatibility with dimensions
 */
export function validateMetricDimensionCompatibility(
  metrics: string[],
  dimensions: string[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if any dimension has restricted metrics
  for (const dim of dimensions) {
    const restrictedMetrics = DIMENSION_SPECIFIC_METRICS[dim];
    if (restrictedMetrics) {
      const incompatibleMetrics = metrics.filter((m) => !restrictedMetrics.includes(m));
      if (incompatibleMetrics.length > 0) {
        errors.push(
          `Dimension "${dim}" only supports these metrics: ${restrictedMetrics.join(", ")}. ` +
          `Remove incompatible metrics or remove the "${dim}" dimension.`
        );
      }
    }
  }

  // Check individual metric compatibility
  for (const metricKey of metrics) {
    const metric = getMetricDefinition(metricKey);
    if (!metric) {
      warnings.push(`Unknown metric: ${metricKey}`);
      continue;
    }

    // Check incompatible dimensions
    if (metric.incompatibleDimensions) {
      const conflicts = dimensions.filter((d) => metric.incompatibleDimensions!.includes(d));
      if (conflicts.length > 0) {
        errors.push(`Metric "${metricKey}" cannot be used with dimensions: ${conflicts.join(", ")}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate metrics for lifetime query
 */
export function validateMetricsForLifetime(metrics: string[], queryLifetime: boolean): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (queryLifetime) {
    const incompatible = metrics.filter((m) => LIFETIME_INCOMPATIBLE_METRICS.includes(m));
    if (incompatible.length > 0) {
      errors.push(`Lifetime queries cannot use metrics: ${incompatible.join(", ")}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Complete validation of query parameters
 */
export function validateQuery(
  metrics: string[],
  dimensions: string[],
  dataLevel: DataLevel,
  queryLifetime: boolean = false
): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  // Validate metrics exist
  if (metrics.length === 0) {
    allErrors.push("At least one metric is required");
  }

  // Validate dimensions exist
  if (dimensions.length === 0) {
    allErrors.push("At least one dimension is required");
  }

  // Run all validation checks
  const validations = [
    validateIdDimensions(dimensions),
    validateTimeDimensions(dimensions),
    validateDimensionRequirements(dimensions),
    validateDimensionsForLevel(dimensions, dataLevel),
    validateDimensionsForLifetime(dimensions, queryLifetime),
    validateMetricDimensionCompatibility(metrics, dimensions),
    validateMetricsForLifetime(metrics, queryLifetime),
  ];

  for (const result of validations) {
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

// ============================================
// COMPATIBILITY HELPERS
// ============================================

/**
 * Get all dimensions compatible with a metric
 */
export function getCompatibleDimensionsForMetric(metricKey: string): string[] {
  const metric = getMetricDefinition(metricKey);
  if (!metric) return [];

  const incompatible = new Set(metric.incompatibleDimensions || []);
  return TIKTOK_DIMENSION_CATALOG
    .map((d) => d.key)
    .filter((key) => !incompatible.has(key));
}

/**
 * Get all metrics compatible with a dimension
 */
export function getCompatibleMetricsForDimension(dimensionKey: string): string[] {
  const restricted = DIMENSION_SPECIFIC_METRICS[dimensionKey];

  if (restricted) {
    return restricted;
  }

  // If no restrictions, all metrics are compatible except those that explicitly exclude this dimension
  return TIKTOK_METRIC_CATALOG
    .filter((m) => !m.incompatibleDimensions?.includes(dimensionKey))
    .map((m) => m.key);
}

/**
 * Check if a specific metric-dimension combination is valid
 */
export function isMetricDimensionCompatible(metricKey: string, dimensionKey: string): boolean {
  const metric = getMetricDefinition(metricKey);
  if (!metric) return false;

  // Check if dimension is explicitly incompatible
  if (metric.incompatibleDimensions?.includes(dimensionKey)) {
    return false;
  }

  // Check if dimension has restricted metrics
  const restricted = DIMENSION_SPECIFIC_METRICS[dimensionKey];
  if (restricted && !restricted.includes(metricKey)) {
    return false;
  }

  return true;
}

/**
 * Get the recommended data level for a set of dimensions
 */
export function getRecommendedDataLevel(dimensions: string[]): DataLevel {
  if (dimensions.includes("ad_id")) {
    return "AUCTION_AD";
  }
  if (dimensions.includes("adgroup_id")) {
    return "AUCTION_ADGROUP";
  }
  if (dimensions.includes("campaign_id")) {
    return "AUCTION_CAMPAIGN";
  }
  return "AUCTION_ADVERTISER";
}

/**
 * Check if dimensions require a specific minimum data level
 */
export function getMinimumDataLevel(dimensions: string[]): DataLevel {
  // Asset dimensions require AD level
  if (dimensions.some((d) => ASSET_REQUIRES_AD.includes(d))) {
    return "AUCTION_AD";
  }

  // Search dimensions are supported at ADVERTISER level and above (not AD level)
  // No minimum level bump needed - they work at the lowest level


  return "AUCTION_ADVERTISER";
}

/**
 * Split metrics into groups that can be queried together
 */
export function groupCompatibleMetrics(
  metrics: string[],
  dimensions: string[]
): string[][] {
  // For TikTok, most metrics can be queried together
  // Only need to split if there are dimension-specific restrictions

  const hasRestrictedDimension = dimensions.some((d) => DIMENSION_SPECIFIC_METRICS[d]);

  if (!hasRestrictedDimension) {
    // All metrics can be in one group
    return [metrics];
  }

  // Split metrics based on dimension restrictions
  const compatible: string[] = [];
  const incompatible: string[] = [];

  for (const metric of metrics) {
    let isCompatible = true;
    for (const dim of dimensions) {
      if (!isMetricDimensionCompatible(metric, dim)) {
        isCompatible = false;
        break;
      }
    }
    if (isCompatible) {
      compatible.push(metric);
    } else {
      incompatible.push(metric);
    }
  }

  const groups: string[][] = [];
  if (compatible.length > 0) groups.push(compatible);
  if (incompatible.length > 0) groups.push(incompatible);

  return groups;
}
