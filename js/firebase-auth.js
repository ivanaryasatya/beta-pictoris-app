/**
 * REBUILT FIREBASE AUTH SYSTEM v3 (FIRESTORE)
 * Handles: Google Auth, Firestore Sync, Admin Approval, Lockdown
 */

console.log("[AUTH] Script Loaded v3 (Firestore)");

// Global State
let currentUser = null;
let currentUserData = null;
let db = firebase.firestore();
let isSystemLocked = false;
let autoAcceptEnabled = false;

// DOM Elements
const UI = {
    // Main Auth
    modal: null,
    input: null,
    btnGoogle: null,
    error: null,
    btnAdmin: null,
    btnLock: null,

    // Admin Login
    adminModal: null,
    adminInput: null,
    adminError: null,
    btnAdminLogin: null,
    btnAdminCancel: null,

    // Lockdown
    lockdownModal: null,
    lockdownInput: null,
    lockdownReason: null,
    lockdownError: null,
    btnLockConfirm: null,
    btnLockCancel: null,
    overlay: null,

    // Network & Admin Panel (Shared)
    networkModal: null,
    userList: null,
    adminControls: null,
    chkAutoAccept: null,
    userCountBadge: null
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("[AUTH] DOM Ready. Initializing...");

    // 1. Capture Elements
    try {
        UI.modal = document.getElementById('authModal');
        UI.btnGoogle = document.getElementById('btnGoogleLogin');
        UI.error = document.getElementById('authError');
        UI.btnAdmin = document.getElementById('btnShowAdmin');
        UI.btnLock = document.getElementById('btnShowLockdown');

        UI.adminModal = document.getElementById('adminLoginModal');
        UI.adminInput = document.getElementById('adminPassInput');
        UI.adminError = document.getElementById('adminLoginError');

        UI.lockdownModal = document.getElementById('lockdownModal');
        UI.lockdownInput = document.getElementById('lockdownInput');
        UI.lockdownReason = document.getElementById('lockdownReasonInput');
        UI.lockdownError = document.getElementById('lockdownError');
        UI.btnLockConfirm = document.getElementById('btnLockAction');
        UI.overlay = document.getElementById('systemLockOverlay');

        // New Network Panel
        UI.networkModal = document.getElementById('networkPanelModal');
        UI.userList = document.getElementById('connectedUsersList');
        UI.adminControls = document.getElementById('adminControlsArea');
        UI.chkAutoAccept = document.getElementById('chkAutoAccept');
        UI.userCountBadge = document.getElementById('userCountBadge');

        console.log("[AUTH] Elements captured");
    } catch (e) {
        console.error("[AUTH] Error capturing elements:", e);
    }

    // 2. Main Logic
    // Detect Page
    const isLandingPage = !!document.getElementById('btnEnterApp');
    const isControlPanel = !isLandingPage; // Simplified assumption or check for dashboard

    initAuthSystem(isLandingPage, isControlPanel);
});

function initAuthSystem(isLanding, isControlPanel) {
    // Bind Google Login
    if (UI.btnGoogle) UI.btnGoogle.addEventListener('click', () => handleGoogleLogin());
    
    const btnEnter = document.getElementById('btnEnterApp');
    if (btnEnter) btnEnter.addEventListener('click', () => handleGoogleLogin());
    
    if (UI.btnAdmin) UI.btnAdmin.addEventListener('click', showAdminLogin);
    if (UI.btnLock) UI.btnLock.addEventListener('click', () => showLockdownModal(true));

    // Monitor Auth State
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            syncUserWithFirestore(user, isLanding, isControlPanel);
        } else {
            if (isControlPanel) window.location.href = 'index.html';
        }
    });

    // Global Config Listeners
    db.collection('config').doc('system').onSnapshot(doc => {
        if (doc.exists()) {
            const data = doc.data();
            isSystemLocked = data.isLocked || false;
            autoAcceptEnabled = data.autoApprove || false;
            if (isControlPanel) updateLockdownState(isSystemLocked);
            if (UI.chkAutoAccept) UI.chkAutoAccept.checked = autoAcceptEnabled;
        }
    });
}

function handleGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(err => {
        if (UI.error) UI.error.innerText = err.message;
    });
}

function syncUserWithFirestore(user, isLanding, isControlPanel) {
    const userRef = db.collection('users').doc(user.uid);
    
    userRef.onSnapshot(doc => {
        if (!doc.exists()) {
            // New User Registration
            const newUser = {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                role: 'user',
                approved: autoAcceptEnabled, // Auto approve if enabled
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            userRef.set(newUser);
        } else {
            const data = doc.data();
            currentUserData = data;

            if (data.approved || data.role === 'admin') {
                if (isLanding) {
                    window.location.href = 'control-panel.html';
                } else {
                    renderProfile(data.displayName, data.role);
                    if (UI.modal) UI.modal.style.display = 'none';
                }
            } else {
                showMainModal();
                if (UI.error) UI.error.innerText = "Waiting for Admin Approval...";
                if (UI.btnGoogle) UI.btnGoogle.disabled = true;
            }
        }
    });
}

// ========================
// ADMIN FLOW
// ========================

function showAdminLogin() {
    UI.modal.style.display = 'none';
    UI.adminModal.style.display = 'flex';
    UI.adminInput.value = "";
    UI.adminInput.focus();
}

window.closeAdminLogin = function () {
    UI.adminModal.style.display = 'none';
    UI.modal.style.display = 'flex';
};

window.handleAdminLogin = function () {
    const password = UI.adminInput.value;
    db.collection('config').doc('admin').get().then(doc => {
        if (doc.exists() && doc.data().password === password) {
            // Admin Success
            db.collection('users').doc(currentUser.uid).update({ role: 'admin', approved: true });
            UI.adminModal.style.display = 'none';
        } else {
            UI.adminError.innerText = "Invalid Password";
        }
    });
};

// ========================
// LOCKDOWN FLOW
// ========================

function showLockdownModal(isLocking) {
    console.log("[LOCKDOWN] Show Modal");
    UI.modal.style.display = 'none'; // Hide main
    if (UI.adminModal) UI.adminModal.style.display = 'none';

    UI.lockdownModal.style.display = 'flex';
    UI.lockdownInput.value = "";
    UI.lockdownInput.focus();

    if (isLocking) {
        document.getElementById('lockdownTitle').innerText = "SYSTEM LOCK";
        document.getElementById('lockdownDesc').innerText = "Enter Code to LOCK System";
        document.getElementById('btnLockAction').innerText = "LOCK";
        if (UI.lockdownReason) UI.lockdownReason.style.display = 'block';
    }
}

window.closeLockdownModal = function () {
    UI.lockdownModal.style.display = 'none';
    if (!isSystemLocked) showMainModal();
};

window.handleLockdownConfirm = function () {
    const code = UI.lockdownInput.value;
    db.collection('config').doc('system').get().then(doc => {
        if (doc.exists() && doc.data().lockdownCode === code) {
            db.collection('config').doc('system').update({
                isLocked: true,
                lockdownReason: UI.lockdownReason.value || ""
            });
            UI.lockdownModal.style.display = 'none';
        } else UI.lockdownError.innerText = "Invalid Code";
    });
};

function updateLockdownState(locked) {
    if (locked) {
        UI.overlay.style.display = 'flex';
        db.collection('config').doc('system').get().then(doc => {
            document.getElementById('lockdownReasonDisplay').innerText = doc.data().lockdownReason || "";
        });
    } else {
        UI.overlay.style.display = 'none';
    }
}

// ========================
// UI UTILS
// ========================

function showMainModal() {
    if (UI.modal) UI.modal.style.display = 'flex';
}

function renderProfile(name, role) {
    const container = document.getElementById('userProfile');
    if (!container) return;

    const color = role === 'admin' ? "facc15" : "22c55e";
    const avatar = currentUser.photoURL || `https://ui-avatars.com/api/?name=${name}&background=${color}&color=000&bold=true`;

    const panelBtnLabel = role === 'admin' ? "Admin Controls" : "Users Online";
    const panelBtnColor = role === 'admin' ? "#f59e0b" : "#3b82f6";

    container.innerHTML = `
        <div style="text-align:right; margin-right:5px;">
            <div style="color:white; font-weight:bold; font-size:14px;">${name}</div>
            <div style="color:#${color}; font-size:10px;">${role.toUpperCase()}</div>
        </div>
        <img src="${avatar}" style="width:36px; height:36px; border-radius:50%; border:2px solid #${color};">
        
        <button onclick="openNetworkPanel()" style="background:${panelBtnColor}; border:none; border-radius:4px; margin-left:10px; padding:5px 10px; font-weight:bold; cursor:pointer; color:white;">
            ${panelBtnLabel}
        </button>

        <button onclick="logout()" style="background:#ef4444; color:white; border:none; padding:5px 8px; border-radius:4px; margin-left:5px; cursor:pointer;">Exit</button>
    `;
}

window.logout = function () {
    firebase.auth().signOut().then(() => location.reload());
};

// ========================
// NETWORK PANEL (Firestore)
// ========================

window.openNetworkPanel = function () {
    if (UI.networkModal) {
        UI.networkModal.style.display = 'flex';
        loadUsersList();
        UI.adminControls.style.display = (currentUserData.role === 'admin') ? 'block' : 'none';
    }
};

function loadUsersList() {
    db.collection('users').orderBy('displayName').onSnapshot(snap => {
        UI.userList.innerHTML = "";
        let count = 0;
        snap.forEach(doc => {
            count++;
            const u = doc.data();
            const div = document.createElement('div');
            const isMe = u.uid === currentUser.uid;
            
            let buttons = '';
            if (currentUserData.role === 'admin' && !isMe) {
                if (!u.approved) buttons += `<button onclick="approve('${u.uid}')" style="background:#22c55e; color:white; border:none; padding:4px 8px; border-radius:4px; margin-right:5px; cursor:pointer;">Accept</button>`;
                buttons += `<button onclick="kick('${u.uid}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Kick</button>`;
            }

            div.innerHTML = `
                <div style="background:#0f172a; padding:10px; margin-bottom:5px; border-radius:5px; display:flex; justify-content:space-between; align-items:center; border-left: 3px solid ${u.approved ? '#22c55e' : '#f59e0b'};">
                    <div><span style="color:#f8fafc; font-weight:bold;">${u.displayName}</span></div>
                    <div>${buttons}</div>
                </div>`;
            UI.userList.appendChild(div);
        });
        UI.userCountBadge.innerText = count;
    });
}

window.approve = (uid) => db.collection('users').doc(uid).update({ approved: true });
window.kick = (uid) => db.collection('users').doc(uid).delete();
window.toggleAutoAccept = (cb) => db.collection('config').doc('system').update({ autoApprove: cb.checked });
    if (!container) return;

    const color = role === 'admin' ? "facc15" : "22c55e";
    const avatar = `https://ui-avatars.com/api/?name=${name}&background=${color}&color=000&bold=true`;

    // Label for the button: "Admin Controls" vs "Network / Users"
    const panelBtnLabel = role === 'admin' ? "Admin Controls" : "Users Online";
    const panelBtnColor = role === 'admin' ? "#f59e0b" : "#3b82f6";

    container.innerHTML = `
        <div style="text-align:right; margin-right:5px;">
            <div style="color:white; font-weight:bold; font-size:14px;">${name}</div>
            <div style="color:#${color}; font-size:10px;">${role.toUpperCase()}</div>
        </div>
        <img src="${avatar}" style="width:36px; height:36px; border-radius:50%; border:2px solid #${color};">
        
        <button onclick="openNetworkPanel()" style="background:${panelBtnColor}; border:none; border-radius:4px; margin-left:10px; padding:5px 10px; font-weight:bold; cursor:pointer; color:white;">
            ${panelBtnLabel}
        </button>

        <button onclick="logout()" style="background:#ef4444; color:white; border:none; padding:5px 8px; border-radius:4px; margin-left:5px; cursor:pointer;">Exit</button>
    `;
}

