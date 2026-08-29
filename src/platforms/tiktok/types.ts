/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// TIKTOK BUSINESS API TYPES FOR BENLY REPORTS
// ============================================

// --- Enums ---

/**
 * Service type determines the ad buying model
 * - AUCTION: Standard auction-based ad buying (most common)
 * - RESERVATION: Reserved inventory (TopView, Reach & Frequency)
 */
export type ServiceType = "AUCTION" | "RESERVATION";

/**
 * Report type determines the data structure returned
 * - BASIC: Standard performance metrics (most common)
 * - AUDIENCE: Audience analysis reports
 * - PLAYABLE_MATERIAL: Playable ad performance
 * - CATALOG: Product catalog reports
 * - BC: Business Center reports
 */
export type ReportType = "BASIC" | "AUDIENCE" | "PLAYABLE_MATERIAL" | "CATALOG" | "BC";

/**
 * Data level determines the granularity of reporting
 * - AUCTION_ADVERTISER: Account-level aggregation
 * - AUCTION_CAMPAIGN: Campaign-level data
 * - AUCTION_ADGROUP: Ad group-level data
 * - AUCTION_AD: Individual ad-level data
 */
export type DataLevel =
  | "AUCTION_ADVERTISER"
  | "AUCTION_CAMPAIGN"
  | "AUCTION_ADGROUP"
  | "AUCTION_AD"
  | "RESERVATION_ADVERTISER"
  | "RESERVATION_CAMPAIGN"
  | "RESERVATION_ADGROUP"
  | "RESERVATION_AD";

/**
 * Time granularity for reports
 */
export type TimeGranularity = "DAY" | "HOUR" | "LIFETIME";

// --- Configuration ---

export interface TikTokApiConfig {
  accessToken: string;
  advertiserId: string;
  apiVersion: string; // "v1.3"
}

export interface TimeRange {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
}

// --- Metric Categories ---

export type MetricCategory =
  | "core"
  | "video"
  | "clicks"
  | "social"
  | "live"
  | "interactive"
  | "instant_experience"
  | "app"
  | "website"
  | "tiktok"
  | "offline"
  | "messaging"
  | "shop"
  | "attribution"
  | "skan"
  | "attribute"
  | "calculated";

export type MetricType = "native" | "calculated";

export type MetricFormat =
  | "number"
  | "currency"
  | "percentage"
  | "duration"
  | "ratio";

// --- Dimension Categories ---

export type DimensionCategory =
  | "id"
  | "time"
  | "targeting"
  | "asset"
  | "search"
  | "conversion";

// --- Filter Categories ---

export type FilterCategory =
  | "id"
  | "status"
  | "campaign_config"
  | "targeting"
  | "ad_config"
  | "labels"
  | "time";

export type FilterOperator =
  | "IN"
  | "NOT_IN"
  | "CONTAIN_ANY_OF"
  | "BETWEEN"
  | "GREATER_THAN"
  | "LOWER_THAN";

// --- Catalog Definitions ---

export interface TikTokMetricDefinition {
  key: string;
  name: string;
  description: string;
  category: MetricCategory;
  type: MetricType;
  format: MetricFormat;
  apiField: string; // Exact API field name
  compatibleDimensions: string[];
  incompatibleDimensions?: string[];
  requiredFields?: string[]; // For calculated metrics
  levelRestrictions?: DataLevel[];
  isDeprecated?: boolean;
  attributionType?: "CTA" | "VTA" | "EVTA" | "SKAN"; // Attribution model
}

export interface TikTokDimensionDefinition {
  key: string;
  name: string;
  description: string;
  category: DimensionCategory;
  apiField: string;
  possibleValues?: string[];
  groupingRules: {
    maxOneFrom?: string[]; // Can only use one dimension from this group
    requiresAny?: string[];  // Must combine with at least one of these
    excludes?: string[];     // Cannot combine with these
  };
  supportedMetrics?: string[]; // If limited to specific metrics
  levelRestrictions?: DataLevel[];
  supportsLifetime?: boolean; // Whether dimension works with query_lifetime=true
}

