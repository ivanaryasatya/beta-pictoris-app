/**
 * Dummy Data Simulator
 * Simulates robot telemetry when in "Guest" mode or waiting for approvals.
 */

let dummyInterval = null;

function startDummyMode() {
    console.log("Starting Dummy Data Simulation...");

    // Clear any existing intervals
    if (dummyInterval) clearInterval(dummyInterval);

    dummyInterval = setInterval(() => {
        // Simulate Battery Drop
        let bat = 100 - (Date.now() % 100000) / 1000;
        updateChart('batteryChart', bat.toFixed(1));
        document.getElementById('val_batteryChart').innerText = Math.floor(bat) + '%';

        // Simulate Temperature
        let temp = 40 + Math.random() * 5;
        updateChart('tempChart', temp.toFixed(1));
        document.getElementById('val_tempChart').innerText = Math.floor(temp) + '°C';
        document.getElementById('val_core0Temp').innerText = (temp + Math.random()).toFixed(1) + '°C';
        document.getElementById('val_core1Temp').innerText = (temp - Math.random()).toFixed(1) + '°C';

        // Simulate Speed
        let speed = Math.floor(Math.random() * 50);
        updateChart('speedChart', speed);
        document.getElementById('val_speedChart').innerText = speed;

        // Simulate Signal
        let sig = -30 - Math.random() * 10;
        updateChart('signalChart', sig.toFixed(0));
        document.getElementById('val_signalChart').innerText = Math.floor(sig) + 'dB';

        // Simulate Ping
        let ping = 20 + Math.random() * 10;
        updateChart('pingChart', ping.toFixed(0));
        document.getElementById('val_pingChart').innerText = Math.floor(ping) + 'ms';

        // Simulate IMU
        if (typeof updateIMUDisplay === 'function') {
            updateIMUDisplay(
                Math.sin(Date.now() / 1000) * 10, // Roll
                Math.cos(Date.now() / 1000) * 5,  // Pitch
                (Date.now() / 100) % 360          // Yaw
            );
        }

    }, 1000);

    // Simulate Terminal Logs
    setInterval(() => {
        const logs = [
            "[SYSTEM] Heartbeat received...",
            "[SENSORS] IMU calibration OK",
            "[WIFI] Signal strength stable",
            "[MOTOR] Driver A temp normal",
            "[MOTOR] Driver B temp normal",
            "[BATTERY] Voltage check: 12.4V",
            "[CAM] Frame rate: 24fps"
        ];
        const randomLog = logs[Math.floor(Math.random() * logs.length)];
        logToTerminal(randomLog);
    }, 3000);
}

function stopDummyMode() {
    console.log("Stopping Dummy Data Simulation...");
    if (dummyInterval) clearInterval(dummyInterval);
    logToTerminal("[SYSTEM] Switched to REAL DATA MODE");
}

// Helper for Charts (Assumes charts.js structure)
function updateChart(chartId, value) {
    // This function assumes the charts global objects exist as window[chartId]
    // or similar. If not, charts.js needs to expose update methods.
    // For now, we try to find the chart instance if stored globally.
    // Ideally, charts.js should have a global update function.
    if (window[chartId] && window[chartId].data) {
        const chart = window[chartId];
        const now = new Date().toLocaleTimeString();
        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        chart.data.labels.push(now);
        chart.data.datasets[0].data.push(value);
        chart.update();
    }
}
