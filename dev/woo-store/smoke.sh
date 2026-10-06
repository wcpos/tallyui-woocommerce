#!/usr/bin/env bash
set -euo pipefail

check=setup
tmp_dir=
trap 'result=$?; [[ -z "$tmp_dir" ]] || rm -rf -- "$tmp_dir";
    if (( result != 0 )); then printf "FAIL %s\n" "$check" >&2; exit 1; fi' EXIT
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=dev/woo-store/lib.sh
source "$script_dir/lib.sh"
# shellcheck disable=SC1090
source "$DEV_STORE_CREDENTIALS"
umask 077
tmp_dir="$(mktemp -d)"

check='mail log plugin installed'
mail_filter="$(wp_cli eval 'echo (int) has_filter("pre_wp_mail");')"
[[ "$mail_filter" -ne 0 ]]
printf 'ok %s\n' "$check"

check='WCPOS customer emails off for POS orders'
customer_emails_off="$(wp_cli eval 'echo (int) (get_option("woocommerce_pos_settings_checkout")["customer_emails"]["enabled"] === false);')"
[[ "$customer_emails_off" == 1 ]]
printf 'ok %s\n' "$check"

check='taxes off'
calc_taxes="$(wp_cli eval 'echo get_option("woocommerce_calc_taxes");')"
[[ "$calc_taxes" == no ]]
printf 'ok %s\n' "$check"

for blocked_path in /wp-admin/ /wp-login.php /xmlrpc.php \
    /wp-json/wc/v3/products '/?rest_route=/wc/v3/products' \
    /wp-content/plugins/woocommerce-pos/woocommerce-pos.php; do
    check="403 $blocked_path"
    status="$(curl -sS -o /dev/null -w '%{http_code}' "$DEV_STORE_URL$blocked_path")"
    [[ "$status" == 403 ]]
    printf 'ok 403 %s\n' "$blocked_path"
done

check='401 POST /wp-json/wcpos/v2/push/orders without a token'
status="$(curl -sS -o "$tmp_dir/push-orders" -w '%{http_code}' \
    -H 'Content-Type: application/json' -H 'X-WCPOS: 1' -d '{}' \
    "$DEV_STORE_URL/wp-json/wcpos/v2/push/orders")"
[[ "$status" == 401 ]]
jq -e '.code == "woocommerce_pos_rest_unauthorized"' "$tmp_dir/push-orders" > /dev/null
printf 'ok %s\n' "$check"

check='403 POST /wp-json/wcpos/v2/push/products'
status="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H 'Content-Type: application/json' -H 'X-WCPOS: 1' -d '{}' \
    "$DEV_STORE_URL/wp-json/wcpos/v2/push/products")"
[[ "$status" == 403 ]]
printf 'ok %s\n' "$check"

check='401 POST /wp-json/wcpos/v2/push/customers without a token'
status="$(curl -sS -o "$tmp_dir/push-customers" -w '%{http_code}' \
    -H 'Content-Type: application/json' -H 'X-WCPOS: 1' -d '{}' \
    "$DEV_STORE_URL/wp-json/wcpos/v2/push/customers")"
[[ "$status" == 401 ]]
jq -e '.code == "woocommerce_pos_rest_unauthorized"' "$tmp_dir/push-customers" > /dev/null
printf 'ok %s\n' "$check"

check='401 POST /wp-json/wcpos/v2/orders/1/email without a token'
status="$(curl -sS -o "$tmp_dir/order-email" -w '%{http_code}' \
    -H 'Content-Type: application/json' -H 'X-WCPOS: 1' -d '{}' \
    "$DEV_STORE_URL/wp-json/wcpos/v2/orders/1/email")"
[[ "$status" == 401 ]]
jq -e '.code | type == "string" and length > 0' "$tmp_dir/order-email" > /dev/null
printf 'ok %s\n' "$check"

check='403 POST /wp-json/wcpos/v2/orders/1'
status="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H 'Content-Type: application/json' -H 'X-WCPOS: 1' -d '{}' \
    "$DEV_STORE_URL/wp-json/wcpos/v2/orders/1")"
[[ "$status" == 403 ]]
printf 'ok %s\n' "$check"

check='rest index'
status="$(curl -fsS -H 'X-WCPOS: 1' -o "$tmp_dir/index" -w '%{http_code}' \
    "$DEV_STORE_URL/wp-json/?wcpos=1")"
[[ "$status" == 200 ]]
jq -e '.namespaces | index("wcpos/v2") != null' "$tmp_dir/index" > /dev/null
printf 'ok rest index\n'

check=sign-in
state="$(openssl rand -hex 16)"
login_url="$DEV_STORE_URL/wcpos-auth/?redirect_uri=https%3A%2F%2Fexample.invalid%2Fcallback&state=$state"
curl -fsS -c "$tmp_dir/cookies" "$login_url" -o "$tmp_dir/login"
# PHP source is single-quoted on purpose.
# shellcheck disable=SC2016
fields="$("$DEV_STORE_PHP" -r '
    $doc = new DOMDocument();
    @$doc->loadHTML(stream_get_contents(STDIN));
    $xpath = new DOMXPath($doc);
    echo $xpath->evaluate("string(//input[@name=\"_wpnonce\"]/@value)"), "\t",
        $xpath->evaluate("string(//input[@name=\"auth_session\"]/@value)");
' < "$tmp_dir/login")"
IFS=$'\t' read -r nonce auth_session <<< "$fields"
[[ -n "$nonce" && -n "$auth_session" ]]
status="$(curl -fsS -b "$tmp_dir/cookies" -c "$tmp_dir/cookies" \
    -D "$tmp_dir/headers" -o /dev/null -w '%{http_code}' \
    --data-urlencode "wcpos-log=$CASHIER_USER" \
    --data-urlencode "wcpos-pwd=$CASHIER_PASSWORD" \
    --data-urlencode "_wpnonce=$nonce" --data-urlencode "auth_session=$auth_session" \
    --data-urlencode 'wcpos_website=' "$login_url")"
[[ "$status" == 302 ]]
location="$(sed -n 's/^[Ll]ocation: *//p' "$tmp_dir/headers" | tr -d '\r')"
# PHP source is single-quoted on purpose.
# shellcheck disable=SC2016
access_token="$(printf '%s' "$location" | "$DEV_STORE_PHP" -r '
    $url = stream_get_contents(STDIN);
    if (!str_starts_with($url, "https://example.invalid/callback?")) { exit(1); }
    parse_str(parse_url($url, PHP_URL_QUERY), $params);
    if (($params["state"] ?? "") !== $argv[1] || empty($params["access_token"])) { exit(1); }
    echo $params["access_token"];
' "$state")"
printf 'ok sign-in as %s\n' "$CASHIER_USER"

check='products 12'
curl -fsS -H "Authorization: Bearer $access_token" -H 'X-WCPOS: 1' \
    -D "$tmp_dir/headers" -o "$tmp_dir/products" \
    "$DEV_STORE_URL/wp-json/wcpos/v2/products?per_page=100&status=publish"
total="$(awk 'tolower($1) == "x-wp-total:" { gsub("\r", "", $2); print $2 }' "$tmp_dir/headers")"
[[ "$total" == 12 ]]
jq -e 'type == "array" and all(.[]; [.meta_data[]? | select(.key == "_woocommerce_pos_uuid") | .value | strings | select(length > 0)] | length == 1)' \
    "$tmp_dir/products" > /dev/null
printf 'ok products 12\n'
