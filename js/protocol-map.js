// Protocol Mapping System
// Handles compression/decompression of commands and telemetry.

window.PROTOCOL_MAP = {
    toCode: {},
    toCmd: {},
    isReady: false
};

// Load Protocol CSV
document.addEventListener('DOMContentLoaded', () => {
    fetch('assets/protocol.csv')
        .then(response => {
            if (!response.ok) throw new Error("Protocol CSV not found");
            return response.text();
        })
        .then(csvText => {
            parseProtocolCSV(csvText);
        })
        .catch(err => {
            console.warn("Using default protocol map (fallback)", err);
            // Minimal Fallback
            parseProtocolCSV(`
SPEED,9O
P_SPEED,9P
ANGLE,9A
FAN,9F
ROTATE_MAG_R,0W
            `.trim());
        });
});

function parseProtocolCSV(text) {
    const lines = text.split('\n');
    lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
            const cmd = parts[0].trim();
            const code = parts[1].trim();
            if (cmd && code) {
                window.PROTOCOL_MAP.toCode[cmd] = code;
                window.PROTOCOL_MAP.toCmd[code] = cmd;
            }
        }
    });
    window.PROTOCOL_MAP.isReady = true;
    console.log("Protocol Map Loaded:", Object.keys(window.PROTOCOL_MAP.toCode).length, "entries");
}

function encodeCommand(fullCmd) {
    if (!window.PROTOCOL_MAP.isReady) return { code: null, val: null, original: fullCmd };

    // fullCmd format: "KEY:VALUE" or "KEY"
    let parts = fullCmd.split(':');
    let key = parts[0];
    let val = parts.length > 1 ? parts[1] : null;

    let code = window.PROTOCOL_MAP.toCode[key];

    if (code) {
        // If value exists, try to treat as number if possible
        let numericVal = parseFloat(val);
        if (!isNaN(numericVal)) val = numericVal;

        return { code: code, val: val !== null ? val : 1 }; // Default val 1 for flags?
        // Actually, if command is just "STOP", value might be unnecessary or boolean true.
        // Let's use 1 for boolean flags.
    }

    // Return null key if not found so caller knows to skip or send raw
    return { code: null, original: fullCmd };
}

function decodeData(dataObj) {
    // dataObj: { "B1": 12.5, "9O": 100, ... }
    // Returns: { "battery": 12.5, "SPEED": 100, ... }

    let decoded = {};
    if (!dataObj) return decoded;

    Object.keys(dataObj).forEach(code => {
        let key = window.PROTOCOL_MAP.toCmd[code];
        if (key) {
            decoded[key] = dataObj[code];
        } else {
            // Keep original if unknown (or maybe it's uncompressed data)
            decoded[code] = dataObj[code];
        }
    });
    return decoded;
}
