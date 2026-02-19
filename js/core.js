
// ===== DASHBOARD LOGIC =====

// PERSISTENCE
function saveLayout() {
    const order = Array.from(dashboard.children).map(w => w.id);
    localStorage.setItem('dashboard_layout', JSON.stringify(order));
}

function loadLayout() {
    const saved = localStorage.getItem('dashboard_layout');
    if (saved) {
        try {
            const order = JSON.parse(saved);
            order.forEach(id => {
                const el = document.getElementById(id);
                if (el) dashboard.appendChild(el);
            });
        } catch (e) {
            console.error("Error loading layout", e);
        }
    }
}

// DRAG & DROP
// DRAG & DROP (Event Delegation)
const dashboard = document.getElementById('dashboard');
let draggedWidget = null;
let isHandleDown = false;

document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.drag-handle')) {
        isHandleDown = true;
        const widget = e.target.closest('.widget');
        if (widget) widget.setAttribute('draggable', 'true');
    }
});

document.addEventListener('mouseup', () => {
    isHandleDown = false;
    if (draggedWidget) {
        draggedWidget.classList.remove('dragging');
        draggedWidget = null;
    }
});

document.addEventListener('dragstart', (e) => {
    const widget = e.target.closest('.widget');
    if (!widget || !isHandleDown) {
        e.preventDefault();
        return;
    }

    draggedWidget = widget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widget.id);
    setTimeout(() => widget.classList.add('dragging'), 0);
});

document.addEventListener('dragend', (e) => {
    const widget = e.target.closest('.widget');
    if (widget) widget.classList.remove('dragging');
    draggedWidget = null;
    isHandleDown = false;
    document.querySelectorAll('.widget').forEach(w => w.classList.remove('drag-over'));
    saveLayout();
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.widget');
    if (target && target !== draggedWidget && draggedWidget) {
        target.classList.add('drag-over');
    }
});

document.addEventListener('dragleave', (e) => {
    const target = e.target.closest('.widget');
    if (target) target.classList.remove('drag-over');
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target.closest('.widget');

    if (target && target !== draggedWidget && draggedWidget) {
        target.classList.remove('drag-over');

        // Reorder
        const all = Array.from(dashboard.querySelectorAll('.widget')); // Dynamic fetch
        const draggedIndex = all.indexOf(draggedWidget);
        const targetIndex = all.indexOf(target);

        if (draggedIndex < targetIndex) {
            dashboard.insertBefore(draggedWidget, target.nextSibling);
        } else {
            dashboard.insertBefore(draggedWidget, target);
        }
        saveLayout();
    }
});

// MAXIMIZE
function toggleMaximize(btn) {
    const widget = btn.closest('.widget');
    widget.classList.toggle('maximized');

    // Adjust icon
    if (widget.classList.contains('maximized')) {
        btn.innerText = "✖";
        btn.style.color = "red";
        // Ensure z-index wraps above everything
    } else {
        btn.innerText = "⛶";
        btn.style.color = "#94a3b8";
    }
}
