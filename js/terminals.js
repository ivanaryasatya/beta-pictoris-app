
// ===== TERMINAL =====
// ===== TERMINAL =====
function sendCommand(cmd) {
    // FIREBASE OVERRIDE (Parallel)
    console.log("[DEBUG] sendCommand called with:", cmd);
    if (typeof sendCommandToFirebase === 'function') {
        console.log("[DEBUG] Calling sendCommandToFirebase");
        sendCommandToFirebase(cmd);
    } else {
        console.warn("[DEBUG] sendCommandToFirebase is NOT a function");
    }

    let t = document.getElementById("terminal");
    let time = new Date().toLocaleTimeString();
    t.innerHTML += `[${time}] (${document.getElementById("commType").value}) > ${cmd}<br>`;

    // Auto-scroll check
    const autoScroll = document.getElementById('autoScrollLogs');
    if (autoScroll && autoScroll.checked) {
        t.scrollTop = t.scrollHeight;
    }

    // Send via WebSocket if connected
    if (window.socket && window.socket.readyState === WebSocket.OPEN) {
        window.socket.send(cmd);
    }

    // Send via Serial if connected
    if (window.port && window.port.writable) {
        const encoder = new TextEncoder();
        const writer = window.port.writable.getWriter();
        writer.write(encoder.encode(cmd + "\n")); // Add newline
        writer.releaseLock();
    }

    // Flash TX Indicator
    if (typeof flashTx === 'function') flashTx();
}

// BACKEND LOGS
function logBackend(msg) {
    const t = document.getElementById("terminal");
    if (!t) return;
    const time = new Date().toLocaleTimeString();
    t.innerHTML += `<span style="color:#22d3ee">[${time}] [SYS] ${msg}</span><br>`;

    // Auto-scroll check
    const autoScroll = document.getElementById('autoScrollLogs');
    if (autoScroll && autoScroll.checked) {
        t.scrollTop = t.scrollHeight;
    }
}
