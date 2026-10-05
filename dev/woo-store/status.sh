#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=dev/woo-store/lib.sh
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

result=0
if /opt/homebrew/bin/mariadb-admin --socket="$DEV_STORE_DB_SOCKET" ping >/dev/null 2>&1; then
    printf 'mariadb: running\n'
else
    printf 'mariadb: stopped\n'
    result=1
fi
for service in php-fpm caddy; do
    if [[ -f "$DEV_STORE_RUN/$service.pid" ]] && kill -0 "$(cat "$DEV_STORE_RUN/$service.pid")" 2>/dev/null; then
        printf '%s: running\n' "$service"
    else
        printf '%s: stopped\n' "$service"
        result=1
    fi
done
exit "$result"
