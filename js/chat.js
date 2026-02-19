/**
 * Chat System for Beta Pictoris Control Panel
 * Handles real-time messaging via Firebase
 */

let chatContainer;
let chatMessages;
let chatInput;
let chatBtn;
let btnClearChat;

document.addEventListener('DOMContentLoaded', () => {
    // Wait for main elements, but chat widget might be injected dynamically or statically
    // We'll init if elements exist
    initChat();
});

function initChat() {
    chatContainer = document.getElementById('chatWidget');
    chatMessages = document.getElementById('chatMessages');
    chatInput = document.getElementById('chatInput');
    chatBtn = document.getElementById('chatSendBtn');
    btnClearChat = document.getElementById('btnClearChat');

    if (!chatMessages) return;

    // Listeners
    if (chatBtn) chatBtn.addEventListener('click', sendChatMessage);
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }

    // Load Messages
    listenToChat();

    // Check Role periodically or on init to show Admin controls
    setInterval(updateChatUI, 2000);
}

function updateChatUI() {
    if (btnClearChat) {
        if (currentUserRole === 'admin') {
            btnClearChat.style.display = 'block';
        } else {
            btnClearChat.style.display = 'none';
        }
    }
}

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Ensure we have a user
    const sender = currentUser ? currentUser.name : "Guest";
    const role = currentUserRole || 'guest';

    const msgData = {
        sender: sender,
        role: role,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    database.ref('chat/messages').push(msgData).then(() => {
        chatInput.value = "";
        // Scroll to bottom handled by listener
    }).catch(err => {
        console.error("Chat Error:", err);
        if (typeof logToTerminal === 'function') logToTerminal("Chat Error: " + err.message);
    });
}

function listenToChat() {
    const chatRef = database.ref('chat/messages');

    // Limit to last 50 messages
    chatRef.limitToLast(50).on('child_added', (snapshot) => {
        const msg = snapshot.val();
        renderMessage(msg, snapshot.key);
    });

    // Handle Deletions
    chatRef.on('child_removed', (snapshot) => {
        const key = snapshot.key;
        const el = document.getElementById(`msg-${key}`);
        if (el) el.remove();
    });
}

function renderMessage(msg, key) {
    if (!chatMessages) return;

    // Avoid duplicates
    if (document.getElementById(`msg-${key}`)) return;

    const div = document.createElement('div');
    div.id = `msg-${key}`;
    div.style.marginBottom = "8px";
    div.style.fontSize = "12px";
    div.style.lineHeight = "1.4";
    div.style.display = "flex";
    div.style.alignItems = "flex-start"; // Align top
    div.style.gap = "5px";

    // Permissions
    const isMe = (currentUser && msg.sender === currentUser.name);
    const isAdmin = (currentUserRole === 'admin');
    const msgIsAdmin = (msg.role === 'admin');

    // Time
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Name Color
    let nameColor = "#22d3ee"; // Default Blue
    if (msgIsAdmin) nameColor = "#facc15"; // Admin Gold
    if (isMe) nameColor = "#a5f3fc"; // Lighter me

    // Start with Delete Button if allowed
    let deleteBtn = "";
    if (isMe || isAdmin) {
        deleteBtn = `<span onclick="deleteMessage('${key}')" style="color:#ef4444; cursor:pointer; font-weight:bold; margin-right:4px;" title="Delete">x</span>`;
    }

    div.innerHTML = `
        <div style="flex:1;">
            <span style="color:#64748b; font-size:10px;">[${time}]</span>
            <strong style="color:${nameColor}; cursor:pointer;" title="${msg.role}">${msg.sender}:</strong>
            <span style="color:#e2e8f0; word-break:break-all;">${escapeHtml(msg.text)}</span>
        </div>
        ${deleteBtn}
    `;

    chatMessages.appendChild(div);

    // Auto Scroll
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

window.deleteMessage = function (key) {
    if (confirm("Delete this message?")) {
        database.ref('chat/messages/' + key).remove();
    }
};

window.clearChat = function () {
    if (confirm("⚠ Clear ALL chat history? This cannot be undone.")) {
        database.ref('chat/messages').remove();
    }
};


function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
