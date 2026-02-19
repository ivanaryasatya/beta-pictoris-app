
// ===== IMU 3D VISUALIZATION =====
let camera, scene, renderer, carMesh;

function initIMU() {
    const container = document.getElementById('imu-container');
    if (!container) return;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Match theme

    // Camera
    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 2, 4);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Lights
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(2, 5, 2);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040));

    // Grid
    const gridHelper = new THREE.GridHelper(10, 10, 0x475569, 0x1e293b);
    scene.add(gridHelper);

    // CAR MODEL (Group)
    carMesh = new THREE.Group();

    // Body
    const geometry = new THREE.BoxGeometry(1, 0.2, 1.8);
    const material = new THREE.MeshLambertMaterial({ color: 0x06b6d4 }); // Neon Cyan
    const body = new THREE.Mesh(geometry, material);
    carMesh.add(body);

    // Cabin (Indicator of front/up)
    const cabinGeo = new THREE.BoxGeometry(0.8, 0.3, 0.8);
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.y = 0.25;
    carMesh.add(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 16);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x000000 });

    const positions = [
        [-0.6, 0, 0.6], [0.6, 0, 0.6],   // Front
        [-0.6, 0, -0.6], [0.6, 0, -0.6]  // Back
    ];

    positions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(...pos);
        carMesh.add(wheel);
    });

    // SHOOTER DEVICE (Sleeve/Cannon)
    const shooterGroup = new THREE.Group();

    // Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.8, 16);
    const barrelMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 }); // Metallic Grey
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    // Cylinder is Y-up. To point Z (Forward), rotate 90 deg around X.
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.1, 1.0); // Extending out from front
    shooterGroup.add(barrel);

    // Muzzle/Tip
    const tipGeo = new THREE.TorusGeometry(0.12, 0.04, 8, 16);
    const tipMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
    const tip = new THREE.Mesh(tipGeo, tipMat);
    // Torus acts like a ring on XY plane. To face Z, no rotation needed? 
    // Wait, Torus lies on XY plane (Z is normal). So if we want it facing Front (Z), it's already correct?
    // Let's verify. TorusGeometry(radius, tube, ...). "The torus is centered at the origin and lies in the XY plane."
    // So the hole is along Z. Yes.
    tip.position.set(0, 0.1, 1.4); // At end of barrel
    shooterGroup.add(tip);

    carMesh.add(shooterGroup);

    scene.add(carMesh);

    // Resize listener
    // Resize listener using ResizeObserver for container
    const resizeObserver = new ResizeObserver(() => {
        if (!container || !camera || !renderer) return;
        const width = container.clientWidth;
        const height = container.clientHeight;

        if (width === 0 || height === 0) return;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    animateIMU();
}

function animateIMU() {
    requestAnimationFrame(animateIMU);
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function updateIMU(roll, pitch, yaw) {
    // Update Text
    const rEl = document.getElementById('valRoll');
    const pEl = document.getElementById('valPitch');
    const yEl = document.getElementById('valYaw');

    if (rEl) rEl.innerText = roll.toFixed(1);
    if (pEl) pEl.innerText = pitch.toFixed(1);
    if (yEl) yEl.innerText = yaw.toFixed(1);

    // Update 3D Model Rotation (Convert Deg to Rad)
    // Roll: Z axis, Pitch: X axis, Yaw: Y axis (Three.js coordinates may vary, usually Y is up)
    // Assuming standard aerospace:
    // Pitch -> X, Yaw -> Y, Roll -> Z
    if (carMesh) {
        carMesh.rotation.x = THREE.Math.degToRad(pitch);
        // Add 180 degrees offset to Yaw to face front
        carMesh.rotation.y = THREE.Math.degToRad(yaw + 180);
        carMesh.rotation.z = THREE.Math.degToRad(-roll); // Invert roll for correct visualization
    }

    // UPDATE ATTITUDE INDICATOR (Refined Style)
    // 1. Rotate Horizon Disc (Roll)
    const aiHorizon = document.getElementById('ai-horizon');
    if (aiHorizon) {
        aiHorizon.style.transform = `rotate(${-roll}deg)`;
    }

    // 2. Translate Pitch Plane (Pitch)
    // Calibration: Container is 150px height. 
    // Pitch Ladder covers roughly +/- 20 degrees in 150px? 
    // Let's check HTML lines: +20, +10, 0, -10, -20.
    // Margin is 15px. 5 gaps of ~15px + line thickness?
    // Distance between 0 and +10 is roughly 30px?
    // If 10deg = 30px, then 1deg = 3px.
    const aiPitchPlane = document.getElementById('ai-pitch-plane');
    if (aiPitchPlane) {
        const pitchPx = pitch * 3.0;
        aiPitchPlane.style.transform = `translateY(${pitchPx}px)`;
    }

    // 3. Update Compass (Yaw)
    const compassFace = document.getElementById('compass-face');
    if (compassFace) {
        // If yaw increases (turning right), North moves Left (counter-clockwise).
        // So rotate face by -yaw.
        compassFace.style.transform = `rotate(${-yaw}deg)`;
    }
}

function calibrateIMU() {
    if (confirm("Calibrate IMU? Ensure the robot is on a level surface.")) {
        console.log("Sending CALIBRATE_IMU command...");
        if (typeof sendData === 'function') {
            sendData('CALIBRATE_IMU', 1);
        } else {
            console.warn("sendData function not found. Is communication.js loaded?");
        }
    }
}
