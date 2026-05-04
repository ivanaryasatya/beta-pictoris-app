// Protocol Mapping System
// Handles compression/decompression of commands and telemetry.

window.PROTOCOL_MAP = {
    toCode: {},
    toCmd: {},
    isReady: false
};

// Load Protocol CSV
document.addEventListener('DOMContentLoaded', () => {
    // Load Protocol from Firebase (Fallback to CSV if empty)
    if (window.database) {
        const ref = window.database.ref('/config/protocolMap');
        ref.once('value').then(snapshot => {
            const val = snapshot.val();
            if (val) {
                console.log("Loading Protocol from Firebase...");
                try {
                    let mapData = typeof val === 'string' ? JSON.parse(val) : val;
                    applyProtocolMap(mapData);
                } catch (e) {
                    console.error("Error parsing Firebase Protocol Map:", e);
                    fallbackToCSV();
                }
            } else {
                console.log("Firebase Protocol Map empty. Migrating from CSV...");
                fallbackToCSV(true); // Is Migration
            }
        }).catch(e => {
            console.warn("Firebase Error:", e);
            fallbackToCSV();
        });
    } else {
        fallbackToCSV();
    }
});

function fallbackToCSV(migrate = false) {
    fetch('assets/protocol.csv')
        .then(response => {
            if (!response.ok) throw new Error("Protocol CSV not found");
            return response.text();
        })
        .then(csvText => {
            let mapData = parseProtocolCSV(csvText);
            applyProtocolMap(mapData);
            if (migrate) saveProtocolToFirebase(mapData);
        })
        .catch(err => {
            console.warn("Using default protocol map (hard fallback)", err);
            let mapData = parseProtocolCSV(`
SPEED,9O
P_SPEED,9P
ANGLE,9A
FAN,9F
ROTATE_MAG_R,0W
            `.trim());
            applyProtocolMap(mapData);
        });
}

function parseProtocolCSV(text) {
    const lines = text.split('\n');
    let map = {};
    lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
            const cmd = parts[0].trim();
            const code = parts[1].trim();
            if (cmd && code) {
                map[cmd] = code;
            }
        }
    });
    return map;
}

function applyProtocolMap(mapData) {
    window.PROTOCOL_MAP.toCode = mapData;
    window.PROTOCOL_MAP.toCmd = {};

    // Build reverse map
    for (let cmd in mapData) {
        let code = mapData[cmd];
        window.PROTOCOL_MAP.toCmd[code] = cmd;
    }

    window.PROTOCOL_MAP.isReady = true;
    console.log("Protocol Map Applied:", Object.keys(mapData).length, "entries");
}

window.saveProtocolToFirebase = function (mapData) {
    if (!window.database) return;
    // Save as JSON string
    window.database.ref('/config/protocolMap').set(JSON.stringify(mapData))
        .then(() => console.log("Protocol Map Saved to Firebase"))
        .catch(e => console.error("Save Error:", e));
};

