// ===== AUTONOMOUS SEQUENCER =====

let autoSequence = [];
let isRunning = false;

// Command Types
const CMD_TYPES = {
    MOVE_FORWARD: { label: "Move Forward", icon: "⬆", hasVal: false },
    MOVE_BACKWARD: { label: "Move Backward", icon: "⬇", hasVal: false },
    TURN_LEFT: { label: "Turn Left", icon: "⬅", hasVal: false },
    TURN_RIGHT: { label: "Turn Right", icon: "➡", hasVal: false },
    STOP: { label: "Stop", icon: "⏹", hasVal: false },
    SHOOT: { label: "Shoot", icon: "🎯", hasVal: false },
    WAIT: { label: "Wait (Time)", icon: "⏳", hasVal: true, unit: "ms" },
    WAIT_US_LESS: { label: "Wait US < Dist", icon: "📏", hasVal: true, unit: "cm" }, // Validates against any sensor < val
    WAIT_US_MORE: { label: "Wait US > Dist", icon: "📏", hasVal: true, unit: "cm" }
};

function addCommand(type) {
    const cmd = {
        id: Date.now() + Math.random(),
        type: type,
        val: 1000 // Default value
    };
    autoSequence.push(cmd);
    renderSequence();
}

function removeCommand(id) {
    autoSequence = autoSequence.filter(c => c.id !== id);
    renderSequence();
}

function updateCommandVal(id, val) {
    const cmd = autoSequence.find(c => c.id === id);
    if (cmd) cmd.val = parseInt(val);
}

function renderSequence() {
    const list = document.getElementById("autoSequenceList");
    if (!list) return;
    list.innerHTML = "";

    autoSequence.forEach((cmd, index) => {
        const def = CMD_TYPES[cmd.type];

        const el = document.createElement("div");
        el.className = "auto-cmd-item";
        el.style.background = "#1e293b";
        el.style.padding = "10px";
        el.style.marginBottom = "5px";
        el.style.borderRadius = "5px";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.gap = "10px";
        el.style.borderLeft = "4px solid #3b82f6";

        el.innerHTML = `
            <span style="font-size:16px;">${def.icon}</span>
            <span style="flex-grow:1; font-size:12px; color:#cbd5e1;">${def.label}</span>
            ${def.hasVal ? `<input type="number" value="${cmd.val}" style="width:60px; padding:4px;" onchange="updateCommandVal(${cmd.id}, this.value)"> <span style="font-size:10px; color:#64748b;">${def.unit}</span>` : ''}
            <button onclick="removeCommand(${cmd.id})" style="background:transparent; color:#ef4444; padding:4px;">✖</button>
        `;
        list.appendChild(el);
    });
}

async function runSequence() {
    if (isRunning) return;
    isRunning = true;
    document.getElementById("btnRunAuto").innerText = "⏹ Stop";
    document.getElementById("btnRunAuto").style.background = "#ef4444";

    // Highlight active
    const items = document.querySelectorAll(".auto-cmd-item");

    for (let i = 0; i < autoSequence.length; i++) {
        if (!isRunning) break;

        // Highlight current
        if (items[i]) items[i].style.borderLeftColor = "#22d3ee";
        if (items[i]) items[i].style.background = "#334155";

        await executeCommand(autoSequence[i]);

        // Unhighlight
        if (items[i]) items[i].style.borderLeftColor = "#3b82f6";
        if (items[i]) items[i].style.background = "#1e293b";
    }

    isRunning = false;
    document.getElementById("btnRunAuto").innerText = "▶ Run Sequence";
    document.getElementById("btnRunAuto").style.background = "";
    sendCommand("STOP"); // Safety stop at end
}

function stopSequence() {
    isRunning = false;
}

function toggleAutoRun() {
    if (isRunning) stopSequence();
    else runSequence();
}

function executeCommand(cmd) {
    return new Promise(resolve => {
        // Send actual command for actions
        if (["MOVE_FORWARD", "MOVE_BACKWARD", "TURN_LEFT", "TURN_RIGHT", "STOP", "SHOOT"].includes(cmd.type)) {
            // Use global sendData if available to ensure consistent logging/flashing
            if (typeof sendData === 'function') sendData(cmd.type);
            else sendCommand(cmd.type); // Fallback

            // Small delay to ensure command sends
            setTimeout(resolve, 100);
            return;
        }

        // WAIT TIME
        if (cmd.type === "WAIT") {
            setTimeout(resolve, cmd.val);
            return;
        }

        // SENSOR CONDITIONS
        if (cmd.type.startsWith("WAIT_US")) {
            const checkInterval = setInterval(() => {
                if (!isRunning) {
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }

                // Check Global State
                const us = window.robotState.us || [0, 0, 0];
                const valid = us.some(d => d > 0); // Ensure we have data

                if (valid) {
                    // Check logic
                    if (cmd.type === "WAIT_US_LESS") {
                        // Resolve if ANY sensor is LESS than val
                        if (us.some(d => d < cmd.val && d > 0)) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    } else if (cmd.type === "WAIT_US_MORE") {
                        // Resolve if ANY sensor is MORE than val
                        if (us.some(d => d > cmd.val)) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }
                }
            }, 100);
        }
    });
}

// Initialize with Example
setTimeout(() => {
    addCommand("MOVE_FORWARD");
    const wait = {
        id: Date.now() + Math.random(),
        type: "WAIT",
        val: 1000
    };
    autoSequence.push(wait);

    addCommand("SHOOT");

    const waitUS = {
        id: Date.now() + Math.random(),
        type: "WAIT_US_LESS",
        val: 20
    };
    autoSequence.push(waitUS);

    renderSequence();
}, 500);
