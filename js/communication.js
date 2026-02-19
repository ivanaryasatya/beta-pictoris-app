// ===== COMMUNICATION =====
window.socket = null; // Expose globally for terminals.js
window.robotState = { line: [], us: [] };
const commConfig = {
    wifi: [
        { label: "SSID", type: "text", id: "wifi_ssid", placeholder: "Network Name" },
        { label: "Password", type: "password", id: "wifi_pass", placeholder: "WPA2 Key" },
        { label: "IP Address", type: "text", id: "wifi_ip", placeholder: "192.168.1.100 (Optional)" }
    ],
    bt_classic: [
        { label: "Device Name", type: "text", id: "bt_name", placeholder: "ESP32-Robot" },
        { label: "MAC Address", type: "text", id: "bt_mac", placeholder: "00:11:22:33:44:55" }
    ],
    bt_le: [
        { label: "Device Name", type: "text", id: "ble_name", placeholder: "BLE-Robot" },
        { label: "Service UUID", type: "text", id: "ble_service", placeholder: "Expected Service UUID" }
    ],
    esp_now: [
        { label: "Peer MAC", type: "text", id: "esp_peer", placeholder: "FF:FF:FF:FF:FF:FF" },
        { label: "Channel", type: "number", id: "esp_chan", placeholder: "1", min: 1, max: 14 },
        { label: "LMK Key", type: "password", id: "esp_lmk", placeholder: "Optional Key" }
    ],
    radio: [
        { label: "Frequency", type: "number", id: "radio_freq", placeholder: "433 / 868 / 915 MHz" },
        { label: "Address/Pipe", type: "text", id: "radio_addr", placeholder: "0xF0F0F0F0E1" }
    ],
    serial: [
        { label: "COM Port", type: "text", id: "ser_port", placeholder: "COM3 / /dev/ttyUSB0" },
        { label: "Baud Rate", type: "select", id: "ser_baud", options: ["9600", "115200", "57600", "230400"] }
    ]
};

function updateCommConfig() {
    const type = document.getElementById("commType").value;
    const container = document.getElementById("commConfigInputs");
    container.innerHTML = "";

    const fields = commConfig[type] || [];

    fields.forEach(field => {
        let wrapper = document.createElement("div");
        wrapper.style.marginBottom = "5px";

        let lbl = document.createElement("label");
        lbl.innerText = field.label;
        lbl.style.display = "block";
        lbl.style.fontSize = "12px";
        lbl.style.color = "#cbd5e1";

        let input;
        if (field.type === "select") {
            input = document.createElement("select");
            input.style.width = "100%";
            field.options.forEach(opt => {
                let o = document.createElement("option");
                o.value = opt;
                o.innerText = opt;
                input.appendChild(o);
            });
        } else {
            input = document.createElement("input");
            input.type = field.type;
            input.placeholder = field.placeholder;
            input.style.width = "100%";
            input.style.boxSizing = "border-box"; // Fix padding overflow
            if (field.min) input.min = field.min;
            if (field.max) input.max = field.max;
        }
        input.id = field.id;

        wrapper.appendChild(lbl);
        wrapper.appendChild(input);
        container.appendChild(wrapper);
    });

    // Reset status on change
    disconnectComm();
}

let isConnected = false;
let socket = null;

