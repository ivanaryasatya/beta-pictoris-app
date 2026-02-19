// Panel Switcher Logic
// Allows swapping widgets between grid slots dynamically.

const WIDGET_MAP = {
    'widget_comm': '📡 Communication',
    'widget_ops': '🤖 Robot Ops',
    'widget_auto': '🧩 Auto Sequencer',
    'widget_metrics': '📊 Metrics',
    'widget_imu': 'compass', // Using icon in name logic below
    'widget_term_sys': '🖥 System Log',
    'widget_camera': '📷 Camera',
    'widget_info': 'ℹ Robot Specs',
    'widget_custom': '➕ Custom Cmd',
    'widget_text': '📁 Text Storage'
};

document.addEventListener('DOMContentLoaded', () => {
    initPanelSwitcher();
});

function initPanelSwitcher() {
    const widgets = document.querySelectorAll('.widget');
    const widgetIds = Array.from(widgets).map(w => w.id);

    widgets.forEach(widget => {
        const header = widget.querySelector('.widget-header');
        if (!header) return;

        // Create Dropdown Container
        const switcherContainer = document.createElement('div');
        switcherContainer.className = 'panel-switcher-container';
        switcherContainer.style.marginLeft = '10px';
        switcherContainer.style.flex = '1'; // Allow it to take space if needed

        // Create Select Element
        const select = document.createElement('select');
        select.className = 'panel-select';
        select.style.padding = '2px 5px';
        select.style.fontSize = '12px';
        select.style.background = '#0f172a'; // Solid dark blue-black
        select.style.border = '1px solid #475569';
        select.style.color = '#f8fafc'; // Bright whiteish
        select.style.borderRadius = '4px';
        select.style.width = 'auto';
        select.style.cursor = 'pointer';
        select.style.outline = 'none';

        // Add class to styling via CSS if preferred, but inline for now:
        // Force option styles (some browsers ignore this but helpful)
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            .panel-select option {
                background: #0f172a;
                color: #f8fafc;
            }
        `;
        document.head.appendChild(styleEl);

        // Populate Options
        widgetIds.forEach(id => {
            const option = document.createElement('option');
            option.value = id;
            option.text = WIDGET_MAP[id] || id;
            if (id === 'widget_imu') option.text = '🧭 IMU'; // Correction
            select.appendChild(option);
        });

        // Set Current Value
        select.value = widget.id;

        // Add Change Listener
        select.addEventListener('change', (e) => {
            const targetId = e.target.value;
            const sourceId = widget.id; // self

            if (targetId !== sourceId) {
                swapWidgets(sourceId, targetId);
                // Reset this dropdown to its new identity (which is the sourceId, visually)
                // Actually, if we swap positions, the dropdown moves WITH the widget.
                // So if I am in Top-Left (Camera) and pick Terminal.
                // Camera Widget moves to Bottom-Right. Terminal moves to Top-Left.
                // The dropdown I just clicked is inside Camera Widget. It is now in Bottom-Right.
                // It should still say "Camera" because it is the Camera Widget.
                // The User wants to put "Terminal" HERE (Top-Left).
                // So logically, I am moving the *Other* widget *Here*.
                // So my dropdown should logic should be: "Bring X Here".
                // But typically dropdowns show "What is currently here".
                // If I select "Terminal", I expect this slot to become Terminal.
                // So yes, swapping is correct.

                // However, after swap, the dropdown in this physical DOM element (which just moved)
                // will show "Terminal" because I selected it? No.
                // The DOM element TEXT is "Camera" (if looking at header title).
                // The dropdown value is "Terminal".

                // We should probably reset the dropdown value back to the widget's own ID
                // to maintain consistency: "I am Camera Widget, currently located here."
                // "If you select Terminal, I will swap places with Terminal."
                e.target.value = sourceId;
            }
        });

        // Insert after Title (h3)
        // Layout: H3 - Switcher - Controls
        // header has justify-content: space-between.
        // H3 is first child. Controls is last child.
        // We want it maybe next to H3 or Controls?
        // Let's put it next to Controls.
        const controls = widget.querySelector('.widget-controls');
        header.insertBefore(switcherContainer, controls);
        switcherContainer.appendChild(select);
    });

    // Load any saved layout
    loadLayout();
}

function swapWidgets(id1, id2) {
    const el1 = document.getElementById(id1);
    const el2 = document.getElementById(id2);

    if (!el1 || !el2) return;

    // Get current Grid Areas
    // If not set in inline style, get from computed style
    // Note: CSS Grid definitions might be complex. 
    // Best way: Force explicit grid-areas on inline styles if not present.

    let area1 = el1.style.gridArea || window.getComputedStyle(el1).gridArea;
    let area2 = el2.style.gridArea || window.getComputedStyle(el2).gridArea;

    // Get visibility
    let display1 = el1.style.display || window.getComputedStyle(el1).display;
    let display2 = el2.style.display || window.getComputedStyle(el2).display;

    // Swap Grid Areas
    el1.style.gridArea = area2;
    el2.style.gridArea = area1;

    // Swap Visibility (in case one is hidden)
    if (display1 === 'none' && display2 !== 'none') {
        el1.style.display = display2; // Show 1
        el2.style.display = 'none';   // Hide 2
    } else if (display2 === 'none' && display1 !== 'none') {
        el2.style.display = display1; // Show 2
        el1.style.display = 'none';   // Hide 1
    }

    // Note: If both visible, display swap is irrelevant (usually 'flex' or 'block')
    // But good to preserve just in case.

    console.log(`Swapped ${id1} (${area1}) with ${id2} (${area2})`);
}

// Persist Layout Functions
function saveLayout() {
    const layout = {};
    const widgets = document.querySelectorAll('.widget');

    widgets.forEach(w => {
        // Only save grid area if it overrides default (inline style present)
        // Or actually save ALL current computed grid areas to be safe
        const style = w.style.gridArea;
        // If inline style is empty, it means it's using CSS default. 
        // But if we swapped, it WILL be in inline style.
        // So saving inline style is enough? 
        // If user never moved anything, inline style is empty.
        // If we save empty, on load we do nothing, which is correct (keeps default).
        if (style) {
            layout[w.id] = style;
        }

        // Also save visibility state for 'widget_custom' vs others?
        // Let's save visibility too just in case
        if (w.style.display) {
            if (!layout[w.id]) layout[w.id] = {};
            // Wait, simple key-value is easier for grid-area. 
            // Let's make value an object: { area: '...', display: '...' }
            layout[w.id] = {
                area: style,
                display: w.style.display
            };
        }
    });

    localStorage.setItem('dashboard_layout', JSON.stringify(layout));
    alert("Layout Saved as Default!");
}

function resetLayout() {
    if (confirm("Reset dashboard layout to factory default?")) {
        localStorage.removeItem('dashboard_layout');
        location.reload();
    }
}

function loadLayout() {
    const saved = localStorage.getItem('dashboard_layout');
    if (!saved) return;

    try {
        const layout = JSON.parse(saved);
        Object.keys(layout).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const data = layout[id];
                // Support both old format (string) and new format (object) if needed
                // But since we just wrote it, it's object.
                if (typeof data === 'object') {
                    if (data.area) el.style.gridArea = data.area;
                    if (data.display) el.style.display = data.display;
                } else {
                    el.style.gridArea = data;
                }
            }
        });
    } catch (e) {
        console.error("Failed to load layout", e);
    }
}