export interface TikTokFilterDefinition {
  key: string;
  name: string;
  description: string;
  category: FilterCategory;
  apiField: string;
  supportedOperators: FilterOperator[];
  possibleValues?: string[];
  valueType: "string" | "string[]" | "number" | "date_range";
  levelRestrictions?: DataLevel[];
}

// --- API Request Types ---

export interface TikTokFilter {
  field_name: string;
  filter_type: FilterOperator;
  filter_value: string | string[] | { start: string; end: string };
}

export interface TikTokQueryRequest {
  advertiserId: string;
  serviceType: ServiceType;
  reportType: ReportType;
  dataLevel: DataLevel;
  dimensions: string[];
  metrics: string[];
  startDate: string;
  endDate: string;
  filtering?: TikTokFilter[];
  queryLifetime?: boolean;
  page?: number;
  pageSize?: number;
  orderField?: string;
  orderType?: "ASC" | "DESC";
}

export interface TikTokApiRequest {
  type: "basic" | "attribution" | "skan" | "shop";
  advertiser_id: string;
  service_type: ServiceType;
  report_type: ReportType;
  data_level: DataLevel;
  dimensions: string[];
  metrics: string[];
  start_date: string;
  end_date: string;
  filtering?: TikTokFilter[];
  query_lifetime?: boolean;
  page?: number;
  page_size?: number;
  order_field?: string;
  order_type?: "ASC" | "DESC";
}

// --- API Response Types ---

export interface TikTokInsightRow {
  // Dimension values (present based on requested dimensions)
  advertiser_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  adgroup_id?: string;
  adgroup_name?: string;
  ad_id?: string;
  ad_name?: string;
  stat_time_day?: string;
  stat_time_hour?: string;
  country_code?: string;
  ad_type?: string;
  custom_event_type?: string;
  event_source_id?: string;
  page_id?: string;
  video_material_id?: string;
  image_id?: string;
  search_terms?: string;
  search_keyword?: string;
  match_type?: string;

  // Core metrics
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  cpc?: string;
  reach?: string;
  frequency?: string;
  gross_impressions?: string;
  secondary_goal_result?: string;
  cost_per_secondary_goal_result?: string;
  secondary_goal_result_rate?: string;

  // Video metrics
  video_play_actions?: string;
  video_watched_2s?: string;
  video_watched_6s?: string;
  video_views_p25?: string;
  video_views_p50?: string;
  video_views_p75?: string;
  video_views_p100?: string;
  engaged_view?: string;
  engaged_view_15s?: string;
  average_video_play?: string;
  average_video_play_per_user?: string;
  total_watch_time?: string;

  // Click metrics
  engagements?: string;
  clicks_on_music_disc?: string;
  anchor_clicks?: string;
  headline_clicks?: string;
  card_clicks?: string;
  real_time_app_install?: string;
  real_time_app_install_cost?: string;

  // Social metrics
  follows?: string;
  likes?: string;
  comments?: string;
  shares?: string;
  profile_visits?: string;
  profile_visits_rate?: string;
  duet?: string;
  stitch?: string;
  sound_usage?: string;

  // LIVE metrics
  live_views?: string;
  live_unique_views?: string;
  live_effective_views?: string;
  live_product_clicks?: string;
  live_effective_views_cost?: string;

  // App conversion metrics (various attribution types)
  app_install?: string;
  registration?: string;
  purchase?: string;
  add_to_cart?: string;
  checkout?: string;
  view_content?: string;
  add_payment_info?: string;
  add_to_wishlist?: string;
  launch_app?: string;
  complete_tutorial?: string;
  create_group?: string;
  join_group?: string;
  create_gamerole?: string;
  spend_credits?: string;
  achieve_level?: string;
  unlock_achievement?: string;
  sales_lead?: string;
  in_app_ad_click?: string;
  in_app_ad_impr?: string;
  loan_apply?: string;
  loan_approval?: string;
  loan_disbursal?: string;
  login?: string;
  rate?: string;
  start_trial?: string;
  subscribe?: string;
  next_day_open?: string;
  total_app_event?: string;

