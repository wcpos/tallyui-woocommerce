<?php

foreach (wc_get_products([
    'limit' => -1,
    'status' => 'any',
    'type' => array_keys(wc_get_product_types()),
]) as $product) {
    foreach ($product->get_children() as $child_id) {
        wc_get_product($child_id)->delete(true);
    }
    $product->delete(true);
}

foreach (get_posts([
    'post_type' => 'attachment',
    'post_status' => 'any',
    'posts_per_page' => -1,
    'meta_key' => '_tallyui_seed',
    'meta_value' => '1',
    'fields' => 'ids',
]) as $attachment_id) {
    wp_delete_attachment($attachment_id, true);
}

$colours = ['Coffee' => '#6F4E37', 'Bakery' => '#D9A441', 'Merch' => '#2F5D8A'];
$categories = [];
foreach ($colours as $name => $colour) {
    $term = term_exists($name, 'product_cat');
    if (!$term) {
        $term = wp_insert_term($name, 'product_cat');
    }
    $categories[$name] = (int) $term['term_id'];
}

// Name, category, SKU, regular price, sale price, stock, status.
$catalogue = [
    ['Espresso', 'Coffee', 'COF-ESP', '3.00', '', 100, 'publish'],
    ['Flat White', 'Coffee', 'COF-FLW', '4.50', '', 100, 'publish'],
    ['Cold Brew', 'Coffee', 'COF-CLD', '5.00', '4.00', 40, 'publish'],
    ['Croissant', 'Bakery', 'BAK-CRO', '3.50', '', 24, 'publish'],
    ['Blueberry Muffin', 'Bakery', 'BAK-MUF', '3.75', '', 18, 'publish'],
    ['Banana Bread', 'Bakery', 'BAK-BAN', '4.25', '', 0, 'publish'],
    ['Coffee Beans 250g', 'Merch', 'MER-BEA250', '14.00', '', 30, 'publish'],
    ['Ceramic Mug', 'Merch', 'MER-MUG', '12.00', '', 15, 'publish'],
    ['Tote Bag', 'Merch', 'MER-TOT', '15.00', '', 20, 'publish'],
    ['Gift Card 25', 'Merch', 'MER-GC25', '25.00', '', null, 'publish'],
    ['Seasonal Special', 'Bakery', 'BAK-SEA', '6.00', '', 10, 'draft'],
    ['T-Shirt', 'Merch', 'MER-TEE', '25.00', '', null, 'publish'],
    ['Hoodie', 'Merch', 'MER-HOD', '45.00', '', null, 'publish'],
];
$variable_attributes = [
    'MER-TEE' => ['Size' => ['S', 'M', 'L'], 'Colour' => ['Black', 'White']],
    'MER-HOD' => ['Size' => ['S', 'M', 'L']],
];
$variation_data = [
    'MER-TEE' => [
        ['MER-TEE-S-BLK', ['size' => 'S', 'colour' => 'Black']],
        ['MER-TEE-S-WHT', ['size' => 'S', 'colour' => 'White']],
        ['MER-TEE-M-BLK', ['size' => 'M', 'colour' => 'Black']],
        ['MER-TEE-M-WHT', ['size' => 'M', 'colour' => 'White']],
        ['MER-TEE-L-BLK', ['size' => 'L', 'colour' => 'Black']],
        ['MER-TEE-L-WHT', ['size' => 'L', 'colour' => 'White']],
    ],
    'MER-HOD' => [
        ['MER-HOD-S', ['size' => 'S']],
        ['MER-HOD-M', ['size' => 'M']],
        ['MER-HOD-L', ['size' => 'L']],
    ],
];

