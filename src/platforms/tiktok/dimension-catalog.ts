/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// TIKTOK BUSINESS API DIMENSION CATALOG
// ============================================
// Complete catalog of TikTok dimensions with grouping rules
// Reference: https://business-api.tiktok.com/portal/docs?id=1751443956638721

import { TikTokDimensionDefinition, DimensionCategory, DataLevel } from "./types.js";

// --- Helper to create dimension definitions ---

function createDimension(
  key: string,
  name: string,
  description: string,
  category: DimensionCategory,
  apiField?: string,
  options?: Partial<TikTokDimensionDefinition>
): TikTokDimensionDefinition {
  return {
    key,
    name,
    description,
    category,
    apiField: apiField || key,
    groupingRules: {},
    supportsLifetime: true,
    ...options,
  };
}

// ============================================
// ID DIMENSIONS
// ============================================

export const ID_DIMENSIONS: TikTokDimensionDefinition[] = [
  createDimension(
    "advertiser_id",
    "Advertiser ID",
    "The unique identifier for the advertiser account",
    "id",
    "advertiser_id",
    {
      groupingRules: {
        maxOneFrom: ["campaign_id", "adgroup_id", "ad_id"],
      },
      levelRestrictions: [
        "AUCTION_ADVERTISER",
        "RESERVATION_ADVERTISER",
      ],
    }
  ),
  createDimension(
    "campaign_id",
    "Campaign ID",
    "The unique identifier for the campaign",
    "id",
    "campaign_id",
    {
      groupingRules: {
        maxOneFrom: ["advertiser_id", "adgroup_id", "ad_id"],
      },
      levelRestrictions: [
        "AUCTION_CAMPAIGN",
        "AUCTION_ADGROUP",
        "AUCTION_AD",
        "RESERVATION_CAMPAIGN",
        "RESERVATION_ADGROUP",
        "RESERVATION_AD",
      ],
    }
  ),
  createDimension(
    "adgroup_id",
    "Ad Group ID",
    "The unique identifier for the ad group",
    "id",
    "adgroup_id",
    {
      groupingRules: {
        maxOneFrom: ["advertiser_id", "campaign_id", "ad_id"],
      },
      levelRestrictions: [
        "AUCTION_ADGROUP",
        "AUCTION_AD",
        "RESERVATION_ADGROUP",
        "RESERVATION_AD",
      ],
    }
  ),
  createDimension(
    "ad_id",
    "Ad ID",
    "The unique identifier for the ad",
    "id",
    "ad_id",
    {
      groupingRules: {
        maxOneFrom: ["advertiser_id", "campaign_id", "adgroup_id"],
      },
      levelRestrictions: [
        "AUCTION_AD",
        "RESERVATION_AD",
      ],
    }
  ),
];

// ============================================
// NAME DIMENSIONS (enriched server-side, not sent to TikTok API)
// ============================================

export const NAME_DIMENSIONS: TikTokDimensionDefinition[] = [
  createDimension(
    "campaign_name",
    "Campaign Name",
    "The name of the campaign (resolved from campaign_id)",
    "id",
    "campaign_name"
  ),
  createDimension(
    "adgroup_name",
    "Ad Group Name",
    "The name of the ad group (resolved from adgroup_id)",
    "id",
    "adgroup_name"
  ),
  createDimension(
    "ad_name",
    "Ad Name",
    "The name of the ad (resolved from ad_id)",
    "id",
    "ad_name"
  ),
];

// ============================================
// TIME DIMENSIONS
// ============================================

export const TIME_DIMENSIONS: TikTokDimensionDefinition[] = [
  createDimension(
    "stat_time_day",
    "Day",
    "Statistics aggregated by day (YYYY-MM-DD format)",
    "time",
    "stat_time_day",
    {
      groupingRules: {
        maxOneFrom: ["stat_time_hour"],
        excludes: ["query_lifetime"],
      },
      supportsLifetime: false,
    }
  ),
  createDimension(
    "stat_time_hour",
    "Hour",
    "Statistics aggregated by hour (YYYY-MM-DD HH:00:00 format)",
    "time",
    "stat_time_hour",
    {
      groupingRules: {
        maxOneFrom: ["stat_time_day"],
        excludes: ["query_lifetime"],
      },
      supportsLifetime: false,
    }
  ),
];

// ============================================
// TARGETING DIMENSIONS
// ============================================