function encodeCommand(fullCmd) {
    if (!window.PROTOCOL_MAP.isReady) return { code: null, val: null, original: fullCmd };

    // fullCmd format: "KEY:VALUE" or "KEY"
    let parts = fullCmd.split(':');
    let key = parts[0];
    let val = parts.length > 1 ? parts[1] : null;

    let code = window.PROTOCOL_MAP.toCode[key];

    if (code) {
        // If value contains comma, treat as string (e.g. "2,500,500")
        if (val && val.includes && val.includes(',')) {
            // It is a string parameter list, keep as string
        } else {
            // Try to treat as number
            let numericVal = parseFloat(val);
            if (!isNaN(numericVal)) val = numericVal;
        }

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

// Editor Functions
window.openProtocolEditor = function () {
    console.log("[DEBUG] Opening Protocol Editor");
    // alert("Opening Editor..."); // Uncomment for hard debugging if console is ignored
    const modal = document.getElementById('protocolEditorModal');
    const textarea = document.getElementById('protocolJsonInput');

    if (!modal) {
        console.error("[DEBUG] Protocol Editor Modal NOT FOUND!");
        return;
    }

    // Get current map
    const map = window.PROTOCOL_MAP.toCode;
    textarea.value = JSON.stringify(map, null, 4);

    modal.style.display = 'block';
    // Ensure z-index is high
    modal.style.zIndex = "9999";
};

window.saveProtocolEditor = function () {
    const textarea = document.getElementById('protocolJsonInput');
    try {
        const newMapData = JSON.parse(textarea.value);

        // Minimal validation
        if (typeof newMapData !== 'object' || newMapData === null) throw new Error("Invalid JSON Object");

        // --- MIGRATION LOGIC ---
        if (window.database) {
            const queueRef = window.database.ref('/controlPanel/command');

            // Fetch current queue once
            queueRef.once('value').then(snapshot => {
                const currentData = snapshot.val();

                if (typeof currentData === 'string' && currentData.length > 0) {
                    console.log("[MIGRATION] Checking binary commands...");

                    // Use OLD map to decode
                    let oldToCmd = window.PROTOCOL_MAP.toCmd || {};
                    let updatedQueueStr = "";

                    let i = 0;
                    while (i < currentData.length) {
                        if (currentData[i] === '#') {
                            // Find the next length byte. 
                            // Because CMD could be multiple chars, we need to try to parse correctly.
                            // However, we can guess CMD length by iterating up to 4 characters.
                            let found = false;

                            // Trying cmd lengths from 1 to 4:
                            for (let cmdLen = 1; cmdLen <= 4; cmdLen++) {
                                let lenIndex = i + 1 + cmdLen;
                                if (lenIndex < currentData.length) {
                                    let packetLen = currentData.charCodeAt(lenIndex);
                                    if (packetLen >= 4 && i + packetLen <= currentData.length) {
                                        let candidate = currentData.substr(i, packetLen);
                                        // verify CRC
                                        let testCrc = 0;
                                        for (let k = 0; k < candidate.length - 1; k++) {
                                            testCrc ^= candidate.charCodeAt(k);
                                        }
                                        if (String.fromCharCode(testCrc) === candidate[candidate.length - 1]) {
                                            // Valid packet found
                                            let oldBaseCode = candidate.substr(1, cmdLen);
                                            let dataPart = candidate.substring(lenIndex + 1, candidate.length - 1);

                                            // Translate to new base code
                                            let commandKey = oldToCmd[oldBaseCode];
                                            if (commandKey) {
                                                let newBaseCode = newMapData[commandKey];
                                                if (newBaseCode) {
                                                    // Reconstruct new packet
                                                    let newTotalLen = 1 + newBaseCode.length + 1 + dataPart.length + 1;
                                                    let newLenChar = String.fromCharCode(newTotalLen);
                                                    let newPacketWithoutCrc = "#" + newBaseCode + newLenChar + dataPart;

                                                    let newCrc = 0;
                                                    for (let k = 0; k < newPacketWithoutCrc.length; k++) {
                                                        newCrc ^= newPacketWithoutCrc.charCodeAt(k);
                                                    }
                                                    let newCrcChar = String.fromCharCode(newCrc);
                                                    updatedQueueStr += newPacketWithoutCrc + newCrcChar;

                                                    if (oldBaseCode !== newBaseCode) {
                                                        console.log(`[MIGRATION] ${commandKey}: ${oldBaseCode} -> ${newBaseCode}`);
                                                    }
                                                } else {
                                                    // Retain old packet if no new mapping found
                                                    updatedQueueStr += candidate;
                                                }
                                            } else {
                                                // Keep as is if unknown
                                                updatedQueueStr += candidate;
                                            }

                                            i += packetLen;
                                            found = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (found) continue;
                        }
                        // Fallback: character is not start of valid packet or parsing failed
                        if (i < 0) break; // sanity check
                        i++;
                    }

                    // Update Queue in Firebase
                    if (updatedQueueStr.length > 0) {
                        queueRef.set(updatedQueueStr)
                            .then(() => console.log("Queue Update Complete"))
                            .catch(e => console.error("Queue Update Failed", e));
                    }
                }

                // Proceed to save map
                finishSaving(newMapData);

            }).catch(e => {
                console.error("Migration fetch failed:", e);
                // Save map anyway
                finishSaving(newMapData);
            });
        } else {
            finishSaving(newMapData);
        }

    } catch (e) {
        console.error(e);
        alert("Invalid JSON: " + e.message);
    }
};

function finishSaving(mapData) {
    // Apply locally
    applyProtocolMap(mapData);

    // Save to Firebase
    saveProtocolToFirebase(mapData);

    document.getElementById('protocolEditorModal').style.display = 'none';
    alert("Protocol Map Saved & Commands Updated!");
}


