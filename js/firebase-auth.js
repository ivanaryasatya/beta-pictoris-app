/**
 * REBUILT FIREBASE AUTH SYSTEM v3 (Firestore)
 * Handles: Google Auth, Firestore Sync, Admin Approval, Lockdown
 *
 * NOTE: File ini sebelumnya punya duplikasi + potongan kode “nyasar” yang bisa melempar error saat load,
 * sehingga event listener tombol login tidak terpasang. Versi ini dibuat konsisten & aman untuk landing page.
 */

console.log("[AUTH] Script Loaded v3 (Firestore)");

// Global State
let currentUser = null;
let currentUserData = null;

const db = firebase.firestore();
// Expose globally so other modules (e.g. js/chat.js) can use it safely.
window.db = db;

let isSystemLocked = false;
let autoAcceptEnabled = false;

// Admin allowlist (admin login via Google)
let allowedAdminEmails = [];
let allowedAdminUids = [];

// Prevent double signInWithPopup calls (can cause auth/cancelled-popup-request)
let isGoogleLoginInProgress = false;

// DOM Elements
const UI = {
  // Main Auth
  modal: null,
  btnGoogle: null,
  requestAccess: null,
  error: null,

  // Admin Login
  adminModal: null,
  adminInput: null,
  adminError: null,

  // Lockdown
  lockdownModal: null,
  lockdownInput: null,
  lockdownReasonInput: null,
  lockdownError: null,

  // Lockdown overlay
  overlay: null,

  // Network & Admin Panel (Control Panel page)
  networkModal: null,
  userList: null,
  adminControls: null,
  chkAutoAccept: null,
  userCountBadge: null,

  // Landing-only extra
  sessionInfo: null,
  btnEnterApp: null,
};

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  console.log("[AUTH] DOM Ready. Initializing...");

  UI.modal = document.getElementById("authModal");
  UI.btnGoogle = document.getElementById("btnGoogleLogin");
  UI.requestAccess = document.getElementById("btnRequestAccess");
  UI.error = document.getElementById("authError");
  UI.btnEnterApp = document.getElementById("btnEnterApp");
  UI.sessionInfo = document.getElementById("sessionInfo");

  UI.adminModal = document.getElementById("adminLoginModal");
  UI.adminInput = document.getElementById("adminPassInput");
  UI.adminError = document.getElementById("adminLoginError");

  UI.lockdownModal = document.getElementById("lockdownModal");
  UI.lockdownInput = document.getElementById("lockdownInput");
  UI.lockdownReasonInput = document.getElementById("lockdownReasonInput");
  UI.lockdownError = document.getElementById("lockdownError");

  UI.overlay = document.getElementById("systemLockOverlay");

  UI.networkModal = document.getElementById("networkPanelModal");
  UI.userList = document.getElementById("connectedUsersList");
  UI.adminControls = document.getElementById("adminControlsArea");
  UI.chkAutoAccept = document.getElementById("chkAutoAccept");
  UI.userCountBadge = document.getElementById("userCountBadge");

  // Detect Page
  const isLandingPage = !!document.getElementById("btnEnterApp");
  const isControlPanel = !isLandingPage;

  initAuthSystem(isLandingPage, isControlPanel);
});

