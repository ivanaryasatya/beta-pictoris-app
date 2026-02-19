
// ===== CHART CREATOR =====
const charts = {}; // Store chart instances
const chartStatus = {}; // Store pause status

function createChart(id, label) {
    chartStatus[id] = true; // Active by default

    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js not loaded. Skipping chart creation for " + id);
        return null;
    }

    const ctx = document.getElementById(id).getContext('2d');
    charts[id] = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: label, data: [], borderColor: 'cyan', tension: 0.4, pointRadius: 0 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: { display: false },
                y: { grid: { color: '#334155' }, min: 0 } // Added min 0 for better scaling
            },
            plugins: { legend: { display: false } }
        }
    });
    return charts[id];
}

// CHART ZOOM FIX
let zoomPlaceholder = document.createElement("div");

function toggleZoom(wrapper) {
    let backdrop = document.getElementById("backdrop");

    // Check if already zoomed
    if (wrapper.classList.contains("zoomed")) {
        // UNZOOM
        wrapper.classList.remove("zoomed");
        backdrop.classList.remove("active");

        // Move back to placeholder
        if (zoomPlaceholder.parentNode) {
            zoomPlaceholder.parentNode.replaceChild(wrapper, zoomPlaceholder);
        }
    } else {
        // ZOOM IN
        // Unzoom others first
        closeAllZooms();

        // Create placeholder to hold spot
        wrapper.parentNode.insertBefore(zoomPlaceholder, wrapper);

        // Move to body to escape stacking context
        document.body.appendChild(wrapper);

        wrapper.classList.add("zoomed");
        backdrop.classList.add("active");
    }
}

function closeAllZooms() {
    // Find any zoomed wrapper in body
    const zoomed = document.querySelector(".chart-wrapper.zoomed");
    if (zoomed) {
        toggleZoom(zoomed); // Toggle it off
    }
    document.getElementById("backdrop").classList.remove("active");
    document.getElementById("keySettingsModal").style.display = "none";
}

function toggleChart(id, isActive) {
    chartStatus[id] = isActive;
}

function updateChart(id, value) {
    // 1. Update Text Value (Independent of Chart rendering)
    const valEl = document.getElementById('val_' + id);
    if (valEl) valEl.innerText = value.toFixed(1) + (id.includes('Temp') ? '' : (id.includes('Speed') ? '' : (id.includes('signal') ? '' : '%')));
    // Note: The suffix handling is a bit loose here, relying on existing HTML content is better but we are overwriting it.
    // Actually, distinct units are hardcoded in the HTML "0%", "0°C". 
    // Let's just update the number and keep the unit if possible? 
    // The current code `valEl.innerText = value.toFixed(1)` overwrites everything including %.
    // Let's stick to simple overwrite for now as per previous logic, or improve it.
    // The previous code was: `if (valEl) valEl.innerText = value.toFixed(1);`
    // Let's keep it simple.

    // 2. Check Pause Status
    if (!chartStatus[id]) return;

    // 3. Update Chart
    const chart = charts[id];
    if (!chart) return;

    if (chart.data.labels.length > 20) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.data.labels.push("");
    chart.data.datasets[0].data.push(value);
    chart.update();
}

function updateIndicator(id, isActive) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isActive) {
        el.style.color = "#4ade80"; // Green
        el.style.opacity = "1";
    } else {
        el.style.color = "#ef4444"; // Red
        el.style.opacity = "0.5";
    }
}

function updateLineSensors(sensors) {
    // Expects array of 8 booleans/ints [1, 0, 1, ...]

    // Global Disable Check (Accessed from robot-ops.js)
    if (window.lineConfig && !window.lineConfig.enabled) {
        for (let i = 0; i < 8; i++) {
            const el = document.getElementById(`line_${i}`);
            if (el) {
                el.style.background = "#334155"; // Grey/Off
                el.style.boxShadow = "none";
                el.style.opacity = "0.2"; // Dimmed
            }
        }
        return;
    }

    for (let i = 0; i < 8; i++) {
        const el = document.getElementById(`line_${i}`);
        if (el) {
            // Check Mask
            if (window.lineConfig && window.lineConfig.mask[i] === 0) {
                el.style.background = "#334155";
                el.style.boxShadow = "none";
                el.style.opacity = "0.2"; // Dimmed if masked
                continue;
            } else {
                el.style.opacity = "1";
            }

            const isActive = sensors[i] > 0;
            // Detects Line = Cyan/Green. No Line = Dark/Red.
            el.style.background = isActive ? "#22d3ee" : "#334155";
            el.style.boxShadow = isActive ? "0 0 10px #22d3ee" : "none";
        }
    }
}
