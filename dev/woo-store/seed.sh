#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=dev/woo-store/lib.sh
source "$script_dir/lib.sh"

if ! /opt/homebrew/bin/mariadb-admin --socket="$DEV_STORE_DB_SOCKET" ping > /dev/null 2>&1; then
    dev_store_log "MariaDB is not running; start the database before seeding."
    exit 1
fi

printf '%s\n' 'dev-store: replacing all products with the demo catalogue'
wp_cli eval-file "$script_dir/seed/seed.php"
