<?php
/**
 * Admin interface for Flipbook Viewer
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class Flipbook_Viewer_Admin {

    /**
     * Instance of this class
     */
    private static $instance = null;

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
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            __('Flipbook Viewer Settings', 'flipbook-viewer'),
            __('Flipbook Viewer', 'flipbook-viewer'),
            'manage_options',
            'flipbook-viewer',
            array($this, 'render_settings_page')
        );
    }

    /**
     * Register settings
     */
    public function register_settings() {
        register_setting(
            'flipbook_viewer_options_group',
            'flipbook_viewer_options',
            array($this, 'sanitize_options')
        );

        // Display Section
        add_settings_section(
            'flipbook_viewer_display_section',
            __('Default Display Settings', 'flipbook-viewer'),
            array($this, 'render_display_section'),
            'flipbook-viewer'
        );

        // Width
        add_settings_field(
            'width',
            __('Width', 'flipbook-viewer'),
            array($this, 'render_width_field'),
            'flipbook-viewer',
            'flipbook_viewer_display_section'
        );

        // Height
        add_settings_field(
            'height',
            __('Height', 'flipbook-viewer'),
            array($this, 'render_height_field'),
            'flipbook-viewer',
            'flipbook_viewer_display_section'
        );

        // Background Color
        add_settings_field(
            'background_color',
            __('Background Color', 'flipbook-viewer'),
            array($this, 'render_background_color_field'),
            'flipbook-viewer',
            'flipbook_viewer_display_section'
        );

        // Box Color
        add_settings_field(
            'box_color',
            __('Box Color', 'flipbook-viewer'),
            array($this, 'render_box_color_field'),
            'flipbook-viewer',
            'flipbook_viewer_display_section'
        );

        // Box Border
        add_settings_field(
            'box_border',
            __('Box Border', 'flipbook-viewer'),
            array($this, 'render_box_border_field'),
            'flipbook-viewer',
            'flipbook_viewer_display_section'
        );

        // Layout Section
        add_settings_section(
            'flipbook_viewer_layout_section',
            __('Layout Settings', 'flipbook-viewer'),
            array($this, 'render_layout_section'),
            'flipbook-viewer'
        );

        // Layout Mode
        add_settings_field(
            'layout',
            __('Layout Mode', 'flipbook-viewer'),
            array($this, 'render_layout_field'),
            'flipbook-viewer',
            'flipbook_viewer_layout_section'
        );

        // Book Layout
        add_settings_field(
            'book_layout',
            __('Book Layout', 'flipbook-viewer'),
            array($this, 'render_book_layout_field'),
            'flipbook-viewer',
            'flipbook_viewer_layout_section'
        );

        // View Mode
        add_settings_field(
            'view_mode',
            __('View Mode', 'flipbook-viewer'),
            array($this, 'render_view_mode_field'),
            'flipbook-viewer',
            'flipbook_viewer_layout_section'
        );

        // Breakpoint
        add_settings_field(
            'breakpoint',
            __('Responsive Breakpoint', 'flipbook-viewer'),
            array($this, 'render_breakpoint_field'),
            'flipbook-viewer',
            'flipbook_viewer_layout_section'
        );

        // Enable Animations
        add_settings_field(
            'enable_animations',
            __('Enable Animations', 'flipbook-viewer'),
            array($this, 'render_animations_field'),
            'flipbook-viewer',
            'flipbook_viewer_layout_section'
        );

        // Margin
        add_settings_field(
            'margin',
            __('Margin', 'flipbook-viewer'),
            array($this, 'render_margin_field'),
            'flipbook-viewer',
            'flipbook_viewer_layout_section'
        );
    }

    /**
     * Sanitize options
     */
    public function sanitize_options($input) {
        $sanitized = array();

        if (isset($input['width'])) {
            $sanitized['width'] = sanitize_text_field($input['width']);
        }

        if (isset($input['height'])) {
            $sanitized['height'] = sanitize_text_field($input['height']);
        }

        if (isset($input['background_color'])) {
            $sanitized['background_color'] = sanitize_hex_color($input['background_color']);
        }

        if (isset($input['box_color'])) {
            $sanitized['box_color'] = sanitize_hex_color($input['box_color']);
        }

        if (isset($input['box_border'])) {
            $sanitized['box_border'] = intval($input['box_border']);
        }

        if (isset($input['margin'])) {
            $sanitized['margin'] = floatval($input['margin']);
        }

        if (isset($input['margin_top'])) {
            $sanitized['margin_top'] = $input['margin_top'] !== '' ? floatval($input['margin_top']) : null;
        }

        if (isset($input['margin_left'])) {
            $sanitized['margin_left'] = $input['margin_left'] !== '' ? floatval($input['margin_left']) : null;
        }

        if (isset($input['layout'])) {
            $sanitized['layout'] = in_array($input['layout'], array('auto', 'single', 'double')) ? $input['layout'] : 'auto';
        }

        if (isset($input['book_layout'])) {
            $sanitized['book_layout'] = in_array($input['book_layout'], array('traditional', 'spread')) ? $input['book_layout'] : 'traditional';
        }

        if (isset($input['view_mode'])) {
            $sanitized['view_mode'] = in_array($input['view_mode'], array('flipbook', 'singlepage')) ? $input['view_mode'] : 'flipbook';
        }

        if (isset($input['breakpoint'])) {
            $sanitized['breakpoint'] = intval($input['breakpoint']);
        }

        if (isset($input['enable_animations'])) {
            $sanitized['enable_animations'] = (bool) $input['enable_animations'];
        }

        return $sanitized;
    }

    /**
     * Render settings page
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        // Show success message
        if (isset($_GET['settings-updated'])) {
            add_settings_error(
                'flipbook_viewer_messages',
                'flipbook_viewer_message',
                __('Settings Saved', 'flipbook-viewer'),
                'updated'
            );
        }

        settings_errors('flipbook_viewer_messages');
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

            <div class="notice notice-info">
                <p>
                    <strong><?php _e('Shortcode Usage:', 'flipbook-viewer'); ?></strong><br>
                    <code>[flipbook pdf="URL_TO_PDF"]</code><br>
                    <br>
                    <strong><?php _e('Example with parameters:', 'flipbook-viewer'); ?></strong><br>
                    <code>[flipbook pdf="https://example.com/document.pdf" width="800px" height="600px" layout="double"]</code><br>
                    <br>
                    <strong><?php _e('Available parameters:', 'flipbook-viewer'); ?></strong><br>
                    <ul style="list-style: disc; margin-left: 20px;">
                        <li><code>pdf</code> - PDF URL (required)</li>
                        <li><code>width</code> - Width (default: 100%)</li>
                        <li><code>height</code> - Height (default: auto)</li>
                        <li><code>background_color</code> - Background color (hex)</li>
                        <li><code>box_color</code> - Box color (hex)</li>
                        <li><code>layout</code> - auto, single, or double</li>
                        <li><code>book_layout</code> - traditional or spread</li>
                        <li><code>view_mode</code> - flipbook or singlepage</li>
                        <li><code>breakpoint</code> - Container width breakpoint (px)</li>
                        <li><code>enable_animations</code> - true or false</li>
                    </ul>
                </p>
            </div>

            <form action="options.php" method="post">
                <?php
                settings_fields('flipbook_viewer_options_group');
                do_settings_sections('flipbook-viewer');
                submit_button(__('Save Settings', 'flipbook-viewer'));
                ?>
            </form>
        </div>
        <?php
    }

    /**
     * Section renderers
     */
    public function render_display_section() {
        echo '<p>' . __('Configure default display settings for the flipbook viewer. These can be overridden per shortcode.', 'flipbook-viewer') . '</p>';
    }

    public function render_layout_section() {
        echo '<p>' . __('Configure layout and behavior settings.', 'flipbook-viewer') . '</p>';
    }

    /**
     * Field renderers
     */
    public function render_width_field() {
        $options = get_option('flipbook_viewer_options', array());
        $value = isset($options['width']) ? $options['width'] : '100%';
        ?>
        <input type="text" name="flipbook_viewer_options[width]" value="<?php echo esc_attr($value); ?>" class="regular-text">
        <p class="description"><?php _e('Width of the viewer (e.g., 100%, 800px). Default: 100%', 'flipbook-viewer'); ?></p>
        <?php
    }

    public function render_height_field() {
        $options = get_option('flipbook_viewer_options', array());
        $value = isset($options['height']) ? $options['height'] : 'auto';
        ?>
        <input type="text" name="flipbook_viewer_options[height]" value="<?php echo esc_attr($value); ?>" class="regular-text">
        <p class="description"><?php _e('Height of the viewer (e.g., auto, 600px). Default: auto (fits aspect ratio)', 'flipbook-viewer'); ?></p>
        <?php
    }

    public function render_background_color_field() {
        $options = get_option('flipbook_viewer_options', array());
        $value = isset($options['background_color']) ? $options['background_color'] : '#353535';
        ?>
        <input type="text" name="flipbook_viewer_options[background_color]" value="<?php echo esc_attr($value); ?>" class="color-field">
        <p class="description"><?php _e('Background color (hex code). Default: #353535', 'flipbook-viewer'); ?></p>
        <?php
    }

    public function render_box_color_field() {
        $options = get_option('flipbook_viewer_options', array());
        $value = isset($options['box_color']) ? $options['box_color'] : '#353535';
        ?>
        <input type="text" name="flipbook_viewer_options[box_color]" value="<?php echo esc_attr($value); ?>" class="color-field">
        <p class="description"><?php _e('Box color (hex code). Default: #353535', 'flipbook-viewer'); ?></p>
        <?php
    }

    public function render_box_border_field() {
        $options = get_option('flipbook_viewer_options', array());
        $value = isset($options['box_border']) ? $options['box_border'] : 0;
        ?>
        <input type="number" name="flipbook_viewer_options[box_border]" value="<?php echo esc_attr($value); ?>" min="0" step="1">
        <p class="description"><?php _e('Border width in pixels. Default: 0', 'flipbook-viewer'); ?></p>
        <?php
    }

    public function render_layout_field() {
        $options = get_option('flipbook_viewer_options', array());
        $value = isset($options['layout']) ? $options['layout'] : 'auto';
        ?>
        <select name="flipbook_viewer_options[layout]">
            <option value="auto" <?php selected($value, 'auto'); ?>><?php _e('Auto (responsive)', 'flipbook-viewer'); ?></option>
            <option value="single" <?php selected($value, 'single'); ?>><?php _e('Single Page', 'flipbook-viewer'); ?></option>
            <option value="double" <?php selected($value, 'double'); ?>><?php _e('Double Page Spread', 'flipbook-viewer'); ?></option>
        </select>
        <p class="description"><?php _e('Page layout mode. Auto switches based on container width.', 'flipbook-viewer'); ?></p>
        <?php
    }

    public function render_book_layout_field() {
        $options = get_option('flipbook_viewer_options', array());
        $value = isset($options['book_layout']) ? $options['book_layout'] : 'traditional';
        ?>
        <select name="flipbook_viewer_options[book_layout]">
            <option value="traditional" <?php selected($value, 'traditional'); ?>><?php _e('Traditional (page 1 alone, then spreads)', 'flipbook-viewer'); ?></option>
            <option value="spread" <?php selected($value, 'spread'); ?>><?php _e('Spread (start with pages 1-2)', 'flipbook-viewer'); ?></option>
        </select>
        <p class="description"><?php _e('Book layout style. Traditional shows page 1 as cover, then 2-3, 4-5, etc.', 'flipbook-viewer'); ?></p>
        <?php
    }

    public function render_view_mode_field() {
        $options = get_option('flipbook_viewer_options', array());
        $value = isset($options['view_mode']) ? $options['view_mode'] : 'flipbook';
        ?>
        <select name="flipbook_viewer_options[view_mode]">
            <option value="flipbook" <?php selected($value, 'flipbook'); ?>><?php _e('Flipbook (animated pages)', 'flipbook-viewer'); ?></option>
            <option value="singlepage" <?php selected($value, 'singlepage'); ?>><?php _e('Single Page (scrollable)', 'flipbook-viewer'); ?></option>
        </select>
        <p class="description"><?php _e('Viewer mode. Flipbook shows animated page turns, Single Page shows scrollable pages.', 'flipbook-viewer'); ?></p>
        <?php
    }

    public function render_breakpoint_field() {
        $options = get_option('flipbook_viewer_options', array());
        $value = isset($options['breakpoint']) ? $options['breakpoint'] : 768;
        ?>
        <input type="number" name="flipbook_viewer_options[breakpoint]" value="<?php echo esc_attr($value); ?>" min="0" step="1">
        <p class="description"><?php _e('Container width (in pixels) below which to switch to single page layout when layout is "auto". Default: 768px', 'flipbook-viewer'); ?></p>
        <?php
    }

    public function render_animations_field() {
        $options = get_option('flipbook_viewer_options', array());
        $value = isset($options['enable_animations']) ? $options['enable_animations'] : true;
        ?>
        <label>
            <input type="checkbox" name="flipbook_viewer_options[enable_animations]" value="1" <?php checked($value, true); ?>>
            <?php _e('Enable flip animations (respects user prefers-reduced-motion setting)', 'flipbook-viewer'); ?>
        </label>
        <p class="description"><?php _e('When enabled, page flip animations will be shown unless the user has requested reduced motion in their system settings.', 'flipbook-viewer'); ?></p>
        <?php
    }

    public function render_margin_field() {
        $options = get_option('flipbook_viewer_options', array());
        $value = isset($options['margin']) ? $options['margin'] : 1;
        ?>
        <input type="number" name="flipbook_viewer_options[margin]" value="<?php echo esc_attr($value); ?>" min="0" step="0.1">
        <p class="description"><?php _e('Margin percentage around the viewer. Default: 1', 'flipbook-viewer'); ?></p>
        <?php
    }
}
