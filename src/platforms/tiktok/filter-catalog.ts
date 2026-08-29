/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// TIKTOK BUSINESS API FILTER CATALOG
// ============================================
// Complete catalog of TikTok report filters
// Reference: https://business-api.tiktok.com/portal/docs?id=1751443975608321

import { TikTokFilterDefinition, FilterCategory, FilterOperator, DataLevel } from "./types.js";

// --- Helper to create filter definitions ---

function createFilter(
  key: string,
  name: string,
  description: string,
  category: FilterCategory,
  supportedOperators: FilterOperator[],
  valueType: TikTokFilterDefinition["valueType"],
  apiField?: string,
  options?: Partial<TikTokFilterDefinition>
): TikTokFilterDefinition {
  return {
    key,
    name,
    description,
    category,
    apiField: apiField || key,
    supportedOperators,
    valueType,
    ...options,
  };
}

// ============================================
// ID FILTERS
// ============================================

export const ID_FILTERS: TikTokFilterDefinition[] = [
  createFilter(
    "campaign_ids",
    "Campaign IDs",
    "Filter by specific campaign IDs",
    "id",
    ["IN"],
    "string[]",
    "campaign_ids"
  ),
  createFilter(
    "adgroup_ids",
    "Ad Group IDs",
    "Filter by specific ad group IDs",
    "id",
    ["IN"],
    "string[]",
    "adgroup_ids"
  ),
  createFilter(
    "ad_ids",
    "Ad IDs",
    "Filter by specific ad IDs",
    "id",
    ["IN"],
    "string[]",
    "ad_ids"
  ),
  createFilter(
    "ad_ids_v2",
    "Ad IDs (V2)",
    "Filter by specific ad IDs (new format)",
    "id",
    ["IN", "NOT_IN"],
    "string[]",
    "ad_ids_v2"
  ),
];

// ============================================
// STATUS FILTERS
// ============================================

export const STATUS_FILTERS: TikTokFilterDefinition[] = [
  createFilter(
    "campaign_status",
    "Campaign Status",
    "Filter by campaign status",
    "status",
    ["IN"],
    "string[]",
    "campaign_status",
    {
      possibleValues: [
        "CAMPAIGN_STATUS_ENABLE",
        "CAMPAIGN_STATUS_DISABLE",
        "CAMPAIGN_STATUS_DELETE",
        "CAMPAIGN_STATUS_ALL",
        "CAMPAIGN_STATUS_NOT_DELETE",
      ],
    }
  ),
  createFilter(
    "adgroup_status",
    "Ad Group Status",
    "Filter by ad group status",
    "status",
    ["IN"],
    "string[]",
    "adgroup_status",
    {
      possibleValues: [
        "ADGROUP_STATUS_DELIVERY_OK",
        "ADGROUP_STATUS_NOT_DELIVERY",
        "ADGROUP_STATUS_ALL",
        "ADGROUP_STATUS_NOT_DELETE",
        "ADGROUP_STATUS_DELETE",
      ],
    }
  ),
  createFilter(
    "ad_status",
    "Ad Status",
    "Filter by ad status",
    "status",
    ["IN"],
    "string[]",
    "ad_status",
    {
      possibleValues: [
        "AD_STATUS_DELIVERY_OK",
        "AD_STATUS_NOT_DELIVERY",
        "AD_STATUS_ALL",
        "AD_STATUS_NOT_DELETE",
        "AD_STATUS_DELETE",
      ],
    }
  ),
];

// ============================================
// CAMPAIGN CONFIGURATION FILTERS
// ============================================

