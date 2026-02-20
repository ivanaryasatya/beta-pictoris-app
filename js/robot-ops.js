
// ===== KEYBOARD CONTROLS =====
let keyBindings = {
    "MOVE_FORWARD": { key: "ArrowUp", label: "Forward" },
    "MOVE_BACKWARD": { key: "ArrowDown", label: "Backward" },
    "TURN_LEFT": { key: "ArrowLeft", label: "Left" },
    "TURN_RIGHT": { key: "ArrowRight", label: "Right" },
    "STOP": { key: " ", label: "Stop" }, // Space
    "SHOOT": { key: "Enter", label: "Shoot" },
    "REFILL": { key: "r", label: "Refill" },
    "LOCK_TARGET": { key: "l", label: "Lock Target" },
    "ROTATE_MAG_L": { key: "q", label: "Rotate Mag L" },
    "ROTATE_MAG_R": { key: "e", label: "Rotate Mag R" },
    "MOD_MOTOR": { key: "m", label: "Mod: Motor Speed (+ 0-9)" },
    "MOD_POWER": { key: "p", label: "Mod: Shooter Power (+ 0-9)" },
    "MOD_ANGLE": { key: "a", label: "Mod: Elevation (+ 0-9)" },
    "MOD_FAN": { key: "f", label: "Mod: Fan Speed (+ 0-9)" }
};

let isRemapping = null; // Stores action being remapped
let pressedKeys = {}; // Track pressed keys to prevent flooding

document.addEventListener('keydown', function (e) {
    // Ignore if in input/select
    if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT" || document.activeElement.tagName === "TEXTAREA") return;

    if (isRemapping) {
        // Remap Logic
        e.preventDefault();
        keyBindings[isRemapping].key = e.key;
        isRemapping = null;
        renderKeySettings();
        return;
    }

    if (pressedKeys[e.key]) return; // Ignore if key is already pressed

    // Slider Shortcuts (Modifier + 0-9)
    if (e.key >= '0' && e.key <= '9') {
        let digit = parseInt(e.key);
        // Normalized 0 to 1
        let ratio = digit / 9.0;

        // Check Modifiers (Check if the key associated with MOD is currently pressed)
        if (pressedKeys[keyBindings["MOD_MOTOR"].key]) {
            let val = Math.round(ratio * 255);
            updateSpeed('MOTOR', val);
            e.preventDefault(); return;
        }
        if (pressedKeys[keyBindings["MOD_POWER"].key]) {
            let val = Math.round(ratio * 255);
            updateSpeed('SHOOT', val);
            e.preventDefault(); return;
        }
        if (pressedKeys[keyBindings["MOD_ANGLE"].key]) {
            let val = Math.round(ratio * 45); // Max angle 45
            updateSpeed('ANGLE', val);
            e.preventDefault(); return;
        }
        if (pressedKeys[keyBindings["MOD_FAN"].key]) {
            let val = Math.round(ratio * 255);
            updateSpeed('FAN', val);
            e.preventDefault(); return;
        }
    }

    // Command Logic
    for (let action in keyBindings) {
        if (keyBindings[action].key === e.key) {
            // If it's a modifier key, we just mark it as pressed (handled by pressedKeys logic above)
            // But we don't send a command for modifiers themselves unless they map to an action.
            // The MOD_* keys don't map to a direct sendCommand, so we can skip them or let them fall through.
            // However, MOD keys are in keyBindings.
            // If we sendCommand("MOD_MOTOR"), it might do nothing or error if not handled.
            // Let's filter out MOD_ keys from sending commands.
            if (action.startsWith("MOD_")) {
                pressedKeys[e.key] = true;
                e.preventDefault();
                return;
            }

            e.preventDefault();
            pressedKeys[e.key] = true; // Mark key as pressed
            sendCommand(action);
            return;
        }
    }
});

document.addEventListener('keyup', function (e) {
    if (pressedKeys[e.key]) {
        pressedKeys[e.key] = false; // Reset key state
    }
});

function openKeySettings() {
    document.getElementById("keySettingsModal").style.display = "block";
    document.getElementById("backdrop").classList.add("active");
    renderKeySettings();
}

function closeKeySettings() {
    document.getElementById("keySettingsModal").style.display = "none";
    document.getElementById("backdrop").classList.remove("active");
    isRemapping = null;
}

