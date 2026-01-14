import {FaceLandmarker, FilesetResolver} from "/static/js/mediapipe-vision.js";

const CONFIG = {
    // Lighting
    LIGHTING_INTERVAL_MS: 500,  
    LIGHTING_SAMPLE_SIZE: 50,   
    BRIGHTNESS_LOW: 25,         
    BRIGHTNESS_HIGH: 200,      
    // Arah Hadap Kepala
    PITCH_DOWN_THRESHOLD: 0.65,
    PITCH_UP_THRESHOLD: 0.32,
    YAW_RIGHT_THRESHOLD: 0.35,
    YAW_LEFT_THRESHOLD: 0.65
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
            "/static/wasm"
        );
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `/static/models/face_landmarker.task`,
                delegate: "GPU",
            },
            outputFaceBlendshapes: false,
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
    enableWebcamButton.style.display = "none"; 
    console.log("Model siap, mencoba menyalakan kamera otomatis");
    enableCam(); 
}

initializeFaceLandmarker();

if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    enableWebcamButton.addEventListener("click", enableCam);
} else {
    console.warn("GetUserMedia not supported");
}

async function enableCam() { 
    if (!faceLandmarker) {
        console.log("Model belum siap");
        return;
    }
    enableWebcamButton.disabled = true;
    try {
        const constraints = {
            video: {
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        video.addEventListener("loadedmetadata", () => {
            video.play();
            // LOGIC TOMBOL CAPTURE
            enableWebcamButton.style.display = "block";
            enableWebcamButton.innerText = "CAPTURE";
            // Reset Event Listener
            let newButton = enableWebcamButton.cloneNode(true);
            enableWebcamButton.parentNode.replaceChild(newButton, enableWebcamButton);
            enableWebcamButton = newButton;
            enableWebcamButton.addEventListener("click", captureImage);
            enableWebcamButton.disabled = true; 
            predictWebcam(); 
        });
    } catch (err) {
        console.error("Gagal akses kamera:", err);
        alert("Kamera tidak dapat diakses.");
    }
}

async function predictWebcam() {
    if (video.paused || video.ended) {
        window.requestAnimationFrame(predictWebcam);
        return;
    }
    let startTimeMs = performance.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        // Deteksi wajah
        const results = faceLandmarker.detectForVideo(video, startTimeMs);
        // Render & Validasi
        displayResults(results);
    }
    // Looping
    window.requestAnimationFrame(predictWebcam);
}

// LOGIC VALIDASI POSE KEPALA
function getHeadPose(landmarks) {
    const nose = landmarks[1];
    const leftEye = landmarks[263];
    const rightEye = landmarks[33];
    const mouth = landmarks[13];
    // YAW 
    const distToLeftEye = Math.abs(nose.x - leftEye.x);
    const distToRightEye = Math.abs(nose.x - rightEye.x);
    const yawRatio = distToRightEye / (distToLeftEye + distToRightEye);
    // PITCH (Menggunakan Mata & Mulut)
    // Cari titik tengah di antara dua mata (secara Y)
    const midEyeY = (leftEye.y + rightEye.y) / 2;
    // Jarak Hidung ke Garis Mata
    const distNoseToEyeLine = Math.abs(nose.y - midEyeY);
    // Jarak Hidung ke Mulut
    const distNoseToMouth = Math.abs(nose.y - mouth.y);
    // Rasio baru
    const pitchRatio = distNoseToEyeLine / (distNoseToEyeLine + distNoseToMouth)

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
    // Default: Disable tombol jika tidak ada wajah
    if (videoWidth === 0 || !results.faceLandmarks || results.faceLandmarks.length === 0) {
        enableWebcamButton.disabled = true;
        enableWebcamButton.style.opacity = "0.5"; // Visual cue
        return;
    }
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
    // Prioritas Pesan Error: Cahaya > Pose
    if (pose.status === "FORWARD") {
        if (cachedLightingResult.status !== 'OK') {
            finalColor = "red";
            finalMessage = cachedLightingResult.msg;
        }
    }
    
    renderOverlay(box, finalColor, finalMessage, elementWidth);
    // --- LOGIKA TOMBOL ENABLE/DISABLE ---
    if (finalMessage === "OK") {
        enableWebcamButton.disabled = false;
        enableWebcamButton.style.opacity = "2";
        enableWebcamButton.style.cursor = "pointer";
        enableWebcamButton.style.backgroundColor = "rgba(0, 110, 255, 0.8)";
        enableWebcamButton.style.color = "white";
    } else {
        enableWebcamButton.disabled = true;
        enableWebcamButton.style.opacity = "0.5";
        enableWebcamButton.style.cursor = "not-allowed";
        enableWebcamButton.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
        enableWebcamButton.style.color = "white";
    }
}

function captureImage() {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Compress dikit biar muat di storage
    const base64Image = canvas.toDataURL('image/jpeg', 0.7); 
    try {
        // SIMPAN KE STORAGE BROWSER
        sessionStorage.setItem("capturedFaceImage", base64Image);
        // Redirect ke halaman absensi (ambil URL dari hidden input HTML)
        const redirectUrl = document.getElementById("redirectUrl").value; // e.g., "/absensi"
        window.location.href = redirectUrl;
    } catch (e) {
        alert("Gagal menyimpan gambar (Quota Exceeded). Coba kurangi resolusi.");
    }
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