export const CAMPAIGN_CONFIG_FILTERS: TikTokFilterDefinition[] = [
  createFilter(
    "campaign_automation_type",
    "Campaign Automation Type",
    "Filter by automation level",
    "campaign_config",
    ["IN"],
    "string[]",
    "campaign_automation_type",
    {
      possibleValues: [
        "MANUAL",
        "SMART_PLUS",
        "UPGRADED_SMART_PLUS",
      ],
    }
  ),
  createFilter(
    "campaign_system_origins",
    "Campaign System Origins",
    "Filter by campaign creation source",
    "campaign_config",
    ["IN"],
    "string[]",
    "campaign_system_origins",
    {
      possibleValues: [
        "PROMOTE",
        "TT_ADS_PLATFORM",
        "THIRD_PARTY",
        "GMC",
      ],
    }
  ),
  createFilter(
    "campaign_type",
    "Campaign Type",
    "Filter by campaign type",
    "campaign_config",
    ["IN"],
    "string[]",
    "campaign_type",
    {
      possibleValues: [
        "REGULAR_CAMPAIGN",
        "IOS14_CAMPAIGN",
        "SMART_PERFORMANCE_CAMPAIGN",
        "APP_RE_ENGAGEMENT_CAMPAIGN",
      ],
    }
  ),
  createFilter(
    "creative_campaign_type",
    "Creative Campaign Type",
    "Filter by creative optimization type",
    "campaign_config",
    ["IN"],
    "string[]",
    "creative_campaign_type",
    {
      possibleValues: [
        "SMART+",
        "SEARCH_CAMPAIGN",
        "OTHER",
      ],
    }
  ),
  createFilter(
    "campaign_product_source",
    "Campaign Product Source",
    "Filter by product catalog source",
    "campaign_config",
    ["IN"],
    "string[]",
    "campaign_product_source",
    {
      possibleValues: [
        "CATALOG",
        "STORE",
      ],
    }
  ),
  createFilter(
    "is_cbo_enabled",
    "CBO Enabled",
    "Filter by Campaign Budget Optimization status",
    "campaign_config",
    ["IN"],
    "string[]",
    "is_cbo_enabled",
    {
      possibleValues: [
        "CBO_CAMPAIGN",
        "NON_CBO_CAMPAIGN",
      ],
    }
  ),
];

// ============================================
// TARGETING FILTERS
// ============================================

export const TARGETING_FILTERS: TikTokFilterDefinition[] = [
  createFilter(
    "objective_type",
    "Objective Type",
    "Filter by campaign objective",
    "targeting",
    ["IN"],
    "string[]",
    "objective_type",
    {
      possibleValues: [
        "APP_PROMOTION",
        "APP_INSTALL",
        "APP_RETARGETING",
        "CONVERSIONS",
        "WEB_CONVERSIONS",
        "CATALOG_SALES",
        "REACH",
        "TRAFFIC",
        "VIDEO_VIEWS",
        "ENGAGEMENT",
        "LEAD_GENERATION",
        "COMMUNITY_INTERACTION",
        "PRODUCT_SALES",
        "SHOP_PURCHASES",
        "LIVE_SHOPPING",
      ],
    }
  ),
  createFilter(
    "billing_event",
    "Billing Event",
    "Filter by billing event type",
    "targeting",
    ["IN"],
    "string[]",
    "billing_event",
    {
      possibleValues: [
        "CPC",
        "CPM",
        "OCPM",
        "CPV",
      ],
    }
  ),
  createFilter(
    "bid_strategy",
    "Bid Strategy",
    "Filter by bidding strategy",
    "targeting",
    ["IN"],
    "string[]",
    "bid_strategy",
    {
      possibleValues: [
        "BID_TYPE_NO_BID",
        "BID_TYPE_CUSTOM",
        "BID_TYPE_MAX_CONVERSION",
        "BID_TYPE_LOWEST_COST",
        "BID_TYPE_COST_CAP",
      ],
    }
  ),
  createFilter(
    "delivery_type",
    "Delivery Type",
    "Filter by ad delivery type",
    "targeting",
    ["IN"],
    "string[]",
    "delivery_type",
    {
      possibleValues: [
        "STANDARD",
        "ACCELERATED",
      ],
    }
  ),
  createFilter(
    "optimization_goal",
    "Optimization Goal",
    "Filter by optimization goal",
    "targeting",
    ["IN"],
    "string[]",
    "optimization_goal",
    {
      possibleValues: [
        "CLICK",
        "CONVERT",
        "INSTALL",
        "SHOW",
        "ENGAGED_VIEW",
        "VALUE",
        "FOLLOW",
        "PROFILE_VISIT",
        "VIDEO_VIEW",
        "LEAD_GENERATION",
        "APP_EVENT",
        "COMPLETE_PAYMENT",
      ],
    }
  ),
  createFilter(
    "promotion_type",
    "Promotion Type",
    "Filter by what is being promoted",
    "targeting",
    ["IN"],
    "string[]",
    "promotion_type",
    {
      possibleValues: [
        "APP_ANDROID",
        "APP_IOS",
        "WEBSITE",
        "TIKTOK_SHOP",
        "LEAD_GENERATION",
        "INSTANT_PAGE",
      ],
    }
  ),
  createFilter(
    "age",
    "Age Targeting",
    "Filter by age targeting group",
    "targeting",
    ["IN"],
    "string[]",
    "age",
    {
      possibleValues: [
        "AGE_13_17",
        "AGE_18_24",
        "AGE_25_34",
        "AGE_35_44",
        "AGE_45_54",
        "AGE_55_100",
        "AGE_UNLIMITED",
      ],
    }
  ),
  createFilter(
    "gender",
    "Gender Targeting",
    "Filter by gender targeting",
    "targeting",
    ["IN"],
    "string[]",
    "gender",
    {
      possibleValues: [
        "FEMALE",
        "MALE",
        "UNLIMITED",
      ],
    }
  ),
  createFilter(
    "dpa_target_audience_type",
    "DPA Target Audience",
    "Filter by Dynamic Product Ads audience type",
    "targeting",
    ["IN"],
    "string[]",
    "dpa_target_audience_type",
    {
      possibleValues: [
        "RETARGETING",
        "PROSPECTING",
        "BROAD",
      ],
    }
  ),
];

