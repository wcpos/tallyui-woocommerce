#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=dev/woo-store/lib.sh
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

export XDG_DATA_HOME="$DEV_STORE_STATE/caddy/data"
export XDG_CONFIG_HOME="$DEV_STORE_STATE/caddy/config"
if [[ -f "$DEV_STORE_RUN/caddy.pid" ]] && kill -0 "$(cat "$DEV_STORE_RUN/caddy.pid")" 2>/dev/null; then
    /opt/homebrew/bin/caddy stop --config "$DEV_STORE_ETC/Caddyfile" --adapter caddyfile
fi

if [[ -f "$DEV_STORE_RUN/php-fpm.pid" ]] && kill -0 "$(cat "$DEV_STORE_RUN/php-fpm.pid")" 2>/dev/null; then
    pid="$(cat "$DEV_STORE_RUN/php-fpm.pid")"
    kill -QUIT "$pid"
    for ((attempt = 0; attempt < 20; attempt++)); do
        sleep 0.5
        if ! kill -0 "$pid" 2>/dev/null; then
            break
        fi
    done
    if ((attempt == 20)); then
        dev_store_log "php-fpm did not stop within 10 seconds."
        exit 1
    fi
fi

if /opt/homebrew/bin/mariadb-admin --socket="$DEV_STORE_DB_SOCKET" ping >/dev/null 2>&1; then
    /opt/homebrew/bin/mariadb-admin --socket="$DEV_STORE_DB_SOCKET" shutdown
fi
exit 0