  // Website conversion metrics
  complete_payment?: string;
  landing_page_view?: string;
  page_view?: string;
  page_browse?: string;
  button_click?: string;
  online_consult?: string;
  user_registration?: string;
  product_details_page_browse?: string;
  web_detail_add_cart?: string;
  web_shopping?: string;
  web_event_add_to_cart?: string;
  initiate_checkout?: string;
  add_billing?: string;
  search?: string;
  watch_video?: string;
  download?: string;
  contact?: string;
  form?: string;
  submit_form?: string;

  // TikTok (Onsite) conversion metrics
  ix_page_view_count?: string;
  ix_button_click_count?: string;
  ix_product_click_count?: string;
  complete_payment_onsite?: string;
  initiate_checkout_onsite?: string;
  add_to_cart_onsite?: string;

  // Attribution-specific metrics (CTA, VTA, EVTA variations)
  // These follow the pattern: {metric}_{attribution_type}
  app_install_cta?: string;
  app_install_vta?: string;
  app_install_evta?: string;
  purchase_cta?: string;
  purchase_vta?: string;
  purchase_evta?: string;
  // ... many more attribution variations

  // Cost per action metrics
  cost_per_app_install?: string;
  cost_per_registration?: string;
  cost_per_purchase?: string;
  cost_per_add_to_cart?: string;
  cost_per_checkout?: string;
  cost_per_landing_page_view?: string;
  cost_per_result?: string;
  cost_per_1000_reached?: string;
  cost_per_100_reached?: string;

  // Value metrics
  total_purchase_value?: string;
  total_add_to_cart_value?: string;
  total_initiate_checkout_value?: string;
  total_view_content_value?: string;
  total_complete_payment_value?: string;

  // ROAS metrics
  complete_payment_roas?: string;
  purchase_roas?: string;
  value_per_complete_payment?: string;

  // SKAN metrics
  skan_app_install?: string;
  skan_purchase?: string;
  skan_registration?: string;
  skan_add_to_cart?: string;
  skan_checkout?: string;
  skan_purchase_value?: string;
  skan_cost_per_app_install?: string;
  skan_cost_per_purchase?: string;
  skan_purchase_roas?: string;

  // Shop metrics
  product_clicks?: string;
  product_details_page_browse_shop?: string;
  add_to_cart_shop?: string;
  checkout_shop?: string;
  complete_payment_shop?: string;
  live_product_clicks_shop?: string;
  video_product_clicks?: string;
  onsite_shopping_roas?: string;
  onsite_complete_payment_value?: string;

  // Messaging metrics
  onsite_form?: string;
  onsite_form_detail?: string;
  onsite_download?: string;
  ix_download_click_count?: string;
  ix_app_download_count?: string;

  // Result metrics
  result?: string;
  result_rate?: string;
  conversion?: string;
  real_time_conversion?: string;

  // Total/combined website conversion metrics
  total_complete_payment_rate?: string; // misleading name: currency VALUE, not a rate
  total_web_event_add_to_cart?: string;
  total_web_event_add_to_cart_value?: string;
  total_initiate_checkout?: string;
  total_landing_page_view?: string;
  total_pageview?: string;
  cost_per_pageview?: string;
  page_browse_view?: string;
  website_form?: string;
  website_total_form?: string;
  website_download?: string;
  website_total_download?: string;
  website_contact?: string;
  website_total_contact?: string;

  // App total/rate metrics
  total_purchase?: string;
  total_registration?: string;
  total_subscribe_value?: string;
  total_app_event_value?: string;
  total_active_pay_roas?: string;
  registration_rate?: string;
  purchase_rate?: string;
  cost_per_total_registration?: string;
  cost_per_total_purchase?: string;
  value_per_total_purchase?: string;
  total_purchase_roas_day0?: string;
  total_purchase_roas_day2?: string;
  total_purchase_roas_day6?: string;
  app_event_add_to_cart?: string;
  app_event_add_to_cart_rate?: string;
  cost_per_app_event_add_to_cart?: string;
  total_app_event_add_to_cart?: string;
  total_app_event_add_to_cart_value?: string;
  cost_per_total_app_event_add_to_cart?: string;
  value_per_total_app_event_add_to_cart?: string;
  checkout_rate?: string;
  total_checkout?: string;
  total_checkout_value?: string;
  cost_per_total_checkout?: string;
  value_per_checkout?: string;
  view_content_rate?: string;
  total_view_content?: string;
  cost_per_total_view_content?: string;
  value_per_total_view_content?: string;
  cost_per_view_content?: string;

