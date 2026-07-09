<?php
/**
 * Plugin Name: BWS PDF Viewer
 * Plugin URI: https://github.com/davidofchatham/bws-pdf-viewer
 * Description: Accessibility-compliant PDF viewer with animated page flip effects. Embed PDFs using shortcode with support for responsive layouts, keyboard navigation, and screen reader compatibility.
 * Version: 0.4.7
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: charles.lobo@gmail.com
 * Author URI: https://github.com/theproductiveprogrammer
 * License: MIT
 * Text Domain: bws-pdf-viewer
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('BWS_PDF_VIEWER_VERSION', '0.4.7');
define('BWS_PDF_VIEWER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('BWS_PDF_VIEWER_PLUGIN_URL', plugin_dir_url(__FILE__));
define('BWS_PDF_VIEWER_PLUGIN_BASENAME', plugin_basename(__FILE__));

// Asset cache-busting. When true, asset versions use filemtime() so every file
// save produces a fresh ?ver= (kills mobile/CDN staleness during testing where
// DevTools "disable cache" isn't available). Defaults to WP_DEBUG; overridable
// via the 'bws_pdf_viewer_dev_assets' filter. Leave false in production so the
// version constant drives cache-busting normally.
if (!defined('BWS_PDF_VIEWER_DEV_ASSETS')) {
    define('BWS_PDF_VIEWER_DEV_ASSETS', defined('WP_DEBUG') && WP_DEBUG);
}

/**
 * Main BWS PDF Viewer Class
 */
class BWS_PDF_Viewer {

    /**
     * Instance of this class
     */
    private static $instance = null;

    /**
     * Default options
     *
     * view_mode: 'document' (continuous scroll) | 'flipbook' (page-flip animation)
     * Note: 'singlepage' accepted as alias for 'document' for backward compatibility.
     */
    private $default_options = array(
        'width'                   => '100%',
        'height'                  => 'auto',
        'background_color'        => 'transparent',
        'box_color'               => 'transparent',
        'box_border'              => 0,
        'margin'                  => 1,
        'margin_top'              => null,
        'margin_left'             => null,
        'layout'                  => 'auto',        // auto, single, double
        'book_layout'             => 'traditional', // traditional (page 1 alone), spread (start with 1-2)
        'view_mode'               => 'document',    // document | flipbook
        'breakpoint'              => 768,           // px for container-based layout switching
        'enable_animations'       => true,          // respect prefers-reduced-motion
        'show_controls'           => true,          // show navigation controls toolbar
        'show_fullscreen'         => true,          // show fullscreen toggle button
        'show_print'              => true,          // show print button
        'default_show_controls'   => true,          // admin default for show_controls
        'default_show_fullscreen' => true,          // admin default for show_fullscreen
        'default_show_print'      => true,          // admin default for show_print
        'disabled_modes'          => array(),       // P3: site-wide disabled view modes
    );

    /**
     * Get instance
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructor
     */
    private function __construct() {
        $this->init();
    }

    /**
     * Initialize plugin
     */
    private function init() {
        // Load dependencies
        add_action('plugins_loaded', array($this, 'load_textdomain'));

        // Register scripts and styles
        add_action('wp_enqueue_scripts', array($this, 'register_assets'));

        // Register shortcode
        add_shortcode('bws_pdf', array($this, 'shortcode_handler'));

        // Admin interface
        if (is_admin()) {
            require_once BWS_PDF_VIEWER_PLUGIN_DIR . 'includes/admin.php';
            BWS_PDF_Viewer_Admin::get_instance();
        }
    }

    /**
     * Load plugin textdomain
     */
    public function load_textdomain() {
        load_plugin_textdomain('bws-pdf-viewer', false, dirname(BWS_PDF_VIEWER_PLUGIN_BASENAME) . '/languages');
    }

