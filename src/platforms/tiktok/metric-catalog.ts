/**
 * tiktok-ads-mcp-server: an open-source MCP server for the TikTok Business API.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// TIKTOK BUSINESS API METRIC CATALOG
// ============================================
// Complete catalog of 400+ TikTok metrics organized by category
// Reference: https://business-api.tiktok.com/portal/docs?id=1751443967255553

import { TikTokMetricDefinition, MetricCategory, MetricFormat } from "./types.js";

// --- Helper to create metric definitions ---

function createMetric(
  key: string,
  name: string,
  description: string,
  category: MetricCategory,
  format: MetricFormat,
  apiField?: string,
  options?: Partial<TikTokMetricDefinition>
): TikTokMetricDefinition {
  return {
    key,
    name,
    description,
    category,
    type: "native",
    format,
    apiField: apiField || key,
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    ...options,
  };
}

// ============================================
// CORE METRICS
// ============================================

export const CORE_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "spend",
    "Spend",
    "The estimated total amount of money you've spent on your ads",
    "core",
    "currency"
  ),
  createMetric(
    "impressions",
    "Impressions",
    "The number of times your ads were on screen",
    "core",
    "number"
  ),
  createMetric(
    "clicks",
    "Clicks",
    "The number of clicks on your ads",
    "core",
    "number"
  ),
  createMetric(
    "ctr",
    "CTR",
    "The percentage of impressions that resulted in a click (Clicks / Impressions × 100)",
    "core",
    "percentage"
  ),
  createMetric(
    "cpm",
    "CPM",
    "The average cost for 1,000 impressions (Spend / Impressions × 1000)",
    "core",
    "currency"
  ),
  createMetric(
    "cpc",
    "CPC",
    "The average cost per click (Spend / Clicks)",
    "core",
    "currency"
  ),
  createMetric(
    "reach",
    "Reach",
    "The number of unique users who saw your ads at least once",
    "core",
    "number"
  ),
  createMetric(
    "frequency",
    "Frequency",
    "The average number of times each person saw your ads",
    "core",
    "number"
  ),
  createMetric(
    "gross_impressions",
    "Gross Impressions",
    "Total impressions including invalid traffic (before deduplication)",
    "core",
    "number"
  ),
  createMetric(
    "secondary_goal_result",
    "Secondary Goal Result",
    "Number of secondary goal results achieved",
    "core",
    "number"
  ),
  createMetric(
    "cost_per_secondary_goal_result",
    "Cost per Secondary Goal Result",
    "Average cost per secondary goal result",
    "core",
    "currency"
  ),
  createMetric(
    "secondary_goal_result_rate",
    "Secondary Goal Result Rate",
    "Percentage of impressions resulting in secondary goal",
    "core",
    "percentage"
  ),
  createMetric(
    "cost_per_result",
    "Cost per Result",
    "Average cost per optimization result",
    "core",
    "currency"
  ),
  createMetric(
    "cost_per_1000_reached",
    "Cost per 1,000 Reached",
    "Average cost to reach 1,000 unique users",
    "core",
    "currency"
  ),
];

// ============================================
// VIDEO METRICS
// ============================================

export const VIDEO_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "video_play_actions",
    "Video Plays",
    "The number of times your video starts to play",
    "video",
    "number"
  ),
  createMetric(
    "video_watched_2s",
    "2-Second Video Views",
    "The number of times your video was played for at least 2 seconds",
    "video",
    "number"
  ),
  createMetric(
    "video_watched_6s",
    "6-Second Video Views",
    "The number of times your video was played for at least 6 seconds or completed",
    "video",
    "number"
  ),
  createMetric(
    "video_views_p25",
    "25% Video Views",
    "The number of times your video was played at 25% of its length",
    "video",
    "number"
  ),
  createMetric(
    "video_views_p50",
    "50% Video Views",
    "The number of times your video was played at 50% of its length",
    "video",
    "number"
  ),
  createMetric(
    "video_views_p75",
    "75% Video Views",
    "The number of times your video was played at 75% of its length",
    "video",
    "number"
  ),
  createMetric(
    "video_views_p100",
    "100% Video Views",
    "The number of times your video was played to completion",
    "video",
    "number"
  ),
  createMetric(
    "engaged_view",
    "Engaged Views",
    "Views where user watched at least 6 seconds or engaged with the ad",
    "video",
    "number"
  ),
  createMetric(
    "engaged_view_15s",
    "15-Second Engaged Views",
    "Views where user watched at least 15 seconds or completed video",
    "video",
    "number"
  ),
  createMetric(
    "average_video_play",
    "Average Watch Time",
    "Average time in seconds users watched your video",
    "video",
    "duration"
  ),
  createMetric(
    "average_video_play_per_user",
    "Average Watch Time per User",
    "Average total time per unique user watching your video",
    "video",
    "duration"
  ),
  // Note: total_watch_time, cost_per_video_play, cost_per_2s_view, cost_per_6s_view
  // are NOT available in TikTok API - they must be calculated client-side if needed
  createMetric(
    "cost_per_engaged_view",
    "Cost per Engaged View",
    "Average cost per engaged view",
    "video",
    "currency"
  ),
];

// ============================================
// CLICKS METRICS
// ============================================

export const CLICKS_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "engagements",
    "Engagements",
    "Total number of engagements with your ad (likes, comments, shares, etc.)",
    "clicks",
    "number"
  ),
  createMetric(
    "clicks_on_music_disc",
    "Music Disc Clicks",
    "Number of clicks on the music disc in your ad",
    "clicks",
    "number"
  ),
  createMetric(
    "anchor_clicks",
    "Anchor Clicks",
    "Number of clicks on anchor elements in your ad",
    "clicks",
    "number"
  ),
  // Note: headline_clicks and card_clicks are NOT available in TikTok API
  createMetric(
    "real_time_app_install",
    "Real-Time App Installs",
    "Real-time count of app installs (not de-duplicated)",
    "clicks",
    "number"
  ),
  createMetric(
    "real_time_app_install_cost",
    "Real-Time App Install Cost",
    "Average cost per real-time app install",
    "clicks",
    "currency"
  ),
];

// ============================================
// SOCIAL METRICS
// ============================================

export const SOCIAL_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "follows",
    "Follows",
    "Number of follows to your TikTok account from your ad",
    "social",
    "number"
  ),
  createMetric(
    "likes",
    "Likes",
    "Number of likes on your ad",
    "social",
    "number"
  ),
  createMetric(
    "comments",
    "Comments",
    "Number of comments on your ad",
    "social",
    "number"
  ),
  createMetric(
    "shares",
    "Shares",
    "Number of shares of your ad",
    "social",
    "number"
  ),
  createMetric(
    "profile_visits",
    "Profile Visits",
    "Number of visits to your TikTok profile from your ad",
    "social",
    "number"
  ),
  createMetric(
    "profile_visits_rate",
    "Profile Visit Rate",
    "Percentage of impressions resulting in profile visits",
    "social",
    "percentage"
  ),
  // Note: duet, stitch, sound_usage are NOT available in TikTok Ads API
  // These are organic metrics not tracked for paid ads
  createMetric(
    "cost_per_follow",
    "Cost per Follow",
    "Average cost per new follower",
    "social",
    "currency"
  ),
  createMetric(
    "cost_per_like",
    "Cost per Like",
    "Average cost per like",
    "social",
    "currency"
  ),
  createMetric(
    "cost_per_share",
    "Cost per Share",
    "Average cost per share",
    "social",
    "currency"
  ),
];

// ============================================
// LIVE METRICS
// ============================================

export const LIVE_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "live_views",
    "LIVE Views",
    "Total number of views on your LIVE stream",
    "live",
    "number"
  ),
  createMetric(
    "live_unique_views",
    "LIVE Unique Views",
    "Number of unique viewers of your LIVE stream",
    "live",
    "number"
  ),
  createMetric(
    "live_effective_views",
    "LIVE Effective Views",
    "Number of viewers who watched for at least 1 minute",
    "live",
    "number"
  ),
  createMetric(
    "live_product_clicks",
    "LIVE Product Clicks",
    "Number of product clicks during LIVE stream",
    "live",
    "number"
  ),
  createMetric(
    "live_effective_views_cost",
    "Cost per LIVE Effective View",
    "Average cost per effective LIVE view",
    "live",
    "currency"
  ),
  createMetric(
    "live_followers",
    "LIVE Followers",
    "Number of new followers gained during LIVE",
    "live",
    "number"
  ),
  createMetric(
    "live_gift_value",
    "LIVE Gift Value",
    "Total value of gifts received during LIVE",
    "live",
    "currency"
  ),
];

// ============================================
// INTERACTIVE ADD-ONS METRICS
// ============================================

export const INTERACTIVE_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "interactive_addon_impression",
    "Interactive Add-on Impressions",
    "Number of impressions with interactive add-ons displayed",
    "interactive",
    "number"
  ),
  createMetric(
    "interactive_addon_destination_clicks",
    "Interactive Add-on Clicks",
    "Number of clicks on interactive add-on destinations",
    "interactive",
    "number"
  ),
  createMetric(
    "countdown_sticker_recall_clicks",
    "Countdown Sticker Clicks",
    "Number of clicks on countdown sticker reminders",
    "interactive",
    "number"
  ),
  createMetric(
    "display_card_clicks",
    "Display Card Clicks",
    "Number of clicks on display cards",
    "interactive",
    "number"
  ),
  createMetric(
    "gift_code_sticker_claims",
    "Gift Code Claims",
    "Number of gift codes claimed via sticker",
    "interactive",
    "number"
  ),
  createMetric(
    "pop_out_showcase_clicks",
    "Pop-out Showcase Clicks",
    "Number of clicks on pop-out showcases",
    "interactive",
    "number"
  ),
  createMetric(
    "super_like_count",
    "Super Likes",
    "Number of super likes received",
    "interactive",
    "number"
  ),
  createMetric(
    "voting_sticker_votes",
    "Voting Sticker Votes",
    "Number of votes cast via voting sticker",
    "interactive",
    "number"
  ),
];

// ============================================
// INSTANT EXPERIENCE METRICS
// ============================================

export const INSTANT_EXPERIENCE_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "ix_page_view_count",
    "Instant Page Views",
    "Number of views of your instant experience page",
    "instant_experience",
    "number"
  ),
  createMetric(
    "ix_button_click_count",
    "Instant Button Clicks",
    "Number of button clicks in instant experience",
    "instant_experience",
    "number"
  ),
  createMetric(
    "ix_product_click_count",
    "Instant Product Clicks",
    "Number of product clicks in instant experience",
    "instant_experience",
    "number"
  ),
  createMetric(
    "ix_download_click_count",
    "Instant Download Clicks",
    "Number of download button clicks in instant experience",
    "instant_experience",
    "number"
  ),
  createMetric(
    "ix_app_download_count",
    "Instant App Downloads",
    "Number of app downloads from instant experience",
    "instant_experience",
    "number"
  ),
  createMetric(
    "ix_video_view_count",
    "Instant Video Views",
    "Number of video views in instant experience",
    "instant_experience",
    "number"
  ),
  createMetric(
    "ix_average_page_stay",
    "Instant Avg Page Stay",
    "Average time spent on instant experience page",
    "instant_experience",
    "duration"
  ),
  createMetric(
    "ix_average_page_view_per_user",
    "Instant Avg Pages per User",
    "Average pages viewed per user in instant experience",
    "instant_experience",
    "number"
  ),
];

// ============================================
// APP CONVERSION METRICS - TOTAL
// ============================================

export const APP_CONVERSION_METRICS: TikTokMetricDefinition[] = [
  // Install & Launch
  createMetric(
    "app_install",
    "App Installs",
    "Total number of app installs attributed to your ad",
    "app",
    "number"
  ),
  createMetric(
    "launch_app",
    "App Launches",
    "Number of app launches after install",
    "app",
    "number"
  ),
  createMetric(
    "next_day_open",
    "Next Day Opens",
    "Number of app opens on the day after install",
    "app",
    "number"
  ),

  // Registration & Login
  createMetric(
    "registration",
    "Registrations",
    "Total number of in-app registrations",
    "app",
    "number"
  ),
  createMetric(
    "login",
    "Logins",
    "Number of in-app logins",
    "app",
    "number"
  ),
  createMetric(
    "complete_tutorial",
    "Tutorial Completions",
    "Number of tutorial completions in app",
    "app",
    "number"
  ),

  // Purchase & E-commerce
  createMetric(
    "purchase",
    "Purchases",
    "Total number of in-app purchases",
    "app",
    "number"
  ),
  createMetric(
    "total_purchase_value",
    "Purchase Value",
    "Total value of in-app purchases",
    "app",
    "currency"
  ),
  createMetric(
    "add_to_cart",
    "Add to Cart",
    "Number of add to cart events in app",
    "app",
    "number"
  ),
  createMetric(
    "total_add_to_cart_value",
    "Add to Cart Value",
    "Total value of items added to cart",
    "app",
    "currency"
  ),
  createMetric(
    "checkout",
    "Checkouts",
    "Number of checkout initiations in app",
    "app",
    "number"
  ),
  createMetric(
    "view_content",
    "Content Views",
    "Number of content/product views in app",
    "app",
    "number"
  ),
  createMetric(
    "total_view_content_value",
    "Content View Value",
    "Total value of content viewed",
    "app",
    "currency"
  ),
  createMetric(
    "add_payment_info",
    "Add Payment Info",
    "Number of add payment info events",
    "app",
    "number"
  ),
  createMetric(
    "add_to_wishlist",
    "Add to Wishlist",
    "Number of add to wishlist events",
    "app",
    "number"
  ),

  // Gaming
  createMetric(
    "create_gamerole",
    "Game Roles Created",
    "Number of game roles created",
    "app",
    "number"
  ),
  createMetric(
    "spend_credits",
    "Credits Spent",
    "Number of spend credits events",
    "app",
    "number"
  ),
  createMetric(
    "total_spend_credits_value",
    "Credits Spent Value",
    "Total value of credits spent",
    "app",
    "currency"
  ),
  createMetric(
    "achieve_level",
    "Levels Achieved",
    "Number of level achievements in game",
    "app",
    "number"
  ),
  createMetric(
    "unlock_achievement",
    "Achievements Unlocked",
    "Number of achievements unlocked",
    "app",
    "number"
  ),

  // Social
  createMetric(
    "create_group",
    "Groups Created",
    "Number of groups created in app",
    "app",
    "number"
  ),
  createMetric(
    "join_group",
    "Groups Joined",
    "Number of groups joined in app",
    "app",
    "number"
  ),
  createMetric(
    "rate",
    "Ratings",
    "Number of rating events in app",
    "app",
    "number"
  ),

  // Subscription
  createMetric(
    "start_trial",
    "Trial Starts",
    "Number of free trial starts",
    "app",
    "number"
  ),
  createMetric(
    "subscribe",
    "Subscriptions",
    "Number of subscription sign-ups",
    "app",
    "number"
  ),
  createMetric(
    "total_subscribe_value",
    "Subscription Value",
    "Total value of subscriptions",
    "app",
    "currency"
  ),

  // Leads & Finance
  createMetric(
    "sales_lead",
    "Sales Leads",
    "Number of sales leads generated",
    "app",
    "number"
  ),
  createMetric(
    "loan_apply",
    "Loan Applications",
    "Number of loan applications",
    "app",
    "number"
  ),
  createMetric(
    "loan_approval",
    "Loan Approvals",
    "Number of loan approvals",
    "app",
    "number"
  ),
  createMetric(
    "loan_disbursal",
    "Loan Disbursals",
    "Number of loan disbursals",
    "app",
    "number"
  ),

  // In-App Ads
  createMetric(
    "in_app_ad_click",
    "In-App Ad Clicks",
    "Number of in-app ad clicks",
    "app",
    "number"
  ),
  createMetric(
    "in_app_ad_impr",
    "In-App Ad Impressions",
    "Number of in-app ad impressions",
    "app",
    "number"
  ),

  // Custom & Total
  createMetric(
    "total_app_event",
    "Total App Events",
    "Total number of all tracked app events",
    "app",
    "number"
  ),
  createMetric(
    "total_app_event_value",
    "Total App Event Value",
    "Total value of all app events",
    "app",
    "currency"
  ),

  // Cost per action
  createMetric(
    "cost_per_app_install",
    "Cost per Install",
    "Average cost per app install",
    "app",
    "currency"
  ),
  createMetric(
    "cost_per_registration",
    "Cost per Registration",
    "Average cost per registration",
    "app",
    "currency"
  ),
  createMetric(
    "cost_per_purchase",
    "Cost per Purchase",
    "Average cost per in-app purchase",
    "app",
    "currency"
  ),
  createMetric(
    "cost_per_add_to_cart",
    "Cost per Add to Cart",
    "Average cost per add to cart",
    "app",
    "currency"
  ),
  createMetric(
    "cost_per_checkout",
    "Cost per Checkout",
    "Average cost per checkout",
    "app",
    "currency"
  ),
  createMetric(
    "cost_per_view_content",
    "Cost per Content View",
    "Average cost per content view",
    "app",
    "currency"
  ),

  // ROAS
  createMetric(
    "purchase_roas",
    "Purchase ROAS",
    "Return on ad spend for purchases (Value / Spend)",
    "app",
    "ratio"
  ),

  // Registration (Total)
  createMetric(
    "registration_rate",
    "Registration Rate",
    "Registrations / installs",
    "app",
    "percentage"
  ),
  createMetric(
    "total_registration",
    "Total Registrations",
    "All app registrations",
    "app",
    "number"
  ),
  createMetric(
    "cost_per_total_registration",
    "Total Cost per Registration",
    "Cost per registration (total)",
    "app",
    "currency"
  ),

  // Purchase (Total)
  createMetric(
    "purchase_rate",
    "Purchase Rate",
    "Purchases / installs",
    "app",
    "percentage"
  ),
  createMetric(
    "total_purchase",
    "Total Purchases",
    "All app purchases",
    "app",
    "number"
  ),
  createMetric(
    "cost_per_total_purchase",
    "Total Cost per Purchase",
    "Cost per purchase (total)",
    "app",
    "currency"
  ),
  createMetric(
    "value_per_total_purchase",
    "Value per Purchase",
    "Average value per purchase",
    "app",
    "currency"
  ),
  createMetric(
    "total_active_pay_roas",
    "Purchase ROAS (Total)",
    "Return on ad spend for all purchases",
    "app",
    "ratio"
  ),
  createMetric(
    "total_purchase_roas_day0",
    "ROAS Day 0",
    "ROAS within 24 hours",
    "app",
    "ratio"
  ),
  createMetric(
    "total_purchase_roas_day2",
    "ROAS Day 2",
    "ROAS within 72 hours",
    "app",
    "ratio"
  ),
  createMetric(
    "total_purchase_roas_day6",
    "ROAS Day 6",
    "ROAS within 168 hours",
    "app",
    "ratio"
  ),

  // Add to Cart (App Event)
  createMetric(
    "app_event_add_to_cart",
    "Unique ATC (App)",
    "Unique add to cart events in app",
    "app",
    "number"
  ),
  createMetric(
    "cost_per_app_event_add_to_cart",
    "Cost per Unique ATC (App)",
    "Cost per unique add to cart event",
    "app",
    "currency"
  ),
  createMetric(
    "app_event_add_to_cart_rate",
    "ATC Rate (App)",
    "Add to cart / installs",
    "app",
    "percentage"
  ),
  createMetric(
    "total_app_event_add_to_cart",
    "Total ATC (App)",
    "All add to cart events in app",
    "app",
    "number"
  ),
  createMetric(
    "cost_per_total_app_event_add_to_cart",
    "Total Cost per ATC (App)",
    "Cost per add to cart event (total)",
    "app",
    "currency"
  ),
  createMetric(
    "value_per_total_app_event_add_to_cart",
    "Value per ATC (App)",
    "Average value per add to cart event",
    "app",
    "currency"
  ),
  createMetric(
    "total_app_event_add_to_cart_value",
    "ATC Value (App)",
    "Total value of add to cart events",
    "app",
    "currency"
  ),

  // Checkout (Total)
  createMetric(
    "checkout_rate",
    "Checkout Rate",
    "Checkouts / installs",
    "app",
    "percentage"
  ),
  createMetric(
    "total_checkout",
    "Total Checkouts",
    "All checkouts in app",
    "app",
    "number"
  ),
  createMetric(
    "cost_per_total_checkout",
    "Total Cost per Checkout",
    "Cost per checkout (total)",
    "app",
    "currency"
  ),
  createMetric(
    "value_per_checkout",
    "Value per Checkout",
    "Average value per checkout",
    "app",
    "currency"
  ),
  createMetric(
    "total_checkout_value",
    "Checkout Value",
    "Total value of checkouts",
    "app",
    "currency"
  ),

  // View Content (Total)
  createMetric(
    "view_content_rate",
    "Content View Rate",
    "Content views / installs",
    "app",
    "percentage"
  ),
  createMetric(
    "total_view_content",
    "Total Content Views",
    "All content views in app",
    "app",
    "number"
  ),
  createMetric(
    "cost_per_total_view_content",
    "Total Cost per Content View",
    "Cost per content view (total)",
    "app",
    "currency"
  ),
  createMetric(
    "value_per_total_view_content",
    "Value per Content View",
    "Average value per content view",
    "app",
    "currency"
  ),
];

// ============================================
// APP CONVERSION METRICS - CTA (Click-Through Attribution)
// ============================================

export const APP_CTA_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "cta_conversion",
    "Conversions (CTA)",
    "Number of conversions attributed to clicks on your ads (Click-through Attribution)",
    "attribution",
    "number",
    "cta_conversion",
    { attributionType: "CTA" }
  ),
  createMetric(
    "cost_per_cta_conversion",
    "Cost per Conversion (CTA)",
    "Average cost per conversion attributed to a click on your ad",
    "attribution",
    "currency",
    "cost_per_cta_conversion",
    { attributionType: "CTA" }
  ),
  createMetric(
    "cta_purchase",
    "Purchases (CTA)",
    "Number of purchases attributed to clicks on your ads (Click-through Attribution)",
    "attribution",
    "number",
    "cta_purchase",
    { attributionType: "CTA" }
  ),
  createMetric(
    "cost_per_cta_purchase",
    "Cost per Purchase (CTA)",
    "Average cost per purchase attributed to a click on your ad",
    "attribution",
    "currency",
    "cost_per_cta_purchase",
    { attributionType: "CTA" }
  ),
  createMetric(
    "cta_registration",
    "Registrations (CTA)",
    "Number of registrations attributed to clicks on your ads (Click-through Attribution)",
    "attribution",
    "number",
    "cta_registration",
    { attributionType: "CTA" }
  ),
  createMetric(
    "cost_per_cta_registration",
    "Cost per Registration (CTA)",
    "Average cost per registration attributed to a click on your ad",
    "attribution",
    "currency",
    "cost_per_cta_registration",
    { attributionType: "CTA" }
  ),
  createMetric(
    "cta_app_install",
    "App Installs (CTA)",
    "Number of app installs attributed to clicks on your ads (Click-through Attribution)",
    "attribution",
    "number",
    "cta_app_install",
    { attributionType: "CTA" }
  ),
  createMetric(
    "cost_per_cta_app_install",
    "Cost per App Install (CTA)",
    "Average cost per app install attributed to a click on your ad",
    "attribution",
    "currency",
    "cost_per_cta_app_install",
    { attributionType: "CTA" }
  ),
];

// ============================================
// APP CONVERSION METRICS - VTA (View-Through Attribution)
// ============================================

export const APP_VTA_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "vta_conversion",
    "Conversions (VTA)",
    "Number of conversions attributed to ad impressions (View-through Attribution)",
    "attribution",
    "number",
    "vta_conversion",
    { attributionType: "VTA" }
  ),
  createMetric(
    "cost_per_vta_conversion",
    "Cost per Conversion (VTA)",
    "Average cost per conversion attributed to an ad impression",
    "attribution",
    "currency",
    "cost_per_vta_conversion",
    { attributionType: "VTA" }
  ),
  createMetric(
    "vta_purchase",
    "Purchases (VTA)",
    "Number of purchases attributed to ad impressions (View-through Attribution)",
    "attribution",
    "number",
    "vta_purchase",
    { attributionType: "VTA" }
  ),
  createMetric(
    "cost_per_vta_purchase",
    "Cost per Purchase (VTA)",
    "Average cost per purchase attributed to an ad impression",
    "attribution",
    "currency",
    "cost_per_vta_purchase",
    { attributionType: "VTA" }
  ),
  createMetric(
    "vta_registration",
    "Registrations (VTA)",
    "Number of registrations attributed to ad impressions (View-through Attribution)",
    "attribution",
    "number",
    "vta_registration",
    { attributionType: "VTA" }
  ),
  createMetric(
    "cost_per_vta_registration",
    "Cost per Registration (VTA)",
    "Average cost per registration attributed to an ad impression",
    "attribution",
    "currency",
    "cost_per_vta_registration",
    { attributionType: "VTA" }
  ),
  createMetric(
    "vta_app_install",
    "App Installs (VTA)",
    "Number of app installs attributed to ad impressions (View-through Attribution)",
    "attribution",
    "number",
    "vta_app_install",
    { attributionType: "VTA" }
  ),
  createMetric(
    "cost_per_vta_app_install",
    "Cost per App Install (VTA)",
    "Average cost per app install attributed to an ad impression",
    "attribution",
    "currency",
    "cost_per_vta_app_install",
    { attributionType: "VTA" }
  ),
  // VTA Web Metrics
  createMetric(
    "vta_complete_payment",
    "Purchases - Web (VTA)",
    "Number of website purchases attributed to ad impressions (View-through Attribution)",
    "attribution",
    "number",
    "vta_complete_payment",
    { attributionType: "VTA" }
  ),
  createMetric(
    "vta_complete_payment_value",
    "Purchase Value - Web (VTA)",
    "Total value of website purchases attributed to ad impressions",
    "attribution",
    "currency",
    "vta_complete_payment_value",
    { attributionType: "VTA" }
  ),
  createMetric(
    "vta_complete_payment_roas",
    "Purchase ROAS - Web (VTA)",
    "Return on ad spend for website purchases attributed to ad impressions",
    "attribution",
    "ratio",
    "vta_complete_payment_roas",
    { attributionType: "VTA" }
  ),
];

// ============================================
// APP/WEB CONVERSION METRICS - EVTA (Engaged View-Through Attribution)
// ============================================

export const APP_EVTA_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "engaged_view_through_conversions",
    "Conversions (EVTA)",
    "Number of conversions attributed to engaged video views (Engaged View-through Attribution)",
    "attribution",
    "number",
    "engaged_view_through_conversions",
    { attributionType: "EVTA" }
  ),
  createMetric(
    "cost_per_engaged_view_through_conversion",
    "Cost per Conversion (EVTA)",
    "Average cost per conversion attributed to engaged video views",
    "attribution",
    "currency",
    "cost_per_engaged_view_through_conversion",
    { attributionType: "EVTA" }
  ),
  createMetric(
    "evta_app_install",
    "App Installs (EVTA)",
    "Number of app installs attributed to engaged video views",
    "attribution",
    "number",
    "evta_app_install",
    { attributionType: "EVTA" }
  ),
  createMetric(
    "evta_registration",
    "Registrations (EVTA)",
    "Number of registrations attributed to engaged video views",
    "attribution",
    "number",
    "evta_registration",
    { attributionType: "EVTA" }
  ),
  createMetric(
    "evta_purchase",
    "Purchases - App (EVTA)",
    "Number of app purchases attributed to engaged video views",
    "attribution",
    "number",
    "evta_purchase",
    { attributionType: "EVTA" }
  ),
  createMetric(
    "evta_payments_completed",
    "Purchases - Web (EVTA)",
    "Number of website purchases attributed to engaged video views",
    "attribution",
    "number",
    "evta_payments_completed",
    { attributionType: "EVTA" }
  ),
];

// ============================================
// WEBSITE CONVERSION METRICS
// ============================================

export const WEBSITE_CONVERSION_METRICS: TikTokMetricDefinition[] = [
  // Core web events
  createMetric(
    "complete_payment",
    "Complete Payments",
    "Number of completed payment events on website",
    "website",
    "number"
  ),
  createMetric(
    "total_complete_payment_value",
    "Complete Payment Value",
    "Total value of website payments",
    "website",
    "currency",
    "total_complete_payment_rate" // TikTok API uses _rate suffix for this currency field
  ),
  // Landing Page Views
  createMetric(
    "page_browse_view",
    "Landing Page Views",
    "Number of landing page view events on website",
    "website",
    "number",
    "total_landing_page_view"
  ),
  createMetric(
    "total_page_browse_view",
    "Page Views",
    "Number of page view events on website",
    "website",
    "number",
    "total_pageview"
  ),

  // Engagement
  createMetric(
    "button_click",
    "Button Clicks",
    "Number of button clicks on website",
    "website",
    "number"
  ),
  createMetric(
    "online_consult",
    "Online Consultations",
    "Number of online consultation requests",
    "website",
    "number"
  ),
  createMetric(
    "user_registration",
    "User Registrations",
    "Number of website registrations",
    "website",
    "number"
  ),

  // E-commerce
  createMetric(
    "product_details_page_browse",
    "Product Page Views",
    "Number of product detail page views",
    "website",
    "number"
  ),
  // Note: web_detail_add_cart and web_shopping do NOT exist in TikTok API
  // Use web_event_add_to_cart for add to cart events
  createMetric(
    "web_event_add_to_cart",
    "Web Add to Cart",
    "Number of add to cart events on website",
    "website",
    "number"
  ),
  createMetric(
    "total_web_event_add_to_cart_value",
    "Web Add to Cart Value",
    "Total value of items added to cart",
    "website",
    "currency"
  ),
  createMetric(
    "initiate_checkout",
    "Initiate Checkouts",
    "Number of checkout initiations",
    "website",
    "number"
  ),
  createMetric(
    "total_initiate_checkout_value",
    "Initiate Checkout Value",
    "Total value of initiated checkouts",
    "website",
    "currency"
  ),
  createMetric(
    "add_billing",
    "Add Billing",
    "Number of add billing events",
    "website",
    "number"
  ),

  // Search & Content
  createMetric(
    "search",
    "Searches",
    "Number of search events on website",
    "website",
    "number"
  ),
  // Note: watch_video does NOT exist in TikTok API

  // Downloads (Web) - correct API field is website_download
  createMetric(
    "website_download",
    "Downloads (Unique)",
    "Number of unique download actions on website",
    "website",
    "number"
  ),
  createMetric(
    "website_total_download",
    "Downloads",
    "Number of download actions on website",
    "website",
    "number"
  ),

  // Contacts (Web) - correct API field is website_contact
  createMetric(
    "website_contact",
    "Contacts (Unique)",
    "Number of unique contact actions on website",
    "website",
    "number"
  ),
  createMetric(
    "website_total_contact",
    "Contacts",
    "Number of contact actions on website",
    "website",
    "number"
  ),

  // Forms (Web) - correct API field is website_form
  createMetric(
    "website_form",
    "Form Submissions (Unique)",
    "Number of unique form submissions on website",
    "website",
    "number"
  ),
  createMetric(
    "website_total_form",
    "Form Submissions",
    "Number of form submissions on website",
    "website",
    "number"
  ),

  // Cost per action
  createMetric(
    "cost_per_complete_payment",
    "Cost per Payment",
    "Average cost per complete payment",
    "website",
    "currency"
  ),
  createMetric(
    "cost_per_page_browse_view",
    "Cost per Landing Page View",
    "Average cost per landing page view",
    "website",
    "currency",
    "cost_per_landing_page_view"
  ),
  createMetric(
    "cost_per_total_page_browse_view",
    "Cost per Page View",
    "Average cost per page view action",
    "website",
    "currency",
    "cost_per_pageview"
  ),
  createMetric(
    "cost_per_initiate_checkout",
    "Cost per Initiate Checkout",
    "Average cost per checkout initiation",
    "website",
    "currency"
  ),

  // ROAS
  createMetric(
    "complete_payment_roas",
    "Payment ROAS",
    "Return on ad spend for website payments",
    "website",
    "ratio"
  ),
  createMetric(
    "value_per_complete_payment",
    "Value per Payment",
    "Average value per complete payment",
    "website",
    "currency"
  ),
  createMetric(
    "complete_payment_rate",
    "Payment Rate",
    "Purchases / clicks on website",
    "website",
    "percentage"
  ),
  createMetric(
    "conversion",
    "Conversions",
    "Number of optimization conversions reported by TikTok",
    "core",
    "number",
    "conversion"
  ),
  createMetric(
    "conversions",
    "Conversions",
    "Cross-source alias for TikTok conversion",
    "core",
    "number",
    "conversion"
  ),
];

// ============================================
// TIKTOK (ONSITE) CONVERSION METRICS
// ============================================

export const TIKTOK_ONSITE_METRICS: TikTokMetricDefinition[] = [
  // Purchases (TikTok)
  createMetric(
    "onsite_total_purchase",
    "Onsite Purchases",
    "Number of TikTok purchase actions attributed to your ads",
    "tiktok",
    "number"
  ),
  createMetric(
    "onsite_total_purchase_value",
    "Onsite Purchase Value",
    "Total value of TikTok purchase actions",
    "tiktok",
    "currency"
  ),
  createMetric(
    "onsite_cost_per_purchase",
    "Cost per Onsite Purchase",
    "Average cost per TikTok purchase action",
    "tiktok",
    "currency"
  ),
  createMetric(
    "onsite_purchases_roas",
    "Onsite ROAS",
    "Return on ad spend from TikTok purchases",
    "tiktok",
    "ratio"
  ),

  // Checkout (TikTok)
  createMetric(
    "onsite_total_checkout_initiation",
    "Onsite Checkouts",
    "Number of TikTok checkout initiation actions",
    "tiktok",
    "number"
  ),
  createMetric(
    "onsite_cost_per_checkout_initiation",
    "Cost per Onsite Checkout",
    "Average cost per TikTok checkout initiation",
    "tiktok",
    "currency"
  ),

  // Add to Cart (TikTok)
  createMetric(
    "onsite_total_add_to_cart",
    "Onsite Add to Cart",
    "Number of TikTok add to cart actions",
    "tiktok",
    "number"
  ),
  createMetric(
    "onsite_cost_per_add_to_cart",
    "Cost per Onsite Add to Cart",
    "Average cost per TikTok add to cart action",
    "tiktok",
    "currency"
  ),

  // Content Views (TikTok) - Product Details Page Views
  createMetric(
    "onsite_total_product_details_page_view",
    "Onsite Content Views",
    "Number of TikTok product details page view actions",
    "tiktok",
    "number"
  ),
  createMetric(
    "onsite_cost_per_product_details_page_view",
    "Cost per Onsite Content View",
    "Average cost per TikTok product details page view",
    "tiktok",
    "currency"
  ),

  // Forms & Downloads (TikTok)
  createMetric(
    "onsite_form",
    "Onsite Forms",
    "Number of onsite form submissions on TikTok",
    "tiktok",
    "number"
  ),
  createMetric(
    "onsite_form_detail",
    "Onsite Form Details",
    "Number of onsite form detail views on TikTok",
    "tiktok",
    "number"
  ),
  createMetric(
    "onsite_download",
    "Onsite Downloads",
    "Number of downloads from TikTok",
    "tiktok",
    "number"
  ),

  // Purchase rates & values
  createMetric(
    "onsite_purchase_rate",
    "Onsite Purchase Rate",
    "TikTok purchase rate",
    "tiktok",
    "percentage"
  ),
  createMetric(
    "onsite_value_per_purchase",
    "Onsite Value per Purchase",
    "Average TikTok purchase value",
    "tiktok",
    "currency"
  ),
  createMetric(
    "onsite_unique_purchase",
    "Onsite Unique Purchases",
    "Unique TikTok purchases",
    "tiktok",
    "number"
  ),

  // Day-window purchase values
  createMetric(
    "onsite_total_purchase_value_day0",
    "Onsite Purchase Value (Day 0)",
    "TikTok purchase value within 24 hours",
    "tiktok",
    "currency"
  ),
  createMetric(
    "onsite_total_purchase_value_day6",
    "Onsite Purchase Value (Day 6)",
    "TikTok purchase value within 7 days",
    "tiktok",
    "currency"
  ),
  createMetric(
    "onsite_total_purchase_value_day13",
    "Onsite Purchase Value (Day 13)",
    "TikTok purchase value within 14 days",
    "tiktok",
    "currency"
  ),

  // Day-window ROAS
  createMetric(
    "onsite_total_purchase_roas_day0",
    "Onsite ROAS (Day 0)",
    "TikTok ROAS within 24 hours",
    "tiktok",
    "ratio"
  ),
  createMetric(
    "onsite_total_purchase_roas_day6",
    "Onsite ROAS (Day 6)",
    "TikTok ROAS within 7 days",
    "tiktok",
    "ratio"
  ),
  createMetric(
    "onsite_total_purchase_roas_day13",
    "Onsite ROAS (Day 13)",
    "TikTok ROAS within 14 days",
    "tiktok",
    "ratio"
  ),

  // Registration
  createMetric(
    "onsite_total_registration",
    "Onsite Registrations",
    "TikTok registrations",
    "tiktok",
    "number"
  ),
];

// ============================================
// OFFLINE METRICS
// ============================================

export const OFFLINE_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "offline_shopping_events",
    "Offline Events",
    "Number of offline shopping events",
    "offline",
    "number"
  ),
  createMetric(
    "offline_shopping_events_value",
    "Offline Events Value",
    "Total value of offline events",
    "offline",
    "currency"
  ),
  createMetric(
    "cost_per_offline_shopping_event",
    "Cost per Offline Event",
    "Average cost per offline event",
    "offline",
    "currency"
  ),
  createMetric(
    "offline_shopping_events_roas",
    "Offline ROAS",
    "Return on ad spend for offline events",
    "offline",
    "ratio"
  ),
  createMetric(
    "offline_total_crm_events",
    "Offline CRM Events",
    "Number of offline CRM events",
    "offline",
    "number"
  ),
  createMetric(
    "offline_contact_events",
    "Offline Contacts",
    "Number of offline contact events",
    "offline",
    "number"
  ),
  createMetric(
    "offline_subscribe_events",
    "Offline Subscriptions",
    "Number of offline subscription events",
    "offline",
    "number"
  ),
  createMetric(
    "offline_form_events",
    "Offline Form Submissions",
    "Number of offline form submission events",
    "offline",
    "number"
  ),
];

// ============================================
// MESSAGING METRICS
// ============================================

export const MESSAGING_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "messaging_conversation_started",
    "Conversations Started",
    "Number of messaging conversations started",
    "messaging",
    "number"
  ),
  createMetric(
    "cost_per_messaging_conversation_started",
    "Cost per Conversation",
    "Average cost per conversation started",
    "messaging",
    "currency"
  ),
];

// ============================================
// SHOP METRICS
// ============================================

export const SHOP_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "product_clicks",
    "Product Clicks",
    "Number of product clicks in TikTok Shop",
    "shop",
    "number"
  ),
  createMetric(
    "product_details_page_browse_shop",
    "Shop Product Views",
    "Number of product detail page views in Shop",
    "shop",
    "number",
    "onsite_on_web_detail"
  ),
  createMetric(
    "add_to_cart_shop",
    "Shop Add to Cart",
    "Number of add to cart events in Shop",
    "shop",
    "number",
    "onsite_on_web_cart"
  ),
  createMetric(
    "checkout_shop",
    "Shop Checkouts",
    "Number of checkouts in TikTok Shop",
    "shop",
    "number",
    "onsite_initiate_checkout_count"
  ),
  createMetric(
    "complete_payment_shop",
    "Shop Payments",
    "Number of payments completed in Shop",
    "shop",
    "number",
    "onsite_shopping"
  ),
  createMetric(
    "live_product_clicks_shop",
    "LIVE Shop Product Clicks",
    "Product clicks during LIVE shopping",
    "shop",
    "number"
  ),
  createMetric(
    "video_product_clicks",
    "Video Product Clicks",
    "Product clicks from video ads",
    "shop",
    "number"
  ),
  createMetric(
    "onsite_shopping_roas",
    "Shop ROAS",
    "Return on ad spend for TikTok Shop",
    "shop",
    "ratio"
  ),
  createMetric(
    "onsite_complete_payment_value",
    "Shop Payment Value",
    "Total value of Shop payments",
    "shop",
    "currency",
    "total_onsite_shopping_value"
  ),
  createMetric(
    "cost_per_product_click",
    "Cost per Product Click",
    "Average cost per product click",
    "shop",
    "currency"
  ),
  createMetric(
    "cost_per_add_to_cart_shop",
    "Cost per Shop Add to Cart",
    "Average cost per Shop add to cart",
    "shop",
    "currency"
  ),
  createMetric(
    "cost_per_complete_payment_shop",
    "Cost per Shop Payment",
    "Average cost per Shop payment",
    "shop",
    "currency",
    "cost_per_onsite_shopping"
  ),
  createMetric(
    "onsite_shopping_rate",
    "Shop Purchase Rate",
    "TikTok Shop purchase rate",
    "shop",
    "percentage"
  ),
  createMetric(
    "value_per_onsite_shopping",
    "Shop AOV",
    "TikTok Shop average order value",
    "shop",
    "currency"
  ),
  createMetric(
    "shop_total_items_purchased",
    "Shop Items Purchased",
    "Number of items sold in TikTok Shop",
    "shop",
    "number"
  ),
];

// ============================================
// SKAN METRICS (iOS 14+)
// ============================================

export const SKAN_METRICS: TikTokMetricDefinition[] = [
  createMetric(
    "skan_app_install",
    "SKAN Installs",
    "App installs via SKAdNetwork",
    "skan",
    "number",
    "skan_app_install",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_purchase",
    "SKAN Purchases",
    "Purchases via SKAdNetwork",
    "skan",
    "number",
    "skan_purchase",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_purchase_value",
    "SKAN Purchase Value",
    "Purchase value via SKAdNetwork",
    "skan",
    "currency",
    "skan_purchase_value",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_registration",
    "SKAN Registrations",
    "Registrations via SKAdNetwork",
    "skan",
    "number",
    "skan_registration",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_add_to_cart",
    "SKAN Add to Cart",
    "Add to cart via SKAdNetwork",
    "skan",
    "number",
    "skan_add_to_cart",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_checkout",
    "SKAN Checkouts",
    "Checkouts via SKAdNetwork",
    "skan",
    "number",
    "skan_checkout",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_view_content",
    "SKAN Content Views",
    "Content views via SKAdNetwork",
    "skan",
    "number",
    "skan_view_content",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_subscribe",
    "SKAN Subscriptions",
    "Subscriptions via SKAdNetwork",
    "skan",
    "number",
    "skan_subscribe",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_start_trial",
    "SKAN Trial Starts",
    "Trial starts via SKAdNetwork",
    "skan",
    "number",
    "skan_start_trial",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_cost_per_app_install",
    "SKAN Cost per Install",
    "Cost per SKAN install",
    "skan",
    "currency",
    "skan_cost_per_app_install",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_cost_per_purchase",
    "SKAN Cost per Purchase",
    "Cost per SKAN purchase",
    "skan",
    "currency",
    "skan_cost_per_purchase",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_purchase_roas",
    "SKAN Purchase ROAS",
    "ROAS via SKAdNetwork",
    "skan",
    "ratio",
    "skan_purchase_roas",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_result",
    "SKAN Results",
    "Results via SKAdNetwork",
    "skan",
    "number",
    "skan_result",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_cost_per_result",
    "SKAN Cost per Result",
    "Cost per SKAN result",
    "skan",
    "currency",
    "skan_cost_per_result",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_conversion",
    "SKAN Conversions",
    "Conversions via SKAdNetwork",
    "skan",
    "number",
    "skan_conversion",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_conversion_rate_v2",
    "SKAN Conversion Rate",
    "SKAN conversion rate",
    "skan",
    "percentage",
    "skan_conversion_rate_v2",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_total_purchase_value",
    "SKAN Total Purchase Value",
    "Total purchase value via SKAdNetwork",
    "skan",
    "currency",
    "skan_total_purchase_value",
    { attributionType: "SKAN" }
  ),
  createMetric(
    "skan_total_repetitive_active_pay_roas",
    "SKAN ROAS (Total)",
    "Total ROAS via SKAdNetwork",
    "skan",
    "ratio",
    "skan_total_repetitive_active_pay_roas",
    { attributionType: "SKAN" }
  ),
];

// ============================================
// CALCULATED METRICS (Custom)
// ============================================

export const CALCULATED_METRICS: TikTokMetricDefinition[] = [
  {
    key: "hookRate",
    name: "Hook Rate",
    description: "Percentage of impressions where users watched to 25% of video (Video P25 / Impressions x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "hookRate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["video_views_p25", "impressions"],
  },
  {
    key: "thumbstopRate",
    name: "Thumbstop Rate",
    description: "Percentage of impressions that resulted in video plays (Video Plays / Impressions x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "thumbstopRate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["video_play_actions", "impressions"],
  },
  {
    key: "holdRate",
    name: "Hold Rate",
    description: "Percentage of users who reached 25% and continued to 50% (P50 / P25 x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "holdRate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["video_views_p50", "video_views_p25"],
  },
  {
    key: "completionRate",
    name: "Completion Rate",
    description: "Percentage of users who reached 25% and completed the video (P100 / P25 x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "completionRate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["video_views_p100", "video_views_p25"],
  },
  {
    key: "engagementRate",
    name: "Engagement Rate",
    description: "Percentage of impressions that resulted in engagement (Engagements / Impressions x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "engagementRate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["engagements", "impressions"],
  },
  {
    key: "aov",
    name: "Average Order Value (App)",
    description: "Average Order Value for app events (Total Purchase Value / Purchase Count)",
    category: "calculated",
    type: "calculated",
    format: "currency",
    apiField: "aov",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["total_purchase_value", "purchase"],
  },
  {
    key: "aovWebsite",
    name: "Average Order Value (Website)",
    description: "Average Order Value for website events (Total Payment Value / Complete Payments)",
    category: "calculated",
    type: "calculated",
    format: "currency",
    apiField: "aovWebsite",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["total_complete_payment_value", "complete_payment"],
  },
  {
    key: "aovCombined",
    name: "Average Order Value (Combined)",
    description: "Average Order Value across all conversion types (app, website, or shop)",
    category: "calculated",
    type: "calculated",
    format: "currency",
    apiField: "aovCombined",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["total_purchase_value", "purchase", "total_complete_payment_value", "complete_payment", "onsite_complete_payment_value", "complete_payment_shop"],
  },
  {
    key: "clickToAtcRatio",
    name: "Click to Add to Cart Ratio",
    description: "Percentage of clicks that resulted in add to cart (Add to Cart / Clicks x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "clickToAtcRatio",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["add_to_cart", "clicks"],
  },
  {
    key: "atcToPurchaseRatio",
    name: "Add to Cart to Purchase Ratio",
    description: "Percentage of add to cart that converted to purchase (Purchase / Add to Cart x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "atcToPurchaseRatio",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["purchase", "add_to_cart"],
  },
  {
    key: "clickToPurchaseRatio",
    name: "Click to Purchase Ratio",
    description: "Percentage of clicks that resulted in purchase (Purchase / Clicks x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "clickToPurchaseRatio",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["purchase", "clicks"],
  },
  {
    key: "likeRate",
    name: "Like Rate",
    description: "Percentage of impressions that resulted in likes (Likes / Impressions x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "likeRate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["likes", "impressions"],
  },
  {
    key: "commentRate",
    name: "Comment Rate",
    description: "Percentage of impressions that resulted in comments (Comments / Impressions x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "commentRate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["comments", "impressions"],
  },
  {
    key: "shareRate",
    name: "Share Rate",
    description: "Percentage of impressions that resulted in shares (Shares / Impressions x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "shareRate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["shares", "impressions"],
  },
  {
    key: "followRate",
    name: "Follow Rate",
    description: "Percentage of impressions that resulted in follows (Follows / Impressions x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "followRate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["follows", "impressions"],
  },
  {
    key: "aovShop",
    name: "Average Order Value (Shop)",
    description: "Average Order Value for TikTok Shop (Shop Payment Value / Shop Payments)",
    category: "calculated",
    type: "calculated",
    format: "currency",
    apiField: "aovShop",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["onsite_complete_payment_value", "complete_payment_shop"],
  },
  {
    key: "videoP25Rate",
    name: "Video P25 Rate",
    description: "Percentage of impressions that reached 25% of video (P25 / Impressions x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "videoP25Rate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["video_views_p25", "impressions"],
  },
  {
    key: "videoP50Rate",
    name: "Video P50 Rate",
    description: "Percentage of impressions that reached 50% of video (P50 / Impressions x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "videoP50Rate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["video_views_p50", "impressions"],
  },
  {
    key: "videoP75Rate",
    name: "Video P75 Rate",
    description: "Percentage of impressions that reached 75% of video (P75 / Impressions x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "videoP75Rate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["video_views_p75", "impressions"],
  },
  {
    key: "videoP100Rate",
    name: "Video P100 Rate",
    description: "Percentage of impressions that completed video (P100 / Impressions x 100)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "videoP100Rate",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["video_views_p100", "impressions"],
  },
  {
    key: "dropOffP25ToP50",
    name: "Drop-off P25->P50",
    description: "Percentage of viewers that dropped off between 25% and 50% (100 - Hold Rate)",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "dropOffP25ToP50",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["video_views_p50", "video_views_p25"],
  },
  {
    key: "dropOffP50ToP75",
    name: "Drop-off P50->P75",
    description: "Percentage of viewers that dropped off between 50% and 75%",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "dropOffP50ToP75",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["video_views_p75", "video_views_p50"],
  },
  {
    key: "dropOffP75ToP100",
    name: "Drop-off P75->P100",
    description: "Percentage of viewers that dropped off between 75% and 100%",
    category: "calculated",
    type: "calculated",
    format: "percentage",
    apiField: "dropOffP75ToP100",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["video_views_p100", "video_views_p75"],
  },
  {
    key: "costPerEngagement",
    name: "Cost per Engagement",
    description: "Average cost per engagement action (Spend / Engagements)",
    category: "calculated",
    type: "calculated",
    format: "currency",
    apiField: "costPerEngagement",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["spend", "engagements"],
  },
  {
    key: "costPerVideoView",
    name: "Cost per Video View",
    description: "Average cost per video play (Spend / Video Plays)",
    category: "calculated",
    type: "calculated",
    format: "currency",
    apiField: "costPerVideoView",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["spend", "video_play_actions"],
  },
  {
    key: "costPer1000VideoViews",
    name: "CPM Video Views",
    description: "Cost per 1000 video plays (Spend / Video Plays x 1000)",
    category: "calculated",
    type: "calculated",
    format: "currency",
    apiField: "costPer1000VideoViews",
    compatibleDimensions: ["advertiser_id", "campaign_id", "adgroup_id", "ad_id", "stat_time_day"],
    requiredFields: ["spend", "video_play_actions"],
  },
];

// ============================================
// COMPLETE METRIC CATALOG
// ============================================

export const TIKTOK_METRIC_CATALOG: TikTokMetricDefinition[] = [
  ...CORE_METRICS,
  ...VIDEO_METRICS,
  ...CLICKS_METRICS,
  ...SOCIAL_METRICS,
  ...LIVE_METRICS,
  ...INTERACTIVE_METRICS,
  ...INSTANT_EXPERIENCE_METRICS,
  ...APP_CONVERSION_METRICS,
  ...APP_CTA_METRICS,
  ...APP_VTA_METRICS,
  ...APP_EVTA_METRICS,
  ...WEBSITE_CONVERSION_METRICS,
  ...TIKTOK_ONSITE_METRICS,
  ...OFFLINE_METRICS,
  ...MESSAGING_METRICS,
  ...SHOP_METRICS,
  ...SKAN_METRICS,
  ...CALCULATED_METRICS,
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get metric definition by key
 */
