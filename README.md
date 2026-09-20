<div align="center">

# TikTok Ads MCP server

### Make sense of your TikTok advertising.

Explore campaign performance, inspect native assets and prepare changes from your MCP client.

[![Release](https://img.shields.io/github/v/release/getmcpads-com/tiktok-ads-mcp-server?color=2448e5)](https://github.com/getmcpads-com/tiktok-ads-mcp-server/releases/latest)
[![CI](https://github.com/getmcpads-com/tiktok-ads-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/getmcpads-com/tiktok-ads-mcp-server/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522.12-brightgreen.svg)](package.json)

[Watch the demo](https://www.getmcpads.com/home/film/get-mcp-ads-film-1080p.mp4) · [What's new](#whats-new) · [Install](#install-this-release) · [Tool reference](#tools) · [Try hosted getmcpads](https://www.getmcpads.com/tools/tiktok-ads?utm_source=github&utm_medium=readme&utm_campaign=tiktok-ads)

[![Watch the getmcpads product demo: campaign review in Claude](https://www.getmcpads.com/home/film/poster-rich.webp)](https://www.getmcpads.com/home/film/get-mcp-ads-film-1080p.mp4)

**[Play the 27-second product film](https://www.getmcpads.com/home/film/get-mcp-ads-film-1080p.mp4)**

</div>

The film demonstrates hosted getmcpads with staged data. Its creative galleries and MCP Apps interface belong to the hosted product. This repository provides the standalone native API tools.

**35 read tools** · **29 write tools**, disabled by default.

Run locally with your own platform credentials and a client that supports stdio MCP, such as Claude Desktop, Claude Code or Cursor. Your requests go directly to the platform. For managed connections, including supported ChatGPT setups, use the hosted option.

## What's new

**[v2.0.0: Native tools and security update](https://github.com/getmcpads-com/tiktok-ads-mcp-server/releases/tag/v2.0.0) · September 20, 2026**

- Preserve exact unquoted 64-bit IDs in read, write and verification responses.
- Fix campaign field selection and default list limits.
- Update native write validation for budgets, schedules, targeting and readback. Add carousel music, uploaded-video readiness, CTA portfolio and custom identity tools.
- Require Node.js 22.12 or newer and check Node 22/24 in CI.
- Update vulnerable dependencies and regenerate the MCP catalog.

[Full changelog](CHANGELOG.md) · [Source synchronization details](SOURCE_SYNC.md) · [All releases](https://github.com/getmcpads-com/tiktok-ads-mcp-server/releases)

### Upgrade notes

Requires **Node.js 22.12 or newer**. CI covers Node 22 and 24. Version 2.0.0 drops Node 18 and 20 support. Read the current tool schemas before reusing saved arguments. Writes remain optional and require explicit confirmation. Hosted creative integrations and MCP Apps UI are outside this release.

## Install this release

This is a GitHub source release. npm and MCP Registry versions are published separately. The commands below select this exact version; unpinned `npx` examples later in this document select the version currently available on npm.

```bash
git clone --branch v2.0.0 --depth 1 https://github.com/getmcpads-com/tiktok-ads-mcp-server.git
cd tiktok-ads-mcp-server
npm ci
npm run build
```

Configure your MCP client to run `node` with the absolute path to `dist/cli.js` and the platform credentials documented below.

> **Prefer a managed connection?** [Use TikTok Ads with hosted getmcpads](https://www.getmcpads.com/tools/tiktok-ads?utm_source=github&utm_medium=readme&utm_campaign=tiktok-ads). Connect your account, select the data your assistant may access and use the hosted MCP connection. See the site for current features and plans.

## What you get

| | |
|---|---|
| **35 read tools** | Campaigns, ad groups, ads, creatives, audiences, pixels, events, Spark Ads, catalogs, delivery diagnostics |
| **29 write tools** | Off by default. Campaign and ad group status, budgets, campaign creation. Each one **previews before it applies** |
| **277 metrics** | Including derived ones computed client-side |
| **16 dimensions** | With a compatibility matrix that catches invalid combinations before they hit the API |
| **5 resources** | Live catalogues the model can read: metrics, dimensions, compatibility rules, 12 workflow recipes |
| **Keyword research** | `tiktok_search_keywords` and `tiktok_get_search_ads_maturity`, for TikTok Search Ads |
| **Forward-compatible reads** | `tiktok_get_read_endpoint`, `tiktok_get_entities_raw`, `tiktok_get_report_raw` reach endpoints this server doesn't model yet |

### The query planner

TikTok rejects many metric and dimension combinations, and its error messages rarely say why.
This server encodes the compatibility matrix, so it **splits an impossible request into
several valid API calls and merges the results** instead of failing.

`tiktok_validate_query` lets the model check a combination before spending a call on it.

### One trap this server handles for you

**TikTok answers HTTP 200 even when the call failed.** The applicative `code` field is what
decides. A client that trusts the HTTP status reports imaginary successes back to the model,
which then reasons on data that was never returned. Every call here checks `code` first.

---

## Getting a token

TikTok needs **two** values, not one: an access token and the App ID it belongs to.

1. Create a developer app on the [TikTok for Business developer portal](https://business-api.tiktok.com/portal).
2. Note the **App ID** and App Secret from the app's page.
3. Authorize the advertiser accounts you want to reach. TikTok grants access per advertiser,
   so an account you skip here stays invisible to the server no matter what the token allows.
4. Complete the OAuth authorization flow to exchange the returned `auth_code` for an
   **access token**. TikTok's long-lived tokens do not expire on a fixed schedule, but they
   are revoked when the authorization is withdrawn.
5. Put the token in `TIKTOK_ACCESS_TOKEN` and the App ID in `TIKTOK_APP_ID`.

📖 [TikTok API for Business documentation](https://business-api.tiktok.com/portal/docs)

Run **`tiktok_health_check`** as your first call. It verifies the credentials, lists the
advertiser accounts you can actually reach, and reports what is missing, without printing
your token.

### Which permissions?

| Scope group | When you need it |
|---|---|
| Reporting and read scopes | **Always.** Campaigns, ad groups, ads, insights |
| Campaign management scopes | Only if you set `TIKTOK_ENABLE_WRITES=1` |
| Catalog and Business Center scopes | Optional, for `tiktok_get_shop_catalog_diagnostics` |

---

## Setup

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "tiktok-ads": {
      "command": "npx",
      "args": ["-y", "@getmcpads/tiktok-ads-mcp-server"],
      "env": {
        "TIKTOK_ACCESS_TOKEN": "your-token-here",
        "TIKTOK_APP_ID": "your-app-id-here"
      }
    }
  }
}
```

Restart Claude Desktop. Ask it: *"list my TikTok advertiser accounts"*.

### Claude Code

```bash
claude mcp add tiktok-ads --env TIKTOK_ACCESS_TOKEN=your-token --env TIKTOK_APP_ID=your-app-id -- npx -y @getmcpads/tiktok-ads-mcp-server
```

### Cursor

`.cursor/mcp.json` in your project, same shape as the Claude Desktop config above.

### From source

```bash
git clone https://github.com/getmcpads-com/tiktok-ads-mcp-server.git
cd tiktok-ads-mcp-server
npm install && npm run build
cp .env.example .env   # then fill in your credentials
npm start
```

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `TIKTOK_ACCESS_TOKEN` | none | **Required.** Your access token |
| `TIKTOK_APP_ID` | none | **Required.** The App ID the token belongs to |
| `TIKTOK_APP_SECRET` | none | Optional, for endpoints needing app authentication |
| `TIKTOK_ADVERTISER_ID` | none | Optional default, saves passing it on every call |
| `TIKTOK_BC_ID` | none | Optional Business Center ID |
| `TIKTOK_ENABLE_WRITES` | *unset* | Set to `1` to register the 29 write tools |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

Check your setup at any time:

```bash
npm run doctor
```

---

## Writes, and why they preview first

Write tools are **disabled by default**. Enable them with `TIKTOK_ENABLE_WRITES=1`.

When enabled, every write tool returns a preview and changes nothing:

```jsonc
// tiktok_update_adgroup_budget { advertiserId: "7...", adGroupId: "1...", budget: 50 }
{
  "applied": false,
  "action": "tiktok_update_adgroup_budget",
  "change": { "advertiser": "7...", "adGroup": "1...", "newBudget": 50,
              "budgetMode": "BUDGET_MODE_DAY" },
  "message": "Preview only, nothing was changed. Repeat the same call with confirm: true to apply this change to the live account."
}
```

Only a second call carrying `confirm: true` touches the live account.

This is deliberate. An assistant composes these calls, and it can pick the wrong advertiser,
the wrong campaign, or the wrong order of magnitude on a budget. A mandatory preview makes the
mistake visible before it costs money, and gives a human the stopping point the protocol does
not guarantee on its own.

One further guardrail: **`tiktok_create_campaign` always creates the campaign `DISABLE`.**
There is no option to create it running.

| Tool | What it changes |
|---|---|
| `tiktok_update_campaign_status` / `tiktok_update_adgroup_status` | Pause or reactivate |
| `tiktok_update_campaign_budget` / `tiktok_update_adgroup_budget` | Budget, in the account currency |
| `tiktok_create_campaign` | Creates a campaign, always `DISABLE` |

---

## Tools

Every tool is listed below. See [server-card.json](server-card.json) for complete parameter and output schemas.

<details>
<summary><b>35 read tools</b></summary>

| Tool | Purpose |
| --- | --- |
| `tiktok_health_check` | Read-only health check for TikTok credentials, accessible advertisers, and advertiser info. |
| `tiktok_list_advertisers` | List all TikTok advertiser accounts accessible with the current token. |
| `tiktok_get_advertiser_info` | Get detailed information for specific TikTok advertiser accounts: currency, timezone, status, balance. |
| `tiktok_get_campaigns` | List campaigns for a TikTok advertiser account. |
| `tiktok_get_adgroups` | Read full native ad group configuration including targeting, custom/lookalike audience references and exclusions, geo, language, age/gender, placements, interests/behaviors, budget and schedule. |
| `tiktok_get_targeting` | Read configured ad group targeting and audience references: custom/lookalike inclusions/exclusions, geo, language, age/gender, placements, interests and behaviors. |
| `tiktok_get_audience_report` | Read TikTok AUDIENCE performance reports by age or gender at advertiser, campaign, ad group or ad level, including delivery from eligible Smart+ campaigns. |
| `tiktok_get_ads` | List ads for a TikTok advertiser. |
| `tiktok_get_insights` | Query TikTok Ads performance insights using the current native/calculated metric catalog and query planning. |
| `tiktok_get_creatives` | Get creative details (video, image, text) for specific ads in a TikTok advertiser account. |
| `tiktok_get_audiences` | List custom and lookalike audiences for a TikTok advertiser account. |
| `tiktok_search_keywords` | Get keyword suggestions for TikTok Search Ads. |
| `tiktok_validate_query` | Validate a TikTok metric/dimension combination BEFORE executing. |
| `tiktok_get_pixels` | List TikTok pixels and, when permissions allow it, pixel event metadata for an advertiser. |
| `tiktok_get_events` | Discover pixel/app events or accessible tracking diagnostics for an advertiser. |
| `tiktok_get_delivery_status` | Aggregate campaign, ad group, and ad delivery status/operation_status with simple diagnostics. |
| `tiktok_get_async_report_status` | Check a TikTok async report task status by taskId when async report endpoints are available. |
| `tiktok_get_video_assets` | Return ad-linked TikTok video asset metadata from ad/get and video material endpoints when available. |
| `tiktok_get_spark_ads` | Return Spark Ads context from ad fields when available, with a conservative fallback if Spark-specific fields are not supported. |
| `tiktok_get_audience_details` | Get custom/lookalike/saved audience details where TikTok DMP endpoints are accessible. |
| `tiktok_get_shop_catalog_diagnostics` | Read-only TikTok Shop/catalog/e-commerce diagnostics. |
| `tiktok_get_search_ads_maturity` | Diagnose TikTok Search Ads maturity from keyword/search-term reporting and optional keyword recommendation endpoints. |
| `tiktok_get_creative_fatigue_recipes` | Find likely creative fatigue patterns from ad-level daily reporting and return read-only refresh recipes. |
| `tiktok_get_audience_overlap` | Read-only audience overlap diagnostics across ad groups, custom audiences, saved audiences, and targeting fields. |
| `tiktok_get_spark_organic_joins` | Join accessible Spark Ads fields with paid page/post reporting and optional organic identity/post endpoints when permissions allow. |
| `tiktok_list_ad_videos` | List the advertiser's whole video library (file/video/ad/search): file name, duration, dimensions, signature, and publicly served preview and cover URLs. |
| `tiktok_list_ad_images` | List the advertiser's whole image library (file/image/ad/search): file name, dimensions, signature, carousel usability, and a publicly served image URL signed for roughly thirty days (image_url_expires_at gives the exact instant). |
| `tiktok_get_asset_urls` | Re-resolve fresh, publicly fetchable URLs for specific TikTok library assets (file/video/ad/info and file/image/ad/info). |
| `tiktok_get_entities_raw` | List TikTok campaigns, ad groups, or ads with caller-selected native fields, filtering, sorting, and pagination. |
| `tiktok_get_report_raw` | Run a native TikTok BASIC or AUDIENCE synchronous report with caller-selected dimensions and metrics. |
| `tiktok_get_targeting_catalog` | Read TikTok targeting and planning catalogs: locations, languages, interests, behaviors, hashtags, Search Ads keyword ideas/health, devices, carriers, contextual tags, content exclusions, and time zones. |
| `tiktok_get_read_endpoint` | Advanced GET-only TikTok Business API escape hatch for documented JSON read endpoints not yet modeled by a specialized MCP tool. |
| `tiktok_get_carousel_music` | Get TikTok music recommendations for exactly the uploaded images in a standard, non-catalog image ad (one card) or carousel. |
| `tiktok_get_uploaded_video` | Read one uploaded video from this advertiser’s media library. |
| `tiktok_get_write_context` | Read the exact TikTok entity, parent settings and advertiser currency/timezone before editing or building a new configuration. |

</details>

<details>
<summary><b>29 write tools</b></summary>

Disabled by default. Calls preview unless explicitly confirmed. Check the configuration and exact schema before use.

| Tool | Purpose |
| --- | --- |
| `tiktok_create_cta_portfolio` | Create a dynamic CTA portfolio from the exact approved recommendations returned by creative/cta/recommend for this advertiser. |
| `tiktok_create_custom_identity` | Create an advertiser-owned CUSTOMIZED_USER advertising identity for Pangle or Global App Bundle. |
| `tiktok_create_campaign_advanced` | Create DISABLED classic TikTok campaign. |
| `tiktok_update_campaign_configuration` | Update classic TikTok campaign. |
| `tiktok_create_adgroup` | Create DISABLED classic TikTok adgroup. |
| `tiktok_update_adgroup_configuration` | Update classic TikTok adgroup. |
| `tiktok_create_ads` | Create DISABLED classic TikTok ads (video, image, carousel or authorized Spark content). |
| `tiktok_update_ads` | Update classic TikTok ads (video, image, carousel or authorized Spark content). |
| `tiktok_create_smart_plus_campaign` | Create DISABLED upgraded Smart+ TikTok campaign. |
| `tiktok_update_smart_plus_campaign` | Update upgraded Smart+ TikTok campaign. |
| `tiktok_create_smart_plus_adgroup` | Create DISABLED upgraded Smart+ TikTok adgroup. |
| `tiktok_update_smart_plus_adgroup` | Update upgraded Smart+ TikTok adgroup. |
| `tiktok_create_smart_plus_ad` | Create DISABLED upgraded Smart+ TikTok ads (video, image, carousel or authorized Spark content). |
| `tiktok_update_smart_plus_ad` | Update upgraded Smart+ TikTok ads (video, image, carousel or authorized Spark content). |
| `tiktok_update_ad_status` | Pause or reactivate exactly one classic ad. |
| `tiktok_update_smart_plus_campaign_status` | Pause or reactivate exactly one Smart+ campaign. |
| `tiktok_update_smart_plus_adgroup_status` | Pause or reactivate exactly one Smart+ adgroup. |
| `tiktok_update_smart_plus_ad_status` | Pause or reactivate exactly one Smart+ ad. |
| `tiktok_update_smart_plus_material_status` | Pause or reactivate selected creative materials inside one upgraded Smart+ ad. |
| `tiktok_rename_campaign` | Rename one classic TikTok campaign. |
| `tiktok_rename_adgroup` | Rename one classic TikTok adgroup. |
| `tiktok_rename_ad` | Rename one classic TikTok ad. |
| `tiktok_upload_ad_image` | Import a image from a public HTTPS media URL or base64 file (up to 5 MiB). |
| `tiktok_upload_ad_video` | Import a video from a public HTTPS media URL or base64 file (up to 5 MiB). |
| `tiktok_update_campaign_status` | Pause or reactivate a TikTok campaign. |
| `tiktok_create_campaign` | Create a TikTok campaign. |
| `tiktok_update_campaign_budget` | Change a TikTok campaign budget, in the account currency. |
| `tiktok_update_adgroup_status` | Pause or reactivate a TikTok ad group. |
| `tiktok_update_adgroup_budget` | Change the budget of a TikTok ad group. |

</details>

<details>
<summary><b>5 resources</b></summary>

| URI | Contents |
|---|---|
| `tiktok://manifest` | What this server exposes, and its current mode |
| `tiktok://metrics` | All 277 metrics with categories and formats |
| `tiktok://dimensions` | All 16 dimensions and where they are valid |
| `tiktok://compatibility` | The compatibility matrix |
| `tiktok://recipes` | 12 step-by-step workflows |

</details>

---

## Security

The server holds a credential that can read, and optionally modify, live ad accounts.
Concretely:

- **The token is never logged.** Debug output prints `Access-Token: [redacted]`.
- **Requests go only to `business-api.tiktok.com`**, and only under `/open_api/v1.3/`.
  Any other host or path is refused rather than called. *Covered by tests.*
- **Redirects are refused once a token is attached**, so a redirect cannot forward your
  credential elsewhere.
- **Mutating and OAuth endpoints are blocked on the generic read paths.** *Covered by tests.*
- **No telemetry.** The server makes no network call other than to the TikTok Business API.
  You can verify this by grepping the source for `fetch`.

Full policy and reporting instructions: [SECURITY.md](SECURITY.md).

---

## Looking for a managed, multi-platform version?

[Try hosted TikTok Ads](https://www.getmcpads.com/tools/tiktok-ads?utm_source=github&utm_medium=readme&utm_campaign=tiktok_ads_hosted) if you want to use this source without operating a local server.
getmcpads also connects advertising, Search Console and GA4 through one MCP URL.
Source availability and plan limits are listed on the site; connecting an account is still required.

1. Follow the [TikTok Ads connection guide](https://www.getmcpads.com/guides/sources/tiktok-ads).
2. Select the account or property your assistant may read.
3. Connect [Claude](https://www.getmcpads.com/guides/setup/claude),
   [ChatGPT](https://www.getmcpads.com/guides/setup/chatgpt) or
   [Codex](https://www.getmcpads.com/guides/setup/codex).
4. Try a read-only review: “Compare campaign delivery and conversion trends over complete periods. State missing data and do not change anything.”

See the [current hosted tool catalogue](https://www.getmcpads.com/tools/tiktok-ads)
and [pricing](https://www.getmcpads.com/pricing) before choosing a paid plan.
This Apache 2.0 adapter remains independently useful with your own credentials.

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
Please read [SECURITY.md](SECURITY.md) before reporting anything security-related.

## Licence

[Apache License 2.0](LICENSE). See also [NOTICE](NOTICE).

TikTok and TikTok for Business are trademarks of ByteDance Ltd. and its affiliates.
**This project is not affiliated with, endorsed by, or sponsored by TikTok or ByteDance.**
It is an independent client of a public API.

## MCP contracts and desktop bundle

Every tool declares read/write annotations, parameter descriptions and a structured output schema. Successful calls expose the payload as `structuredContent.result`; errors retain `isError: true`. The generated [server card](server-card.json) contains definitions only.

Run `npm run bundle -- /path/to/output` to build a `.mcpb` desktop bundle from the current catalog. Credentials are entered locally during installation. Write tools remain disabled unless explicitly enabled.

## More from getmcpads

[Meta Ads](https://github.com/getmcpads-com/meta-ads-mcp-server) · [Google Ads](https://github.com/getmcpads-com/google-ads-mcp-server) · [Google Analytics 4](https://github.com/getmcpads-com/google-analytics-mcp-server) · [Google Search Console](https://github.com/getmcpads-com/google-search-console-mcp-server) · [Pinterest Ads](https://github.com/getmcpads-com/pinterest-ads-mcp-server) · [X Ads](https://github.com/getmcpads-com/x-ads-mcp-server)

Maintained by **Emmanuel** at [getmcpads](https://www.getmcpads.com). Questions: [hello@getmcpads.com](mailto:hello@getmcpads.com).