    /**
     * Asset version string for cache-busting.
     *
     * In dev mode (BWS_PDF_VIEWER_DEV_ASSETS, filterable via
     * 'bws_pdf_viewer_dev_assets') returns the file's filemtime so every save
     * busts the cache. Otherwise returns the plugin version constant.
     *
     * @param string $relative_path Path relative to the plugin dir, e.g. 'dist/pdf.js'.
     * @return string|int Version usable as the $ver arg to wp_register_script/style.
     */
    private function asset_version($relative_path) {
        $dev = apply_filters('bws_pdf_viewer_dev_assets', BWS_PDF_VIEWER_DEV_ASSETS);
        if ($dev) {
            $file = BWS_PDF_VIEWER_PLUGIN_DIR . $relative_path;
            $mtime = @filemtime($file);
            if ($mtime) {
                return $mtime;
            }
        }
        return BWS_PDF_VIEWER_VERSION;
    }

    /**
     * Register scripts and styles
     *
     * Plugin base URL is filterable via 'bws_pdf_viewer_plugin_url' to support
     * multi-domain deployments (e.g. BWS Portal System).
     */
    public function register_assets() {
        // Allow external plugins (e.g. BWS Portal System) to rewrite the plugin base URL.
        // The returned URL MUST end with a trailing slash.
        $plugin_url = apply_filters('bws_pdf_viewer_plugin_url', BWS_PDF_VIEWER_PLUGIN_URL);

        // PDF.js library with automatic worker setup (webpack.mjs zero-config approach)
        wp_register_script(
            'bws-pdfjs-lib',
            $plugin_url . 'dist/pdf.js',
            array(),
            $this->asset_version('dist/pdf.js'),
            true
        );

        // Core viewer bundle: all three render engines (flip + native + image)
        wp_register_script(
            'bws-pdf-viewer-lib',
            $plugin_url . 'dist/bws-viewer-engines.js',
            array(),
            $this->asset_version('dist/bws-viewer-engines.js'),
            true
        );

        // WordPress integration script (depends on PDF.js library)
        wp_register_script(
            'bws-pdf-viewer-wp',
            $plugin_url . 'includes/bws-pdf-viewer.js',
            array('bws-pdf-viewer-lib', 'bws-pdfjs-lib'),
            $this->asset_version('includes/bws-pdf-viewer.js'),
            true
        );

        // Styles
        wp_register_style(
            'bws-pdf-viewer',
            $plugin_url . 'includes/bws-pdf-viewer.css',
            array(),
            $this->asset_version('includes/bws-pdf-viewer.css')
        );

        // Pass plugin URL and config to JavaScript.
        // pluginUrl is already rewritten by the filter above so JS receives the correct base.
        wp_localize_script('bws-pdf-viewer-wp', 'bwsPdfViewerData', array(
            'pluginUrl' => $plugin_url,
            'ajaxUrl'   => admin_url('admin-ajax.php'),
            // Toolbar strings, run through WordPress translation. Keys mirror the
            // getStrings() reads in includes/bws-pdf-viewer.js; JS keeps English
            // fallbacks so a stale/absent payload still renders.
            'i18n'      => array(
                'toolbarLabel'        => __('PDF viewer controls', 'bws-pdf-viewer'),
                'prev'                => __('Previous', 'bws-pdf-viewer'),
                'prevLabel'           => __('Previous page', 'bws-pdf-viewer'),
                'next'                => __('Next', 'bws-pdf-viewer'),
                'nextLabel'           => __('Next page', 'bws-pdf-viewer'),
                'of'                  => __('of', 'bws-pdf-viewer'),
                'pageNumberLabel'     => __('Page number', 'bws-pdf-viewer'),
                'fullscreen'          => __('Fullscreen', 'bws-pdf-viewer'),
                'fullscreenLabel'     => __('Enter fullscreen', 'bws-pdf-viewer'),
                'exitFullscreen'      => __('Exit Fullscreen', 'bws-pdf-viewer'),
                'exitFullscreenLabel' => __('Exit fullscreen', 'bws-pdf-viewer'),
                'print'               => __('Print', 'bws-pdf-viewer'),
                'printLabel'          => __('Print PDF', 'bws-pdf-viewer'),
            ),
        ));
    }

