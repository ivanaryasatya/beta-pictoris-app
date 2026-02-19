// ===== TEXT STORAGE PANEL =====
// Handles creating, reading, and deleting text files in Firebase

console.log("[TEXT-STORAGE] Script Loaded");

// Global State for Text Items
let textItems = {};

document.addEventListener('DOMContentLoaded', () => {
    initTextStorage();
});

function initTextStorage() {
    if (!window.database) {
        console.warn("[TEXT-STORAGE] Firebase Database not available. Retrying in 1s...");
        setTimeout(initTextStorage, 1000);
        return;
    }

    const ref = window.database.ref('/controlPanel/textStorage');

    // Listen for changes
    ref.on('value', (snapshot) => {
        const val = snapshot.val();
        textItems = val || {};
        renderTextList();
    });
}

// --- UI FUNCTIONS ---

function renderTextList() {
    const listContainer = document.getElementById('textStorageList');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const keys = Object.keys(textItems);

    if (keys.length === 0) {
        listContainer.innerHTML = '<div style="color:#64748b; text-align:center; padding:20px; font-size:12px;">No text files found.</div>';
        return;
    }

    // Sort by timestamp descending (newest first)
    keys.sort((a, b) => {
        const timeA = new Date(textItems[a].timestamp || 0).getTime();
        const timeB = new Date(textItems[b].timestamp || 0).getTime();
        return timeB - timeA;
    });

    keys.forEach(key => {
        const item = textItems[key];
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const el = document.createElement('div');
        el.className = 'text-item';
        el.style.background = '#1e293b';
        el.style.marginBottom = '5px';
        el.style.padding = '8px';
        el.style.borderRadius = '4px';
        el.style.display = 'flex';
        el.style.justifyContent = 'space-between';
        el.style.alignItems = 'center';
        el.style.border = '1px solid #334155';

        el.innerHTML = `
            <div style="overflow:hidden;">
                <div style="font-weight:bold; color:#f1f5f9; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.title)}</div>
                <div style="font-size:10px; color:#94a3b8; display:flex; gap:10px;">
                    <span>👤 ${escapeHtml(item.author || 'Unknown')}</span>
                    <span>🕒 ${dateStr}</span>
                </div>
            </div>
            <div style="display:flex; gap:5px;">
                <button onclick="viewTextItem('${key}')" style="background:#3b82f6; border:none; color:white; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:10px;">View</button>
                <button onclick="deleteTextItem('${key}')" style="background:#ef4444; border:none; color:white; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:10px;">🗑</button>
            </div>
        `;

        listContainer.appendChild(el);
    });
}

function openNewTextModal() {
    document.getElementById('textEditorModal').style.display = 'block';
    document.getElementById('txtTitle').value = '';
    document.getElementById('txtContent').value = '';
    document.getElementById('txtKey').value = ''; // Empty for new
    document.getElementById('textEditorTitle').innerText = 'New Text File';

    // Auto-focus title
    setTimeout(() => document.getElementById('txtTitle').focus(), 100);
}

function viewTextItem(key) {
    const item = textItems[key];
    if (!item) return;

    document.getElementById('textEditorModal').style.display = 'block';
    document.getElementById('txtTitle').value = item.title;
    document.getElementById('txtContent').value = item.content;
    document.getElementById('txtKey').value = key; // Set key for editing (if we supported edit, but for now mostly view)
    document.getElementById('textEditorTitle').innerText = 'View/Edit File';
}

function closeTextEditor() {
    document.getElementById('textEditorModal').style.display = 'none';
}

function saveTextItem() {
    const title = document.getElementById('txtTitle').value.trim();
    const content = document.getElementById('txtContent').value;
    const existingKey = document.getElementById('txtKey').value;

    if (!title) {
        alert("Please enter a title.");
        return;
    }

    if (!window.database) {
        alert("Database not connected.");
        return;
    }

    // Determine Author
    // window.currentUser is set by firebase-auth.js
    let author = "Guest";
    if (window.currentUser) {
        author = window.currentUser.displayName || window.currentUser.email || "User";
    }

    const payload = {
        title: title,
        content: content,
        author: author,
        timestamp: new Date().toISOString()
    };

    if (existingKey) {
        // Update existing
        window.database.ref('/controlPanel/textStorage/' + existingKey).update(payload)
            .then(() => {
                closeTextEditor();
            })
            .catch(e => alert("Error updating: " + e.message));
    } else {
        // Create new
        const newRef = window.database.ref('/controlPanel/textStorage').push();
        newRef.set(payload)
            .then(() => {
                closeTextEditor();
            })
            .catch(e => alert("Error saving: " + e.message));
    }
}

function deleteTextItem(key) {
    if (confirm("Are you sure you want to delete this file?")) {
        window.database.ref('/controlPanel/textStorage/' + key).remove()
            .catch(e => alert("Error deleting: " + e.message));
    }
}

// Utility
function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
