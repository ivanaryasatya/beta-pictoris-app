/**
 * BUZZER & COMPOSER LOGIC
 * Handles Piano UI and Sequence Composer
 */

console.log("[BUZZER] Script Loaded");

// Frequency Map (Standard Octave 4-5)
const NOTES = {
    'C4': 261, 'C#4': 277, 'D4': 293, 'D#4': 311, 'E4': 329, 'F4': 349, 'F#4': 369,
    'G4': 392, 'G#4': 415, 'A4': 440, 'A#4': 466, 'B4': 493,
    'C5': 523, 'C#5': 554, 'D5': 587, 'D#5': 622, 'E5': 659
};

let isPlaying = false;
let stopSignal = false;

// =======================
// PIANO LOGIC
// =======================

function playTone(noteName, duration = 300) {
    const freq = NOTES[noteName];
    if (!freq) return;

    // Visual Feedback
    highlightKey(noteName);

    // Send to Firebase
    const cmd = {
        type: 'tone',
        freq: freq,
        duration: duration,
        note: noteName,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    firebase.database().ref('controlPanel/buzzer_immediate').set(cmd);

    // Optional: Log to console
    // console.log(`[BUZZER] Playing ${noteName} (${freq}Hz) for ${duration}ms`);
}

function highlightKey(note) {
    const btn = document.querySelector(`.piano-key[data-note="${note}"]`);
    if (btn) {
        btn.classList.add('active');
        setTimeout(() => btn.classList.remove('active'), 200);
    }
}

// =======================
// COMPOSER LOGIC
// =======================

function addNoteBlock(note = 'C4', duration = 500) {
    const container = document.getElementById('composerSequence');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'note-block';
    div.style = "display:flex; gap:10px; margin-bottom:10px; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;";

    // Note Select
    let options = '';
    Object.keys(NOTES).forEach(n => {
        options += `<option value="${n}" ${n === note ? 'selected' : ''}>${n}</option>`;
    });

    div.innerHTML = `
        <span style="color:#94a3b8; font-weight:bold; width:20px;">♪</span>
        <select class="note-select" style="background:#1e293b; color:white; border:1px solid #475569; padding:5px; border-radius:4px;">
            ${options}
        </select>
        <input type="number" class="note-duration" value="${duration}" min="50" step="50" style="width:70px; background:#1e293b; color:white; border:1px solid #475569; padding:5px; border-radius:4px;">
        <span style="color:#64748b; font-size:12px;">ms</span>
        <button onclick="this.parentElement.remove()" style="background:#ef4444; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-left:auto;">×</button>
    `;

    container.appendChild(div);
}

async function playSequence() {
    if (isPlaying) return;
    isPlaying = true;
    stopSignal = false;

    const container = document.getElementById('composerSequence');
    const blocks = container.querySelectorAll('.note-block');
    const playBtn = document.getElementById('btnPlaySequence');

    if (playBtn) playBtn.innerText = "⏹ Stop";
    if (playBtn) playBtn.onclick = stopSequence;

    for (let i = 0; i < blocks.length; i++) {
        if (stopSignal) break;

        const block = blocks[i];
        block.style.background = "rgba(34, 211, 238, 0.2)"; // Highlight

        const note = block.querySelector('.note-select').value;
        const duration = parseInt(block.querySelector('.note-duration').value);

        playTone(note, duration);

        // Wait for duration + small gap
        await new Promise(r => setTimeout(r, duration + 50));

        block.style.background = "rgba(255,255,255,0.05)"; // Unhighlight
    }

    isPlaying = false;
    stopSignal = false;
    if (playBtn) playBtn.innerText = "▶ Play Sequence";
    if (playBtn) playBtn.onclick = playSequence;
}

function stopSequence() {
    stopSignal = true;
}

// =======================
// SAVE / LOAD
// =======================

function saveSong() {
    const nameInput = document.getElementById('songNameInput');
    const name = nameInput.value.trim();
    if (!name) { alert("Please enter a song name"); return; }

    const blocks = document.querySelectorAll('.note-block');
    const notes = [];
    blocks.forEach(b => {
        notes.push({
            note: b.querySelector('.note-select').value,
            duration: parseInt(b.querySelector('.note-duration').value)
        });
    });

    if (notes.length === 0) { alert("Sequence is empty!"); return; }

    firebase.database().ref('songs').push({
        name: name,
        notes: notes,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert("Song Saved!");
        nameInput.value = "";
        loadCommonSongs(); // Refresh list
    });
}

function loadCommonSongs() {
    const list = document.getElementById('savedSongsList');
    if (!list) return;

    list.innerHTML = "Loading...";

    firebase.database().ref('songs').limitToLast(10).once('value').then(snap => {
        list.innerHTML = "";
        const songs = snap.val();
        if (!songs) { list.innerHTML = "No saved songs."; return; }

        Object.keys(songs).forEach(key => {
            const s = songs[key];
            const div = document.createElement('div');
            div.style = "background:rgba(255,255,255,0.05); padding:10px; margin-bottom:5px; border-radius:5px; display:flex; justify-content:space-between; align-items:center;";
            div.innerHTML = `
                <span style="color:#e2e8f0; font-weight:600;">${s.name}</span>
                <div>
                    <button onclick='loadSongToComposer(${JSON.stringify(s.notes)})' style="background:#3b82f6; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:12px;">Load</button>
                    <button onclick="deleteSong('${key}')" style="background:#ef4444; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer; margin-left:5px;">🗑</button>
                </div>
            `;
            list.appendChild(div);
        });
    });
}

function loadSongToComposer(notes) {
    const container = document.getElementById('composerSequence');
    container.innerHTML = "";
    notes.forEach(n => addNoteBlock(n.note, n.duration));
}

function deleteSong(key) {
    if (confirm("Delete this song?")) {
        firebase.database().ref('songs/' + key).remove().then(loadCommonSongs);
    }
}

// Initial Load
// document.addEventListener('DOMContentLoaded', loadCommonSongs);
// Better called when panel opens