function renderKeySettings() {
    const list = document.getElementById("keyBindingList");
    list.innerHTML = "";

    for (let action in keyBindings) {
        let binding = keyBindings[action];

        let row = document.createElement("div");
        row.className = "key-row";

        let label = document.createElement("span");
        label.innerText = binding.label;

        let btn = document.createElement("button");
        btn.className = "key-btn";
        // Show "Space" for Spacebar, otherwise proper Key
        let displayKey = binding.key === " " ? "Space" : binding.key;
        if (displayKey.startsWith("Arrow")) displayKey = displayKey.replace("Arrow", "");

        btn.innerText = isRemapping === action ? "Press Key..." : displayKey;

        if (isRemapping === action) btn.classList.add("listening");

        btn.onclick = function () {
            isRemapping = action;
            renderKeySettings();
        };

        row.appendChild(label);
        row.appendChild(btn);
        list.appendChild(row);
    }
}

// ===== ROBOT OPS =====


// Update display only (for continuous slider movement)
function updateSpeedDisplay(type, val) {
    if (type === 'MOTOR') {
        document.getElementById('valMotor').innerText = val;
    } else if (type === 'SHOOT') {
        document.getElementById('valShoot').innerText = val;
    } else if (type === 'ANGLE') {
        const el = document.getElementById('angleDisplay');
        if (el) el.innerText = val + '°';
    } else if (type === 'FAN') {
        document.getElementById('valFan').innerText = val;
        // Also update slider position if it wasn't the source (e.g. from telemetry)
        const slider = document.getElementById('fanSlider');
        if (slider && slider.value != val) slider.value = val;
    }
}

function updateSpeed(type, val) {
    // Update display first to ensure sync
    updateSpeedDisplay(type, val);

    if (type === 'MOTOR') {
        sendCommand('SPEED:' + val);
    } else if (type === 'SHOOT') {
        sendCommand('P_SPEED:' + val);
    } else if (type === 'ANGLE') {
        document.getElementById('shotAngle').value = val;
        sendCommand('ANGLE:' + val);
    } else if (type === 'FAN') {
        // Only send if not in auto mode? 
        // Actually the slider is disabled in auto mode, so onchange won't fire from user.
        sendCommand('FAN:' + val);
    }
}

function toggleFanAuto(checkbox) {
    const slider = document.getElementById('fanSlider');
    if (!slider) return;

    if (checkbox.checked) {
        // Auto Mode ON
        slider.disabled = true;
        slider.style.opacity = '0.5';
        slider.style.cursor = 'not-allowed';
        sendCommand('FAN_AUTO:1');
    } else {
        // Auto Mode OFF
        slider.disabled = false;
        slider.style.opacity = '1';
        slider.style.cursor = 'pointer';
        sendCommand('FAN_AUTO:0');
    }
}

// SHOT ANGLE (PROTRACTOR)
let isDraggingAngle = false;