// ============================================
// AD CONFIGURATION FILTERS
// ============================================

export const AD_CONFIG_FILTERS: TikTokFilterDefinition[] = [
  createFilter(
    "buying_type",
    "Buying Type",
    "Filter by ad buying type",
    "ad_config",
    ["IN"],
    "string[]",
    "buying_type",
    {
      possibleValues: [
        "AUCTION",
        "RESERVATION_TOP_VIEW",
        "RESERVATION_RF",
      ],
    }
  ),
  createFilter(
    "app_promotion_type",
    "App Promotion Type",
    "Filter by app promotion type",
    "ad_config",
    ["IN"],
    "string[]",
    "app_promotion_type",
    {
      possibleValues: [
        "APP_INSTALL",
        "APP_RETARGETING",
        "APP_PRE_REGISTRATION",
      ],
    }
  ),
  createFilter(
    "ad_entity_type",
    "Ad Entity Type",
    "Filter by ad entity type",
    "ad_config",
    ["IN"],
    "string[]",
    "ad_entity_type",
    {
      possibleValues: [
        "STANDARD",
        "SPARK",
        "PLAYABLE",
        "LEAD_GEN",
        "CAROUSEL",
        "COLLECTION",
      ],
    }
  ),
  createFilter(
    "identity_type",
    "Identity Type",
    "Filter by identity authorization type",
    "ad_config",
    ["IN"],
    "string[]",
    "identity_type",
    {
      possibleValues: [
        "AUTH_CODE",
        "TT_USER",
        "BC_AUTH_TT",
        "NO_IDENTITY",
      ],
    }
  ),
  createFilter(
    "image_mode",
    "Image Mode",
    "Filter by creative image mode",
    "ad_config",
    ["IN"],
    "string[]",
    "image_mode",
    {
      possibleValues: [
        "SINGLE_IMAGE",
        "VIDEO",
        "CAROUSEL",
        "PLAYABLE",
      ],
    }
  ),
  createFilter(
    "creative_material_mode",
    "Creative Material Mode",
    "Filter by creative optimization mode",
    "ad_config",
    ["IN"],
    "string[]",
    "creative_material_mode",
    {
      possibleValues: [
        "CUSTOM",
        "AUTOMATED",
        "SMART_CREATIVE",
      ],
    }
  ),
  createFilter(
    "destination",
    "Destination",
    "Filter by ad destination",
    "ad_config",
    ["IN"],
    "string[]",
    "destination",
    {
      possibleValues: [
        "WEBSITE",
        "APP_STORE",
        "INSTANT_PAGE",
        "TIKTOK_PAGE",
        "TIKTOK_SHOP",
        "LEAD_FORM",
        "MESSAGING",
      ],
    }
  ),
];

// ============================================
// LABEL FILTERS
// ============================================

export const LABEL_FILTERS: TikTokFilterDefinition[] = [
  createFilter(
    "campaign_label_ids",
    "Campaign Label IDs",
    "Filter by campaign label IDs",
    "labels",
    ["CONTAIN_ANY_OF"],
    "string[]",
    "campaign_label_ids"
  ),
  createFilter(
    "campaign_label_names",
    "Campaign Label Names",
    "Filter by campaign label names",
    "labels",
    ["CONTAIN_ANY_OF"],
    "string[]",
    "campaign_label_names"
  ),
  createFilter(
    "campaign_label_types",
    "Campaign Label Types",
    "Filter by campaign label types",
    "labels",
    ["CONTAIN_ANY_OF"],
    "string[]",
    "campaign_label_types",
    {
      possibleValues: [
        "SYSTEM",
        "CUSTOM",
      ],
    }
  ),
];

// ============================================
// TIME FILTERS
// ============================================

export const TIME_FILTERS: TikTokFilterDefinition[] = [
  createFilter(
    "create_time",
    "Create Time",
    "Filter by creation time range",
    "time",
    ["BETWEEN", "GREATER_THAN", "LOWER_THAN"],
    "date_range",
    "create_time"
  ),
];

// ============================================
// COMPLETE FILTER CATALOG
// ============================================