export function getMetricDefinition(key: string): TikTokMetricDefinition | undefined {
  return TIKTOK_METRIC_CATALOG.find((m) => m.key === key || m.apiField === key);
}

/**
 * Get all metrics by category
 */
export function getMetricsByCategory(category: MetricCategory): TikTokMetricDefinition[] {
  return TIKTOK_METRIC_CATALOG.filter((m) => m.category === category);
}

/**
 * Get all native (non-calculated) metrics
 */
export function getNativeMetrics(): TikTokMetricDefinition[] {
  return TIKTOK_METRIC_CATALOG.filter((m) => m.type === "native");
}

/**
 * Get all calculated metrics
 */
export function getCalculatedMetrics(): TikTokMetricDefinition[] {
  return TIKTOK_METRIC_CATALOG.filter((m) => m.type === "calculated");
}

/**
 * Get required native metric KEYS for a set of metrics (expanding calculated dependencies).
 * Returns internal metric keys (NOT API field names).
 * The key->apiField mapping is done later by getApiFieldsForMetrics() in createApiRequest().
 */
export function getRequiredFieldsForMetrics(metricKeys: string[]): string[] {
  const requiredFields = new Set<string>();

  for (const key of metricKeys) {
    const metric = getMetricDefinition(key);
    if (metric?.type === "calculated" && metric.requiredFields) {
      // requiredFields contains metric KEYS (internal names)
      metric.requiredFields.forEach((f) => requiredFields.add(f));
    } else if (metric?.type === "native") {
      requiredFields.add(metric.key);
    }
  }

  return Array.from(requiredFields);
}

