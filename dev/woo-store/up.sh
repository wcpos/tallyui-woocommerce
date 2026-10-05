#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=dev/woo-store/lib.sh
source "$script_dir/lib.sh"

mkdir -p "$DEV_STORE_STATE"
chmod 700 "$DEV_STORE_STATE"
mkdir -p "$DEV_STORE_WP" "$DEV_STORE_DATA" "$DEV_STORE_RUN" "$DEV_STORE_LOG" "$DEV_STORE_ETC" \
    "$DEV_STORE_STATE/caddy/data" "$DEV_STORE_STATE/caddy/config"
for template in my.cnf php-fpm.conf Caddyfile; do
    render_template "$script_dir/templates/$template" "$DEV_STORE_ETC/$template"
done

if [[ ! -d "$DEV_STORE_DATA/mysql" ]]; then
    /opt/homebrew/bin/mariadb-install-db --defaults-file="$DEV_STORE_ETC/my.cnf" \
        --datadir="$DEV_STORE_DATA" --auth-root-authentication-method=socket --skip-test-db
fi
if ! /opt/homebrew/bin/mariadb-admin --socket="$DEV_STORE_DB_SOCKET" ping >/dev/null 2>&1; then
    nohup /opt/homebrew/bin/mariadbd --defaults-file="$DEV_STORE_ETC/my.cnf" \
        > "$DEV_STORE_LOG/mariadb.log" 2>&1 &
    for ((attempt = 0; attempt < 60; attempt++)); do
        sleep 0.5
        if /opt/homebrew/bin/mariadb-admin --socket="$DEV_STORE_DB_SOCKET" ping >/dev/null 2>&1; then
            break
        fi
    done
    if ((attempt == 60)); then
        dev_store_log "MariaDB did not answer within 30 seconds."
        exit 1
    fi
fi

if [[ ! -f "$DEV_STORE_RUN/php-fpm.pid" ]] || ! kill -0 "$(cat "$DEV_STORE_RUN/php-fpm.pid")" 2>/dev/null; then
    "$DEV_STORE_PHP_FPM" --fpm-config "$DEV_STORE_ETC/php-fpm.conf"
    for ((attempt = 0; attempt < 20; attempt++)); do
        sleep 0.5
        if [[ -S "$DEV_STORE_FPM_SOCKET" ]]; then
            break
        fi
    done
    if [[ ! -S "$DEV_STORE_FPM_SOCKET" ]]; then
        dev_store_log "php-fpm socket did not appear within 10 seconds."
        exit 1
    fi
fi

export XDG_DATA_HOME="$DEV_STORE_STATE/caddy/data"
export XDG_CONFIG_HOME="$DEV_STORE_STATE/caddy/config"
if [[ -f "$DEV_STORE_RUN/caddy.pid" ]] && kill -0 "$(cat "$DEV_STORE_RUN/caddy.pid")" 2>/dev/null; then
    /opt/homebrew/bin/caddy reload --config "$DEV_STORE_ETC/Caddyfile" --adapter caddyfile
else
    /opt/homebrew/bin/caddy start --config "$DEV_STORE_ETC/Caddyfile" --adapter caddyfile \
        --pidfile "$DEV_STORE_RUN/caddy.pid"
fi
