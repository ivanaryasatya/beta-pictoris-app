/**
 * REBUILT FIREBASE AUTH SYSTEM v2
 * Handles: User Identification, Admin Login, System Lockdown, Network Panel
 */

console.log("[AUTH] Script Loaded v2");

// Global State
let currentUser = null;
let currentUserRole = 'guest'; // 'guest', 'user', 'admin'
let isSystemLocked = false;
let autoAcceptEnabled = false;

// DOM Elements
const UI = {
    // Main Auth
    modal: null,
    input: null,
    btnRequest: null,
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
        UI.input = document.getElementById('usernameInput');
        UI.btnRequest = document.getElementById('btnRequestAccess');
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
    // Bind Events
    if (UI.btnRequest) UI.btnRequest.addEventListener('click', () => handleRequestAccess(isLanding));
    if (UI.input) {
        UI.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleRequestAccess(isLanding);
        });
    }

    if (UI.btnAdmin) UI.btnAdmin.addEventListener('click', showAdminLogin);
    if (UI.btnLock) UI.btnLock.addEventListener('click', () => showLockdownModal(true));

    // Landing Page Enter Button
    const btnEnter = document.getElementById('btnEnterApp');
    if (btnEnter) {
        btnEnter.addEventListener('click', () => {
            // If we already have a session? handled in checkSession UI update
            if (currentUser) {
                window.location.href = 'control-panel.html';
            } else {
                showMainModal();
            }
        });
    }

    // Initialize/Sync Logic (Lockdown, AutoApprove)
    database.ref('config/is_locked').on('value', (snap) => {
        isSystemLocked = (snap.val() === true);
        // Pass context to updateLockdownState
        updateLockdownState(isSystemLocked, isLanding, isControlPanel);
    });

    database.ref('config/auto_approve').on('value', (snap) => {
        autoAcceptEnabled = (snap.val() === true);
        if (UI.chkAutoAccept) UI.chkAutoAccept.checked = autoAcceptEnabled;
    });

    // Check Local Storage
    const storedUser = localStorage.getItem('pictoris_username');
    if (storedUser) {
        console.log("[AUTH] Found stored session:", storedUser);
        checkSession(storedUser, isLanding, isControlPanel);
    } else {
        if (isControlPanel) {
            console.warn("[AUTH] No session on Control Panel. Redirecting.");
            window.location.href = 'index.html';
        } else {
            console.log("[AUTH] Landing Page - Guest");
        }
    }
}

// ========================
// USER FLOW
// ========================

function handleRequestAccess(redirectAfter = false) {
    console.log("[AUTH] handling request...");
    const username = UI.input.value.trim();

    if (!username) {
        UI.error.innerText = "Please enter a username.";
        return;
    }
    // ... validations ...
    if (username.length < 3) { UI.error.innerText = "Too short"; return; }
    if (!/^[a-zA-Z0-9-_]+$/.test(username)) { UI.error.innerText = "Invalid chars"; return; }

    // UI Feedback
    UI.btnRequest.disabled = true;
    UI.btnRequest.innerText = "Verifying...";
    UI.error.innerText = "";

    // Store if we need to redirect
    UI.redirectOnSuccess = redirectAfter;

    // 1. Check if user exists
    database.ref('usernames/' + username).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                console.log("[AUTH] User exists. Checking status...");
                // Just update status (re-login)
                updateUserStatus(username, false);
            } else {
                console.log("[AUTH] New user. Registering...");
                registerNewUser(username);
            }
        })
        .catch(err => {
            console.error(err);
            UI.error.innerText = "Network Error. Try again.";
            resetMainBtn();
        });
}

function registerNewUser(username) {
    // Check Auto-Approve Config BEFORE creating user
    database.ref('config/auto_approve').once('value').then(snap => {
        const shouldApprove = (snap.val() === true);

        const userData = {
            username: username,
            role: 'user',
            approved: shouldApprove, // Set based on config
            connectedAt: firebase.database.ServerValue.TIMESTAMP
        };

        database.ref('usernames/' + username).set(userData)
            .then(() => {
                console.log(`[AUTH] User registered. Auto-Approved: ${shouldApprove}`);
                startSessionMonitoring(username);
            })
            .catch(err => {
                UI.error.innerText = "Reg Error: " + err.message;
                resetMainBtn();
            });
    });
}

function updateUserStatus(username, approved) {
    database.ref('usernames/' + username).update({
        connectedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        startSessionMonitoring(username);
    });
}

