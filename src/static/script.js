import {FaceLandmarker, FilesetResolver} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

const CONFIG = {
    // Lighting
    LIGHTING_INTERVAL_MS: 500,  
    LIGHTING_SAMPLE_SIZE: 50,   
    BRIGHTNESS_LOW: 35,         
    BRIGHTNESS_HIGH: 200,      
    // Head Pose
    PITCH_DOWN_THRESHOLD: 0.55,
    PITCH_UP_THRESHOLD: 0.45,
    YAW_RIGHT_THRESHOLD: 0.40,
    YAW_LEFT_THRESHOLD: 0.60
};

let faceLandmarker;
let runningMode = "VIDEO";
let video = document.getElementById("webcam");
let liveView = document.getElementById("liveView");
let enableWebcamButton = document.getElementById("webcamButton");
let loadingOverlay = document.getElementById("loadingOverlay");
let children = []; 
let lastVideoTime = -1;
let lastLightingCheckTime = 0;
let cachedLightingResult = { status: 'OK', msg: 'OK' };

const canvasProcess = document.createElement('canvas');
const ctxProcess = canvasProcess.getContext('2d', { willReadFrequently: true });

const initializeFaceLandmarker = async () => {
    console.log("Sedang download model...");
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU",
            },
            outputFaceBlendshapes: true,
            runningMode: runningMode,
            numFaces: 1
        });
        console.log("Model selesai dimuat");
        updateUIReady();
    } catch (error) {
        console.error("Error initializing Model:", error);
        loadingOverlay.innerHTML = `<p style='color:red'>Gagal memuat AI. Cek koneksi internet & Refresh.</p>`;
    }
};

function updateUIReady() {
    loadingOverlay.style.display = "none";
    enableWebcamButton.disabled = false;
    enableWebcamButton.innerText = "ENABLE WEBCAM";
}

initializeFaceLandmarker();

if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    enableWebcamButton.addEventListener("click", enableCam);
} else {
    console.warn("GetUserMedia not supported");
}

async function enableCam(event) {
    if (!faceLandmarker) {
        alert("Model masih di Load")
        return;
    }

    enableWebcamButton.disabled = true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    } catch (err) {
        console.error(err);
        enableWebcamButton.disabled = false;
        enableWebcamButton.innerText = "ENABLE WEBCAM";
    }
}

async function predictWebcam() {
    let startTimeMs = performance.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        // Deteksi wajah
        const results = faceLandmarker.detectForVideo(video, startTimeMs);
        // Render & Validasi
        displayResults(results);
    }
    window.requestAnimationFrame(predictWebcam);
}

// LOGIC VALIDASI POSE KEPALA
function getHeadPose(landmarks) {
    const nose = landmarks[1];
    const leftEye = landmarks[263];
    const rightEye = landmarks[33];
    const chin = landmarks[152];
    const topHead = landmarks[10];

    const distToLeftEye = Math.abs(nose.x - leftEye.x);
    const distToRightEye = Math.abs(nose.x - rightEye.x);
    const yawRatio = distToRightEye / (distToLeftEye + distToRightEye);

    const distToTop = Math.abs(nose.y - topHead.y);
    const distToChin = Math.abs(nose.y - chin.y);
    const pitchRatio = distToTop / (distToTop + distToChin);

    let status = "FORWARD";
    let color = "rgba(98, 255, 0, 0.975)"
    let message = "OK";

    if (pitchRatio > CONFIG.PITCH_DOWN_THRESHOLD) {
        status = "DOWN"; color = "red"; message = "JANGAN MENUNDUK";
    } else if (pitchRatio < CONFIG.PITCH_UP_THRESHOLD) {
        status = "UP"; color = "red"; message = "JANGAN MENDONGAK";
    }
    else if (yawRatio < CONFIG.YAW_RIGHT_THRESHOLD) {
        status = "RIGHT"; color = "red"; message = "HADAP KAMERA";
    } else if (yawRatio > CONFIG.YAW_LEFT_THRESHOLD) {
        status = "LEFT"; color = "red"; message = "HADAP KAMERA";
    }
    return { status, color, message };
}