function connectComm() {
    if (isConnected) {
        disconnectComm();
        return;
    }

    const type = document.getElementById("commType").value;
    const fields = commConfig[type];
    let details = [];
    let valid = true;
    let validIP = "";

    // Validation & Data Collection
    fields.forEach(field => {
        let el = document.getElementById(field.id);
        if (!el.value && field.type !== "password" && !field.placeholder.includes("Optional")) {
            el.style.border = "1px solid red";
            valid = false;
        } else {
            el.style.border = "none";
            if (field.type !== "password") {
                details.push(`<strong>${field.label}:</strong> ${el.value || "Default"}`);
            }
            if (field.id === "wifi_ip") validIP = el.value;
        }
    });

    if (!valid) return alert("Please fill in required fields.");

    // WIFI CONNECTION (WebSocket)
    if (type === "wifi") {
        document.getElementById("commStatus").innerText = "Connecting...";

        try {
            socket = new WebSocket(`ws://${validIP}:81`);

            socket.onopen = function (e) {
                isConnected = true;
                updateConnectionUI(type, details, true);
                logBackend("WiFi Connected: " + validIP);
            };

            socket.onmessage = function (event) {
                flashRx(); // Visual Indicator
                try {
                    const msg = JSON.parse(event.data);

                    // Route Data
                    if (msg.type === "imu") {
                        if (window.updateIMU) updateIMU(msg.roll, msg.pitch, msg.yaw);
                    } else if (msg.type === "telemetry") {
                        if (window.updateChart) {
                            if (msg.battery) updateChart('batteryChart', msg.battery);
                            if (msg.temp) updateChart('tempChart', msg.temp);
                            if (msg.speed) updateChart('speedChart', msg.speed);
                            if (msg.signal) updateChart('signalChart', msg.signal);
                            if (msg.ping) updateChart('pingChart', msg.ping);

                            // New Diagnostics
                            if (msg.fan) updateChart('fanSpeedChart', msg.fan);
                            if (msg.core0) updateChart('core0TempChart', msg.core0);
                            if (msg.core1) updateChart('core1TempChart', msg.core1);
                            if (msg.mota) updateChart('motorATempChart', msg.mota);
                            if (msg.motb) updateChart('motorBTempChart', msg.motb);
                        }
                        // Indicators
                        if (window.updateIndicator) {
                            if (msg.ball !== undefined) updateIndicator("indBall", msg.ball);
                            if (msg.mag !== undefined) updateIndicator("indMag", msg.mag);
                            if (msg.ready !== undefined) updateIndicator("indReady", msg.ready);
                            if (msg.locked !== undefined) updateIndicator("indLocked", msg.locked); // New
                        }
                        // Line Sensors
                        if (window.updateLineSensors && msg.line) {
                            window.robotState.line = msg.line;
                            updateLineSensors(msg.line);
                        }
                        // Ultrasonic Sensors
                        if (window.updateUltrasonic && msg.us) {
                            window.robotState.us = msg.us;
                            updateUltrasonic(msg.us);
                        }
                    } else if (msg.type === "log") {
                        logBackend(msg.data);
                    }
                } catch (e) {
                    // Plain text fallback
                    logBackend("RX: " + event.data);
                }
            };

            socket.onclose = function (event) {
                if (isConnected) {
                    logBackend("WiFi Connection Closed");
                    disconnectComm();
                }
            };

            socket.onerror = function (error) {
                console.error("WebSocket Error", error);
                logBackend("WiFi Error");
            };

        } catch (e) {
            alert("Invalid IP Address or WebSocket Error");
            return;
        }

        // SERIAL CONNECTION (Web Serial API)
    } else if (type === "serial") {
        if ("serial" in navigator) {
            connectSerial(document.getElementById("ser_baud").value);
        } else {
            alert("Web Serial API not supported in this browser. Try Chrome or Edge.");
        }

    } else {
        // SIMULATION FOR OTHER TYPES
        isConnected = true;
        updateConnectionUI(type, details, true);
        sendCommand(`SYSTEM: Simulated Connected via ${type}`);
    }
}

function updateConnectionUI(type, details, connected) {
    if (connected) {
        document.getElementById("commStatus").innerText = "Connected";
        document.getElementById("commStatus").style.color = "#4ade80"; // Green

        document.getElementById("activeConnectionDisplay").style.borderLeft = "4px solid #4ade80";
        document.getElementById("activeConnectionDisplay").style.background = "#1e293b";

        document.getElementById("commDetails").innerHTML = `
            Type: ${type.toUpperCase().replace("_", " ")}<br>
            ${details.join("<br>")}
        `;

        document.querySelector("#commConfigInputs").style.opacity = "0.5";
        document.querySelector("#commConfigInputs").style.pointerEvents = "none";
        document.querySelector("button[onclick='connectComm()']").innerText = "Disconnect";
        document.getElementById("commType").disabled = true;
    } else {
        document.getElementById("commStatus").innerText = "Disconnected";
        document.getElementById("commStatus").style.color = "white";

        document.getElementById("activeConnectionDisplay").style.borderLeft = "4px solid #ef4444"; // Red
        document.getElementById("activeConnectionDisplay").style.background = "transparent";
        document.getElementById("commDetails").innerHTML = "";
        document.querySelector("#commConfigInputs").style.opacity = "1";
        document.querySelector("#commConfigInputs").style.pointerEvents = "all";
        document.querySelector("button[onclick='connectComm()']").innerText = "Connect";
        document.getElementById("commType").disabled = false;
    }
}

// ===== SERIAL FUNCTIONS =====
let port;
let reader;
let inputStream;
let outputStream;
let isSerialClosing = false;

async function connectSerial(baudRate) {
    try {
        // If we already have a port open, try to close it first
        if (port && port.readable) {
            await disconnectComm();
        }

        port = await navigator.serial.requestPort();
        await port.open({ baudRate: parseInt(baudRate) });

        isConnected = true;
        isSerialClosing = false;
        updateConnectionUI("serial", [`Baud: ${baudRate}`], true);
        logBackend("Serial Connected");

        // Setup Read Loop
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        inputStream = textDecoder.readable;

        readLoop();

    } catch (err) {
        console.error("Serial Connection Error:", err);
        logBackend("Serial Error: " + err.message);
        disconnectComm();
    }
}

async function readLoop() {
    reader = inputStream.getReader();
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                // Allow the serial port to be closed later.
                break;
            }
            if (value) {
                handleSerialData(value);
            }
        }
    } catch (error) {
        console.error("Read Error:", error);
    } finally {
        reader.releaseLock();
    }
}

