# 0002. Testers use the web build hosted on Vercel

Status: Accepted
Date: 2026-10-05

## Context

PLAN.md's D4 asks where testers open the app. The web build is the tester
surface until the MVP holds (PLAN.md, principle 4). `medusapos/app` hosts
its web build on Vercel (its ADR 0005), and the `wcpos` team on Vercel is
on the Pro plan. The front desk took D4 on 2026-10-05: host the web export
on Vercel in team `wcpos`, as `medusapos/app` does.

## Decision

- One Vercel project, `tallyui-woocommerce`, in team `wcpos`, with root
  directory `apps/pos`. Vercel installs from the repository root (pnpm
  workspace) and runs the app's `build` (`expo export --platform web`)
  into `apps/pos/dist`.
- The export is a single-page app (`web.output: "single"`), so every path
  rewrites to `index.html`. That includes the sign-in callback,
  `/auth/callback`.
- `main` deploys to production and each PR gets a preview. The production
  URL is the tester link.
- The app holds no secrets. The store URL and the WCPOS token come from
  the tester's own sign-in. The one build-time secret is the RxDB Premium
  licence once the app persists to SQLite-wasm (see ADR 0004). It goes
  into Vercel's encrypted environment and never into the repository.

## Consequences

- WCPOS's browser login returns the tokens to `redirect_uri` in the query
  string (WCPOS 1.10.20 `Templates/Auth.php`). That first request to
  `/auth/callback` therefore reaches Vercel with the tokens in its URL and
  can appear in Vercel's request logs. The app strips them from the
  address bar at once (`history.replaceState`). The access token lives 30
  minutes; the refresh token lives 30 days and is not rotated on 1.10.x.
  Access to the project's logs is limited to the `wcpos` team. If that
  proves not enough, the callback can move to a page that is never logged.
- A tester's store must serve HTTPS. The app is served over HTTPS, so a
  plain-HTTP store is mixed content and the browser blocks it.
