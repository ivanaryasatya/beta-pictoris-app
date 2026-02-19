// ===== CAMERA CONTROLS =====

let cameraStream = null;
let isCameraOn = false;

function openCameraSettings() {
    const modal = document.getElementById('cameraSettingsModal');
    const backdrop = document.getElementById('backdrop');
    if (modal && backdrop) {
        modal.style.display = 'block';
        backdrop.classList.add('active');

        // Load saved settings
        const savedIP = localStorage.getItem('cam_ip');
        if (savedIP) document.getElementById('cam_ip').value = savedIP;

        const savedSource = localStorage.getItem('cam_source') || 'ip';
        document.getElementById('cam_source').value = savedSource;

        toggleIPSettings(savedSource === 'ip');
    }
}

function closeCameraSettings() {
    const modal = document.getElementById('cameraSettingsModal');
    const backdrop = document.getElementById('backdrop');
    if (modal && backdrop) {
        modal.style.display = 'none';
        backdrop.classList.remove('active');
    }
}

function saveCameraSettings(close = true) {
    const ip = document.getElementById('cam_ip').value;
    const source = document.getElementById('cam_source').value;

    localStorage.setItem('cam_ip', ip);
    localStorage.setItem('cam_source', source);

    toggleIPSettings(source === 'ip');

    if (isCameraOn) {
        reloadCamera();
    }

    if (close) closeCameraSettings();
}

function toggleIPSettings(show) {
    const el = document.getElementById('ip_settings');
    if (el) el.style.display = show ? 'block' : 'none';
}

function toggleCameraState() {
    isCameraOn = !isCameraOn;
    const btn = document.getElementById('btnCamToggle');

    if (isCameraOn) {
        if (btn) btn.style.color = '#22c55e'; // Green
        reloadCamera();
    } else {
        if (btn) btn.style.color = '#ef4444'; // Red
        stopCamera();
    }
}

function stopCamera() {
    const widgetContent = document.querySelector('#widget_camera .widget-content');

    // Stop Webcam Stream
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    // Clear Content
    widgetContent.innerHTML = `
        <div style="color:#475569; text-align:center;">
            <div style="font-size:30px;">📷</div>
            <div style="font-size:12px;">CAMERA OFF</div>
        </div>
    `;
}

async function reloadCamera() {
    if (!isCameraOn) return;

    const widgetContent = document.querySelector('#widget_camera .widget-content');
    const source = localStorage.getItem('cam_source') || 'ip';

    // Stop previous stream if any
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    if (source === 'webcam') {
        // WEBCAM MODE
        widgetContent.innerHTML = `<video id="webcamVideo" autoplay playsinline style="width:100%; height:100%; object-fit:contain; transform: scaleX(-1);"></video>`;
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const videoEl = document.getElementById('webcamVideo');
            videoEl.srcObject = cameraStream;
        } catch (err) {
            console.error("Webcam error:", err);
            widgetContent.innerHTML = `
                <div style="color:#ef4444; text-align:center;">
                    <div style="font-size:30px;">⚠️</div>
                    <div style="font-size:12px;">WEBCAM ERROR</div>
                    <div style="font-size:10px;">${err.message}</div>
                </div>
            `;
            isCameraOn = false;
            document.getElementById('btnCamToggle').style.color = '#ef4444';
        }

    } else {
        // IP CAMERA MODE
        let ip = document.getElementById('cam_ip').value;
        if (!ip) ip = "http://192.168.4.1:81/stream";
        if (!ip.startsWith('http')) ip = 'http://' + ip;

        widgetContent.innerHTML = `
            <img src="${ip}" style="width:100%; height:100%; object-fit:contain; display:block;" 
            onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'color:#ef4444; text-align:center;\\'><div style=\\'font-size:30px;\\'>⚠️</div><div style=\\'font-size:12px;\\'>CONNECTION FAILED</div></div>'">
        `;
        logBackend(`Camera stream: ${ip}`);
    }
}

function updateCameraParam(key, value) {
    if (localStorage.getItem('cam_source') === 'webcam') return; // Not supported for webcam yet

    let ip = document.getElementById('cam_ip').value;
    let baseUrl = ip.split(':')[0] + ':' + ip.split(':')[1];
    let controlUrl = baseUrl + "/control";
    const url = `${controlUrl}?var=${key}&val=${value}`;

    fetch(url, { mode: 'no-cors' }).catch(console.error);
}

function toggleCameraFlash() {
    if (localStorage.getItem('cam_source') === 'webcam') {
        alert("Flash control not available for Webcam");
        return;
    }
    if (!window.flashState) window.flashState = 0;
    window.flashState = window.flashState === 0 ? 255 : 0;
    updateCameraParam('led_intensity', window.flashState);
}

// Init Load
window.addEventListener('load', () => {
    const savedIP = localStorage.getItem('cam_ip');
    if (savedIP) document.getElementById('cam_ip').value = savedIP;

    // Default OFF
    stopCamera();
});
