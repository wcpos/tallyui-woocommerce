# Local WooCommerce dev store services

Native MariaDB, PHP 8.3 FPM and Caddy provide the services for a local
WooCommerce development store. WordPress installation comes in a later job.

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

HTTP listens on `127.0.0.1:8480`, MariaDB on `127.0.0.1:3306`, and the Caddy
admin endpoint on `127.0.0.1:2480`. PHP FPM uses `run/php-fpm.sock`, never a
TCP port. Port 8481 is reserved for a later public listener.

Homebrew tools must already be installed. PHP 8.3 is keg-only and is called
by its full paths: `/opt/homebrew/opt/php@8.3/bin/php` and
`/opt/homebrew/opt/php@8.3/sbin/php-fpm`. PHP on PATH is not used.

`lib.sh` is sourced by scripts, not executed directly; it defines the shared
paths, constants, template renderer and logging function.
