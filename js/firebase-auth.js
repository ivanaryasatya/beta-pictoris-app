// Firebase Authentication & Mode Logic

let currentUser = null;
let isRealMode = false;

// UI Elements (Will be populated on load)
let authModal, btnLoginGoogle, btnContinueGuest;

document.addEventListener('DOMContentLoaded', () => {
    authModal = document.getElementById('authModal');

    // Check if we are on the dashboard page
    if (authModal) {
        initAuthUI();
    }
});

function initAuthUI() {
    // Initialize Buttons
    document.getElementById('btnLoginGoogle').addEventListener('click', loginWithGoogle);
    document.getElementById('btnContinueGuest').addEventListener('click', startGuestSession);

    // Listen for Auth State
    auth.onAuthStateChanged(user => {
        renderUserProfile(user); // Update Header UI

        if (user) {
            currentUser = user;
            console.log("User logged in:", user.email);
            checkUserRole(user);
        } else {
            // No user is signed in.
            console.log("No user logged in.");
            showAuthModal();
        }
    });

    // Logout Button (Add to header if needed)
    // Removed duplicate listener as it will be handled in renderUserProfile
}

function renderUserProfile(user) {
    const container = document.getElementById('userProfile');
    if (!container) return;

    if (user) {
        // Logged In State
        const name = user.displayName || user.email.split('@')[0];
        const photo = user.photoURL || "https://ui-avatars.com/api/?name=" + name + "&background=random";

        container.innerHTML = `
            <div style="text-align:right; line-height:1.2;">
                <div style="font-size:12px; font-weight:bold; color:#f8fafc;">${name}</div>
                <div style="font-size:10px; color:${isRealMode ? '#4ade80' : '#fbbf24'}">${isRealMode ? 'Admin Access' : 'Guest/Pending'}</div>
            </div>
            <img src="${photo}" style="width:32px; height:32px; border-radius:50%; border:2px solid #475569;">
            <button id="btnLogout" style="background:#ef4444; color:white; border:none; padding:5px 10px; border-radius:5px; font-size:10px; cursor:pointer;">Logout</button>
        `;

        document.getElementById('btnLogout').addEventListener('click', () => {
            auth.signOut().then(() => {
                location.reload();
            });
        });

    } else {
        // Logged Out State
        container.innerHTML = `
            <button id="btnLoginHeader" style="background:#3b82f6; color:white; border:none; padding:5px 12px; border-radius:20px; font-size:12px; cursor:pointer; font-weight:bold;">
                Login for Control
            </button>
        `;
        document.getElementById('btnLoginHeader').addEventListener('click', showAuthModal);
    }
}

function showAuthModal() {
    authModal.style.display = 'flex';
}

function hideAuthModal() {
    authModal.style.display = 'none';
}

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            // User signed in
            hideAuthModal();
        }).catch((error) => {
            console.error("Login Error:", error);
            alert("Login Failed: " + error.message);
        });
}

function startGuestSession() {
    console.log("Starting Guest Session");
    hideAuthModal();
    isRealMode = false;
    startDummyMode();
    logToTerminal("[SYSTEM] Guest Mode Active - Displaying Dummy Data");
    // Disable Controls visually or logically?
    disableRealControls();
}

function checkUserRole(user) {
    hideAuthModal();

    // Check if user is approved in Realtime Database
    // Path: /users/{uid}/approved
    const userRef = database.ref('users/' + user.uid);

    userRef.once('value').then((snapshot) => {
        const userData = snapshot.val();

        if (userData && userData.approved === true) {
            console.log("User Approved. Starting Real Mode.");
            isRealMode = true;
            stopDummyMode(); // Stop simulation if running
            enableRealControls();
            logToTerminal("[SYSTEM] AUTHENTICATED. CONNECTED TO ROBOT.");

            // Start listening to real robot data
            listenToRobotData();
        } else {
            console.log("User Not Approved. Starting Guest Mode (Pending).");
            isRealMode = false;
            startDummyMode();
            logToTerminal("[SYSTEM] User Pending Approval. Showing Dummy Data.");

            // Create user entry if not exists
            if (!userData) {
                userRef.set({
                    email: user.email,
                    name: user.displayName,
                    approved: false,
                    lastLogin: Date.now()
                });
            }
        }
    }).catch(err => {
        console.error("Error checking role:", err);
        startGuestSession();
    });
}

// Control Logic Helpers
function disableRealControls() {
    // maybe gray out buttons or just prevent sending
    document.body.classList.add('guest-mode');
}

function enableRealControls() {
    document.body.classList.remove('guest-mode');
}

function listenToRobotData() {
    // Listen to /robot/telemetry path
    database.ref('robot/telemetry').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            // Update UI with REAL data
            // Expecting data like { battery: 12.5, temp: 45, ... }
            if (data.battery) {
                updateChart('batteryChart', data.battery);
                document.getElementById('val_batteryChart').innerText = data.battery + '%';
            }
            // ... map other fields
        }
    });

    // Listen to /robot/logs
    database.ref('robot/logs').limitToLast(1).on('child_added', (snapshot) => {
        const log = snapshot.val();
        logToTerminal(log);
    });
}

function sendCommandToFirebase(cmd) {
    if (!isRealMode) {
        logToTerminal("[GUEST] Command ignored: " + cmd);
        return;
    }

    // Push command to /robot/commands
    const cmdRef = database.ref('robot/commands').push();
    cmdRef.set({
        command: cmd,
        timestamp: Date.now(),
        user: currentUser.email
    });
    logToTerminal("[TX] " + cmd);
}