function initProtractor() {
    const container = document.getElementById("protractorInput");
    if (!container) return;

    const updateFromEvent = (e) => {
        const rect = container.getBoundingClientRect();
        // Center of the half-circle (bottom center of container)
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.bottom;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const dx = clientX - centerX;
        const dy = clientY - centerY;

        // Calculate angle in degrees
        // Math.atan2(dy, dx) returns radians.
        // -PI/2 is up (-90deg), 0 is right, -PI is left.
        // We want 0 at left, 45 at top-left-ish?
        // User requested 0-45 degrees.
        // Let's assume 0 is horizontal left (flat), 45 is diagonal up-right?
        // Or standard protractor: 0 is right, 180 left, 90 up.
        // Context: "Elevation" usually implies 0 = flat, 90 = vertical.
        // Let's assume 0 = horizon, 45 = max elevation.

        // Let's map screen coordinates to standard Angle.
        // atan2(y, x) -> y grows down, so dy is negative above center.
        let rad = Math.atan2(dy, dx);
        let deg = rad * (180 / Math.PI);

        // Current calculation:
        // Right (0deg) -> 0
        // Up (-90deg) -> -90
        // Left (180/-180) -> 180

        // We want elevation. usually 0 is flat. 
        // Let's assume robot shoots forward.
        // If 0 is "flat", and we limit to 45.
        // Visual representation:
        // Needle should move from Horizontal (0) to 45 degrees up.
        // Visual Map: 
        // Real logic: -180 (Left) to 0 (Right).
        // Let's map -180 (Left) as 0 deg elevation? 
        // Wait, protractor-needle css has "transform: rotate(-45deg)".
        // Let's simplify: 
        // Map mouse position to 0-45 based on a clamped range.

        // Improved logic: 
        // Calculate angle relative to "Left" being 0?
        // Let's use standard polar coords and clamp.
        // Atan2(dy, dx): 
        // Up-Left is approx -135 deg.
        // Left is -180 / 180.

        // Let's try: 
        // Angle from X-axis (Right is 0).
        // We want 0 to be Left (shooting forward/left?). 
        // Or maybe 0 is Right. 
        // Let's assume standard: 0 = Horizontal Right.
        // If robot shoots "Forward", which way is forward?
        // Let's assume 0 is Flat, 90 is Up.

        // Let's calculate angle from negative x-axis (Left) because usually that's "forward" in 2D side views?
        // Or usually 0 is right.
        // Let's stick to: Clamped 0-45.
        // If I move mouse to "Left" side, it's 0?
        // If I move up, it increases?

        // Let's calculate typical refresher angle:
        // -PI (Left) to -PI/2 (Up).

        let angle = -1 * deg; // Make Up positive
        // Right = 0, Up = 90, Left = 180.

        // If we want 0-45.
        // Let's assume the user drags on the arc.
        // Let's map the full 180 arc to 0-45? No, that's unintuitive.
        // Let's map 1:1.
        // If user clicks at 45 degree visual angle, set 45.

        // Visual Reference:
        // Box is 200px wide. Center is at 100px.
        // 0 degrees should be Horizontal Right? 
        // The CSS has needle rotate(-45deg). 
        // Let's assume visual 0 is Left Horizontal?
        // Let's try:
        // Calculate angle from the Left side of the semi-circle.
        // atan2(-dy, -dx) ? 

        // Let's use simple scaling:
        // 0 deg = Left Horizontal (-180 real).
        // 45 deg = Diagonal Up-Left (-135 real).
        // 90 deg = Up (-90 real).

        // Angle from coordinates:
        let theta = Math.atan2(dy, dx) * (180 / Math.PI); // -180 to 180
        // Left is +/- 180. Up is -90. Right is 0.
        // We want (Left) -180 => 0 output.
        // We want (Up) -90 => 90 output.
        // Formula: Output = -(theta + 180) ? No.
        // Output = -theta - 90 ? (-(-180)-90) = 90 (at left). incorrect.

        // Output = -theta. 
        // Left (-180) -> 180. 
        // Up (-90) -> 90.
        // Right (0) -> 0.
        // So 0 is Right, 180 is Left.

        // Let's assume 0 is Right for now.
        // Clamp between 0 and 45.

        let visualAngle = -theta; // 0 at right, 90 at top, 180 at left.

        // If visualAngle is negative, it's below horizon -> clamp to 0.
        if (visualAngle < 0) visualAngle = 0;

        // If we want 0-45.
        // User asked for "input seperti busur derajat 0 sampai 45 derajat".
        // Depending on robot orientation. Let's assume 0-180 support but clamped to 45.
        if (visualAngle > 180) visualAngle = 0; // wrap around fix

        // Map direction: 
        // If the user wants 0-45, likely 0 is horizontal and 45 is up.
        // Which side? Let's generic to "Absolute Elevation".
        // If I click Left side (135-180), map to elevation?
        // Let's just use 0-180 and clamp to 45.
        // Meaning user can only select the right-side wedge?
        // Or maybe symmetric?

        // Let's implement 0-180 range first visually, but clamp value to 0-45.
        // Actually, CSS clip-path is top half.
        // 0 at Right, 180 at Left.

        // Let's assume 0 is Right.
        // Clamp to 45 max.
        let val = Math.round(visualAngle);
        if (val > 45) val = 45;
        if (val < 0) val = 0;

        updateAngle(val);
    };

    container.addEventListener("mousedown", (e) => {
        isDraggingAngle = true;
        updateFromEvent(e);
    });

    window.addEventListener("mousemove", (e) => {
        if (isDraggingAngle) updateFromEvent(e);
    });

    window.addEventListener("mouseup", () => {
        isDraggingAngle = false;
    });

    // Touch support
    container.addEventListener("touchstart", (e) => {
        isDraggingAngle = true;
        updateFromEvent(e);
        e.preventDefault();
    }, { passive: false });

    window.addEventListener("touchmove", (e) => {
        if (isDraggingAngle) {
            updateFromEvent(e);
            e.preventDefault();
        }
    }, { passive: false });

    window.addEventListener("touchend", () => {
        isDraggingAngle = false;
    });
}