    /**
     * Shortcode handler
     *
     * Format: [bws_pdf]https://example.com/doc.pdf[/bws_pdf]
     * Or with attributes: [bws_pdf view_mode="flipbook" show_fullscreen="true"]URL[/bws_pdf]
     *
     * The PDF source URL is the shortcode content (between opening and closing tags).
     * It is passed through the 'bws_pdf_viewer_pdf_url' filter before sanitisation,
     * allowing external plugins (e.g. BWS Portal System) to rewrite it for multi-domain use.
     */
    public function shortcode_handler($atts, $content = null) {
        // Get PDF URL from wrapped content
        $pdf_url = trim($content);

        // Return error markup immediately if no URL provided (no assets enqueued)
        if (empty($pdf_url)) {
            return '<p class="bws-pdf-viewer-error">' . esc_html__('Error: No PDF URL specified.', 'bws-pdf-viewer') . '</p>';
        }

        // Allow external plugins to rewrite the PDF URL (e.g. for multi-domain CDN delivery).
        // The filter receives the raw URL string; the returned value MUST be a valid URL.
        // For single-domain deployments where no filter is registered, $pdf_url is unchanged.
        $pdf_url = apply_filters('bws_pdf_viewer_pdf_url', $pdf_url);

        // Merge saved admin options over plugin defaults, then shortcode attributes over that
        $saved_options = get_option('bws_pdf_viewer_options', array());
        $defaults = array_merge($this->default_options, $saved_options);

        $atts = shortcode_atts(array(
            'width'            => $defaults['width'],
            'height'           => $defaults['height'],
            'background_color' => $defaults['background_color'],
            'box_color'        => $defaults['box_color'],
            'box_border'       => $defaults['box_border'],
            'margin'           => $defaults['margin'],
            'margin_top'       => $defaults['margin_top'],
            'margin_left'      => $defaults['margin_left'],
            'layout'           => $defaults['layout'],
            'book_layout'      => $defaults['book_layout'],
            'view_mode'        => $defaults['view_mode'],
            'breakpoint'       => $defaults['breakpoint'],
            'enable_animations'=> $defaults['enable_animations'],
            'show_controls'    => isset($defaults['default_show_controls']) ? $defaults['default_show_controls'] : true,
            'show_fullscreen'  => isset($defaults['default_show_fullscreen']) ? $defaults['default_show_fullscreen'] : true,
            'show_print'       => isset($defaults['default_show_print']) ? $defaults['default_show_print'] : true,
            'force_native'     => null, // 'true', 'false', or null for auto-detect
        ), $atts, 'bws_pdf');

        // Enqueue assets (PDF.js library includes worker via webpack.mjs zero-config)
        wp_enqueue_script('bws-pdfjs-lib');
        wp_enqueue_script('bws-pdf-viewer-lib');
        wp_enqueue_script('bws-pdf-viewer-wp');
        wp_enqueue_style('bws-pdf-viewer');

        // Generate unique ID for this instance
        static $instance_count = 0;
        $instance_count++;
        $instance_id = 'bws-pdf-viewer-' . $instance_count;

        // Normalise view_mode: accept legacy 'singlepage' as alias for 'document'
        $view_mode = $atts['view_mode'];
        if ($view_mode === 'singlepage') {
            $view_mode = 'document';
        }

        // Prepare JavaScript configuration object.
        // 'singlepage' boolean is retained for compatibility with the flipbook library routing
        // logic in src/index.js — it is derived from viewMode, not stored separately.
        $config = array(
            'pdf'              => esc_url_raw($pdf_url),
            'viewMode'         => $view_mode,
            'singlepage'       => ($view_mode === 'document'),
            'layout'           => $atts['layout'],
            'bookLayout'       => $atts['book_layout'],
            'width'            => $atts['width'],
            'height'           => $atts['height'],
            'backgroundColor'  => $atts['background_color'],
            'boxColor'         => $atts['box_color'],
            'boxBorder'        => intval($atts['box_border']),
            'margin'           => floatval($atts['margin']),
            'marginTop'        => $atts['margin_top'] !== null ? floatval($atts['margin_top']) : null,
            'marginLeft'       => $atts['margin_left'] !== null ? floatval($atts['margin_left']) : null,
            'breakpoint'       => intval($atts['breakpoint']),
            'enableAnimations' => filter_var($atts['enable_animations'], FILTER_VALIDATE_BOOLEAN),
            'showControls'     => filter_var($atts['show_controls'], FILTER_VALIDATE_BOOLEAN),
            'showFullscreen'   => filter_var($atts['show_fullscreen'], FILTER_VALIDATE_BOOLEAN),
            'showPrint'        => filter_var($atts['show_print'], FILTER_VALIDATE_BOOLEAN),
            'forceNative'      => $atts['force_native'],
        );

        // Output container with loading indicator and data-config attribute.
        // The loading indicator is removed by JS after successful viewer initialisation.
        // Only emit an inline width when one is actually set: an empty width (admin
        // field cleared) must NOT produce style="width: ;" — that broken declaration
        // collapses the flex container to its content width, left-pinning a narrow
        // canvas (B16). With no inline width the CSS default (width:100%) fills the
        // parent and the JS derives the canvas from the container width.
        $width_attr = ($atts['width'] === '' || $atts['width'] === null)
            ? ''
            : sprintf(' style="width: %s;"', esc_attr($atts['width']));
        $output = sprintf(
            '<div id="%1$s" class="bws-pdf-viewer-container" data-config="%2$s"%3$s>'
                . '<div class="bws-pdf-viewer-loading"><span>%4$s</span></div>'
            . '</div>',
            esc_attr($instance_id),
            esc_attr(wp_json_encode($config)),
            $width_attr,
            esc_html__('Loading PDF…', 'bws-pdf-viewer')
        );

        return $output;
    }