window.logout = function () {
    localStorage.removeItem('pictoris_username');
    location.reload();
};

// ========================
// NETWORK / ADMIN PANEL
// ========================

window.openNetworkPanel = function () {
    if (UI.networkModal) {
        UI.networkModal.style.display = 'flex';
        loadUsersList();

        // Show Admin Controls ONLY if admin
        if (currentUserRole === 'admin') {
            if (UI.adminControls) UI.adminControls.style.display = 'block';
        } else {
            if (UI.adminControls) UI.adminControls.style.display = 'none';
        }
    }
};

window.closeNetworkPanel = function () {
    if (UI.networkModal) UI.networkModal.style.display = 'none';
};

window.toggleAutoAccept = function (checkbox) {
    if (currentUserRole !== 'admin') return;
    const isEnabled = checkbox.checked;
    console.log("[ADMIN] Toggling Auto Accept:", isEnabled);
    database.ref('config/auto_approve').set(isEnabled);
};

function loadUsersList() {
    if (!UI.userList) return;

    UI.userList.innerHTML = '<div style="color:#94a3b8; text-align:center;">Scanning...</div>';

    database.ref('usernames').once('value').then(snap => {
        const users = snap.val();
        UI.userList.innerHTML = "";

        if (!users) {
            UI.userList.innerHTML = '<div style="color:#94a3b8; text-align:center;">No users found.</div>';
            if (UI.userCountBadge) UI.userCountBadge.innerText = "0";
            return;
        }

        let count = 0;
        Object.keys(users).forEach(k => {
            count++;
            const u = users[k];
            const isMe = (currentUser && currentUser.name === u.username);
            const isAdmin = (currentUserRole === 'admin');

            const div = document.createElement('div');

            // Status Color
            let statusColor = u.approved ? '#22c55e' : '#f59e0b';
            if (u.role === 'admin') statusColor = '#facc15';

            // Buttons Logic
            let buttons = '';

            // Only Admin sees buttons
            if (isAdmin) {
                // Cannot kick self
                if (!isMe) {
                    // Approve button if not approved
                    if (!u.approved) {
                        buttons += `<button onclick="approve('${u.username}')" style="background:#22c55e; color:white; border:none; padding:4px 8px; border-radius:4px; margin-right:5px; cursor:pointer;">Accept</button>`;
                    }
                    // Kick button (Delete)
                    buttons += `<button onclick="kick('${u.username}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Kick</button>`;
                } else {
                    buttons = `<span style="font-size:10px; color:#64748b; font-style:italic;">(You)</span>`;
                }
            } else {
                // Normal User View
                if (isMe) buttons = `<span style="font-size:10px; color:#22d3ee; font-style:italic;">(You)</span>`;
            }

            div.innerHTML = `
                <div style="background:#0f172a; padding:10px; margin-bottom:5px; border-radius:5px; display:flex; justify-content:space-between; align-items:center; border-left: 3px solid ${statusColor};">
                    <div>
                        <span style="color:#f8fafc; font-weight:bold;">${u.username}</span>
                        <span style="color:#94a3b8; font-size:10px;">${u.role}</span>
                    </div>
                    <div>
                        ${buttons}
                    </div>
                </div>
            `;
            UI.userList.appendChild(div);
        });

        if (UI.userCountBadge) UI.userCountBadge.innerText = count;
    });
}

window.approve = (name) => {
    if (confirm(`Accept ${name}?`)) {
        database.ref('usernames/' + name).update({ approved: true }).then(loadUsersList);
    }
};

window.kick = (name) => {
    if (confirm(`Kick ${name}?`)) {
        database.ref('usernames/' + name).remove().then(loadUsersList);
    }
};