// Call init
setTimeout(initProtractor, 500);

function updateAngle(val) {
    val = parseInt(val);
    if (isNaN(val)) val = 0;
    if (val > 45) val = 45; // Hard limit 45
    if (val < 0) val = 0;

    // Update Text
    const display = document.getElementById("angleDisplay");
    if (display) display.innerText = val + "°";

    // Update Input (Hidden)
    const el = document.getElementById("shotAngle");
    if (el && el.value != val) el.value = val;

    // Update Needle Rotation
    // visual 0 is Right (0 deg).
    // needle css default is -45deg? 
    // Let's set rotation directly. 
    // -90 is Up? No, in CSS rotation: 0 is Up/Right depending on origin.
    // CSS .protractor-needle: bottom center origin.
    // If 0 deg rotation = vertical up (default div layout?).
    // A vertical div at left:50% bottom:0.
    // 0 deg = Up (12 o'clock).
    // We calculated visualAngle where 0=Right, 90=Up.
    // So Needel Rotation = (visualAngle - 90).
    // 0 -> -90 (Right).
    // 90 -> 0 (Up).

    const needle = document.getElementById("protractorNeedle");
    if (needle) {
        // We want 0 degrees to be flat right?
        let rot = -90 + val;
        needle.style.transform = `rotate(${rot}deg)`;
    }

    // Send Command
    // Debounce this? Or just send.
    // For now, send immediately.
    sendCommand(`ANGLE_SET:${val}`);
}

// Ensure init is called on load
window.addEventListener('DOMContentLoaded', initProtractor);

// ===== LINE SENSOR CONFIG =====
window.lineConfig = {
    enabled: true,
    mask: [1, 1, 1, 1, 1, 1, 1, 1]
};

// Load on Startup
function loadLineConfig() {
    const saved = localStorage.getItem("lineConfig");
    if (saved) {
        try {
            window.lineConfig = JSON.parse(saved);
        } catch (e) { console.error("Invalid Line Config", e); }
    }
}
loadLineConfig();

function openLineSettings() {
    document.getElementById("lineConfigModal").style.display = "block";
    document.getElementById("backdrop").classList.add("active");

    // Set UI State
    document.getElementById("line_global_enable").checked = window.lineConfig.enabled;
    const checks = document.querySelectorAll(".line-mask");
    checks.forEach((chk, i) => {
        chk.checked = !!window.lineConfig.mask[i];
    });
}

function closeLineSettings() {
    document.getElementById("lineConfigModal").style.display = "none";
    document.getElementById("backdrop").classList.remove("active");
}

function saveLineConfig() {
    window.lineConfig.enabled = document.getElementById("line_global_enable").checked;

    const checks = document.querySelectorAll(".line-mask");
    checks.forEach((chk, i) => {
        window.lineConfig.mask[i] = chk.checked ? 1 : 0;
    });

    localStorage.setItem("lineConfig", JSON.stringify(window.lineConfig));
    closeLineSettings();

    // Force refresh visuals immediately if function exists
    if (window.updateLineSensors && !window.lineConfig.enabled) {
        updateLineSensors([0, 0, 0, 0, 0, 0, 0, 0]);
    }
}

// ===== ULTRASONIC CONFIG =====
window.ultrasonicConfig = {
    enabled: true,
    mask: [1, 1, 1]
};

function loadUltrasonicConfig() {
    const saved = localStorage.getItem("ultrasonicConfig");
    if (saved) {
        try {
            window.ultrasonicConfig = JSON.parse(saved);
        } catch (e) { console.error("Invalid US Config", e); }
    }
}
loadUltrasonicConfig();

function openUltrasonicSettings() {
    document.getElementById("ultrasonicConfigModal").style.display = "block";
    document.getElementById("backdrop").classList.add("active");

    document.getElementById("us_global_enable").checked = window.ultrasonicConfig.enabled;
    const checks = document.querySelectorAll(".us-mask");
    checks.forEach((chk, i) => {
        chk.checked = !!window.ultrasonicConfig.mask[i];
    });
}

