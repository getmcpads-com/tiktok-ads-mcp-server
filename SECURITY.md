# Security Policy

This server holds an access token that can read, and when writes are enabled
modify, live advertising accounts. We take reports seriously.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting on this repository:
[Report a vulnerability](https://github.com/getmcpads-com/tiktok-ads-mcp-server/security/advisories/new).

We aim to acknowledge a report within 3 business days and to ship a fix or a
documented mitigation within 30 days. We will credit you in the advisory unless
you ask us not to.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |

## What this server does with your token

- The token is read once from `TIKTOK_ACCESS_TOKEN` at startup and kept in
  memory. It is never written to disk. Debug logging prints
  `Access-Token: [redacted]`, never the value.
- Requests go only to `https://business-api.tiktok.com`, and only under
  `/open_api/v1.3/`. Any other host or path prefix is refused rather than
  called. This is covered by tests.
- HTTP redirects are refused once a token has been attached, so a redirect
  cannot forward your credentials to a third party.
- Mutating endpoints, OAuth endpoints and credential parameters are blocked on
  the generic read paths, so a crafted argument cannot turn a read tool into a
  write. This is covered by tests.
- No telemetry, no analytics, no phone-home. The server makes no network call
  other than to the TikTok Business API.

## A TikTok specific trap

**TikTok answers HTTP 200 even when a call fails.** The applicative `code`
field is what decides. This server treats a non-zero `code` as an error rather
than reporting an imaginary success back to the model. If you build on top of
this code, do the same.

## Handling your token safely

- Scope the token to the advertiser accounts you actually need.
- Grant read scopes only. Add campaign management scopes **only** if you enable
  writes.
- Treat the token like a password: it is a bearer credential.
- Your MCP client config file is usually plain text on disk. Check its
  permissions, and never commit it.
- Rotate the token if you suspect exposure.

## Scope

Vulnerabilities in the TikTok Business API itself are not in scope here; report
those to TikTok.