/**
 * Get API field names for metrics
 */
export function getApiFieldsForMetrics(metricKeys: string[]): string[] {
  return metricKeys
    .map((key) => {
      const metric = getMetricDefinition(key);
      return metric?.apiField;
    })
    .filter((field): field is string => field !== undefined);
}

/**
 * Check if metric is compatible with dimension
 */
export function isMetricCompatibleWithDimension(metricKey: string, dimensionKey: string): boolean {
  const metric = getMetricDefinition(metricKey);
  if (!metric) return false;

  if (metric.incompatibleDimensions?.includes(dimensionKey)) {
    return false;
  }

  return metric.compatibleDimensions.includes(dimensionKey) || metric.compatibleDimensions.length === 0;
}

/**
 * Get metric category display order
 */
export const METRIC_CATEGORY_ORDER: MetricCategory[] = [
  "core",
  "video",
  "clicks",
  "social",
  "live",
  "interactive",
  "instant_experience",
  "app",
  "website",
  "tiktok",
  "shop",
  "attribution",
  "skan",
  "offline",
  "messaging",
  "calculated",
];

/**
 * Get human-readable category name
 */
export function getCategoryDisplayName(category: MetricCategory): string {
  const names: Record<MetricCategory, string> = {
    core: "Core Metrics",
    video: "Video Metrics",
    clicks: "Clicks & Engagement",
    social: "Social Metrics",
    live: "LIVE Metrics",
    interactive: "Interactive Add-ons",
    instant_experience: "Instant Experience",
    app: "App Conversions",
    website: "Website Conversions",
    tiktok: "TikTok (Onsite)",
    offline: "Offline Events",
    messaging: "Messaging",
    shop: "TikTok Shop",
    attribution: "Attribution",
    skan: "SKAN (iOS 14+)",
    attribute: "Attributes",
    calculated: "Calculated client-side",
  };
  return names[category] || category;
}

