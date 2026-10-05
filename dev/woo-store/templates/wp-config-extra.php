// Tailscale Funnel terminates TLS; Caddy forwards X-Forwarded-Proto (ADR 0003).
if ( isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) && 'https' === $_SERVER['HTTP_X_FORWARDED_PROTO'] ) {
	$_SERVER['HTTPS'] = 'on';
}
define( 'WP_ENVIRONMENT_TYPE', 'development' );
define( 'DISALLOW_FILE_EDIT', true );
define( 'AUTOMATIC_UPDATER_DISABLED', true );
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', '@LOG@/wp-debug.log' );
define( 'WP_DEBUG_DISPLAY', false );