    /**
     * Get default options
     */
    public function get_default_options() {
        return $this->default_options;
    }
}

/**
 * Initialize plugin
 */
function bws_pdf_viewer_init() {
    bws_pdf_viewer_setup_update_checker();
    return BWS_PDF_Viewer::get_instance();
}

/**
 * Wire up in-dashboard update notices and one-click updates via Plugin Update
 * Checker, sourced from GitHub Releases. The release ZIP attached by
 * .github/workflows/release.yml on each `v*` tag is named
 * bws-pdf-viewer-<version>.zip, so match the asset by regex rather than PUC's
 * exact-name auto-picker. The slug must equal the installed plugin folder
 * (bws-pdf-viewer).
 */
function bws_pdf_viewer_setup_update_checker() {
    $loader = BWS_PDF_VIEWER_PLUGIN_DIR . 'libs/plugin-update-checker/load-v5p7.php';
    if (!file_exists($loader)) {
        return;
    }
    require_once $loader;

    $update_checker = \YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
        'https://github.com/davidofchatham/bws-pdf-viewer/',
        __FILE__,
        'bws-pdf-viewer'
    );

    // Use GitHub Releases (not branch tips) and the attached versioned ZIP asset.
    $update_checker->getVcsApi()->enableReleaseAssets('/bws-pdf-viewer-[\d.]+\.zip/');
}

// Start the plugin
add_action('plugins_loaded', 'bws_pdf_viewer_init');

/**
 * Activation hook
 */
register_activation_hook(__FILE__, function() {
    $existing_options = get_option('bws_pdf_viewer_options', array());
    $default_options  = BWS_PDF_Viewer::get_instance()->get_default_options();

    if (empty($existing_options)) {
        // Fresh install — use all defaults
        add_option('bws_pdf_viewer_options', $default_options);
    } else {
        // Upgrade — preserve existing settings, add new keys
        $merged_options = array_merge($default_options, $existing_options);
        update_option('bws_pdf_viewer_options', $merged_options);
    }
});

/**
 * Deactivation hook
 */
register_deactivation_hook(__FILE__, function() {
    // Options are preserved on deactivation
});
