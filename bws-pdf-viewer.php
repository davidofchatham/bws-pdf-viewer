<?php
/**
 * Plugin Name: BWS PDF Viewer
 * Plugin URI: https://github.com/davidofchatham/bws-flipbook-viewer
 * Description: Amazing flip book PDF viewer with animated pages. Embed PDFs using shortcode with support for responsive layouts and accessibility features.
 * Version: 2.0.0
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
define('BWS_PDF_VIEWER_VERSION', '2.0.0');
define('BWS_PDF_VIEWER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('BWS_PDF_VIEWER_PLUGIN_URL', plugin_dir_url(__FILE__));
define('BWS_PDF_VIEWER_PLUGIN_BASENAME', plugin_basename(__FILE__));

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
     * Register scripts and styles
     */
    public function register_assets() {
        // PDF.js library (main library, must be loaded first)
        wp_register_script(
            'bws-pdfjs-lib',
            BWS_PDF_VIEWER_PLUGIN_URL . 'dist/pdf.js',
            array(),
            BWS_PDF_VIEWER_VERSION,
            true
        );

        // PDF.js worker
        wp_register_script(
            'bws-pdfjs-worker',
            BWS_PDF_VIEWER_PLUGIN_URL . 'dist/pdf.worker.js',
            array(),
            BWS_PDF_VIEWER_VERSION,
            true
        );

        // Flipbook viewer library
        wp_register_script(
            'bws-pdf-viewer-lib',
            BWS_PDF_VIEWER_PLUGIN_URL . 'dist/flipbook-viewer.js',
            array(),
            BWS_PDF_VIEWER_VERSION,
            true
        );

        // WordPress integration script (depends on PDF.js library)
        wp_register_script(
            'bws-pdf-viewer-wp',
            BWS_PDF_VIEWER_PLUGIN_URL . 'includes/bws-pdf-viewer.js',
            array('bws-pdf-viewer-lib', 'bws-pdfjs-lib', 'bws-pdfjs-worker'),
            BWS_PDF_VIEWER_VERSION,
            true
        );

        // Styles
        wp_register_style(
            'bws-pdf-viewer',
            BWS_PDF_VIEWER_PLUGIN_URL . 'includes/bws-pdf-viewer.css',
            array(),
            BWS_PDF_VIEWER_VERSION
        );

        // Pass plugin URL to JavaScript
        wp_localize_script('bws-pdf-viewer-wp', 'bwsPdfViewerData', array(
            'pluginUrl' => BWS_PDF_VIEWER_PLUGIN_URL,
            'ajaxUrl' => admin_url('admin-ajax.php'),
        ));
    }

    /**
     * Shortcode handler
     * Format: [bws_pdf]https://example.com/doc.pdf[/bws_pdf]
     * Or with attributes: [bws_pdf width="800px" layout="double"]https://example.com/doc.pdf[/bws_pdf]
     */
    public function shortcode_handler($atts, $content = null) {
        // Get PDF URL from wrapped content
        $pdf_url = trim($content);

        // Parse attributes with defaults
        $saved_options = get_option('bws_pdf_viewer_options', array());
        $defaults = array_merge($this->default_options, $saved_options);

        $atts = shortcode_atts(array(
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
        ), $atts, 'bws_pdf');

        // Validate PDF URL
        if (empty($pdf_url)) {
            return '<p class="bws-pdf-viewer-error">' . esc_html__('Error: No PDF URL specified.', 'bws-pdf-viewer') . '</p>';
        }

        // Enqueue assets (PDF.js library must be loaded first)
        wp_enqueue_script('bws-pdfjs-lib');
        wp_enqueue_script('bws-pdfjs-worker');
        wp_enqueue_script('bws-pdf-viewer-lib');
        wp_enqueue_script('bws-pdf-viewer-wp');
        wp_enqueue_style('bws-pdf-viewer');

        // Generate unique ID for this instance
        static $instance_count = 0;
        $instance_count++;
        $instance_id = 'bws-pdf-viewer-' . $instance_count;

        // Prepare configuration
        $config = array(
            'pdf' => esc_url($pdf_url),
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
            '<div id="%s" class="bws-pdf-viewer-container" data-config="%s" style="width: %s;"></div>',
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
function bws_pdf_viewer_init() {
    return BWS_PDF_Viewer::get_instance();
}

// Start the plugin
add_action('plugins_loaded', 'bws_pdf_viewer_init');

/**
 * Activation hook
 */
register_activation_hook(__FILE__, function() {
    // Set default options on activation
    $default_options = BWS_PDF_Viewer::get_instance()->get_default_options();
    add_option('bws_pdf_viewer_options', $default_options);
});

/**
 * Deactivation hook
 */
register_deactivation_hook(__FILE__, function() {
    // Cleanup if needed (keeping options for now)
});
