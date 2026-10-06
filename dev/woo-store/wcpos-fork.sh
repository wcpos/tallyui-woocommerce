#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=dev/woo-store/lib.sh
source "$script_dir/lib.sh"

pro_dir="$DEV_STORE_WP/wp-content/plugins/woocommerce-pos-pro" # WCPOS Pro installation.
free_dir="$pro_dir/vendor/wcpos/woocommerce-pos" # Free copy loaded by Pro.
backup_dir="$DEV_STORE_STATE/wcpos-fork/stock" # Stock Free backup.
checkout="$DEV_STORE_STATE/wcpos-fork/checkout" # TallyUI fork clone.
fork_branch=tally # Local fork branch.
marker="$free_dir/.tally-overlay" # Applied fork commit.

case "${1:-}" in
    apply|restore|status) ;;
    *) printf 'Usage: %s apply|restore|status\n' "$0" >&2; exit 2 ;;
esac

case "$1" in
    status)
        if [[ ! -d "$free_dir" ]]; then
            dev_store_log "WCPOS Free bundle is missing: $free_dir"
            exit 1
        fi
        if [[ -f "$marker" ]]; then
            printf 'tally %s\n' "$(cat "$marker")"
        else
            printf 'stock\n'
        fi
        ;;
    apply)
        if [[ ! -d "$free_dir" ]]; then
            dev_store_log "WCPOS Free bundle is missing: $free_dir"
            exit 1
        fi
        if [[ ! -d "$checkout" ]]; then
            dev_store_log "WCPOS fork checkout is missing: $checkout"
            exit 1
        fi
        if ! sha="$(git -C "$checkout" rev-parse --verify "$fork_branch^{commit}")"; then
            dev_store_log "WCPOS fork branch is missing: $fork_branch"
            exit 1
        fi
        ref="$(jq -r '(.packages // .)[] | select(.name == "wcpos/woocommerce-pos") | .source.reference' \
            "$pro_dir/vendor/composer/installed.json")"
        if [[ -z "$ref" ]]; then
            dev_store_log 'WCPOS Pro bundled Free reference is empty.'
            exit 1
        fi
        if ! git -C "$checkout" cat-file -e "$ref^{commit}"; then
            dev_store_log "WCPOS Pro bundled Free commit $ref is missing; fetch upstream into the checkout."
            exit 1
        fi
        if ! git -C "$checkout" diff --quiet "$ref" "$sha" -- composer.json composer.lock php-scoper; then
            dev_store_log "The fork changes PHP dependencies since the commit Pro bundles ($ref to $sha); the overlay cannot carry them."
            exit 1
        fi
        if [[ ! -f "$marker" ]]; then
            mkdir -p "$backup_dir"
            rsync -a --delete "$free_dir/" "$backup_dir/"
        fi
        if [[ ! -d "$backup_dir" ]]; then
            dev_store_log "WCPOS Free backup is missing: $backup_dir"
            exit 1
        fi
        rsync -a --delete "$backup_dir/" "$free_dir/"
        tmp="$(mktemp -d)"
        trap 'rm -rf -- "$tmp"' EXIT
        git -C "$checkout" archive "$sha" | tar -x -C "$tmp"
        rsync -a --checksum --exclude-from="$tmp/.distignore" "$tmp/" "$free_dir/"
        printf '%s\n' "$sha" > "$marker"
        printf 'tally %s\n' "$sha"
        ;;
    restore)
        if [[ ! -f "$marker" ]]; then
            printf 'stock\n'
            exit 0
        fi
        if [[ ! -d "$backup_dir" ]]; then
            dev_store_log "WCPOS Free backup is missing: $backup_dir"
            exit 1
        fi
        rsync -a --delete "$backup_dir/" "$free_dir/"
        printf 'stock\n'
        ;;
esac
