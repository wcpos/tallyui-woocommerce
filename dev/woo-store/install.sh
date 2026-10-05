#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=dev/woo-store/lib.sh
source "$script_dir/lib.sh"

if ! "$script_dir/status.sh"; then
    dev_store_log "A service is stopped; start the services before installing."
    exit 1
fi
ensure_credentials

/opt/homebrew/bin/mariadb --socket="$DEV_STORE_DB_SOCKET" <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
SQL

if [[ ! -f "$DEV_STORE_WP/wp-includes/version.php" ]]; then
    wp_cli core download --version="$DEV_STORE_WP_VERSION" --locale=en_US
fi
rm -f "$DEV_STORE_WP/ping.php"

if [[ ! -f "$DEV_STORE_WP/wp-config.php" ]]; then
    render_template "$script_dir/templates/wp-config-extra.php" "$DEV_STORE_ETC/wp-config-extra.php"
    # With --prompt, WP-CLI echoes the full command, password included, to stdout.
    {
        printf '%s\n' "$DB_PASSWORD"
        cat "$DEV_STORE_ETC/wp-config-extra.php"
    } | wp_cli config create --dbname="$DB_NAME" --dbuser="$DB_USER" \
        --dbhost="localhost:$DEV_STORE_DB_SOCKET" --skip-check --prompt=dbpass --extra-php > /dev/null
fi

if ! wp_cli core is-installed; then
    printf '%s\n' "$ADMIN_PASSWORD" | wp_cli core install --url="$DEV_STORE_URL" \
        --title="TallyUI WooCommerce dev store" --admin_user="$ADMIN_USER" \
        --admin_email=admin@dev-store.invalid --skip-email --prompt=admin_password > /dev/null
fi

wp_cli option update home "$DEV_STORE_URL"
wp_cli option update siteurl "$DEV_STORE_URL"
wp_cli rewrite structure '/%postname%/'
wp_cli option update timezone_string "$DEV_STORE_TIMEZONE"
wp_cli option update blog_public 0

for plugin in woocommerce woocommerce-pos; do
    case "$plugin" in
        woocommerce) version="$DEV_STORE_WC_VERSION" ;;
        woocommerce-pos) version="$DEV_STORE_WCPOS_VERSION" ;;
    esac
    if installed_version="$(wp_cli plugin get "$plugin" --field=version 2>/dev/null)"; then
        if [[ "$installed_version" != "$version" ]]; then
            wp_cli plugin install "$plugin" --version="$version" --activate --force
        elif ! wp_cli plugin is-active "$plugin"; then
            wp_cli plugin install "$plugin" --version="$version" --activate
        fi
    else
        wp_cli plugin install "$plugin" --version="$version" --activate
    fi
done

wp_cli option update woocommerce_coming_soon no
wp_cli option update woocommerce_store_pages_only no
wp_cli option update woocommerce_calc_taxes no
wp_cli option update woocommerce_currency USD
wp_cli option update woocommerce_default_country US:CA
wp_cli option update woocommerce_onboarding_profile '{"skipped":true}' --format=json
wp_cli option update woocommerce_manage_stock yes

if ! wp_cli user get "$CASHIER_USER" --field=ID >/dev/null 2>&1; then
    printf '%s\n' "$CASHIER_PASSWORD" | wp_cli user create "$CASHIER_USER" \
        cashier@dev-store.invalid --role=shop_manager --prompt=user_pass > /dev/null
fi
if ! wp_cli user list-caps "$CASHIER_USER" | grep -qx 'access_woocommerce_pos'; then
    wp_cli user add-cap "$CASHIER_USER" access_woocommerce_pos
fi

printf 'URL: %s\nWordPress: %s\nWooCommerce: %s\nWCPOS Free: %s\nCashier: %s\nCredentials: %s\n' \
    "$DEV_STORE_URL" "$(wp_cli core version)" \
    "$(wp_cli plugin get woocommerce --field=version)" \
    "$(wp_cli plugin get woocommerce-pos --field=version)" "$CASHIER_USER" "$DEV_STORE_CREDENTIALS"
