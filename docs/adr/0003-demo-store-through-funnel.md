# 0003. The demo store is the Mac mini's dev store, read-only through Tailscale Funnel

Status: Accepted
Date: 2026-10-05

## Context

PLAN.md's D5 asked which store testers use. The proposal was that testers
bring their own, because the dev store is not reachable from outside the
Mac mini. Paul wants a demo he can open from his phone. The front desk took
D5 on 2026-10-05: use the Mac mini's dev store, exposed read-only through
the machine's Tailscale Funnel.

The Mac mini already serves a Funnel on port 443 (the GitHub-events
receiver and the support desk) and a tailnet-only route on port 8443 (an
e2e store in Colima). Funnel accepts only ports 443, 8443 and 10000.

## Decision

- The dev store (PLAN.md, "Dev store") is served publicly at
  `https://claudes-mac-mini.tail6a20e3.ts.net:10000`, which is also its
  WordPress `siteurl` and `home`. Funnel terminates TLS, so the store needs
  no local certificate. WordPress trusts `X-Forwarded-Proto` from the local
  proxy and so sees HTTPS.
- Caddy serves two listeners, both bound to `127.0.0.1`:
  - **8480, full access.** Used by the scripts and by WP-CLI work. It is
    never exposed.
  - **8481, the public filter.** It is the only listener Funnel points at,
    and it forwards only what the app needs: the REST index, `wcpos/*`
    routes, the WCPOS browser login (`/wcpos-auth/`), uploads (product
    images), and core WordPress assets the login page loads. Writes to
    `wcpos/*` stay refused until M3 needs the order push. `wp-admin`,
    `wp-login.php`, `xmlrpc.php`, `wc/*` and everything else answer 403.
- The demo cashier is a dedicated user. Its password lives in the dev
  store's state directory, outside the repository, and the front desk
  passes it to Paul. The WCPOS login page limits failures per IP and per
  username (WCPOS 1.10.20 `Templates/Auth.php`).
- Funnel on port 10000 is added beside the existing routes and changes none
  of them.

## Consequences

- The demo works only while the Mac mini and its dev store are up. The
  store's services start on demand (PLAN.md), so the demo needs them
  started and kept running. That is a `dev/woo-store` job, not a login item.
- Testers' own stores (the D5 proposal) still work the same way, since
  the app only takes a site URL. The tester guide comes with M3.
- Opening the store's admin publicly is out of scope. Admin work goes
  through WP-CLI on the Mac mini.