export const TIKTOK_FILTER_CATALOG: TikTokFilterDefinition[] = [
  ...ID_FILTERS,
  ...STATUS_FILTERS,
  ...CAMPAIGN_CONFIG_FILTERS,
  ...TARGETING_FILTERS,
  ...AD_CONFIG_FILTERS,
  ...LABEL_FILTERS,
  ...TIME_FILTERS,
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get filter definition by key
 */
export function getFilterDefinition(key: string): TikTokFilterDefinition | undefined {
  return TIKTOK_FILTER_CATALOG.find((f) => f.key === key);
}

/**
 * Get all filters by category
 */
export function getFiltersByCategory(category: FilterCategory): TikTokFilterDefinition[] {
  return TIKTOK_FILTER_CATALOG.filter((f) => f.category === category);
}

/**
 * Get all filters grouped by category
 */
export function getAllFiltersGroupedByCategory(): Record<FilterCategory, TikTokFilterDefinition[]> {
  const grouped: Record<FilterCategory, TikTokFilterDefinition[]> = {
    id: [],
    status: [],
    campaign_config: [],
    targeting: [],
    ad_config: [],
    labels: [],
    time: [],
  };

  for (const filter of TIKTOK_FILTER_CATALOG) {
    if (grouped[filter.category]) {
      grouped[filter.category].push(filter);
    }
  }

  return grouped;
}

/**
 * Validate filter value against definition
 */
export function validateFilterValue(
  filterKey: string,
  operator: FilterOperator,
  value: unknown
): { valid: boolean; error?: string } {
  const definition = getFilterDefinition(filterKey);

  if (!definition) {
    return { valid: false, error: `Unknown filter: ${filterKey}` };
  }

  // Check if operator is supported
  if (!definition.supportedOperators.includes(operator)) {
    return {
      valid: false,
      error: `Operator "${operator}" not supported for filter "${filterKey}". Supported: ${definition.supportedOperators.join(", ")}`,
    };
  }

  // Check value type
  if (definition.valueType === "string[]") {
    if (!Array.isArray(value)) {
      return { valid: false, error: `Filter "${filterKey}" expects an array value` };
    }
    // Check if values are in possibleValues if defined
    if (definition.possibleValues) {
      const invalidValues = (value as string[]).filter(
        (v) => !definition.possibleValues!.includes(v)
      );
      if (invalidValues.length > 0) {
        return {
          valid: false,
          error: `Invalid values for "${filterKey}": ${invalidValues.join(", ")}. Valid values: ${definition.possibleValues.join(", ")}`,
        };
      }
    }
  } else if (definition.valueType === "date_range") {
    if (operator === "BETWEEN") {
      if (typeof value !== "object" || !("start" in (value as object)) || !("end" in (value as object))) {
        return { valid: false, error: `Filter "${filterKey}" with BETWEEN requires { start, end } object` };
      }
    }
  }

  return { valid: true };
}

/**
 * Build filter object for API request
 */
export function buildFilterObject(
  filterKey: string,
  operator: FilterOperator,
  value: string | string[] | { start: string; end: string }
): { field_name: string; filter_type: FilterOperator; filter_value: typeof value } | null {
  const definition = getFilterDefinition(filterKey);
  if (!definition) return null;

  return {
    field_name: definition.apiField,
    filter_type: operator,
    filter_value: value,
  };
}

/**
 * Get filter category display order
 */
export const FILTER_CATEGORY_ORDER: FilterCategory[] = [
  "id",
  "status",
  "campaign_config",
  "targeting",
  "ad_config",
  "labels",
  "time",
];

/**
 * Get human-readable category name
 */
export function getCategoryDisplayName(category: FilterCategory): string {
  const names: Record<FilterCategory, string> = {
    id: "Entity IDs",
    status: "Status",
    campaign_config: "Campaign Configuration",
    targeting: "Targeting & Objectives",
    ad_config: "Ad Configuration",
    labels: "Labels",
    time: "Time Range",
  };
  return names[category] || category;
}

/**
 * Get human-readable operator name
 */
export function getOperatorDisplayName(operator: FilterOperator): string {
  const names: Record<FilterOperator, string> = {
    IN: "Is any of",
    NOT_IN: "Is not any of",
    CONTAIN_ANY_OF: "Contains any of",
    BETWEEN: "Between",
    GREATER_THAN: "After",
    LOWER_THAN: "Before",
  };
  return names[operator] || operator;
}

/**
 * Get filters available for a specific data level
 */
export function getFiltersForDataLevel(dataLevel: DataLevel): TikTokFilterDefinition[] {
  return TIKTOK_FILTER_CATALOG.filter((f) => {
    if (!f.levelRestrictions) return true;
    return f.levelRestrictions.includes(dataLevel);
  });
}