/**
 * Validate the metric catalog for common issues
 * Use this for debugging to identify metrics with missing or incorrect apiField mappings
 */
export function validateMetricCatalog(): {
  valid: boolean;
  issues: { key: string; issue: string }[];
} {
  const issues: { key: string; issue: string }[] = [];

  for (const metric of TIKTOK_METRIC_CATALOG) {
    // Check for missing key
    if (!metric.key) {
      issues.push({ key: "(unknown)", issue: "Missing key" });
      continue;
    }

    // Check for missing apiField
    if (!metric.apiField) {
      issues.push({ key: metric.key, issue: "Missing apiField" });
    }

    // Check for calculated metrics missing requiredFields
    if (metric.type === "calculated" && (!metric.requiredFields || metric.requiredFields.length === 0)) {
      issues.push({ key: metric.key, issue: "Calculated metric missing requiredFields" });
    }

    // Check for duplicate keys
    const duplicates = TIKTOK_METRIC_CATALOG.filter((m) => m.key === metric.key);
    if (duplicates.length > 1) {
      issues.push({ key: metric.key, issue: `Duplicate key (found ${duplicates.length} times)` });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Log metrics that don't have data in a result row
 * Useful for debugging which metrics are missing from API response
 */
export function findMissingMetricsInRow(
  requestedMetrics: string[],
  row: Record<string, unknown>
): string[] {
  const rowKeys = Object.keys(row);
  const missing: string[] = [];

  for (const metricKey of requestedMetrics) {
    const metric = getMetricDefinition(metricKey);
    if (!metric) {
      missing.push(`${metricKey} (not in catalog)`);
      continue;
    }

    const apiField = metric.apiField;
    const hasValue = rowKeys.includes(apiField) && row[apiField] != null && row[apiField] !== "";

    if (!hasValue && metric.type === "native") {
      missing.push(`${metricKey} (${apiField})`);
    }
  }

  return missing;
}
