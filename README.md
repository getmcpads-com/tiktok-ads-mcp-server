# tiktok-ads-mcp-server

[![CI](https://github.com/getmcpads-com/tiktok-ads-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/getmcpads-com/tiktok-ads-mcp-server/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](package.json)

An open-source [Model Context Protocol](https://modelcontextprotocol.io) server for the
**TikTok Business API**. It lets Claude, ChatGPT, Cursor or any MCP client read and analyse
your TikTok advertising data, and change it if you choose to.

You run it. Your token stays on your machine. Nothing is proxied through a third party.

```bash
npx -y @getmcpads/tiktok-ads-mcp-server
```

> **Prefer not to run it yourself?** [getmcpads.com](https://www.getmcpads.com) is the hosted
> version of this server, with TikTok Ads alongside Meta Ads, Google Ads, Pinterest Ads, GA4 and
> Search Console behind a single endpoint, hosted OAuth, and cross-platform reporting.
> Same tools, same safety model, no setup.

---

## What you get

| | |
|---|---|
| **27 read tools** | Campaigns, ad groups, ads, creatives, audiences, pixels, events, Spark Ads, catalogs, delivery diagnostics |
| **5 write tools** | Off by default. Campaign and ad group status, budgets, campaign creation. Each one **previews before it applies** |
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

## How this compares to TikTok's own MCP server

TikTok ships an official MCP server, announced at TikTok World '26 and hosted at
`business-api.tiktok.com/open_mcp/`. It is a serious product, and it is bigger than this one.
Here is an honest comparison.

| | TikTok's official server | This server | [getmcpads.com](https://www.getmcpads.com) |
|---|---|---|---|
| Hosting | TikTok-hosted, remote | **You host it.** stdio, local process | Hosted for you |
| Data path | Through TikTok's endpoint | **Direct to the Business API.** No intermediary | Through our gateway |
| Tools | ~400 flat, or ~40 in layered mode | **32** (27 read + 5 write) | 32, plus 5 other platforms |
| Coverage | Far broader | Reporting, structure, creatives, audiences | Same as this server |
| Writes | Applied directly | **Preview first**, applied only on `confirm: true` | Preview first |
| Metric compatibility | None documented | **Query planner splits incompatible requests** | Same planner |
| HTTP 200 on failure | Handled internally | **Checked on every call** | Checked |
| Auditable | No | **Yes.** Apache-2.0, read every line | This server, audited |
| Modifiable | No | **Fork it** | No |

**Be clear about the trade-off.** If you want the widest possible surface of the TikTok API,
the official server covers far more endpoints than this one does, and you should use it.

What this server offers instead is a **curated set**. TikTok themselves ship a layered mode
that exposes about 40 tools rather than 400, because loading hundreds of tool definitions
fills the model's context and makes it pick the wrong tool more often. 27 well-described
read tools with a compatibility-aware planner is a deliberate design choice, not a gap.

**Choose the official server** for breadth, or if you don't need to see the code.
**Choose this one** if you need your data to stay on your infrastructure, want to audit or
extend what the model can do, or want writes that cannot fire on the first call.
**Choose [getmcpads.com](https://www.getmcpads.com)** if you want this server's capabilities
without running it, or you need more than one ad platform in the same conversation.

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
| `TIKTOK_ENABLE_WRITES` | *unset* | Set to `1` to register the 5 write tools |
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

<details>
<summary><b>27 read tools</b></summary>

### Discovery and health
| Tool | Purpose |
|---|---|
| `tiktok_health_check` | Verifies credentials and advertiser access without exposing the token |
| `tiktok_list_advertisers` | Every advertiser account the token can reach |
| `tiktok_get_advertiser_info` | Account metadata: name, currency, timezone, status |

### Structure
| Tool | Purpose |
|---|---|
| `tiktok_get_campaigns` / `tiktok_get_adgroups` / `tiktok_get_ads` | List entities and their settings |
| `tiktok_get_delivery_status` | Delivery state and why it may be limited |

### Performance
| Tool | Purpose |
|---|---|
| `tiktok_get_insights` | The main reporting tool. Metrics, dimensions, compatibility-aware planning |
| `tiktok_validate_query` | Check a metric and dimension combination *before* running it |
| `tiktok_get_report_raw` | Native report fields, no aliasing |
| `tiktok_get_async_report_status` | Track a long-running async report |

### Creatives
| Tool | Purpose |
|---|---|
| `tiktok_get_creatives` | Ad creative text, media IDs, landing URLs |
| `tiktok_get_video_assets` | Video assets and their metadata |
| `tiktok_get_creative_fatigue_recipes` | Workflows for spotting creative fatigue |
| `tiktok_get_spark_ads` / `tiktok_get_spark_organic_joins` | Spark Ads and their organic counterparts |

### Audiences and targeting
| Tool | Purpose |
|---|---|
| `tiktok_get_audiences` / `tiktok_get_audience_details` | Custom and lookalike audiences |
| `tiktok_get_audience_overlap` | Overlap between audiences |
| `tiktok_get_targeting_catalog` | Available targeting options |

### Search Ads
| Tool | Purpose |
|---|---|
| `tiktok_search_keywords` | Keyword suggestions for TikTok Search Ads |
| `tiktok_get_search_ads_maturity` | How ready an account is for Search Ads |

### Commerce and signals
| Tool | Purpose |
|---|---|
| `tiktok_get_pixels` / `tiktok_get_events` | Pixels and the events they receive |
| `tiktok_get_shop_catalog_diagnostics` | Catalog and product feed health |

### Escape hatches
| Tool | Purpose |
|---|---|
| `tiktok_get_read_endpoint` | Call an allowlisted read endpoint directly |
| `tiktok_get_entities_raw` | Raw entity reads with your own field selection |

These exist so a new API field doesn't require a new release. Mutating endpoints, OAuth
endpoints and credential parameters are **blocked** on these paths, so a crafted argument
cannot turn a read tool into a write.

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

This server does one platform, on your machine, with your token. That is on purpose.

If you'd rather not run it yourself, or you need TikTok Ads **alongside Meta Ads, Google Ads,
Pinterest Ads, GA4 and Search Console** behind one endpoint, with hosted OAuth and
cross-platform reporting, that's what we build at **[getmcpads.com](https://www.getmcpads.com)**.

Same philosophy, less plumbing. This project stays open source and independently useful
either way.

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
Please read [SECURITY.md](SECURITY.md) before reporting anything security-related.

## Licence

[Apache License 2.0](LICENSE). See also [NOTICE](NOTICE).

TikTok and TikTok for Business are trademarks of ByteDance Ltd. and its affiliates.
**This project is not affiliated with, endorsed by, or sponsored by TikTok or ByteDance.**
It is an independent client of a public API.
