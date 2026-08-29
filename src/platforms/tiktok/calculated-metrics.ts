/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// TIKTOK CALCULATED METRICS
// ============================================
// Metrics computed client-side from raw API data

import { TikTokInsightRow, TikTokDerivedMetrics } from "./types.js";

// ============================================
// SAFE NUMBER PARSING
// ============================================

/**
 * Safely parse a number from various input types
 */
function parseNum(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Safe division with fallback for zero divisor
 */
function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0) return fallback;
  return numerator / denominator;
}

/**
 * Calculate percentage safely
 */
function safePercentage(numerator: number, denominator: number): number {
  return safeDivide(numerator, denominator) * 100;
}

// ============================================
// INDIVIDUAL METRIC CALCULATIONS
// ============================================

/**
 * Hook Rate: Percentage of impressions where users watched to 25% of video
 * Formula: (video_views_p25 / impressions) * 100
 */
export function calculateHookRate(row: TikTokInsightRow): number {
  const p25 = parseNum(row.video_views_p25);
  const impressions = parseNum(row.impressions);
  return safePercentage(p25, impressions);
}

/**
 * Thumbstop Rate: Percentage of impressions that resulted in video plays
 * Formula: (video_play_actions / impressions) * 100
 */
export function calculateThumbstopRate(row: TikTokInsightRow): number {
  const plays = parseNum(row.video_play_actions);
  const impressions = parseNum(row.impressions);
  return safePercentage(plays, impressions);
}

/**
 * Hold Rate: Percentage of users who reached 25% and continued to 50%
 * Formula: (video_views_p50 / video_views_p25) * 100
 */
export function calculateHoldRate(row: TikTokInsightRow): number {
  const p50 = parseNum(row.video_views_p50);
  const p25 = parseNum(row.video_views_p25);
  return safePercentage(p50, p25);
}

/**
 * Completion Rate: Percentage of users who reached 25% and completed the video
 * Formula: (video_views_p100 / video_views_p25) * 100
 */
export function calculateCompletionRate(row: TikTokInsightRow): number {
  const p100 = parseNum(row.video_views_p100);
  const p25 = parseNum(row.video_views_p25);
  return safePercentage(p100, p25);
}

/**
 * Engagement Rate: Percentage of impressions that resulted in engagement
 * Formula: (engagements / impressions) * 100
 */
export function calculateEngagementRate(row: TikTokInsightRow): number {
  const engagements = parseNum(row.engagements);
  const impressions = parseNum(row.impressions);
  return safePercentage(engagements, impressions);
}

/**
 * AOV (Average Order Value): Average value per purchase (APP events)
 * Formula: total_purchase_value / purchase
 * Note: For website events, use calculateWebsiteAOV
 */
export function calculateAOV(row: TikTokInsightRow): number {
  const value = parseNum(row.total_purchase_value);
  const purchases = parseNum(row.purchase);
  return safeDivide(value, purchases);
}

/**
 * Website AOV (Average Order Value): Average value per website purchase
 * Formula: total_complete_payment_rate / complete_payment
 * Note: TikTok API uses "total_complete_payment_rate" for the purchase value field
 */
export function calculateWebsiteAOV(row: TikTokInsightRow): number {
  const value = parseNum(row.total_complete_payment_rate);
  const payments = parseNum(row.complete_payment);
  return safeDivide(value, payments);
}

/**
 * Combined AOV: Average order value across all conversion types
 * Uses app purchases first, falls back to website, then TikTok Shop
 */
export function calculateCombinedAOV(row: TikTokInsightRow): number {
  // Try app purchases first
  const appValue = parseNum(row.total_purchase_value);
  const appPurchases = parseNum(row.purchase);
  if (appPurchases > 0) {
    return safeDivide(appValue, appPurchases);
  }

  // Try website payments
  const webValue = parseNum(row.total_complete_payment_rate);
  const webPayments = parseNum(row.complete_payment);
  if (webPayments > 0) {
    return safeDivide(webValue, webPayments);
  }

  // Try TikTok Shop
  const shopValue = parseNum(row.total_onsite_shopping_value);
  const shopPayments = parseNum(row.onsite_shopping);
  if (shopPayments > 0) {
    return safeDivide(shopValue, shopPayments);
  }

  return 0;
}

/**
 * Click to ATC Ratio: Percentage of clicks that resulted in add to cart
 * Formula: (add_to_cart / clicks) * 100
 */
export function calculateClickToAtcRatio(row: TikTokInsightRow): number {
  const atc = parseNum(row.add_to_cart);
  const clicks = parseNum(row.clicks);
  return safePercentage(atc, clicks);
}