// LOGIC VALIDASI CAHAYA
function checkLightingConditions(videoElement, box) {
    if (box.width <= 0 || box.height <= 0) return { status: 'OK', msg: 'OK' };
    // Downscaling
    const sampleSize = CONFIG.LIGHTING_SAMPLE_SIZE;
    canvasProcess.width = sampleSize;
    canvasProcess.height = sampleSize;
    // Draw Image
    ctxProcess.drawImage(
        videoElement, 
        box.rawX, box.rawY, box.rawW, box.rawH, 
        0, 0, sampleSize, sampleSize            
    );
    const frameData = ctxProcess.getImageData(0, 0, sampleSize, sampleSize).data;
    let totalBrightness = 0;
    for (let i = 0; i < frameData.length; i += 4) {
        const r = frameData[i];
        const g = frameData[i + 1];
        const b = frameData[i + 2];
        // Hitung Luminance di RGB pixel
        const brightness = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
        totalBrightness += brightness;
    }
    const pixelCount = sampleSize * sampleSize;
    const avgBrightness = totalBrightness / pixelCount;
    if (avgBrightness < CONFIG.BRIGHTNESS_LOW) {
        return { status: 'TOO_DARK', value: avgBrightness, msg: "TERLALU GELAP" };
    }
    if (avgBrightness > CONFIG.BRIGHTNESS_HIGH) {
        return { status: 'TOO_BRIGHT', value: avgBrightness, msg: "TERLALU CERAH" };
    }
    return { status: 'OK', msg: "OK" };
}

// LOGIC DISPLAY HASIL DETEKSI
function displayResults(results) {
    cleanUpUI();
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const elementWidth = video.offsetWidth;
    const elementHeight = video.offsetHeight;

    if (videoWidth === 0 || !results.faceLandmarks || results.faceLandmarks.length === 0) return;

    const landmarks = results.faceLandmarks[0];
    const box = calculateBoundingBox(landmarks, videoWidth, videoHeight, elementWidth, elementHeight);

    // Validasi Head Pose
    const pose = getHeadPose(landmarks);
    // Validasi Cahaya
    const now = Date.now();
    if (now - lastLightingCheckTime > CONFIG.LIGHTING_INTERVAL_MS) {
        cachedLightingResult = checkLightingConditions(video, box.rawBox);
        lastLightingCheckTime = now;
    }

    let finalColor = pose.color;
    let finalMessage = pose.message;

    if (pose.status === "FORWARD") {
        if (cachedLightingResult.status !== 'OK') {
            finalColor = "red";
            finalMessage = cachedLightingResult.msg;
        }
    }
    renderOverlay(box, finalColor, finalMessage, elementWidth);
}

function cleanUpUI() {
    for (let child of children) {
        liveView.removeChild(child);
    }
    children.splice(0);
}

function calculateBoundingBox(landmarks, vW, vH, elW, elH) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const point of landmarks) {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
    }

    const scaleX = elW / vW;
    const scaleY = elH / vH;
    const scale = Math.max(scaleX, scaleY);

    const scaledVW = vW * scale;
    const scaledVH = vH * scale;

    const offsetX = (elW - scaledVW) / 2;
    const offsetY = (elH - scaledVH) / 2;

    const boxX = (minX * scaledVW) + offsetX;
    const boxY = (minY * scaledVH) + offsetY;
    const boxW = (maxX - minX) * scaledVW;
    const boxH = (maxY - minY) * scaledVH;

    const rawBox = {
        rawX: minX * vW,
        rawY: minY * vH,
        rawW: (maxX - minX) * vW,
        rawH: (maxY - minY) * vH,
        width: (maxX - minX) * vW, 
        height: (maxY - minY) * vH
    };
    return { boxX, boxY, boxW, boxH, rawBox };
}

function renderOverlay(box, color, message, screenWidth) {
    const mirroredX = screenWidth - box.boxW - box.boxX;
    const highlighter = document.createElement("div");
    highlighter.className = "highlighter";
    highlighter.style = `
        left: ${mirroredX}px; 
        top: ${box.boxY}px; 
        width: ${box.boxW}px; 
        height: ${box.boxH}px;
        border-color: ${color};
    `;
    const p = document.createElement("p");
    p.className = "info";
    p.innerText = message;
    p.style.color = color;
    highlighter.appendChild(p);
    liveView.appendChild(highlighter);
    children.push(highlighter);
}