# Local WooCommerce dev store services

Native MariaDB, PHP 8.3 FPM and Caddy provide the services for a local
WooCommerce development store.

All worktrees share one store at
`$HOME/.local/share/tallyui-woocommerce/dev-store` (mode 700).
It contains `wordpress/` (docroot), `mysql/` (database), `run/` (sockets and
PIDs), `log/`, `etc/` (rendered templates), and `caddy/` (Caddy state).

Run from the repository root:

```sh
dev/woo-store/up.sh
dev/woo-store/status.sh
dev/woo-store/down.sh
```

`up.sh` renders configuration and starts the services; repeat runs keep the
running services and reload Caddy. `down.sh` stops them without deleting data.
`status.sh` prints each service's state and exits 0 only when all three run.

The dev store never sends mail: every `wp_mail` call is logged as one JSON line in
`~/.local/share/tallyui-woocommerce/dev-store/log/mail.log`, with recipients,
subject, headers (count them from the array), attachment count and body metadata,
but no body. Read it with
`tail ~/.local/share/tallyui-woocommerce/dev-store/log/mail.log`.

HTTP listens on `127.0.0.1:8480`, MariaDB on `127.0.0.1:3306`, and the Caddy
admin endpoint on `127.0.0.1:2480`. PHP FPM uses `run/php-fpm.sock`, never a
TCP port. The public filter listener uses `127.0.0.1:8481`.

Homebrew tools must already be installed. PHP 8.3 is keg-only and is called
by its full paths: `/opt/homebrew/opt/php@8.3/bin/php` and
`/opt/homebrew/opt/php@8.3/sbin/php-fpm`. PHP on PATH is not used.

`lib.sh` is sourced by scripts, not executed directly; it defines the shared
paths, constants, template renderer and logging function.

## Install

With the services running, run `dev/woo-store/install.sh` from the repository root.
It installs WordPress **7.1.2**, WooCommerce **11.1.1**, and WCPOS Free **1.10.20**.
The public store URL is `https://claudes-mac-mini.tail6a20e3.ts.net:10000`.
Generated credentials are stored outside the repo in
`$HOME/.local/share/tallyui-woocommerce/dev-store/credentials.env` (mode 600).
The cashier account is `cashier`, with the `shop_manager` role and POS access.
`install.sh` is re-runnable; it preserves existing credentials and cashier accounts.

## Seed

Run `dev/woo-store/seed.sh` with MariaDB running to replace the demo catalogue.
It deletes all products first and removes previously generated seed images.
The catalogue has 11 simple products (one draft), T-Shirt and Hoodie variable
products, and 9 variations across Coffee, Bakery and Merch, with stock and SKUs.
Product images are generated locally; barcodes use the WooCommerce GTIN field.

## Public URL and smoke

Public URL: `https://claudes-mac-mini.tail6a20e3.ts.net:10000` (Funnel to `127.0.0.1:8481`).
Only `/wp-json/` and `/wp-json/wcpos/*` reads (GET/HEAD/OPTIONS),
`/wp-json/wcpos/v1/auth/refresh` and `/wp-json/wcpos/v2/auth/refresh` (POST/OPTIONS),
`/wp-json/wcpos/v2/push/orders` (POST/OPTIONS),
`/wp-json/wcpos/v2/push/customers` and `/wp-json/wcpos/v2/orders/<digits>/email` (POST/OPTIONS),
and `/wcpos-auth` or `/wcpos-auth/*` (GET/POST) reach PHP.
Static GET/HEAD requests under `/wp-content/uploads/*`, `/wp-includes/*`, and
`/wp-content/plugins/*` are exposed, excluding `*.php`; everything else returns 403.
Do admin work through WP-CLI (`wp_cli` from `dev/woo-store/lib.sh`).
Run `dev/woo-store/smoke.sh` to check public blocking, cashier sign-in and 12 products.
