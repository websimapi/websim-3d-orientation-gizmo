import * as THREE from 'three';

// --- Constants ---
const OUTER_RADIUS = 10;
const INNER_RADIUS = 1.5;
const GRAVITY_CONSTANT = 0.005;
const DAMPING = 0.92; // Energy loss on bounce
const FRICTION = 0.99; // Rolling friction

// --- Scene Setup ---
let scene, camera, renderer;
let orientationGroup, physicsBall;
const ballVelocity = new THREE.Vector3();
const gravityWorld = new THREE.Vector3(0, -GRAVITY_CONSTANT, 0);

function init() {
    const container = document.getElementById('gizmo-container');

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 25;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // --- Gizmo Objects ---
    orientationGroup = new THREE.Group();
    scene.add(orientationGroup);

    // Outer Sphere (wireframe)
    const outerSphereGeom = new THREE.SphereGeometry(OUTER_RADIUS, 32, 32);
    const outerSphereMat = new THREE.MeshBasicMaterial({
        color: 0x87ceeb,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
    });
    const wireframeSphere = new THREE.Mesh(outerSphereGeom, outerSphereMat);
    orientationGroup.add(wireframeSphere);

    // Axes
    const axesHelper = new THREE.AxesHelper(OUTER_RADIUS * 0.8);
    orientationGroup.add(axesHelper);

    // Inner Ball (physics object)
    const innerBallGeom = new THREE.SphereGeometry(INNER_RADIUS, 32, 32);
    const innerBallMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.3,
        roughness: 0.4,
    });
    physicsBall = new THREE.Mesh(innerBallGeom, innerBallMat);
    orientationGroup.add(physicsBall); // Add ball to the rotating group for visual cohesion

    // --- Event Listeners ---
    const startButton = document.getElementById('start-button');
    startButton.addEventListener('click', () => requestMotionPermissions());

    window.addEventListener('resize', onWindowResize);
}

function requestMotionPermissions() {
    const startButton = document.getElementById('start-button');
    const infoText = document.getElementById('info-text');

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    startButton.classList.add('hidden');
                    infoText.classList.remove('hidden');
                } else {
                    alert('Permission not granted for device orientation.');
                }
            })
            .catch(console.error);
    } else {
        // Other browsers
        window.addEventListener('deviceorientation', handleOrientation);
        startButton.classList.add('hidden');
        infoText.classList.remove('hidden');
    }
}

function handleOrientation(event) {
    const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0; // Z
    const beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0; // X
    const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0; // Y

    // 'YXZ' order seems to be the most consistent for mobile devices
    const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ');
    orientationGroup.quaternion.setFromEuler(euler);
}

function onWindowResize() {
    const container = document.getElementById('gizmo-container');
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function updatePhysics() {
    // Transform world gravity into the local space of the rotating group
    const qInverse = orientationGroup.quaternion.clone().invert();
    const gravityLocal = gravityWorld.clone().applyQuaternion(qInverse);

    // Apply gravity to velocity
    ballVelocity.add(gravityLocal);

    // Apply friction
    ballVelocity.multiplyScalar(FRICTION);

    // Update position
    physicsBall.position.add(ballVelocity);

    // Collision detection and response
    const distanceFromCenter = physicsBall.position.length();
    const collisionBoundary = OUTER_RADIUS - INNER_RADIUS;

    if (distanceFromCenter > collisionBoundary) {
        // Normalize position vector to get collision normal
        const normal = physicsBall.position.clone().normalize();

        // Reflect velocity off the normal
        ballVelocity.reflect(normal);

        // Apply damping to simulate energy loss
        ballVelocity.multiplyScalar(DAMPING);

        // Correct position to prevent sinking into the wall
        physicsBall.position.copy(normal.multiplyScalar(collisionBoundary));
    }
}

function animate() {
    requestAnimationFrame(animate);
    updatePhysics();
    renderer.render(scene, camera);
}

init();
animate();