/**
 * ATC to Purchase Ratio: Percentage of add to cart that converted to purchase
 * Formula: (purchase / add_to_cart) * 100
 */
export function calculateAtcToPurchaseRatio(row: TikTokInsightRow): number {
  const purchases = parseNum(row.purchase);
  const atc = parseNum(row.add_to_cart);
  return safePercentage(purchases, atc);
}

/**
 * Click to Purchase Ratio: Percentage of clicks that resulted in purchase
 * Formula: (purchase / clicks) * 100
 */
export function calculateClickToPurchaseRatio(row: TikTokInsightRow): number {
  const purchases = parseNum(row.purchase);
  const clicks = parseNum(row.clicks);
  return safePercentage(purchases, clicks);
}

/**
 * Like Rate: Percentage of impressions that resulted in likes
 * Formula: (likes / impressions) * 100
 */
export function calculateLikeRate(row: TikTokInsightRow): number {
  const likes = parseNum(row.likes);
  const impressions = parseNum(row.impressions);
  return safePercentage(likes, impressions);
}

/**
 * Comment Rate: Percentage of impressions that resulted in comments
 * Formula: (comments / impressions) * 100
 */
export function calculateCommentRate(row: TikTokInsightRow): number {
  const comments = parseNum(row.comments);
  const impressions = parseNum(row.impressions);
  return safePercentage(comments, impressions);
}

/**
 * Share Rate: Percentage of impressions that resulted in shares
 * Formula: (shares / impressions) * 100
 */
export function calculateShareRate(row: TikTokInsightRow): number {
  const shares = parseNum(row.shares);
  const impressions = parseNum(row.impressions);
  return safePercentage(shares, impressions);
}

/**
 * Follow Rate: Percentage of impressions that resulted in follows
 * Formula: (follows / impressions) * 100
 */
export function calculateFollowRate(row: TikTokInsightRow): number {
  const follows = parseNum(row.follows);
  const impressions = parseNum(row.impressions);
  return safePercentage(follows, impressions);
}

/**
 * Video P25 Rate: Percentage of impressions that reached 25%
 * Formula: (video_views_p25 / impressions) * 100
 */
export function calculateVideoP25Rate(row: TikTokInsightRow): number {
  const p25 = parseNum(row.video_views_p25);
  const impressions = parseNum(row.impressions);
  return safePercentage(p25, impressions);
}

/**
 * Video P50 Rate: Percentage of impressions that reached 50%
 * Formula: (video_views_p50 / impressions) * 100
 */
export function calculateVideoP50Rate(row: TikTokInsightRow): number {
  const p50 = parseNum(row.video_views_p50);
  const impressions = parseNum(row.impressions);
  return safePercentage(p50, impressions);
}

/**
 * Video P75 Rate: Percentage of impressions that reached 75%
 * Formula: (video_views_p75 / impressions) * 100
 */
export function calculateVideoP75Rate(row: TikTokInsightRow): number {
  const p75 = parseNum(row.video_views_p75);
  const impressions = parseNum(row.impressions);
  return safePercentage(p75, impressions);
}

/**
 * Video P100 Rate: Percentage of impressions that completed
 * Formula: (video_views_p100 / impressions) * 100
 */
export function calculateVideoP100Rate(row: TikTokInsightRow): number {
  const p100 = parseNum(row.video_views_p100);
  const impressions = parseNum(row.impressions);
  return safePercentage(p100, impressions);
}

/**
 * Drop-off P25 to P50: Percentage that dropped off between 25% and 50%
 * Formula: 100 - (video_views_p50 / video_views_p25) * 100
 */
export function calculateDropOffP25ToP50(row: TikTokInsightRow): number {
  return 100 - calculateHoldRate(row);
}

/**
 * Drop-off P50 to P75: Percentage that dropped off between 50% and 75%
 * Formula: 100 - (video_views_p75 / video_views_p50) * 100
 */
export function calculateDropOffP50ToP75(row: TikTokInsightRow): number {
  const p75 = parseNum(row.video_views_p75);
  const p50 = parseNum(row.video_views_p50);
  return 100 - safePercentage(p75, p50);
}

/**
 * Drop-off P75 to P100: Percentage that dropped off between 75% and 100%
 * Formula: 100 - (video_views_p100 / video_views_p75) * 100
 */
export function calculateDropOffP75ToP100(row: TikTokInsightRow): number {
  const p100 = parseNum(row.video_views_p100);
  const p75 = parseNum(row.video_views_p75);
  return 100 - safePercentage(p100, p75);
}

/**
 * Cost per Engagement
 * Formula: spend / engagements
 */
export function calculateCostPerEngagement(row: TikTokInsightRow): number {
  const spend = parseNum(row.spend);
  const engagements = parseNum(row.engagements);
  return safeDivide(spend, engagements);
}

