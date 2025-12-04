<?php
/**
 * Plugin Name: Flipbook Viewer
 * Plugin URI: https://github.com/theproductiveprogrammer/flipbook-viewer
 * Description: Amazing flip book component with animated pages. Embed PDFs using shortcode with support for responsive layouts and accessibility features.
 * Version: 2.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: charles.lobo@gmail.com
 * Author URI: https://github.com/theproductiveprogrammer
 * License: MIT
 * Text Domain: flipbook-viewer
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('FLIPBOOK_VIEWER_VERSION', '2.0.0');
define('FLIPBOOK_VIEWER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('FLIPBOOK_VIEWER_PLUGIN_URL', plugin_dir_url(__FILE__));
define('FLIPBOOK_VIEWER_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main Flipbook Viewer Class
 */
class Flipbook_Viewer {

    /**
     * Instance of this class
     */
    private static $instance = null;

    /**
     * Default options
     */
    private $default_options = array(
        'width' => '100%',
        'height' => 'auto',
        'background_color' => '#353535',
        'box_color' => '#353535',
        'box_border' => 0,
        'margin' => 1,
        'margin_top' => null,
        'margin_left' => null,
        'layout' => 'auto', // auto, single, double
        'book_layout' => 'traditional', // traditional (page 1 alone), spread (start with 1-2)
        'view_mode' => 'flipbook', // flipbook, singlepage
        'breakpoint' => 768, // px for container-based layout switching
        'enable_animations' => true, // respect prefers-reduced-motion
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
        add_shortcode('flipbook', array($this, 'shortcode_handler'));

        // Admin interface
        if (is_admin()) {
            require_once FLIPBOOK_VIEWER_PLUGIN_DIR . 'includes/admin.php';
            Flipbook_Viewer_Admin::get_instance();
        }
    }

    /**
     * Load plugin textdomain
     */
    public function load_textdomain() {
        load_plugin_textdomain('flipbook-viewer', false, dirname(FLIPBOOK_VIEWER_PLUGIN_BASENAME) . '/languages');
    }

    /**
     * Register scripts and styles
     */
    public function register_assets() {
        // PDF.js worker
        wp_register_script(
            'pdfjs-worker',
            FLIPBOOK_VIEWER_PLUGIN_URL . 'dist/pdf.worker.js',
            array(),
            FLIPBOOK_VIEWER_VERSION,
            true
        );

        // Flipbook viewer library
        wp_register_script(
            'flipbook-viewer-lib',
            FLIPBOOK_VIEWER_PLUGIN_URL . 'dist/flipbook-viewer.js',
            array(),
            FLIPBOOK_VIEWER_VERSION,
            true
        );

        // WordPress integration script
        wp_register_script(
            'flipbook-viewer-wp',
            FLIPBOOK_VIEWER_PLUGIN_URL . 'includes/flipbook-wp.js',
            array('flipbook-viewer-lib', 'pdfjs-worker'),
            FLIPBOOK_VIEWER_VERSION,
            true
        );

        // Styles
        wp_register_style(
            'flipbook-viewer',
            FLIPBOOK_VIEWER_PLUGIN_URL . 'includes/flipbook-viewer.css',
            array(),
            FLIPBOOK_VIEWER_VERSION
        );

        // Pass plugin URL to JavaScript
        wp_localize_script('flipbook-viewer-wp', 'flipbookViewerData', array(
            'pluginUrl' => FLIPBOOK_VIEWER_PLUGIN_URL,
            'ajaxUrl' => admin_url('admin-ajax.php'),
        ));
    }

    /**
     * Shortcode handler
     */
    public function shortcode_handler($atts, $content = null) {
        // Parse attributes with defaults
        $saved_options = get_option('flipbook_viewer_options', array());
        $defaults = array_merge($this->default_options, $saved_options);

        $atts = shortcode_atts(array(
            'pdf' => '',
            'width' => $defaults['width'],
            'height' => $defaults['height'],
            'background_color' => $defaults['background_color'],
            'box_color' => $defaults['box_color'],
            'box_border' => $defaults['box_border'],
            'margin' => $defaults['margin'],
            'margin_top' => $defaults['margin_top'],
            'margin_left' => $defaults['margin_left'],
            'layout' => $defaults['layout'],
            'book_layout' => $defaults['book_layout'],
            'view_mode' => $defaults['view_mode'],
            'breakpoint' => $defaults['breakpoint'],
            'enable_animations' => $defaults['enable_animations'],
        ), $atts, 'flipbook');

        // Validate PDF URL
        if (empty($atts['pdf'])) {
            return '<p class="flipbook-error">' . esc_html__('Error: No PDF URL specified.', 'flipbook-viewer') . '</p>';
        }

        // Enqueue assets
        wp_enqueue_script('pdfjs-worker');
        wp_enqueue_script('flipbook-viewer-lib');
        wp_enqueue_script('flipbook-viewer-wp');
        wp_enqueue_style('flipbook-viewer');

        // Generate unique ID for this instance
        static $instance_count = 0;
        $instance_count++;
        $instance_id = 'flipbook-' . $instance_count;

        // Prepare configuration
        $config = array(
            'pdf' => esc_url($atts['pdf']),
            'width' => $atts['width'],
            'height' => $atts['height'],
            'backgroundColor' => $atts['background_color'],
            'boxColor' => $atts['box_color'],
            'boxBorder' => intval($atts['box_border']),
            'margin' => floatval($atts['margin']),
            'marginTop' => $atts['margin_top'] !== null ? floatval($atts['margin_top']) : null,
            'marginLeft' => $atts['margin_left'] !== null ? floatval($atts['margin_left']) : null,
            'layout' => $atts['layout'],
            'bookLayout' => $atts['book_layout'],
            'viewMode' => $atts['view_mode'],
            'breakpoint' => intval($atts['breakpoint']),
            'enableAnimations' => filter_var($atts['enable_animations'], FILTER_VALIDATE_BOOLEAN),
            'singlepage' => ($atts['view_mode'] === 'singlepage'),
        );

        // Output container with data attributes
        $output = sprintf(
            '<div id="%s" class="flipbook-viewer-container" data-config="%s" style="width: %s;"></div>',
            esc_attr($instance_id),
            esc_attr(wp_json_encode($config)),
            esc_attr($atts['width'])
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
function flipbook_viewer_init() {
    return Flipbook_Viewer::get_instance();
}

// Start the plugin
add_action('plugins_loaded', 'flipbook_viewer_init');

/**
 * Activation hook
 */
register_activation_hook(__FILE__, function() {
    // Set default options on activation
    $default_options = Flipbook_Viewer::get_instance()->get_default_options();
    add_option('flipbook_viewer_options', $default_options);
});

/**
 * Deactivation hook
 */
register_deactivation_hook(__FILE__, function() {
    // Cleanup if needed (keeping options for now)
});
