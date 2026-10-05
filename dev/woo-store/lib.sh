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
readonly DEV_STORE_URL="https://claudes-mac-mini.tail6a20e3.ts.net:10000" # Public WordPress URL (ADR 0003).
readonly DEV_STORE_WP_VERSION="7.1.2" # Pinned WordPress version.
readonly DEV_STORE_WC_VERSION="11.1.1" # WCPOS 1.10.20 WC tested up to.
readonly DEV_STORE_WCPOS_VERSION="1.10.20" # Pinned WCPOS Free version.
readonly DEV_STORE_TIMEZONE="America/Los_Angeles" # West of UTC to expose date-cursor bugs.
readonly DEV_STORE_CREDENTIALS="$DEV_STORE_STATE/credentials.env" # Private store credentials.

export WP_CLI_PHP="$DEV_STORE_PHP"
export WP_CLI_CACHE_DIR="$DEV_STORE_STATE/wp-cli-cache"

wp_cli() {
    "$DEV_STORE_PHP" /opt/homebrew/bin/wp --path="$DEV_STORE_WP" "$@"
}

ensure_credentials() {
    if [[ ! -f "$DEV_STORE_CREDENTIALS" ]]; then
        (
            umask 077
            cat > "$DEV_STORE_CREDENTIALS" <<EOF
DB_NAME=wordpress
DB_USER=wp
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
ADMIN_USER=admin
ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
CASHIER_USER=cashier
CASHIER_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
EOF
        )
    fi
    # shellcheck disable=SC1090
    source "$DEV_STORE_CREDENTIALS"
}

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