/**
 * Cost per Video View
 * Formula: spend / video_play_actions
 */
export function calculateCostPerVideoView(row: TikTokInsightRow): number {
  const spend = parseNum(row.spend);
  const views = parseNum(row.video_play_actions);
  return safeDivide(spend, views);
}

/**
 * Cost per 1000 Video Views
 * Formula: (spend / video_play_actions) * 1000
 */
export function calculateCostPer1000VideoViews(row: TikTokInsightRow): number {
  return calculateCostPerVideoView(row) * 1000;
}

/**
 * Shop AOV: Average order value for TikTok Shop purchases
 * Formula: total_onsite_shopping_value / onsite_shopping
 */
export function calculateShopAOV(row: TikTokInsightRow): number {
  const value = parseNum(row.total_onsite_shopping_value);
  const payments = parseNum(row.onsite_shopping);
  return safeDivide(value, payments);
}

// ============================================
// BATCH CALCULATIONS
// ============================================

/**
 * Calculate all available metrics for a single row
 */
export function calculateAllMetrics(row: TikTokInsightRow): TikTokDerivedMetrics {
  return {
    // Video engagement
    hookRate: calculateHookRate(row),
    thumbstopRate: calculateThumbstopRate(row),
    holdRate: calculateHoldRate(row),
    completionRate: calculateCompletionRate(row),
    engagementRate: calculateEngagementRate(row),

    // Funnel metrics
    clickToAtcRatio: calculateClickToAtcRatio(row),
    atcToPurchaseRatio: calculateAtcToPurchaseRatio(row),
    clickToPurchaseRatio: calculateClickToPurchaseRatio(row),

    // Value metrics
    aov: calculateAOV(row),
    aovWebsite: calculateWebsiteAOV(row),
    aovCombined: calculateCombinedAOV(row),
    aovShop: calculateShopAOV(row),

    // Video retention rates
    videoP25Rate: calculateVideoP25Rate(row),
    videoP50Rate: calculateVideoP50Rate(row),
    videoP75Rate: calculateVideoP75Rate(row),
    videoP100Rate: calculateVideoP100Rate(row),

    // Drop-off metrics
    dropOffP25ToP50: calculateDropOffP25ToP50(row),
    dropOffP50ToP75: calculateDropOffP50ToP75(row),
    dropOffP75ToP100: calculateDropOffP75ToP100(row),

    // Social engagement
    likeRate: calculateLikeRate(row),
    commentRate: calculateCommentRate(row),
    shareRate: calculateShareRate(row),
    followRate: calculateFollowRate(row),

    // Cost efficiency
    costPerEngagement: calculateCostPerEngagement(row),
    costPerVideoView: calculateCostPerVideoView(row),
    costPer1000VideoViews: calculateCostPer1000VideoViews(row),
  };
}

/**
 * Enrich rows with calculated metrics
 */
export function enrichWithCalculatedMetrics(
  rows: TikTokInsightRow[],
  metricKeys?: string[]
): (TikTokInsightRow & Partial<TikTokDerivedMetrics>)[] {
  return rows.map((row) => {
    const calculated = calculateAllMetrics(row);

    // If specific metrics requested, filter to only those
    if (metricKeys && metricKeys.length > 0) {
      const filtered: Partial<TikTokDerivedMetrics> = {};
      for (const key of metricKeys) {
        if (key in calculated) {
          (filtered as Record<string, unknown>)[key] = (calculated as Record<string, unknown>)[key];
        }
      }
      return { ...row, ...filtered };
    }

    return { ...row, ...calculated };
  });
}

/**
 * Calculate a specific metric for a row
 */
export function calculateMetric(row: TikTokInsightRow, metricKey: string): number | undefined {
  const calculators: Record<string, (row: TikTokInsightRow) => number> = {
    hookRate: calculateHookRate,
    thumbstopRate: calculateThumbstopRate,
    holdRate: calculateHoldRate,
    completionRate: calculateCompletionRate,
    engagementRate: calculateEngagementRate,
    aov: calculateAOV,
    aovWebsite: calculateWebsiteAOV,
    aovCombined: calculateCombinedAOV,
    clickToAtcRatio: calculateClickToAtcRatio,
    atcToPurchaseRatio: calculateAtcToPurchaseRatio,
    clickToPurchaseRatio: calculateClickToPurchaseRatio,
    likeRate: calculateLikeRate,
    commentRate: calculateCommentRate,
    shareRate: calculateShareRate,
    followRate: calculateFollowRate,
    videoP25Rate: calculateVideoP25Rate,
    videoP50Rate: calculateVideoP50Rate,
    videoP75Rate: calculateVideoP75Rate,
    videoP100Rate: calculateVideoP100Rate,
    dropOffP25ToP50: calculateDropOffP25ToP50,
    dropOffP50ToP75: calculateDropOffP50ToP75,
    dropOffP75ToP100: calculateDropOffP75ToP100,
    costPerEngagement: calculateCostPerEngagement,
    costPerVideoView: calculateCostPerVideoView,
    costPer1000VideoViews: calculateCostPer1000VideoViews,
    aovShop: calculateShopAOV,
  };

  const calculator = calculators[metricKey];
  if (!calculator) return undefined;

  return calculator(row);
}