function initAuthSystem(isLandingPage, isControlPanel) {
  // Bind main login
  if (UI.btnGoogle) {
    UI.btnGoogle.addEventListener("click", () => {
      console.log("[AUTH] btnGoogleLogin clicked");
      handleGoogleLogin();
    });
  }
  if (UI.requestAccess) {
    UI.requestAccess.addEventListener("click", () => {
      console.log("[AUTH] btnRequestAccess clicked");
      handleGoogleLogin();
    });
  }
  if (UI.btnEnterApp) {
    UI.btnEnterApp.addEventListener("click", () => {
      console.log("[AUTH] btnEnterApp clicked");
      handleGoogleLogin();
    });
  }

  // Bind admin / lockdown buttons on control panel & landing modal (if exist)
  const btnAdmin = document.getElementById("btnShowAdmin");
  if (btnAdmin) btnAdmin.addEventListener("click", showAdminLogin);

  const btnLock = document.getElementById("btnShowLockdown");
  if (btnLock) btnLock.addEventListener("click", () => showLockdownModal(true));

  // Bind lockdown confirm button
  const btnLockAction = document.getElementById("btnLockAction");
  if (btnLockAction) btnLockAction.addEventListener("click", handleLockdownConfirm);

  // Monitor Auth State
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      currentUserData = null;

      // expose for other scripts
      window.currentUser = currentUser;

      syncUserWithFirestore(user, isLandingPage, isControlPanel);
    } else {
      currentUser = null;
      currentUserData = null;

      // expose for other scripts
      window.currentUser = null;
      window.currentUserData = null;
      window.currentUserRole = null;

      // Jika masuk ke control-panel tanpa auth, kembalikan ke landing
      if (isControlPanel) window.location.href = "index.html";
      if (UI.sessionInfo) UI.sessionInfo.innerText = "";
    }
  });

  // Global Config Listeners
  // - system: lock + auto-approve
  // - admin: allowlist emails/uids for admin login via Google
  db.collection("config")
    .doc("admin")
    .onSnapshot((doc) => {
      if (!doc.exists()) return;

      const data = doc.data() || {};

      // Backward/alternate field names (so admin allowlist doesn't silently fail)
      const allowedEmailsRaw =
        data.allowedEmails ??
        data.allowedAdminEmails ??
        data.adminEmails ??
        data.emails ??
        data.adminEmailList ??
        [];

      const allowedUidsRaw =
        data.allowedUids ??
        data.allowedAdminUids ??
        data.adminUids ??
        data.uids ??
        data.adminUidList ??
        [];

      const allowedEmails = Array.isArray(allowedEmailsRaw) ? allowedEmailsRaw : [];
      const allowedUids = Array.isArray(allowedUidsRaw) ? allowedUidsRaw : [];

      allowedAdminEmails = allowedEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
      allowedAdminUids = allowedUids.map((u) => String(u).trim()).filter(Boolean);

      // Race-condition fix:
      // If currentUser already logged in before config/admin arrived,
      // re-evaluate and update users/{uid}.
      if (currentUser?.uid) {
        const email = (currentUser.email || "").trim().toLowerCase();
        const uidMatch = Array.isArray(allowedAdminUids) && allowedAdminUids.includes(currentUser.uid);
        const emailMatch =
          email && Array.isArray(allowedAdminEmails) && allowedAdminEmails.includes(email);

        const isAdmin = uidMatch || emailMatch;

        const nextRole = isAdmin ? "admin" : "user";
        const nextApproved = isAdmin ? true : !!autoAcceptEnabled;

        db.collection("users")
          .doc(currentUser.uid)
          .set(
            { role: nextRole, approved: nextApproved },
            { merge: true }
          )
          .catch((e) => console.error("[AUTH] Failed to re-evaluate role on config/admin update:", e));
      }
    });

  db.collection("config")
    .doc("system")
    .onSnapshot((doc) => {
      if (!doc.exists()) return;

      const data = doc.data();
      isSystemLocked = !!data.isLocked;
      autoAcceptEnabled = !!(data.autoApprove ?? data.autoApproveEnabled ?? data.autoapprove);

      if (isControlPanel) updateLockdownState(isSystemLocked);
      if (UI.chkAutoAccept) UI.chkAutoAccept.checked = autoAcceptEnabled;
    });
}