  // TikTok Shop metrics
  onsite_shopping?: string;
  total_onsite_shopping_value?: string;
  onsite_initiate_checkout_count?: string;
  onsite_on_web_detail?: string;
  onsite_on_web_cart?: string;
  shop_total_items_purchased?: string;
  cost_per_product_click?: string;
  cost_per_add_to_cart_shop?: string;
  cost_per_onsite_shopping?: string;
  value_per_onsite_shopping?: string;
  onsite_shopping_rate?: string;

  // Onsite (TikTok platform) metrics
  onsite_total_purchase?: string;
  onsite_total_purchase_value?: string;
  onsite_total_checkout_initiation?: string;
  onsite_total_add_to_cart?: string;
  onsite_total_product_details_page_view?: string;
  onsite_total_registration?: string;
  onsite_unique_purchase?: string;
  onsite_cost_per_purchase?: string;
  onsite_cost_per_checkout_initiation?: string;
  onsite_cost_per_add_to_cart?: string;
  onsite_cost_per_product_details_page_view?: string;
  onsite_purchase_rate?: string;
  onsite_value_per_purchase?: string;
  onsite_purchases_roas?: string;
  onsite_total_purchase_value_day0?: string;
  onsite_total_purchase_value_day6?: string;
  onsite_total_purchase_value_day13?: string;
  onsite_total_purchase_roas_day0?: string;
  onsite_total_purchase_roas_day6?: string;
  onsite_total_purchase_roas_day13?: string;

  // Offline metrics
  offline_shopping_events?: string;
  offline_shopping_events_value?: string;
  cost_per_offline_shopping_event?: string;
  offline_shopping_events_roas?: string;
  offline_total_crm_events?: string;
  offline_contact_events?: string;
  offline_subscribe_events?: string;
  offline_form_events?: string;

  // Messaging metrics
  messaging_conversation_started?: string;
  cost_per_messaging_conversation_started?: string;

  // Engagement cost metrics
  cost_per_engaged_view?: string;
  cost_per_follow?: string;
  cost_per_like?: string;
  cost_per_share?: string;

  // LIVE extra metrics
  live_followers?: string;
  live_gift_value?: string;

  // Instant Experience extra metrics
  ix_video_view_count?: string;
  ix_average_page_stay?: string;
  ix_average_page_view_per_user?: string;

  // CTA Attribution metrics
  cta_conversion?: string;
  cost_per_cta_conversion?: string;
  cta_purchase?: string;
  cost_per_cta_purchase?: string;
  cta_registration?: string;
  cost_per_cta_registration?: string;
  cta_app_install?: string;
  cost_per_cta_app_install?: string;

  // VTA Attribution metrics
  vta_conversion?: string;
  cost_per_vta_conversion?: string;
  vta_purchase?: string;
  cost_per_vta_purchase?: string;
  vta_registration?: string;
  cost_per_vta_registration?: string;
  vta_app_install?: string;
  cost_per_vta_app_install?: string;
  vta_complete_payment?: string;
  vta_complete_payment_value?: string;
  vta_complete_payment_roas?: string;

  // EVTA Attribution metrics
  engaged_view_through_conversions?: string;
  cost_per_engaged_view_through_conversion?: string;
  evta_app_install?: string;
  evta_registration?: string;
  evta_purchase?: string;
  evta_payments_completed?: string;

  // SKAN extra metrics
  skan_total_purchase_value?: string;
  skan_total_repetitive_active_pay_roas?: string;
  skan_view_content?: string;
  skan_subscribe?: string;
  skan_start_trial?: string;
  skan_conversion?: string;
  skan_result?: string;
  skan_cost_per_result?: string;
  skan_conversion_rate_v2?: string;

