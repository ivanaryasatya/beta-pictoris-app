
// ===== INITIALIZATION & SIMULATION =====

// Initialize on load
// Initialize on load
// Initialize on load
window.addEventListener('load', function () {
    updateCommConfig();
    loadLayout();

    // Charts - Retry if library not loaded yet
    let chartAttempts = 0;
    const initCharts = () => {
        if (typeof Chart !== 'undefined') {
            createChart("batteryChart", "Battery %");
            createChart("tempChart", "Temperature °C");
            createChart("speedChart", "Speed RPM");
            createChart("signalChart", "Signal dBm");
            createChart("pingChart", "Ping ms");

            // New Diagnostics
            createChart("fanSpeedChart", "Fan Speed %");
            createChart("core0TempChart", "Core 0 °C");
            createChart("core1TempChart", "Core 1 °C");
            createChart("motorATempChart", "Mot A °C");
            createChart("motorBTempChart", "Mot B °C");

            console.log("Charts initialized successfully");
        } else if (chartAttempts < 10) {
            chartAttempts++;
            console.warn(`Chart.js not ready, retrying (${chartAttempts}/10)...`);
            setTimeout(initCharts, 500);
        } else {
            console.error("Chart.js failed to load after multiple attempts.");
        }
    };
    initCharts();
});

// Initialize 3D Scene
setTimeout(initIMU, 500);

// ===== SIMULATED DATA =====

setInterval(() => {
    // Charts
    updateChart('batteryChart', 50 + Math.random() * 50);
    updateChart('tempChart', 20 + Math.random() * 15);
    updateChart('speedChart', Math.random() * 300);
    updateChart('signalChart', -30 - Math.random() * 50);
    updateChart('pingChart', 5 + Math.random() * 50);

    // New Diagnostics Simulation
    updateChart('fanSpeedChart', Math.random() > 0.5 ? 100 : 0);
    updateChart('core0TempChart', 40 + Math.random() * 20);
    updateChart('core1TempChart', 40 + Math.random() * 20);
    updateChart('motorATempChart', 30 + Math.random() * 30);
    updateChart('motorBTempChart', 30 + Math.random() * 30);

    // Update Status Indicators Randomly
    const ball = Math.random() > 0.5;
    const mag = Math.random() > 0.5;
    const ready = Math.random() > 0.5;
    const locked = Math.random() > 0.7; // Occasional lock

    if (window.updateIndicator) {
        updateIndicator("indBall", ball);
        updateIndicator("indMag", mag);
        updateIndicator("indReady", ready);
        updateIndicator("indLocked", locked);
    }

    // Update Line Sensors
    if (window.updateLineSensors) {
        // Create array of 8 random 0/1
        const lineData = Array.from({ length: 8 }, () => Math.random() > 0.7 ? 1 : 0);
        if (window.robotState) window.robotState.line = lineData;
        updateLineSensors(lineData);
    }

    // Update Ultrasonic Sensors
    if (window.updateUltrasonic) {
        // Random distances 0-200cm
        const usData = [
            Math.random() * 200,
            Math.random() * 200,
            Math.random() * 200
        ];
        if (window.robotState) window.robotState.us = usData;
        updateUltrasonic(usData);
    }

    // Backend Logs
    if (Math.random() > 0.7) {
        const logs = [
            "KeepAlive Packet Received",
            "Sensor Data Processed: OK",
            "Motor Driver: Sync",
            "Battery Voltage Check: 12.4V",
            "Radio Signal: -45dBm",
            "Queue: 0 commands pending",
            "IMU: Calibration OK"
        ];
        logBackend(logs[Math.floor(Math.random() * logs.length)]);
    }

}, 1000); // 1s loop

// IMU Simulation (Faster loop)
let simRoll = 0, simPitch = 0, simYaw = 0;
setInterval(() => {
    // Random gentle movement
    simRoll += (Math.random() - 0.5) * 2;
    simPitch += (Math.random() - 0.5) * 2;
    simYaw += (Math.random() - 0.5) * 5;

    // Constrain/Loop for demo
    if (simRoll > 20) simRoll = 20; if (simRoll < -20) simRoll = -20;
    if (simPitch > 20) simPitch = 20; if (simPitch < -20) simPitch = -20;

    updateIMU(simRoll, simPitch, simYaw % 360);
}, 100);