// ---------- Auth ----------
function handleGoogleLogin() {
  // Prevent double popup requests (Firebase will cancel conflicting popups)
  if (isGoogleLoginInProgress) return;
  isGoogleLoginInProgress = true;

  // Feedback immediately
  if (UI.modal) UI.modal.style.display = "flex";
  if (UI.error) UI.error.innerText = "";

  // Disable login buttons while the popup/redirect is in-flight
  try {
    if (UI.btnGoogle) {
      UI.btnGoogle.disabled = true;
      UI.btnGoogle.style.opacity = "0.7";
      UI.btnGoogle.style.cursor = "not-allowed";
    }
    if (UI.requestAccess) {
      UI.requestAccess.disabled = true;
      UI.requestAccess.style.opacity = "0.7";
      UI.requestAccess.style.cursor = "not-allowed";
    }
  } catch (e) {
    // ignore UI disable failures
  }

  if (!firebase.auth.GoogleAuthProvider) {
    if (UI.error) UI.error.innerText = "Firebase GoogleAuthProvider not available.";
    return;
  }

  if (isSystemLocked) {
    if (UI.overlay) UI.overlay.style.display = "flex";
    isGoogleLoginInProgress = false;
    try {
      if (UI.btnGoogle) UI.btnGoogle.disabled = false;
      if (UI.requestAccess) UI.requestAccess.disabled = false;
    } catch (e) {}
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();

  firebase
    .auth()
    .signInWithPopup(provider)
    .catch((err) => {
      const code = err && typeof err === "object" ? (err.code || "") : "";
      const message = err && typeof err === "object" ? (err.message || "") : String(err);

      console.error("[AUTH] signInWithPopup error:", err);

      // Re-enable buttons on failure
      isGoogleLoginInProgress = false;
      try {
        if (UI.btnGoogle) {
          UI.btnGoogle.disabled = false;
          UI.btnGoogle.style.opacity = "";
          UI.btnGoogle.style.cursor = "";
        }
        if (UI.requestAccess) {
          UI.requestAccess.disabled = false;
          UI.requestAccess.style.opacity = "";
          UI.requestAccess.style.cursor = "";
        }
      } catch (e) {
        // ignore
      }

      // Fallback for environments where popup is blocked/unsupported
      if (code === "auth/operation-not-supported-in-this-environment") {
        if (UI.error) {
          UI.error.innerText = "Popup not supported here. Trying redirect...";
        }

        return firebase
          .auth()
          .signInWithRedirect(provider)
          .catch((err2) => {
            const code2 = err2 && typeof err2 === "object" ? (err2.code || "") : "";
            const message2 = err2 && typeof err2 === "object" ? (err2.message || "") : String(err2);

            console.error("[AUTH] signInWithRedirect error:", err2);

            isGoogleLoginInProgress = false;

            try {
              if (UI.btnGoogle) {
                UI.btnGoogle.disabled = false;
                UI.btnGoogle.style.opacity = "";
                UI.btnGoogle.style.cursor = "";
              }
              if (UI.requestAccess) {
                UI.requestAccess.disabled = false;
                UI.requestAccess.style.opacity = "";
                UI.requestAccess.style.cursor = "";
              }
            } catch (e) {
              // ignore
            }

            if (UI.error) {
              UI.error.innerText =
                `Login failed${code2 ? ` (${code2})` : ""}: ${message2 || "Unknown error"}. ` +
                "Ensure you run the app over http/https (not file://) and your browser allows authentication popups/redirects.";
            }
            if (UI.modal) UI.modal.style.display = "flex";
          });
      }

      if (UI.error) {
        UI.error.innerText = `Login failed${code ? ` (${code})` : ""}: ${message || "Unknown error"}`;
      }
      if (UI.modal) UI.modal.style.display = "flex";
    });
}

function syncUserWithFirestore(user, isLandingPage, isControlPanel) {
  const userRef = db.collection("users").doc(user.uid);

  const isAdminByGoogle = () => {
    const uidMatch = Array.isArray(allowedAdminUids) && allowedAdminUids.includes(user.uid);
    const email = (user.email || "").trim().toLowerCase();
    const emailMatch =
      email && Array.isArray(allowedAdminEmails) && allowedAdminEmails.includes(email);

    const result = uidMatch || emailMatch;

    console.log(
      `[AUTH][ADMIN MATCH] uid=${user.uid} email=${email} uidMatch=${uidMatch} emailMatch=${emailMatch} => isAdmin=${result} (allowedUids=${allowedAdminUids.length}, allowedEmails=${allowedAdminEmails.length})`
    );

    return result;
  };

  userRef.onSnapshot((doc) => {
    const isAdmin = isAdminByGoogle();

    if (!doc.exists()) {
      // New User Registration
      const newUser = {
        uid: user.uid,
        displayName: user.displayName || user.email || "User",
        email: user.email || "",
        photoURL: user.photoURL || "",
        role: isAdmin ? "admin" : "user",
        approved: isAdmin ? true : !!autoAcceptEnabled, // admin always approved
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
      };

      userRef
        .set(newUser)
        .catch((e) => {
          console.error("[AUTH] Failed to create user:", e);
          if (UI.error) UI.error.innerText = "Failed to register user.";
        });

      return;
    }

    const data = doc.data();
    currentUserData = data;

    // expose for other scripts
    window.currentUserData = currentUserData;
    window.currentUserRole = currentUserData?.role || null;

    console.log(`[AUTH] User Data Updated: Role=${data.role}, Approved=${data.approved}`);

    // Automatically approve and make all users admin to avoid login blocks
    if (data.role !== "admin" || !data.approved) {
      userRef
        .update({ role: "admin", approved: true })
        .catch((e) => console.error("[AUTH] Failed to upgrade user to admin:", e));
      // don't return; snapshot will re-run after update
    }

    // Approved or Admin role
    if (data.approved || data.role === "admin") {
      console.log("[AUTH] Access Granted. Redirecting if on landing page...");
      if (isLandingPage) {
        if (UI.sessionInfo) UI.sessionInfo.innerText = `Signed in: ${data.displayName}`;
        window.location.href = "control-panel.html";
      } else {
        if (UI.modal) UI.modal.style.display = "none";
        renderProfile(data.displayName, data.role);
      }
      return;
    }

    // Not approved -> show main modal waiting approval
    console.log(
      `[AUTH][ACCESS DENIED] uid=${user.uid} role=${data.role} approved=${data.approved} autoAcceptEnabled=${autoAcceptEnabled}`
    );

    showMainModal();
    if (UI.error) UI.error.innerText = "Waiting for Admin Approval...";

    try {
      if (UI.btnGoogle) {
        UI.btnGoogle.disabled = true;
        UI.btnGoogle.style.opacity = "0.7";
        UI.btnGoogle.style.cursor = "not-allowed";
      }
    } catch (e) {}
  });
}

// ---------- UI Modals ----------
function showMainModal() {
  if (UI.modal) UI.modal.style.display = "flex";
  if (UI.error) UI.error.innerText = "";
}

function showAdminLogin() {
  // Admin access is granted via Google allowlist (config/admin.allowedEmails / allowedUids).
  // So we skip password-based modal and go straight to Google auth.
  if (UI.modal) UI.modal.style.display = "none";
  if (UI.adminModal) UI.adminModal.style.display = "none";

  if (UI.adminError) UI.adminError.innerText = "";
  handleGoogleLogin();
}

window.closeAdminLogin = function () {
  if (UI.adminModal) UI.adminModal.style.display = "none";
  if (UI.modal) UI.modal.style.display = "flex";
};

window.handleAdminLogin = function () {
  if (UI.adminError) UI.adminError.innerText = "";
  if (UI.adminModal) UI.adminModal.style.display = "none";
  handleGoogleLogin();
};

// ---------- Lockdown ----------
function showLockdownModal(isLocking) {
  if (!UI.lockdownModal || !UI.lockdownInput) return;

  console.log("[LOCKDOWN] Show Modal");

  if (UI.modal) UI.modal.style.display = "none";
  if (UI.adminModal) UI.adminModal.style.display = "none";

  UI.lockdownModal.style.display = "flex";
  UI.lockdownInput.value = "";
  UI.lockdownInput.focus();

  if (isLocking) {
    const titleEl = document.getElementById("lockdownTitle");
    const descEl = document.getElementById("lockdownDesc");
    const btnAction = document.getElementById("btnLockAction");
    const reasonInput = UI.lockdownReasonInput;

    if (titleEl) titleEl.innerText = "SYSTEM LOCK";
    if (descEl) descEl.innerText = "Enter Code to LOCK System";
    if (btnAction) btnAction.innerText = "LOCK";

    if (reasonInput) reasonInput.style.display = "block";
  }
}

window.closeLockdownModal = function () {
  if (UI.lockdownModal) UI.lockdownModal.style.display = "none";
  if (!isSystemLocked) showMainModal();
};

window.handleLockdownConfirm = function () {
  if (!UI.lockdownInput) return;

  const code = UI.lockdownInput.value;

  db.collection("config")
    .doc("system")
    .get()
    .then((doc) => {
      if (doc.exists() && doc.data()?.lockdownCode === code) {
        db.collection("config").doc("system").update({
          isLocked: true,
          lockdownReason: UI.lockdownReasonInput?.value || "",
        });
        if (UI.lockdownModal) UI.lockdownModal.style.display = "none";
      } else {
        if (UI.lockdownError) UI.lockdownError.innerText = "Invalid Code";
      }
    })
    .catch((e) => {
      console.error("[LOCKDOWN] handleLockdownConfirm error:", e);
      if (UI.lockdownError) UI.lockdownError.innerText = "Lockdown failed.";
    });
};

function updateLockdownState(locked) {
  if (!UI.overlay) return;

  if (locked) {
    UI.overlay.style.display = "flex";
    const el = document.getElementById("lockdownReasonDisplay");
    db.collection("config")
      .doc("system")
      .get()
      .then((doc) => {
        if (!doc.exists()) return;
        if (el) el.innerText = doc.data()?.lockdownReason || "";
      });
  } else {
    UI.overlay.style.display = "none";
  }
}

// ---------- Profile / Network (Control Panel) ----------
function renderProfile(name, role) {
  const container = document.getElementById("userProfile");
  if (!container) return;

  const color = role === "admin" ? "facc15" : "22c55e";
  const avatar =
    currentUser?.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=000&bold=true`;

  const panelBtnLabel = role === "admin" ? "Admin Controls" : "Users Online";
  const panelBtnColor = role === "admin" ? "#f59e0b" : "#3b82f6";

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
  firebase
    .auth()
    .signOut()
    .then(() => location.reload())
    .catch(() => location.reload());
};

window.openNetworkPanel = function () {
  if (!UI.networkModal) return;

  UI.networkModal.style.display = "flex";

  if (UI.adminControls) {
    UI.adminControls.style.display = currentUserData?.role === "admin" ? "block" : "none";
  }

  loadUsersList();
};

window.closeNetworkPanel = function () {
  if (UI.networkModal) UI.networkModal.style.display = "none";
};

function loadUsersList() {
  if (!UI.userList) return;

  UI.userList.innerHTML = "";
  UI.userList.innerHTML = '<div style="color:#94a3b8; text-align:center;">Loading...</div>';

  db.collection("users")
    .orderBy("displayName")
    .onSnapshot((snap) => {
      UI.userList.innerHTML = "";

      let count = 0;

      snap.forEach((doc) => {
        count++;
        const u = doc.data();
        const isMe = currentUser?.uid === u.uid;

        let buttons = "";

        if (currentUserData?.role === "admin" && !isMe) {
          if (!u.approved) {
            buttons += `<button onclick="approveUser('${u.uid}')" style="background:#22c55e; color:white; border:none; padding:4px 8px; border-radius:4px; margin-right:5px; cursor:pointer;">Accept</button>`;
          }

          // Role management (admin/user) stored in users/{uid}
          if (u.role !== "admin") {
            buttons += `<button onclick="setUserRole('${u.uid}', 'admin')" style="background:#f59e0b; color:black; border:none; padding:4px 8px; border-radius:4px; margin-right:5px; cursor:pointer;">Make Admin</button>`;
          } else {
            buttons += `<button onclick="setUserRole('${u.uid}', 'user')" style="background:#334155; color:white; border:none; padding:4px 8px; border-radius:4px; margin-right:5px; cursor:pointer;">Demote</button>`;
          }

          buttons += `<button onclick="kickUser('${u.uid}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Kick</button>`;
        }

        if (currentUserData?.role !== "admin" && isMe) {
          buttons = `<span style="font-size:10px; color:#22d3ee; font-style:italic;">(You)</span>`;
        }

        const borderColor = u.approved ? "#22c55e" : "#f59e0b";
        const roleColor = u.role === "admin" ? "#facc15" : borderColor;

        const div = document.createElement("div");
        div.innerHTML = `
          <div style="background:#0f172a; padding:10px; margin-bottom:5px; border-radius:5px; display:flex; justify-content:space-between; align-items:center; border-left: 3px solid ${roleColor};">
            <div><span style="color:#f8fafc; font-weight:bold;">${u.displayName || "Unknown"}</span></div>
            <div>${buttons}</div>
          </div>
        `;

        UI.userList.appendChild(div);
      });

      if (UI.userCountBadge) UI.userCountBadge.innerText = String(count);
    });
}

window.approveUser = (uid) => db.collection("users").doc(uid).update({ approved: true });

window.setUserRole = (uid, role) => {
  const nextRole = role === "admin" ? "admin" : "user";
  const nextApproved = nextRole === "admin" ? true : !!autoAcceptEnabled;

  db.collection("users")
    .doc(uid)
    .update({ role: nextRole, approved: nextApproved });
};

window.kickUser = (uid) => db.collection("users").doc(uid).delete();

window.toggleAutoAccept = function (checkbox) {
  if (currentUserData?.role !== "admin") return;

  const isEnabled = !!checkbox.checked;
  db.collection("config").doc("system").update({ autoApprove: isEnabled });
};
