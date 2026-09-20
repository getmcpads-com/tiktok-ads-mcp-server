# Changelog
## 2.0.0 - 2026-09-20

- Preserve exact unquoted 64-bit IDs in read, write and verification responses.
- Fix campaign field selection and default list limits.
- Update native write validation for budgets, schedules, targeting and readback. Add carousel music, uploaded-video readiness, CTA portfolio and custom identity tools.
- Require Node.js 22.12 or newer and check Node 22/24 in CI.
- Update vulnerable dependencies and regenerate the MCP catalog.
- No hosted creative UI or MCP Apps integrations.


## 1.1.0

- Synchronize applicable platform features with GetMCPAds commit b1471be while retaining local read-only exploration tools and credential configuration.
- Expose 33 read tools and 27 explicitly enabled write tools.
- Add MCP annotations, parameter descriptions, structured results, server identity and an offline-generated discovery card.
- Preserve preview/confirmation boundaries; test provider request construction and errors with mocked APIs.
- Refuse credential-bearing redirects and document provider-specific limitations.

No live advertiser mutation is performed by the release tests.