function checkSession(username, isLanding, isControlPanel) {
    database.ref('usernames/' + username).once('value')
        .then(snap => {
            if (snap.exists()) {
                const data = snap.val();
                currentUserRole = data.role || 'user';

                // If on Landing Page, Update Button to "Continue" and Redirect on Click
                if (isLanding) {
                    const btn = document.getElementById('btnEnterApp');
                    const info = document.getElementById('sessionInfo');

                    if (btn) {
                        btn.innerHTML = `<span>🚀</span> CONTINUE AS ${username.toUpperCase()}`;
                        // Clone to remove existing listeners (showMainModal), then add redirect
                        const newBtn = btn.cloneNode(true);
                        btn.parentNode.replaceChild(newBtn, btn);
                        newBtn.addEventListener('click', () => window.location.href = 'control-panel.html');

                        // Auto-redirect if they just arrived? No, let them choose.
                        // But user wants "always login". If they have session, maybe auto-redirect?
                        // "buat supaya user dan admin selalu masuk ke home page dulu" -> They want Landing first.
                        // So button click is fine.
                    }
                    if (info) info.innerText = `Role: ${currentUserRole}`;

                    currentUser = { name: username };
                    return;
                }

                if (isControlPanel) {
                    startSessionMonitoring(username);
                }

            } else {
                // Invalid session
                localStorage.removeItem('pictoris_username');
                if (isControlPanel) window.location.href = 'index.html';
            }
        });
}

function startSessionMonitoring(username) {
    // Set Local
    currentUser = { name: username };
    localStorage.setItem('pictoris_username', username);

    // Listen for changes (Approval/Kick)
    database.ref('usernames/' + username + '/approved').on('value', snap => {
        const isApproved = snap.val();

        console.log(`[AUTH] Approval Status for ${username}: ${isApproved}`);

        if (isApproved === true || currentUserRole === 'admin') {
            // Success
            loginSuccess(username);
        } else {
            // Pending or Kicked
            if (UI.btnRequest) {
                UI.btnRequest.innerText = "Waiting for Admin Approval...";
                UI.btnRequest.disabled = true;
            }
            if (UI.modal && UI.modal.style.display === 'none') {
                // If we were logged in and got kicked
                showMainModal();
                UI.error.innerText = "Access Revoked by Admin.";
            }
        }
    });

    // ADMIN ONLY: Listen for new users to Auto-Approve
    if (currentUserRole === 'admin') {
        startAutoApprover();
    }
}

function startAutoApprover() {
    console.log("[ADMIN] Starting Auto-Approver Listener");
    database.ref('usernames').on('child_added', snapshot => {
        if (autoAcceptEnabled) {
            const u = snapshot.val();
            if (u && u.approved === false) {
                console.log(`[ADMIN] Auto-approving: ${u.username}`);
                database.ref('usernames/' + u.username).update({ approved: true });
            }
        }
    });
}

function loginSuccess(username) {
    console.log("[AUTH] Login Success!");
    if (UI.modal) UI.modal.style.display = 'none';

    // CHECK FOR LANDING PAGE REDIRECT
    if (document.getElementById('btnEnterApp')) {
        console.log("[AUTH] Landing Page detected. Redirecting to Control Panel...");
        window.location.href = 'control-panel.html';
        return;
    }

    // Render Header Profile (if on control panel)
    renderProfile(username, currentUserRole);
}

function resetMainBtn() {
    UI.btnRequest.disabled = false;
    UI.btnRequest.innerText = "Request Access";
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
    database.ref('config/admin_password').once('value').then(snap => {
        if (String(snap.val()) === password) {
            // Admin Success
            createAdminSession();
        } else {
            UI.adminError.innerText = "Invalid Password";
        }
    });
};

function createAdminSession() {
    const adminName = "Admin_Console";
    currentUserRole = 'admin';

    // Auto-approve admin
    database.ref('usernames/' + adminName).update({
        username: adminName,
        role: 'admin',
        approved: true,
        connectedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        UI.adminModal.style.display = 'none';
        startSessionMonitoring(adminName);
    });
}

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
    database.ref('config/lockdown_code').once('value').then(snap => {
        if (String(snap.val()) === code) {
            // Code Correct
            const reason = UI.lockdownReason ? UI.lockdownReason.value : "";

            // Set Lock
            database.ref().update({
                "config/is_locked": true,
                "config/lockdown_reason": reason
            });

            UI.lockdownModal.style.display = 'none';
        } else {
            UI.lockdownError.innerText = "Invalid Code";
        }
    });
};

function updateLockdownState(locked) {
    if (locked) {
        UI.overlay.style.display = 'flex';
        // Get Reason
        database.ref('config/lockdown_reason').once('value').then(s => {
            const r = s.val();
            document.getElementById('lockdownReasonDisplay').innerText = r || "";
        });

        // Hide others
        if (UI.modal) UI.modal.style.display = 'none';
    } else {
        UI.overlay.style.display = 'none';
        if (!currentUser) showMainModal();
    }
}

// ========================
// UI UTILS
// ========================

function showMainModal() {
    if (UI.modal) UI.modal.style.display = 'flex';
    if (UI.input) UI.input.focus();
    resetMainBtn();
}

function renderProfile(name, role) {
    const container = document.getElementById('userProfile');
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