function closeUltrasonicSettings() {
    document.getElementById("ultrasonicConfigModal").style.display = "none";
    document.getElementById("backdrop").classList.remove("active");
}

function saveUltrasonicConfig() {
    window.ultrasonicConfig.enabled = document.getElementById("us_global_enable").checked;

    const checks = document.querySelectorAll(".us-mask");
    checks.forEach((chk, i) => {
        window.ultrasonicConfig.mask[i] = chk.checked ? 1 : 0;
    });

    localStorage.setItem("ultrasonicConfig", JSON.stringify(window.ultrasonicConfig));
    closeUltrasonicSettings();

    // Reset visuals if disabled
    if (!window.ultrasonicConfig.enabled) {
        updateUltrasonic([0, 0, 0]);
    }
}

function updateUltrasonic(distances) {
    // distances: [d1, d2, d3] in cm
    const maxDist = 200; // 200cm max for visual scaling

    if (!window.ultrasonicConfig.enabled) {
        for (let i = 0; i < 3; i++) {
            const bar = document.getElementById(`us_bar_${i}`);
            const val = document.getElementById(`us_val_${i}`);
            if (bar) bar.style.height = "0%";
            if (val) val.innerText = "OFF";
        }
        return;
    }

    for (let i = 0; i < 3; i++) {
        const bar = document.getElementById(`us_bar_${i}`);
        const val = document.getElementById(`us_val_${i}`);
        if (bar && val) {
            // Check Mask
            if (window.ultrasonicConfig.mask[i] === 0) {
                bar.style.height = "0%";
                val.innerText = "OFF";
                continue;
            }

            let d = distances[i];
            let pct = (d / maxDist) * 100;
            if (pct > 100) pct = 100;

            bar.style.height = pct + "%";
            val.innerText = Math.round(d) + "cm";
        }
    }
}
// ===== AUX LIGHTING CONTROL =====
const auxState = {
    LASER: { state: 0, mode: 'MANUAL' }, // 0=off, 1=on, 2=blink
    LED: { state: 0, mode: 'MANUAL' }
};

function toggleAux(type) {
    // Determine target state (Toggle 0 <-> 1)
    // If currently blinking (2), switch to 0 (Off).
    let current = auxState[type].state;
    let next = (current === 0) ? 1 : 0;

    auxState[type].state = next;
    auxState[type].mode = 'MANUAL';

    // Update Button UI
    updateAuxButton(type, next);

    // Send Command
    sendCommand(`${type}:${next}`);
}

function setBlink(type) {
    // Read Inputs
    let onTime, offTime;
    if (type === 'LASER') {
        onTime = document.getElementById('laserOnTime').value || 100;
        offTime = document.getElementById('laserOffTime').value || 100;
    } else {
        onTime = document.getElementById('ledOnTime').value || 500;
        offTime = document.getElementById('ledOffTime').value || 500;
    }

    // Set State
    auxState[type].state = 2; // Blink
    auxState[type].mode = 'BLINK';

    updateAuxButton(type, 2);

    // Command Format: "CMD:2,on,off"
    // Using string format which protocol-map now supports
    sendCommand(`${type}:2,${onTime},${offTime}`);
}

function updateAuxButton(type, state) {
    let btnId = (type === 'LASER') ? 'btnLaser' : 'btnLed';
    let btn = document.getElementById(btnId);
    if (!btn) return;

    if (state === 0) {
        btn.style.background = '#334155'; // Off (Slate)
        btn.style.color = '#fff';
        btn.classList.remove('blink-anim');
    } else if (state === 1) {
        btn.style.background = (type === 'LASER') ? '#ef4444' : '#fbbf24'; // Red/Amber
        btn.style.color = '#fff';
        btn.classList.remove('blink-anim');
    } else if (state === 2) {
        btn.style.background = (type === 'LASER') ? '#7f1d1d' : '#78350f'; // Darker
        btn.style.color = '#fff';
        // Add css class for visual blink if desired
        // btn.classList.add('blink-anim'); 
        // For now just change text color or border?
        btn.style.border = '1px solid ' + ((type === 'LASER') ? '#ef4444' : '#fbbf24');
    }
}
