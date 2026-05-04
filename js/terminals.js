
// ===== TERMINAL =====

// Command history for up/down navigation
let termHistory = [];
let termHistoryIdx = -1;

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
    t.innerHTML += `<span style="color:#38bdf8">[${time}]</span> <span style="color:#4ade80">TX›</span> <span style="color:#f8fafc">${escapeHtml(cmd)}</span><br>`;

    // Auto-scroll check
    _termAutoScroll();

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

// Called from the terminal input bar
function sendTerminalInput() {
    const input = document.getElementById("terminalInput");
    if (!input) return;
    const cmd = input.value.trim();
    if (!cmd) return;

    // Save to history
    if (termHistory[0] !== cmd) {
        termHistory.unshift(cmd);
        if (termHistory.length > 100) termHistory.pop();
    }
    termHistoryIdx = -1;

    input.value = "";
    sendCommand(cmd);
    input.focus();
}

// Handle Enter & Up/Down history in terminal input
function handleTerminalKey(event) {
    const input = document.getElementById("terminalInput");
    if (!input) return;

    if (event.key === "Enter") {
        event.preventDefault();
        sendTerminalInput();
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (termHistory.length > 0) {
            termHistoryIdx = Math.min(termHistoryIdx + 1, termHistory.length - 1);
            input.value = termHistory[termHistoryIdx];
        }
    } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (termHistoryIdx > 0) {
            termHistoryIdx--;
            input.value = termHistory[termHistoryIdx];
        } else {
            termHistoryIdx = -1;
            input.value = "";
        }
    }
}

// Clear terminal output
function clearTerminal() {
    const t = document.getElementById("terminal");
    if (!t) return;
    t.innerHTML = `<span style="color:#475569; font-size:11px;">━━━ Terminal Cleared ━━━</span><br>`;
}

// Log incoming (RX) data from serial/WebSocket — raw line display
function logRx(line) {
    const t = document.getElementById("terminal");
    if (!t) return;
    const time = new Date().toLocaleTimeString();
    t.innerHTML += `<span style="color:#38bdf8">[${time}]</span> <span style="color:#f59e0b">RX‹</span> <span style="color:#d1fae5">${escapeHtml(line)}</span><br>`;
    _termAutoScroll();
}

// BACKEND LOGS (system messages, SYS events)
function logBackend(msg) {
    const t = document.getElementById("terminal");
    if (!t) return;
    const time = new Date().toLocaleTimeString();
    t.innerHTML += `<span style="color:#38bdf8">[${time}]</span> <span style="color:#22d3ee">SYS›</span> <span style="color:#94a3b8">${escapeHtml(String(msg))}</span><br>`;
    _termAutoScroll();
}

// Helper: auto scroll if checkbox checked
function _termAutoScroll() {
    const t = document.getElementById("terminal");
    const autoScroll = document.getElementById('autoScrollLogs');
    if (t && autoScroll && autoScroll.checked) {
        t.scrollTop = t.scrollHeight;
    }
}

// Helper: prevent XSS in terminal output
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
