# Source synchronization

Reviewed on 2026-09-20 against getmcpads source revision `41cc1ca`.

- Preserve exact unquoted 64-bit IDs in read, write and verification responses.
- Fix campaign field selection and default list limits.
- Update native write validation for budgets, schedules, targeting and readback. Add carousel music, uploaded-video readiness, CTA portfolio and custom identity tools.

The public server remains self-contained. Hosted billing, workspaces, account-selection storage, creative galleries, Launcher files and MCP Apps UI are outside this synchronization. Existing standalone protections and public features newer than the hosted source are retained.

Validation uses synthetic data. No live advertising write is required by the test suite. The generated server-card.json is the source of truth for this revision's tool schemas.

Maintainer: Emmanuel, getmcpads. Contact: hello@getmcpads.com.
