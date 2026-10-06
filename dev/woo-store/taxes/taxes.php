<?php

global $wpdb;
$mode = $args[0];
$product_taxes = [
    'BAK-CRO' => ['reduced-rate', 'taxable'],
    'MER-TOT' => ['zero-rate', 'taxable'],
    'BAK-BAN' => ['', 'none'],
];

if (in_array($mode, ['on', 'off'], true)) {
    foreach ([
        'woocommerce_store_address' => '1 Market Street',
        'woocommerce_store_city' => 'San Francisco',
        'woocommerce_default_country' => 'US:CA',
        'woocommerce_store_postcode' => '94105',
    ] as $option => $value) {
        update_option($option, $value);
    }

    foreach (['reduced-rate' => 'Reduced rate', 'zero-rate' => 'Zero rate'] as $slug => $name) {
        if (!in_array($slug, WC_Tax::get_tax_class_slugs(), true)) {
            WC_Tax::create_tax_class($name, $slug);
        }
    }

    // Name, class, rate, priority, compound, shipping. All rates are US / CA.
    foreach ([
        ['CA State', '', '7.2500', 1, 0, 1],
        ['SF District', '', '1.3750', 2, 0, 1],
        ['CA Reduced', 'reduced-rate', '5.5000', 1, 0, 0],
        ['Compound Test', '', '2.0000', 3, 1, 0],
        ['Zero', 'zero-rate', '0.0000', 1, 0, 0],
    ] as [$name, $class, $rate, $priority, $compound, $shipping]) {
        $rate_id = $wpdb->get_var($wpdb->prepare(
            "SELECT tax_rate_id FROM {$wpdb->prefix}woocommerce_tax_rates
             WHERE tax_rate_country = %s AND tax_rate_state = %s AND tax_rate_class = %s
             AND tax_rate_priority = %d AND tax_rate_name = %s LIMIT 1",
            'US', 'CA', $class, $priority, $name
        ));
        if (!$rate_id) {
            $rate_id = WC_Tax::_insert_tax_rate([
                'tax_rate_country' => 'US',
                'tax_rate_state' => 'CA',
                'tax_rate_class' => $class,
                'tax_rate_name' => $name,
                'tax_rate' => $rate,
                'tax_rate_priority' => $priority,
                'tax_rate_compound' => $compound,
                'tax_rate_shipping' => $shipping,
            ]);
        }
        if ($name === 'SF District') {
            WC_Tax::_update_tax_rate_postcodes($rate_id, '94105');
            WC_Tax::_update_tax_rate_cities($rate_id, 'SAN FRANCISCO');
        }
    }

    foreach ($product_taxes as $sku => [$class, $status]) {
        $product = wc_get_product(wc_get_product_id_by_sku($sku));
        if ($product->get_tax_class() !== $class || $product->get_tax_status() !== $status) {
            $product->set_tax_class($class);
            $product->set_tax_status($status);
            $product->save();
        }
    }

    foreach ([
        'TEN' => ['discount_type' => 'percent', 'amount' => 10, 'minimum_amount' => '10.00'],
        'FIVEOFF' => ['discount_type' => 'fixed_cart', 'amount' => '5.00'],
        'MUG2' => ['discount_type' => 'fixed_product', 'amount' => '2.00', 'product_ids' => [wc_get_product_id_by_sku('MER-MUG')]],
        'EXPIRED' => ['discount_type' => 'percent', 'amount' => 50, 'date_expires' => strtotime('yesterday')],
        'ONCE' => ['discount_type' => 'percent', 'amount' => 20, 'usage_limit' => 1, 'usage_count' => 1],
    ] as $code => $properties) {
        $coupon = new WC_Coupon($code);
        if (!$coupon->get_id()) {
            $coupon->set_props($properties);
            $coupon->save();
        }
    }

    update_option('woocommerce_calc_taxes', $mode === 'on' ? 'yes' : 'no');
    if ($mode === 'on') {
        foreach ([
            'woocommerce_prices_include_tax' => 'no',
            'woocommerce_tax_round_at_subtotal' => 'no',
            'woocommerce_tax_based_on' => 'base',
            'woocommerce_tax_display_shop' => 'excl',
            'woocommerce_tax_display_cart' => 'excl',
        ] as $option => $value) {
            update_option($option, $value);
        }
    }
}

$result = [];
foreach (['calc_taxes', 'prices_include_tax', 'tax_round_at_subtotal', 'tax_based_on'] as $option) {
    $result[$option] = get_option('woocommerce_' . $option);
}
$result['tax_rates'] = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}woocommerce_tax_rates");
$result['coupon_codes'] = wp_list_pluck(get_posts([
    'post_type' => 'shop_coupon', 'posts_per_page' => -1, 'orderby' => 'title', 'order' => 'ASC',
]), 'post_title');
foreach ($product_taxes as $sku => $taxes) {
    $product = wc_get_product(wc_get_product_id_by_sku($sku));
    $result['products'][$sku] = [
        'tax_class' => $product->get_tax_class(),
        'tax_status' => $product->get_tax_status(),
    ];
}
echo wp_json_encode($result) . "\n";
