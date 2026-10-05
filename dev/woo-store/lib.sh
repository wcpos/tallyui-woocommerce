#!/usr/bin/env bash
# shellcheck disable=SC2034
# Public constants are used by scripts sourcing this library.
set -euo pipefail

readonly DEV_STORE_STATE="$HOME/.local/share/tallyui-woocommerce/dev-store" # Shared runtime state.
readonly DEV_STORE_WP="$DEV_STORE_STATE/wordpress" # WordPress docroot.
readonly DEV_STORE_DATA="$DEV_STORE_STATE/mysql" # MariaDB data.
readonly DEV_STORE_RUN="$DEV_STORE_STATE/run" # Sockets and PID files.
readonly DEV_STORE_LOG="$DEV_STORE_STATE/log" # Service logs.
readonly DEV_STORE_ETC="$DEV_STORE_STATE/etc" # Rendered configuration.
readonly DEV_STORE_DB_PORT=3306 # Loopback database port.
readonly DEV_STORE_DB_SOCKET="$DEV_STORE_RUN/mysql.sock" # Database socket.
readonly DEV_STORE_FPM_SOCKET="$DEV_STORE_RUN/php-fpm.sock" # PHP FastCGI socket.
readonly DEV_STORE_HTTP_PORT=8480 # Local full-access HTTP port.
readonly DEV_STORE_PHP=/opt/homebrew/opt/php@8.3/bin/php # Keg-only PHP CLI.
readonly DEV_STORE_PHP_FPM=/opt/homebrew/opt/php@8.3/sbin/php-fpm # Keg-only PHP service.

render_template() {
    sed -e "s|@STATE@|$DEV_STORE_STATE|g" \
        -e "s|@WP@|$DEV_STORE_WP|g" \
        -e "s|@RUN@|$DEV_STORE_RUN|g" \
        -e "s|@LOG@|$DEV_STORE_LOG|g" \
        -e "s|@DATA@|$DEV_STORE_DATA|g" \
        -e "s|@DB_PORT@|$DEV_STORE_DB_PORT|g" \
        -e "s|@DB_SOCKET@|$DEV_STORE_DB_SOCKET|g" \
        -e "s|@FPM_SOCKET@|$DEV_STORE_FPM_SOCKET|g" \
        -e "s|@HTTP_PORT@|$DEV_STORE_HTTP_PORT|g" "$1" > "$2"
}

dev_store_log() {
    printf 'dev-store: %s\n' "$1" >&2
}