export const TARGETING_DIMENSIONS: TikTokDimensionDefinition[] = [
  createDimension(
    "country_code",
    "Country",
    "The country code where the ad was displayed (ISO 3166-1 alpha-2)",
    "targeting",
    "country_code",
    {
      groupingRules: {
        excludes: ["query_lifetime", "stat_time_hour"],
      },
      supportsLifetime: false,
      possibleValues: [
        "US", "GB", "DE", "FR", "JP", "BR", "MX", "IT", "ES", "CA",
        "AU", "IN", "ID", "TH", "VN", "MY", "PH", "SG", "KR", "TW",
        // Many more country codes...
      ],
    }
  ),
  createDimension(
    "ad_type",
    "Ad Type",
    "The type of ad (e.g., SINGLE_VIDEO, CAROUSEL)",
    "targeting",
    "ad_type",
    {
      possibleValues: [
        "SINGLE_VIDEO",
        "SINGLE_IMAGE",
        "CAROUSEL",
        "SPARK_ADS",
        "PLAYABLE",
        "COLLECTION",
        "LEAD_GEN",
      ],
    }
  ),
];

// ============================================
// ASSET DIMENSIONS
// ============================================

export const ASSET_DIMENSIONS: TikTokDimensionDefinition[] = [
  createDimension(
    "video_material_id",
    "Video Material ID",
    "The unique identifier for the video creative",
    "asset",
    "video_material_id",
    {
      groupingRules: {
        requiresAny: ["ad_id"],
        excludes: ["image_id"],
      },
      levelRestrictions: ["AUCTION_AD", "RESERVATION_AD"],
    }
  ),
  createDimension(
    "image_id",
    "Image ID",
    "The unique identifier for the image creative",
    "asset",
    "image_id",
    {
      groupingRules: {
        requiresAny: ["ad_id"],
        excludes: ["video_material_id"],
      },
      levelRestrictions: ["AUCTION_AD", "RESERVATION_AD"],
    }
  ),
];

// ============================================
// SEARCH DIMENSIONS
// ============================================

