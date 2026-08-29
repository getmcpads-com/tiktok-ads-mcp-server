import assert from "node:assert/strict";
import { test } from "node:test";

import { buildTikTokReadEndpoint, normalizeTikTokReadEndpoint } from "../src/platforms/tiktok/broad-read.ts";
import { assertSafeTikTokApiUrl } from "../src/platforms/tiktok/client.ts";

test("TikTok read endpoint builder accepts documented GET and catalog endpoints", () => {
  assert.equal(normalizeTikTokReadEndpoint("/report/integrated/get/"), "report/integrated/get");
  assert.equal(normalizeTikTokReadEndpoint("/tool/region/"), "tool/region");
  assert.equal(normalizeTikTokReadEndpoint("tool/search_keyword/keyword_idea"), "tool/search_keyword/keyword_idea");
  assert.equal(normalizeTikTokReadEndpoint("discovery/trending_list"), "discovery/trending_list");
  assert.equal(normalizeTikTokReadEndpoint("business/post/authorize/status"), "business/post/authorize/status");

  const endpoint = buildTikTokReadEndpoint("campaign/get", {
    advertiser_id: "123",
    fields: ["campaign_id", "campaign_name"],
    filtering: { campaign_ids: ["42"] },
  });
  const url = new URL(endpoint, "https://business-api.tiktok.com");
  assert.deepEqual(JSON.parse(url.searchParams.get("fields")), ["campaign_id", "campaign_name"]);
  assert.deepEqual(JSON.parse(url.searchParams.get("filtering")), { campaign_ids: ["42"] });
});

test("TikTok generic GET guard blocks mutations, OAuth and credential parameters", () => {
  assert.throws(() => normalizeTikTokReadEndpoint("adgroup/update"), /Mutation-like/);
  assert.throws(() => normalizeTikTokReadEndpoint("oauth2/advertiser/get"), /OAuth/);
  assert.throws(() => normalizeTikTokReadEndpoint("tt_user/oauth2/token_info/get"), /OAuth/);
  assert.throws(() => normalizeTikTokReadEndpoint("optimizer/rule/update/status"), /Mutation-like/);
  assert.throws(() => buildTikTokReadEndpoint("campaign/get", { access_token: "secret" }), /Sensitive parameter/);
  assert.throws(() => normalizeTikTokReadEndpoint("https://example.com/get"), /Invalid/);
  assert.throws(() => normalizeTikTokReadEndpoint("report/task/download"), /Download endpoints/);
  assert.throws(() => normalizeTikTokReadEndpoint("bc/invoice/download"), /Download endpoints/);
  assert.throws(() => normalizeTikTokReadEndpoint("lead/get"), /Lead-record endpoints/);
  assert.throws(() => normalizeTikTokReadEndpoint("page/lead/task/download"), /Download endpoints|Lead-record endpoints/);
});

test("TikTok client URL guard never forwards Access-Token outside official v1.3", () => {
  const relative = assertSafeTikTokApiUrl("/campaign/get/?advertiser_id=123");
  assert.equal(relative.href, "https://business-api.tiktok.com/open_api/v1.3/campaign/get/?advertiser_id=123");
  assert.throws(() => assertSafeTikTokApiUrl("https://example.com/open_api/v1.3/campaign/get/"), /restricted/);
  assert.throws(() => assertSafeTikTokApiUrl("https://business-api.tiktok.com/open_api/v1.2/campaign/get/"), /v1.3/);
  assert.throws(() => assertSafeTikTokApiUrl("https://business-api.tiktok.com:444/open_api/v1.3/campaign/get/"), /restricted/);
  assert.throws(() => assertSafeTikTokApiUrl("https://user:pass@business-api.tiktok.com/open_api/v1.3/campaign/get/"), /restricted/);
});