require_once ABSPATH . 'wp-admin/includes/image.php';
$items = [];
$published = 0;
$draft = 0;
$variation_count = 0;
foreach ($catalogue as [$name, $category, $sku, $price, $sale, $stock, $status]) {
    $variable = isset($variable_attributes[$sku]);
    $product = $variable ? new WC_Product_Variable() : new WC_Product_Simple();
    $product->set_name($name);
    $product->set_sku($sku);
    $product->set_status($status);
    $product->set_catalog_visibility('visible');
    $product->set_category_ids([$categories[$category]]);
    $product->set_regular_price($price);
    $product->set_sale_price($sale);
    $product->set_manage_stock($stock !== null);
    $product->set_stock_quantity($stock);
    $product->set_virtual($sku === 'MER-GC25');
    if ($variable) {
        $attributes = [];
        foreach ($variable_attributes[$sku] as $attribute_name => $options) {
            $attribute = new WC_Product_Attribute();
            $attribute->set_name($attribute_name);
            $attribute->set_options($options);
            $attribute->set_position(count($attributes));
            $attribute->set_visible(true);
            $attribute->set_variation(true);
            $attributes[] = $attribute;
        }
        $product->set_attributes($attributes);
    }
    $product_id = $product->save();
    $items[] = $product;
    if ($status === 'publish') {
        $published++;
    } else {
        $draft++;
    }

    // Draw at half size so GD's built-in font is legible on the final image.
    $small = imagecreatetruecolor(300, 300);
    [$red, $green, $blue] = sscanf($colours[$category], '#%02x%02x%02x');
    $background = imagecolorallocate($small, $red, $green, $blue);
    imagefill($small, 0, 0, $background);
    $white = imagecolorallocate($small, 255, 255, 255);
    imagestring(
        $small,
        5,
        (int) ((300 - imagefontwidth(5) * strlen($name)) / 2),
        (int) ((300 - imagefontheight(5)) / 2),
        $name,
        $white
    );
    $image = imagecreatetruecolor(600, 600);
    imagecopyresampled($image, $small, 0, 0, 0, 0, 600, 600, 300, 300);
    ob_start();
    imagepng($image);
    $png = ob_get_clean();
    imagedestroy($small);
    imagedestroy($image);
    $upload = wp_upload_bits(sanitize_title($name) . '.png', null, $png);
    $attachment_id = wp_insert_attachment([
        'post_title' => $name,
        'post_mime_type' => 'image/png',
        'post_status' => 'inherit',
    ], $upload['file'], $product_id);
    wp_update_attachment_metadata(
        $attachment_id,
        wp_generate_attachment_metadata($attachment_id, $upload['file'])
    );
    update_post_meta($attachment_id, '_tallyui_seed', '1');
    $product->set_image_id($attachment_id);

    if ($variable) {
        foreach ($variation_data[$sku] as [$variation_sku, $attributes]) {
            $variation = new WC_Product_Variation();
            $variation->set_parent_id($product_id);
            $variation->set_sku($variation_sku);
            $variation->set_status('publish');
            $variation->set_catalog_visibility('visible');
            $variation->set_attributes($attributes);
            $variation->set_regular_price($price);
            $variation->set_manage_stock(true);
            $variation->set_stock_quantity(10);
            $variation->save();
            $items[] = $variation;
            $variation_count++;
        }
        WC_Product_Variable::sync($product_id);
    }
}

foreach ($items as $index => $item) {
    $barcode = '200000000' . sprintf('%03d', $index + 1);
    $sum = 0;
    for ($digit = 0; $digit < 12; $digit++) {
        $sum += (int) $barcode[$digit] * ($digit % 2 === 0 ? 1 : 3);
    }
    $barcode .= (10 - $sum % 10) % 10;
    $item->set_global_unique_id($barcode);
    $item->save();
}

// The app explicitly sends the receipt; WooCommerce's own POS-order emails would duplicate it.
// WCPOS → Settings → Checkout → Customer emails controls those emails.
$checkout_settings = get_option('woocommerce_pos_settings_checkout', array());
if (!is_array($checkout_settings)) {
    $checkout_settings = array();
}
$checkout_settings['customer_emails']['enabled'] = false;
update_option('woocommerce_pos_settings_checkout', $checkout_settings);

update_option('tallyui_dev_seeded', gmdate('c'));
printf(
    "seeded %d products (%d published, %d draft) and %d variations\n",
    $published + $draft,
    $published,
    $draft,
    $variation_count
);