// ============================================
// FORMATTING HELPERS
// ============================================

/**
 * Format metric value for display
 */
export function formatMetricValue(
  value: number,
  format: "number" | "currency" | "percentage" | "duration" | "ratio"
): string {
  if (isNaN(value) || !isFinite(value)) {
    return "-";
  }

  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);

    case "percentage":
      return `${value.toFixed(2)}%`;

    case "duration":
      // Format as seconds or minutes:seconds
      if (value >= 60) {
        const minutes = Math.floor(value / 60);
        const seconds = Math.round(value % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
      }
      return `${value.toFixed(1)}s`;

    case "ratio":
      return value.toFixed(2);

    case "number":
    default:
      // Use compact notation for large numbers
      if (value >= 1000000) {
        return new Intl.NumberFormat("en-US", {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(value);
      }
      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: value >= 100 ? 0 : 2,
      }).format(value);
  }
}

/**
 * Get the format type for a calculated metric
 */
export function getMetricFormat(
  metricKey: string
): "number" | "currency" | "percentage" | "duration" | "ratio" {
  const percentageMetrics = [
    "hookRate",
    "thumbstopRate",
    "holdRate",
    "completionRate",
    "engagementRate",
    "clickToAtcRatio",
    "atcToPurchaseRatio",
    "clickToPurchaseRatio",
    "likeRate",
    "commentRate",
    "shareRate",
    "followRate",
    "videoP25Rate",
    "videoP50Rate",
    "videoP75Rate",
    "videoP100Rate",
    "dropOffP25ToP50",
    "dropOffP50ToP75",
    "dropOffP75ToP100",
  ];

  const currencyMetrics = [
    "aov",
    "aovWebsite",
    "aovCombined",
    "aovShop",
    "costPerEngagement",
    "costPerVideoView",
    "costPer1000VideoViews",
  ];

  if (percentageMetrics.includes(metricKey)) {
    return "percentage";
  }

  if (currencyMetrics.includes(metricKey)) {
    return "currency";
  }

  return "number";
}

// ============================================
// AGGREGATION HELPERS
// ============================================

/**
 * Aggregate rows by summing values
 */
export function aggregateRows(rows: TikTokInsightRow[]): TikTokInsightRow {
  if (rows.length === 0) {
    return {} as TikTokInsightRow;
  }

  if (rows.length === 1) {
    return rows[0];
  }

  const numericFields = [
    "spend",
    "impressions",
    "clicks",
    "reach",
    "video_play_actions",
    "video_watched_2s",
    "video_watched_6s",
    "video_views_p25",
    "video_views_p50",
    "video_views_p75",
    "video_views_p100",
    "engaged_view",
    "engagements",
    "follows",
    "likes",
    "comments",
    "shares",
    "profile_visits",
    "purchase",
    "total_purchase_value",
    "add_to_cart",
    "checkout",
    "registration",
    "app_install",
    "complete_payment",
    "total_complete_payment_rate",
    "onsite_shopping",
    "total_onsite_shopping_value",
  ];

  const aggregated: TikTokInsightRow = {};

  for (const field of numericFields) {
    const sum = rows.reduce((acc, row) => acc + parseNum(row[field]), 0);
    if (sum > 0) {
      (aggregated as Record<string, unknown>)[field] = sum.toString();
    }
  }

  // Recalculate derived metrics
  const impressions = parseNum(aggregated.impressions);
  const clicks = parseNum(aggregated.clicks);
  const spend = parseNum(aggregated.spend);
  const reach = parseNum(aggregated.reach);

  if (impressions > 0 && clicks > 0) {
    aggregated.ctr = ((clicks / impressions) * 100).toString();
  }

  if (impressions > 0 && spend > 0) {
    aggregated.cpm = ((spend / impressions) * 1000).toString();
  }

  if (clicks > 0 && spend > 0) {
    aggregated.cpc = (spend / clicks).toString();
  }

  if (reach > 0 && impressions > 0) {
    aggregated.frequency = (impressions / reach).toString();
  }

  return aggregated;
}
