<?php
/**
 * Plugin Name: Dev store mail log
 * Dev-store-only mu-plugin installed by up.sh that never sends mail.
 */

add_filter('pre_wp_mail', function ($return, $atts) {
    $to = is_array($atts['to']) ? $atts['to'] : explode(',', $atts['to']);
    $headers = is_array($atts['headers']) ? $atts['headers'] : explode(',', $atts['headers']);
    $attachments = is_array($atts['attachments'])
        ? $atts['attachments']
        : array_filter(explode("\n", str_replace("\r\n", "\n", $atts['attachments'])));
    $line = wp_json_encode([
        'time' => gmdate('c'),
        'to' => array_values(array_map('trim', $to)),
        'subject' => $atts['subject'],
        'headers' => array_values(array_map('trim', $headers)),
        'attachments' => count($attachments),
        'body_bytes' => strlen($atts['message']),
        'body_has' => ['order' => preg_match('/\border\b/i', $atts['message']) === 1],
    ]);
    $path = '@LOG@/mail.log';
    if (@file_put_contents($path, $line . "\n", FILE_APPEND | LOCK_EX) === false) {
        error_log('Dev store mail log: could not append to ' . $path);
    }
    return true;
}, 10, 2);