export const SEARCH_DIMENSIONS: TikTokDimensionDefinition[] = [
  createDimension(
    "search_terms",
    "Search Terms",
    "The actual search terms users used that triggered your ad. Supported at ADVERTISER, CAMPAIGN, and ADGROUP levels (not AD level).",
    "search",
    "search_terms",
    {
      groupingRules: {
        excludes: ["search_keyword"],
        maxOneFrom: ["ad_id"], // Cannot be used with ad_id
      },
      supportedMetrics: [
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
    }
  ),
  createDimension(
    "search_keyword",
    "Search Keyword",
    "The keywords you're bidding on for Search Ads. Supported at ADVERTISER, CAMPAIGN, and ADGROUP levels (not AD level). Limited to 6 metrics only.",
    "search",
    "search_keyword",
    {
      groupingRules: {
        excludes: ["search_terms"],
        maxOneFrom: ["ad_id"], // Cannot be used with ad_id
      },
      supportedMetrics: [
        "spend",
        "cpc",
        "cpm",
        "impressions",
        "clicks",
        "ctr",
      ],
    }
  ),
  createDimension(
    "match_type",
    "Match Type",
    "The keyword match type (BROAD, PHRASE, EXACT). Requires search_keyword dimension. Available from 2024-07-30.",
    "search",
    "match_type",
    {
      groupingRules: {
        requiresAny: ["search_keyword"],
        maxOneFrom: ["ad_id"], // Cannot be used with ad_id
      },
      supportedMetrics: [
        "spend",
        "cpc",
        "cpm",
        "impressions",
        "clicks",
        "ctr",
      ],
      possibleValues: ["BROAD", "PHRASE", "EXACT"],
    }
  ),
];

// ============================================
// CONVERSION DIMENSIONS
// ============================================

export const CONVERSION_DIMENSIONS: TikTokDimensionDefinition[] = [
  createDimension(
    "custom_event_type",
    "Custom Event Type",
    "The type of custom conversion event",
    "conversion",
    "custom_event_type",
    {
      supportedMetrics: [
        "total_app_event",
        "total_app_event_value",
        "cost_per_result",
      ],
    }
  ),
  createDimension(
    "event_source_id",
    "Event Source ID",
    "The pixel or app ID that captured the conversion",
    "conversion",
    "event_source_id",
    {}
  ),
  createDimension(
    "page_id",
    "Page ID",
    "The TikTok page ID for organic content promotions",
    "conversion",
    "page_id",
    {
      levelRestrictions: ["AUCTION_AD", "RESERVATION_AD"],
    }
  ),
];

// ============================================
// COMPLETE DIMENSION CATALOG
// ============================================

export const TIKTOK_DIMENSION_CATALOG: TikTokDimensionDefinition[] = [
  ...ID_DIMENSIONS,
  ...TIME_DIMENSIONS,
  ...TARGETING_DIMENSIONS,
  ...ASSET_DIMENSIONS,
  ...SEARCH_DIMENSIONS,
  ...CONVERSION_DIMENSIONS,
];

/**
 * Extended catalog including virtual name dimensions (for ResultsTable column lookup only).
 * These are NOT selectable in the dimension picker -- they're added server-side by enrichWithEntityNames().
 */
export const TIKTOK_DIMENSION_CATALOG_EXTENDED: TikTokDimensionDefinition[] = [
  ...TIKTOK_DIMENSION_CATALOG,
  ...NAME_DIMENSIONS,
];

// ============================================
// DIMENSION GROUPING RULES
// ============================================

/**
 * Valid dimension combinations for TikTok API
 * Only one ID dimension is allowed per request
 * Only one time dimension is allowed per request
 */
export const VALID_DIMENSION_GROUPS: string[][] = [
  // Single dimensions
  ["advertiser_id"],
  ["campaign_id"],
  ["adgroup_id"],
  ["ad_id"],

  // ID + Day
  ["campaign_id", "stat_time_day"],
  ["adgroup_id", "stat_time_day"],
  ["ad_id", "stat_time_day"],

  // ID + Hour
  ["campaign_id", "stat_time_hour"],
  ["adgroup_id", "stat_time_hour"],
  ["ad_id", "stat_time_hour"],

  // ID + Country (not with lifetime)
  ["campaign_id", "country_code"],
  ["adgroup_id", "country_code"],
  ["ad_id", "country_code"],

  // ID + Day + Country
  ["campaign_id", "stat_time_day", "country_code"],
  ["adgroup_id", "stat_time_day", "country_code"],
  ["ad_id", "stat_time_day", "country_code"],

  // ID + Ad Type
  ["campaign_id", "ad_type"],
  ["adgroup_id", "ad_type"],
  ["ad_id", "ad_type"],

  // Search dimensions (supported at ADVERTISER, CAMPAIGN, ADGROUP - NOT AD level)
  // Standalone search dims
  ["search_terms"],
  ["search_keyword"],
  ["search_keyword", "match_type"],
  // Search dims with ID dimensions (except ad_id)
  ["advertiser_id", "search_terms"],
  ["campaign_id", "search_terms"],
  ["adgroup_id", "search_terms"],
  ["advertiser_id", "search_keyword"],
  ["campaign_id", "search_keyword"],
  ["adgroup_id", "search_keyword"],
  ["advertiser_id", "search_keyword", "match_type"],
  ["campaign_id", "search_keyword", "match_type"],
  ["adgroup_id", "search_keyword", "match_type"],
  // Search dims with time dimensions
  ["search_terms", "stat_time_day"],
  ["search_keyword", "stat_time_day"],
  ["search_keyword", "match_type", "stat_time_day"],
  // Search dims with ID + time
  ["advertiser_id", "search_terms", "stat_time_day"],
  ["campaign_id", "search_terms", "stat_time_day"],
  ["adgroup_id", "search_terms", "stat_time_day"],
  ["advertiser_id", "search_keyword", "stat_time_day"],
  ["campaign_id", "search_keyword", "stat_time_day"],
  ["adgroup_id", "search_keyword", "stat_time_day"],

  // Asset dimensions (require ad_id)
  ["ad_id", "video_material_id"],
  ["ad_id", "image_id"],

  // Conversion dimensions
  ["campaign_id", "custom_event_type"],
  ["adgroup_id", "custom_event_type"],
  ["ad_id", "custom_event_type"],
  ["campaign_id", "event_source_id"],
  ["adgroup_id", "event_source_id"],
  ["ad_id", "event_source_id"],
];

/**
 * Dimensions that cannot be used with lifetime queries (query_lifetime=true)
 */
export const LIFETIME_INCOMPATIBLE_DIMENSIONS = [
  "stat_time_day",
  "stat_time_hour",
  "country_code",
];

/**
 * Dimensions that can only be used at specific data levels
 */
export const LEVEL_RESTRICTED_DIMENSIONS: Record<string, DataLevel[]> = {
  advertiser_id: ["AUCTION_ADVERTISER", "RESERVATION_ADVERTISER"],
  ad_id: ["AUCTION_AD", "RESERVATION_AD"],
  video_material_id: ["AUCTION_AD", "RESERVATION_AD"],
  image_id: ["AUCTION_AD", "RESERVATION_AD"],
  page_id: ["AUCTION_AD", "RESERVATION_AD"],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get dimension definition by key
 */
export function getDimensionDefinition(key: string): TikTokDimensionDefinition | undefined {
  return TIKTOK_DIMENSION_CATALOG.find((d) => d.key === key);
}

/**
 * Get all dimensions by category
 */
export function getDimensionsByCategory(category: DimensionCategory): TikTokDimensionDefinition[] {
  return TIKTOK_DIMENSION_CATALOG.filter((d) => d.category === category);
}

/**
 * Check if dimension supports lifetime queries
 */
export function dimensionSupportsLifetime(dimensionKey: string): boolean {
  return !LIFETIME_INCOMPATIBLE_DIMENSIONS.includes(dimensionKey);
}

/**
 * Check if dimension is available at data level
 */
export function isDimensionAvailableAtLevel(dimensionKey: string, dataLevel: DataLevel): boolean {
  const restrictions = LEVEL_RESTRICTED_DIMENSIONS[dimensionKey];
  if (!restrictions) return true; // No restrictions means available at all levels
  return restrictions.includes(dataLevel);
}

/**
 * Validate dimension combination
 */
export function validateDimensionCombination(dimensions: string[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (dimensions.length === 0) {
    errors.push("At least one dimension is required");
    return { valid: false, errors, warnings };
  }

  // Check for multiple ID dimensions
  const idDimensions = dimensions.filter((d) =>
    ID_DIMENSIONS.some((id) => id.key === d)
  );
  if (idDimensions.length > 1) {
    errors.push(`Only one ID dimension allowed per request. Found: ${idDimensions.join(", ")}`);
  }

  // Check for multiple time dimensions
  const timeDimensions = dimensions.filter((d) =>
    TIME_DIMENSIONS.some((t) => t.key === d)
  );
  if (timeDimensions.length > 1) {
    errors.push(`Only one time dimension allowed per request. Found: ${timeDimensions.join(", ")}`);
  }

  // Check grouping rules for each dimension
  for (const dim of dimensions) {
    const definition = getDimensionDefinition(dim);
    if (!definition) {
      warnings.push(`Unknown dimension: ${dim}`);
      continue;
    }

    const rules = definition.groupingRules;

    // Check excludes
    if (rules.excludes) {
      const conflicts = dimensions.filter((d) => rules.excludes!.includes(d));
      if (conflicts.length > 0) {
        errors.push(`Dimension "${dim}" cannot be combined with: ${conflicts.join(", ")}`);
      }
    }

    // Check requiresAny
    if (rules.requiresAny && rules.requiresAny.length > 0) {
      const hasRequired = rules.requiresAny.some((r) => dimensions.includes(r));
      if (!hasRequired) {
        errors.push(`Dimension "${dim}" requires one of: ${rules.requiresAny.join(", ")}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if dimension combination is valid for lifetime queries
 */
export function isValidForLifetimeQuery(dimensions: string[]): boolean {
  return dimensions.every((d) => dimensionSupportsLifetime(d));
}

/**
 * Get compatible dimensions for a given dimension
 */
export function getCompatibleDimensions(dimensionKey: string): string[] {
  const dimension = getDimensionDefinition(dimensionKey);
  if (!dimension) return [];

  const incompatible = new Set<string>();

  // Add dimensions from same ID group
  if (ID_DIMENSIONS.some((d) => d.key === dimensionKey)) {
    ID_DIMENSIONS.forEach((d) => {
      if (d.key !== dimensionKey) incompatible.add(d.key);
    });
  }

  // Add dimensions from same time group
  if (TIME_DIMENSIONS.some((d) => d.key === dimensionKey)) {
    TIME_DIMENSIONS.forEach((d) => {
      if (d.key !== dimensionKey) incompatible.add(d.key);
    });
  }

  // Add explicitly excluded dimensions
  if (dimension.groupingRules.excludes) {
    dimension.groupingRules.excludes.forEach((d) => incompatible.add(d));
  }

  return TIKTOK_DIMENSION_CATALOG
    .map((d) => d.key)
    .filter((k) => k !== dimensionKey && !incompatible.has(k));
}

/**
 * Get dimension category display order
 */
export const DIMENSION_CATEGORY_ORDER: DimensionCategory[] = [
  "id",
  "time",
  "targeting",
  "asset",
  "search",
  "conversion",
];

/**
 * Get human-readable category name
 */
export function getCategoryDisplayName(category: DimensionCategory): string {
  const names: Record<DimensionCategory, string> = {
    id: "ID Dimensions",
    time: "Time Dimensions",
    targeting: "Targeting",
    asset: "Creative Assets",
    search: "Search Ads",
    conversion: "Conversion",
  };
  return names[category] || category;
}

/**
 * Get API field names for dimensions
 */
export function getApiFieldsForDimensions(dimensionKeys: string[]): string[] {
  return dimensionKeys
    .map((key) => {
      const dim = getDimensionDefinition(key);
      return dim?.apiField;
    })
    .filter((field): field is string => field !== undefined);
}