function handleSerialData(data) {
    // Flash RX
    flashRx();

    if (!window.serialBuffer) window.serialBuffer = "";
    window.serialBuffer += data;

    let lines = window.serialBuffer.split('\n');
    window.serialBuffer = lines.pop();

    lines.forEach(line => {
        if (!line.trim()) return;
        try {
            const msg = JSON.parse(line);
            if (msg.type === "imu" && window.updateIMU) updateIMU(msg.roll, msg.pitch, msg.yaw);
            else if (msg.type === "telemetry") {
                if (window.updateChart) {
                    if (msg.battery) updateChart('batteryChart', msg.battery);
                    if (msg.temp) updateChart('tempChart', msg.temp);
                    if (msg.speed) updateChart('speedChart', msg.speed);
                    if (msg.signal) updateChart('signalChart', msg.signal);
                    if (msg.ping) updateChart('pingChart', msg.ping);

                    // New Diagnostics
                    if (msg.fan) updateChart('fanSpeedChart', msg.fan);
                    if (msg.core0) updateChart('core0TempChart', msg.core0);
                    if (msg.core1) updateChart('core1TempChart', msg.core1);
                    if (msg.mota) updateChart('motorATempChart', msg.mota);
                    if (msg.motb) updateChart('motorBTempChart', msg.motb);
                }
            }
            else if (msg.type === "log") logBackend(msg.data);
            else logBackend("RX: " + line);
        } catch (e) {
            logBackend("RX: " + line.trim());
        }
    });
}

async function disconnectComm() {
    // Prevent recursive calls or multiple clicks
    if (isSerialClosing) return;

    isConnected = false;

    // Disconnect WebSocket
    if (socket) {
        socket.close();
        socket = null;
    }

    // Disconnect Serial
    if (port) {
        isSerialClosing = true;
        try {
            if (reader) {
                await reader.cancel();
                // reader.releaseLock() is called in readLoop finally block
                reader = null;
            }
            if (inputStream) {
                inputStream = null;
            }

            await port.close();
            port = null;
            logBackend("Serial Closed");
        } catch (e) {
            console.error("Serial Close Error:", e);
        } finally {
            isSerialClosing = false;
        }
    }

    updateConnectionUI("", [], false);
}

// FIREBASE COMMAND QUEUE
window.sendCommandToFirebase = function (fullCmd) {
    if (!window.firebase || !window.database) {
        console.warn("[DEBUG] Firebase not initialized or database missing");
        return;
    }

    console.log("[DEBUG] Processing Firebase Command:", fullCmd);

    // Get Short Code
    let encoded = encodeCommand(fullCmd);
    let code = encoded.code;
    let val = encoded.val;

    if (!code) {
        console.warn("[DEBUG] No Short Code found for:", fullCmd);
        return; // Only send mapped commands
    }

    let finalCode = code;
    if (val !== undefined && val !== null && val !== 1) { // 1 is default flag
        finalCode = `${code}:${val}`;
    }

    const cmdRef = database.ref('/controlPanel/command');

    cmdRef.transaction((currentString) => {
        let currentData;
        try {
            // Attempt to parse existing string, or default to empty array
            currentData = JSON.parse(currentString || "[]");
        } catch (e) {
            currentData = [];
        }

        if (!Array.isArray(currentData)) currentData = [];

        // Add new command [Code, Status]
        // Status "0" = Pending
        currentData.push([finalCode, "0"]);

        // Keep max 50
        while (currentData.length > 50) currentData.shift();

        // Return as String
        return JSON.stringify(currentData);
    }, (error, committed, snapshot) => {
        if (error) {
            console.error('Firebase Transaction failed abnormally!', error);
        } else if (!committed) {
            console.warn('Firebase Transaction aborted (likely conflict).');
        } else {
            console.log('[DEBUG] Command queued to Firebase:', finalCode);
        }
    });
}

// DATA INDICATORS
let rxTimeout, txTimeout;

function flashRx() {
    const el = document.getElementById("rxIndicator");
    if (el) {
        el.style.color = "#22c55e"; // Green
        el.style.textShadow = "0 0 5px #22c55e";
        clearTimeout(rxTimeout);
        rxTimeout = setTimeout(() => {
            el.style.color = "#334155";
            el.style.textShadow = "none";
        }, 100);
    }
}

function flashTx() {
    const el = document.getElementById("txIndicator");
    if (el) {
        el.style.color = "#3b82f6"; // Blue
        el.style.textShadow = "0 0 5px #3b82f6";
        clearTimeout(txTimeout);
        txTimeout = setTimeout(() => {
            el.style.color = "#334155";
            el.style.textShadow = "none";
        }, 100);
    }
}

// Global Send Wrapper to trigger TX Indicator
window.sendData = function (key, val) {
    if (typeof sendCommand === 'function') {
        if (val !== undefined) sendCommand(`${key}:${val}`);
        else sendCommand(key);
        flashTx();
    } else {
        console.warn("sendCommand not available");
    }
};
