# Contributing

Thanks for considering a contribution. This project is maintained by
[GetMCPAds](https://www.getmcpads.com) and is open to outside patches.

## Getting set up

```bash
git clone https://github.com/getmcpads-com/tiktok-ads-mcp-server.git
cd tiktok-ads-mcp-server
npm install
cp .env.example .env
```

Then run the checks:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

All four must pass. CI runs them on Node 18, 20 and 22.

## Ground rules

**Never commit a token.** `.env` is gitignored. Before opening a PR, re-read
your diff for anything starting with `act.`, which is a common prefix of a TikTok
access token.

**Tests use recorded or synthetic data.** Do not add a test that needs live
credentials to pass; CI has none.

**Metric and breakdown catalogues are the load-bearing part.** If you add or
change an entry in `metric-catalog.ts`, `dimension-catalog.ts`,
`filter-catalog.ts` or `compatibility-rules.ts`, say in the PR description
where the rule comes from: a link to the TikTok documentation, or the API error
you observed. A plausible-looking rule that is wrong is worse than a missing
one, because the query planner trusts it.

**Write tools must preview first.** Any new write tool has to accept `confirm`
and return a preview when it is absent. A tool that mutates an account on the
first call will not be merged.

**Keep it self-contained.** Runtime dependencies are `@modelcontextprotocol/sdk`
and `zod`. Adding a third needs a good reason.

## Pinned API version

The API version is pinned to `v1.3` in `src/platforms/tiktok/client.ts`, and the
URL guard refuses any path outside `/open_api/v1.3/`. We move it deliberately,
not automatically, because a version bump can silently change the shape of a
response. If you bump it, update the guard and describe what you checked.

## TikTok answers 200 on failure

The applicative `code` field decides, not the HTTP status. Any new call must
treat a non-zero `code` as an error. A patch that trusts the HTTP status alone
reports imaginary successes to the model and will not be merged.

## Commit and PR style

- One logical change per PR.
- Explain *why*, not just *what*. The diff already says what.
- If you fix a bug, add the test that would have caught it.

## Reporting bugs

Open an issue with: what you called, what you expected, what you got, and the
TikTok API version in use. Redact IDs and tokens.

For anything security-related, do not open an issue. See [SECURITY.md](SECURITY.md).

## Licence

By contributing, you agree that your contributions are licensed under the
Apache License 2.0, as stated in [LICENSE](LICENSE).
