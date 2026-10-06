#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=dev/woo-store/lib.sh
source "$script_dir/lib.sh"

case "${1:-}" in
    on|off|status) ;;
    *) printf 'Usage: %s on|off|status\n' "$0" >&2; exit 2 ;;
esac

if ! /opt/homebrew/bin/mariadb-admin --socket="$DEV_STORE_DB_SOCKET" ping > /dev/null 2>&1; then
    dev_store_log "MariaDB is not running; start the database before configuring taxes."
    exit 1
fi

wp_cli eval-file "$script_dir/taxes/taxes.php" "$1"