  // Allow additional fields
  [key: string]: unknown;
}

export interface TikTokApiResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    list: TikTokInsightRow[];
    page_info: {
      page: number;
      page_size: number;
      total_number: number;
      total_page: number;
    };
  };
}

// --- Request Types ---

export interface TikTokInsightsQueryRequest {
  advertiserId: string;
  dataLevel: DataLevel;
  metrics: string[];
  dimensions?: string[];
  timeRange?: TimeRange;
  queryLifetime?: boolean;
  filtering?: TikTokFilter[];
  page?: number;
  pageSize?: number;
}

// --- Query Planning Types ---

export interface TikTokQueryPlan {
  requests: TikTokApiRequest[];
  calculatedMetrics: string[];
  joinKeys: string[];
  warnings: string[];
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// --- Calculated Metrics Types ---

export interface TikTokDerivedMetrics {
  // Video engagement metrics
  hookRate?: number;           // (video_views_p25 / impressions) * 100
  thumbstopRate?: number;      // (video_play_actions / impressions) * 100
  holdRate?: number;           // (video_views_p50 / video_views_p25) * 100
  completionRate?: number;     // (video_views_p100 / video_views_p25) * 100
  engagementRate?: number;     // (engagements / impressions) * 100

  // Funnel metrics
  clickToAtcRatio?: number;    // (add_to_cart / clicks) * 100
  atcToPurchaseRatio?: number; // (purchase / add_to_cart) * 100
  clickToPurchaseRatio?: number; // (purchase / clicks) * 100

  // Value metrics
  aov?: number;                // total_purchase_value / purchase (app events)
  aovWebsite?: number;         // total_complete_payment_value / complete_payment (website events)
  aovCombined?: number;        // Combined AOV: app, website, or shop (first available)
  aovShop?: number;            // onsite_complete_payment_value / complete_payment_shop

  // Video retention metrics
  videoP25Rate?: number;       // (video_views_p25 / impressions) * 100
  videoP50Rate?: number;       // (video_views_p50 / impressions) * 100
  videoP75Rate?: number;       // (video_views_p75 / impressions) * 100
  videoP100Rate?: number;      // (video_views_p100 / impressions) * 100

  // Drop-off metrics
  dropOffP25ToP50?: number;    // 100 - holdRate
  dropOffP50ToP75?: number;    // 100 - (video_views_p75 / video_views_p50) * 100
  dropOffP75ToP100?: number;   // 100 - (video_views_p100 / video_views_p75) * 100

  // Social engagement
  likeRate?: number;           // (likes / impressions) * 100
  commentRate?: number;        // (comments / impressions) * 100
  shareRate?: number;          // (shares / impressions) * 100
  followRate?: number;         // (follows / impressions) * 100

