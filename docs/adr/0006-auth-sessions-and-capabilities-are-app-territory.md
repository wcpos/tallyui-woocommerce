# 0006. Auth, sessions and cashier capabilities are app territory

Status: Accepted
Date: 2026-10-06

## Context

ADR 0001 point 3 makes `@tallyui/connector-woocommerce` the only WooCommerce integration point, for every schema, trait, sync, replication and transport. Sign-in has never gone through it:
- The app runs the plugin's browser sign-in (`/wcpos-auth`) itself (`apps/pos/lib/auth/login.ts`).
- It refreshes the access token against `wcpos/v2/auth/refresh` (`apps/pos/lib/auth/session.ts`).
- The connector only turns the access token into request headers (`connector.auth.getHeaders`).

Two PARITY rows raised the same question: "Session management" and "Capability gating". The write-up is `~/agent/handoff/tallyui-woocommerce-m1-2026-10-06/session-management-survey.md`.

- **Sessions.** WCPOS v2 has no sessions screen in the POS app. A user's sessions are listed and revoked in the plugin's WP-admin settings, under POS → Settings → Sessions. v2's sign-out revokes nothing on the server.
- **Capabilities.** v2 reads the signed-in cashier's capabilities from the plugin's `GET wcpos/v2/cashier/{id}`. The `capabilities` field there is the cashier's effective grants, a list of names (`Access_Section::effective_capabilities`). v2 derives its gates locally (`core/screens/main/hooks/user-capabilities.ts`). When the field is absent, v2 treats every capability as granted ("unknown fails open").

The front desk ruled on 2026-10-06.

## Decision

1. **The plugin's auth, session and cashier endpoints are app territory.** Under `wcpos/v1` and `wcpos/v2` these are sign-in, refresh, the sessions routes and `cashier/{id}`. The app calls them itself, in `apps/pos/lib/auth/`, with the connector's request headers. The connector carries only the cashier payload that sign-in returns: the tokens and the user's id, uuid and display name. They are not WooCommerce catalogue or order data, so nothing is filed on TallyUI for them.
2. **Session management stays in WP admin, as in v2.** The app builds no sessions screen and no server-side revoke on sign-out. The demo filter (ADR 0003) keeps refusing DELETE. PARITY records the row as "n/a (server)".
3. **Capability gating follows v2, except that unknown fails closed.**
   - When `cashier/{id}` returns a `capabilities` list, the app derives the same gates from it as v2, by the same rules.
   - When the field is absent or not a list, or the request fails, the gate closes. The control then shows why, instead of v2's fail-open.

## Consequences

- An in-app sessions screen would go beyond v2. It needs a new ruling, a Caddyfile change and an ADR 0003 amendment.
- A store whose plugin predates the capability payload locks the gated controls in this app, where v2 leaves them open. The control's message names the cause.
- If TallyUI's `ConnectorAuth` later grows a capabilities hook, the app can move the fetch behind it. Until then the fetch stays in `apps/pos/lib/auth/`.
