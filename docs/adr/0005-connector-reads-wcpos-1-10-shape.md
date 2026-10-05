# 0005. The connector reads the WCPOS 1.10.x product shape, fixed in TallyUI

Status: Accepted
Date: 2026-10-06

## Context and decision

`@tallyui/connector-woocommerce@3.0.0` requires a top-level `uuid` on every product and reads the barcode from a top-level `barcode`. The released WCPOS Free plugin, 1.10.20, sends neither:
- The uuid is only in `meta_data` as `_woocommerce_pos_uuid`.
- `wcpos/v2` omits `barcode`; the value is in WooCommerce's `global_unique_id`.

So every product failed with `WooMissingUuidError`, and nothing synced from a released store. The write-up, with the plugin source lines and live evidence from the dev store, is `~/agent/handoff/tallyui-woocommerce-G1a-connector-uuid-2026-10-06.md`.

The front desk ruled on 2026-10-06 that the fix belongs in the connector, not in this app. PLAN.md's principle 3 says G1–G8 target the released 1.10.x wire shape, and a shim here would break ADR 0001's rule that the connector is the only WooCommerce integration point. The rule the connector now follows:
- The uuid is the top-level `uuid` if present, else the `_woocommerce_pos_uuid` meta.
- The barcode is the top-level `barcode` if present, else `global_unique_id`.

Top-level fields, which are the WCPOS 2.0 shape, still win. The fix ships as TallyUI 3.0.1, and this app moves to 3.0.1 in one PR.