  // Cost efficiency
  costPerEngagement?: number;  // spend / engagements
  costPerVideoView?: number;   // spend / video_play_actions
  costPer1000VideoViews?: number; // (spend / video_play_actions) * 1000
}

// --- OAuth Types removed (not needed for MCP server) ---

export interface TikTokAdvertiser {
  advertiser_id: string;
  advertiser_name: string;
  currency: string;
  timezone: string;
  status: string;
  company: string;
  balance: number;
}

export interface TikTokAdvertisersResponse {
  code: number;
  message: string;
  data: {
    list: TikTokAdvertiser[];
  };
}

// --- Debug Types ---

export interface QueryDebugInfo {
  requestCount: number;
  rawRequests: TikTokApiRequest[];
  rawResponses?: unknown[];
  calculatedMetrics: string[];
  joinKeys: string[];
  executionTimeMs: number;
  totalRows: number;
  errors: string[];
  warnings: string[];
}

export interface TikTokInsightsResponse {
  data: Record<string, unknown>[];
  debug: QueryDebugInfo;
}

// --- Dimension Grouping Rules ---

/**
 * Dimension groups for compatibility checking
 * Only one dimension from each group can be used per request
 */
export const DIMENSION_GROUPS = {
  ID_DIMENSIONS: [
    "campaign_id",
    "adgroup_id",
    "ad_id",
    "advertiser_id",
  ],
  TIME_DIMENSIONS: [
    "stat_time_day",
    "stat_time_hour",
  ],
  TARGETING_DIMENSIONS: [
    "country_code",
    "ad_type",
  ],
  ASSET_DIMENSIONS: [
    "video_material_id",
    "image_id",
  ],
  SEARCH_DIMENSIONS: [
    "search_terms",
    "search_keyword",
    "match_type",
  ],
  CONVERSION_DIMENSIONS: [
    "custom_event_type",
    "event_source_id",
    "page_id",
  ],
} as const;

/**
 * Dimensions that don't work with lifetime queries
 */
export const LIFETIME_INCOMPATIBLE_DIMENSIONS = [
  "stat_time_day",
  "stat_time_hour",
  "country_code",
] as const;

/**
 * Valid combinations of dimensions
 * Each entry represents a valid grouping
 */
export const VALID_DIMENSION_COMBINATIONS = [
  // Single ID dimension
  ["advertiser_id"],
  ["campaign_id"],
  ["adgroup_id"],
  ["ad_id"],

  // ID + Time
  ["campaign_id", "stat_time_day"],
  ["adgroup_id", "stat_time_day"],
  ["ad_id", "stat_time_day"],
  ["campaign_id", "stat_time_hour"],
  ["adgroup_id", "stat_time_hour"],
  ["ad_id", "stat_time_hour"],

  // ID + Country
  ["campaign_id", "country_code"],
  ["adgroup_id", "country_code"],
  ["ad_id", "country_code"],

  // Search dimensions (require ad_id or adgroup_id)
  ["ad_id", "search_terms"],
  ["ad_id", "search_keyword"],
  ["ad_id", "match_type"],
  ["adgroup_id", "search_terms"],
  ["adgroup_id", "search_keyword"],

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
] as const;

// --- Ad Creative Types ---

export interface TikTokAdDetail {
  ad_id: string;
  ad_name: string;
  ad_text?: string;
  ad_texts?: string[];           // Multiple text variants (plural -- the real text source)
  call_to_action?: string;
  video_id?: string;
  image_id?: string;       // Single image (for single-image ads)
  image_ids?: string[];    // Multiple images (for carousel ads)
  landing_page_url?: string;
  landing_page_urls?: string[];  // Multiple landing page URLs
  display_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adgroup_id?: string;
  adgroup_name?: string;
  operation_status?: string;
  create_time?: string;
  modify_time?: string;
  creative_type?: string;      // e.g. CREATIVE_TYPE_IMAGE, CREATIVE_TYPE_VIDEO
  image_mode?: string;         // e.g. IMAGE_MODE_SMALL_IMAGE, IMAGE_MODE_CAROUSEL
  profile_image_url?: string;  // Fallback profile/avatar image
  ad_format?: string;          // e.g. SINGLE_VIDEO, SINGLE_IMAGE, CAROUSEL_ADS
  creative_material_mode?: string; // CUSTOM, DYNAMIC, SMART_CREATIVE
  tiktok_item_id?: string;     // Spark Ad post ID
  is_aco?: boolean;            // Automated creative optimization
  // Enriched from file info
  video_info?: TikTokVideoInfo;
  image_info?: TikTokImageInfo[];
  // Set by API route
  is_dpa?: boolean;
  is_spark_ad?: boolean;
}

export interface TikTokVideoInfo {
  video_id: string;
  preview_url?: string;
  cover_image_url?: string;
  duration?: number;
  width?: number;
  height?: number;
  file_name?: string;
  format?: string;
  bit_rate?: number;
  size?: number;
}

export interface TikTokImageInfo {
  image_id: string;
  image_url?: string;
  width?: number;
  height?: number;
  file_name?: string;
  format?: string;
  size?: number;
}

export interface TikTokPageInfo {
  page: number;
  page_size: number;
  total_number: number;
  total_page: number;
}

// --- Catalog Dimensions ---

/**
 * Valid CATALOG report request dimensions.
 * These are the ONLY fields that can be sent in the `dimensions` array
 * for report_type: CATALOG. Other fields (names, images) are returned
 * automatically as response attributes.
 */
export const CATALOG_DIMENSIONS = [
  "catalog_id",
  "product_id",
  "sku_id",
  "product_set_id",
  "stat_time_day",
  "campaign_id",
  "adgroup_id",
  "ad_id",
] as const;

/**
 * Response-only attributes for CATALOG reports.
 * These are returned automatically by the API when corresponding
 * ID dimensions are included. Do NOT send these in the dimensions array.
 */
export const CATALOG_RESPONSE_ATTRIBUTES = [
  "catalog_name",
  "product_name",
  "product_image",
  "product_set_name",
  "campaign_name",
  "adgroup_name",
  "ad_name",
  "ad_text",
  "placement",
  "dpa_target_audience_type",
  "promotion_type",
] as const;

export const CATALOG_COMPATIBLE_METRICS = [
  // Core
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "reach",
  "cost_per_1000_reached",
  "frequency",
  // Conversions
  "conversion",
  "cost_per_conversion",
  "conversion_rate",
  "result",
  "cost_per_result",
  "result_rate",
  "real_time_conversion",
  "real_time_cost_per_conversion",
  // Purchase / Website
  "complete_payment",
  "total_complete_payment_value",
  "complete_payment_roas",
  "value_per_complete_payment",
  "cost_per_complete_payment",
  "initiate_checkout",
  "cost_per_initiate_checkout",
  "web_event_add_to_cart",
  "cost_per_web_event_add_to_cart",
  "product_details_page_browse",
  "cost_per_product_details_page_browse",
  // Video
  "video_play_actions",
  "video_watched_2s",
  "video_watched_6s",
  "video_views_p25",
  "video_views_p50",
  "video_views_p75",
  "video_views_p100",
  "average_video_play",
  // Social
  "likes",
  "comments",
  "shares",
  "follows",
  "profile_visits",
  // App
  "app_install",
  "cost_per_app_install",
  "registration",
  "cost_per_registration",
] as const;

// --- DMP Audience Types ---

export type TikTokAudienceStatus =
  | "NORMAL"
  | "UPLOADING"
  | "PROCESSING"
  | "EXPIRED"
  | "FAILED"
  | "SHARED"
  | "DELETED";

export type TikTokAudienceSubtype =
  | "ENGAGEMENT"
  | "FILE_BASED"
  | "PIXEL"
  | "APP"
  | "LOOKALIKE"
  | "COMBINATION"
  | "SHOPPING"
  | "LEAD_GENERATION"
  | "BUSINESS_ACCOUNT"
  | "TIKTOK_SHOP"
  | "OFFLINE";

export interface TikTokLookalikeSpec {
  source_audience_id: string;
  location_ids: string[];
  degree?: string;
}

export interface TikTokCustomAudience {
  audience_id: string;
  name: string;
  audience_type: string;
  subtype: TikTokAudienceSubtype | string;
  cover_num: number;
  create_time: string;
  is_creator: boolean;
  is_valid: boolean;
  status: TikTokAudienceStatus | string;
  description?: string;
  retention_days?: number;
  lookalike_spec?: TikTokLookalikeSpec;
}

export interface TikTokSavedAudience {
  saved_audience_id: string;
  name: string;
  create_time: string;
  modify_time: string;
  targeting?: Record<string, unknown>;
}

export interface TikTokCustomAudienceListResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    list: TikTokCustomAudience[];
    page_info: TikTokPageInfo;
  };
}

export interface TikTokSavedAudienceListResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    list: TikTokSavedAudience[];
    page_info: TikTokPageInfo;
  };
}

// --- Constants ---

export const TIKTOK_API_BASE_URL = "https://business-api.tiktok.com/open_api/v1.3";

export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 1000;
export const MAX_METRICS_PER_REQUEST = 200;
export const MAX_DATE_RANGE_DAYS = 365;
