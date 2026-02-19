
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

    // Load GLB Model
    const loader = new THREE.GLTFLoader();

    loader.load('robot.glb', function (gltf) {
        carMesh = gltf.scene;

        // Adjust Scale / Position automatically (Similar to model-3d.html)
        const box = new THREE.Box3().setFromObject(carMesh);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Normalize size to fit in ~3 units
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim;
        carMesh.scale.setScalar(scale);

        // Center object
        carMesh.position.sub(center.multiplyScalar(scale));

        // --- MANUAL POSITION ADJUSTMENT ---
        // Change these values to shift the model:
        const modelOffset = { x: 2, y: 0.5, z: 0 };

        carMesh.position.x += modelOffset.x;
        carMesh.position.y += modelOffset.y;
        carMesh.position.z += modelOffset.z;
        // ----------------------------------

        // Correct initial rotation to face forward if needed
        // Assuming model faces +Z or -Z, but carMesh is rotated.
        // Let updateIMU handle the dynamic rotation.

        // Enable shadows
        carMesh.traverse(function (node) {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        scene.add(carMesh);
    }, undefined, function (error) {
        console.error("Error loading robot.glb:", error);
        // Fallback: Primitive Car if load fails
        createFallbackCar();
    });

    // Helper for fallback
    function createFallbackCar() {
        carMesh = new THREE.Group();
        // Body
        const geometry = new THREE.BoxGeometry(1, 0.2, 1.8);
        const material = new THREE.MeshLambertMaterial({ color: 0x06b6d4 });
        const body = new THREE.Mesh(geometry, material);
        carMesh.add(body);
        // Cabin
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), new THREE.MeshLambertMaterial({ color: 0x334155 }));
        cabin.position.y = 0.25;
        carMesh.add(cabin);
        scene.add(carMesh);
    }

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
        // --- MANUAL ROTATION ADJUSTMENT ---
        // Change these values to rotate the model (in Degrees):
        const modelRotationOffset = { x: 0, y: 90, z: 0 };

        carMesh.rotation.x = THREE.Math.degToRad(pitch + modelRotationOffset.x);
        carMesh.rotation.y = THREE.Math.degToRad(yaw + modelRotationOffset.y);
        carMesh.rotation.z = THREE.Math.degToRad(-roll + modelRotationOffset.z);
        // ----------------------------------
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
