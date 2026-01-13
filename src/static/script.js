// import {
//     FaceLandmarker,
//     FilesetResolver,
// } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// let faceLandmarker;
// let runningMode = "VIDEO";
// let children = []; 
// let video = document.getElementById("webcam");
// let liveView = document.getElementById("liveView");
// let enableWebcamButton = document.getElementById("webcamButton");

// const loadingOverlay = document.getElementById("loadingOverlay");

// const initializeFaceLandmarker = async () => {
//     console.log("Sedang download model");
//     try {
//         const vision = await FilesetResolver.forVisionTasks(
//             "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
//         );
//         faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
//             baseOptions: {
//                 modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
//                 delegate: "GPU",
//             },
//             outputFaceBlendshapes: true,
//             runningMode: runningMode,
//             numFaces: 1
//         });
        
//         console.log("Model selesai dimuat!");

//         // --- UPDATE UI DISINI ---
//         // 1. Hilangkan Loading Overlay
//         loadingOverlay.style.display = "none";
        
//         // 2. Aktifkan Tombol
//         enableWebcamButton.disabled = false;
//         enableWebcamButton.innerText = "ENABLE WEBCAM";

//     } catch (error) {
//         console.error("Error initializing:", error);
//         // Jika error, kasih tahu user di layar
//         loadingOverlay.innerHTML = `<p style='color:red'>Gagal memuat AI. Cek koneksi internet & Refresh.</p>`;
//     }
// };

// initializeFaceLandmarker();

// // --- WEBCAM HANDLER ---
// if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
//     enableWebcamButton.addEventListener("click", enableCam);
// } else {
//     console.warn("GetUserMedia not supported");
// }

// async function enableCam(event) {
//     if (!faceLandmarker) {
//         alert("Model still loading...");
//         return;
//     }
//     enableWebcamButton.disabled = true;

//     try {
//         const stream = await navigator.mediaDevices.getUserMedia({ video: true });
//         video.srcObject = stream;
//         video.addEventListener("loadeddata", predictWebcam);
//     } catch (err) {
//         console.error(err);
//         enableWebcamButton.disabled = false;
//         enableWebcamButton.innerText = "ENABLE WEBCAM";
//     }
// }

// // --- PREDICTION LOOP ---
// let lastVideoTime = -1;
// async function predictWebcam() {
//     let startTimeMs = performance.now();
//     if (video.currentTime !== lastVideoTime) {
//         lastVideoTime = video.currentTime;
//         // DETECT SEKARANG MENGHASILKAN 'results' YANG LEBIH KAYA
//         const results = faceLandmarker.detectForVideo(video, startTimeMs);
        
//         // Kirim hasil landmarks ke fungsi display
//         displayResults(results);
//     }
//     window.requestAnimationFrame(predictWebcam);
// }

// // --- VALIDASI POSE KEPALA ---
// function getHeadPose(landmarks) {
//     const nose = landmarks[1];
//     const leftEye = landmarks[263];
//     const rightEye = landmarks[33];
//     const chin = landmarks[152];
//     const topHead = landmarks[10];
//     // --- HITUNG YAW (Toleh Kanan/Kiri) ---
//     // Bandingkan jarak hidung ke mata kiri vs mata kanan (rasio jarak horizontal)
//     const distToLeftEye = Math.abs(nose.x - leftEye.x);
//     const distToRightEye = Math.abs(nose.x - rightEye.x);
//     const yawRatio = distToRightEye / (distToLeftEye + distToRightEye);
//     // --- HITUNG PITCH (Nunduk/Dongak) ---
//     // Bandingkan posisi hidung relatif terhadap Dagu dan Jidat (rasio jarak vertikal)
//     const distToTop = Math.abs(nose.y - topHead.y);
//     const distToChin = Math.abs(nose.y - chin.y);
//     const pitchRatio = distToTop / (distToTop + distToChin);
//     // --- THRESHOLDS (BATAS TOLERANSI) ---
//     let status = "FORWARD";
//     let color = "rgb(0, 255, 0)"; // Hijau
//     let message = "OK";
//     // Cek Nunduk/Dongak (Pitch)
//     if (pitchRatio > 0.55) {
//         status = "DOWN";
//         color = "red";
//         message = "JANGAN MENUNDUK";
//     } else if (pitchRatio < 0.45) {
//         status = "UP";
//         color = "red";
//         message = "JANGAN MENDONGAK";
//     }
//     else if (yawRatio < 0.40) {
//         status = "RIGHT";
//         color = "red";
//         message = "HADAP KAMERA"; // User nengok kanan
//     } else if (yawRatio > 0.60) {
//         status = "LEFT";
//         color = "red";
//         message = "HADAP KAMERA"; // User nengok kiri
//     }
//     return { status, color, message };
// }

// // --- VALIDASI KECERAHAN WAJAH ---
// const canvasProcess = document.createElement('canvas');
// const ctxProcess = canvasProcess.getContext('2d', { willReadFrequently: true });
// function checkLightingConditions(videoElement, box) {
//     // Siapkan Canvas seukuran Bounding Box Wajah
//     const width = Math.floor(box.width);
//     const height = Math.floor(box.height);
//     // Safety check dimensi
//     if (width <= 0 || height <= 0) return { status: 'OK', value: 0 };
//     canvasProcess.width = width;
//     canvasProcess.height = height;    
//     ctxProcess.drawImage(videoElement, box.rawX, box.rawY, box.rawW, box.rawH, 0, 0, width, height);
//     // Ambil data pixel
//     const frameData = ctxProcess.getImageData(0, 0, width, height).data;
//     let totalBrightness = 0;
//     let sampleRate = 10; 
//     let count = 0;
//     for (let i = 0; i < frameData.length; i += 5 * sampleRate) {
//         const r = frameData[i];
//         const g = frameData[i + 1];
//         const b = frameData[i + 2];
//         // Rumus Luminance Pixel
//         // const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
//         const brightness = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
//         totalBrightness += brightness;
//         count++;
//     }
//     const avgBrightness = totalBrightness / count;
//     if (avgBrightness < 25) return { status: 'TOO_DARK', value: avgBrightness, msg: "TERLALU GELAP" };
//     if (avgBrightness > 200) return { status: 'TOO_BRIGHT', value: avgBrightness, msg: "TERLALU CERAH" };
//     return { status: 'OK', msg: "OK" };
// }

// function displayResults(results) {
//     // Hapus overlay lama
//     for (let child of children) {
//         liveView.removeChild(child);
//     }
//     children.splice(0);

//     // Cek ukuran video asli vs ukuran layar
//     const videoWidth = video.videoWidth;
//     const videoHeight = video.videoHeight;
//     const elementWidth = video.offsetWidth;
//     const elementHeight = video.offsetHeight;

//     if (videoWidth === 0 || videoHeight === 0) return;

//     // Jika tidak ada wajah
//     if (!results.faceLandmarks || results.faceLandmarks.length === 0) return;

//     // Ambil wajah pertama
//     const landmarks = results.faceLandmarks[0];

//     // 1. Hitung Bounding Box (Normalized 0 - 1)
//     let minX = 1, minY = 1, maxX = 0, maxY = 0;
//     for (const point of landmarks) {
//         if (point.x < minX) minX = point.x;
//         if (point.x > maxX) maxX = point.x;
//         if (point.y < minY) minY = point.y;
//         if (point.y > maxY) maxY = point.y;
//     }

//     // --- PERBAIKAN MATEMATIKA UNTUK OBJECT-FIT: COVER ---
    
//     // 1. Hitung rasio scaling (mana yang lebih besar, lebar atau tinggi)
//     const scaleX = elementWidth / videoWidth;
//     const scaleY = elementHeight / videoHeight;
//     const scale = Math.max(scaleX, scaleY); // 'Cover' menggunakan skala terbesar

//     // 2. Hitung ukuran video setelah di-zoom oleh CSS
//     const scaledVideoWidth = videoWidth * scale;
//     const scaledVideoHeight = videoHeight * scale;

//     // 3. Hitung posisi offset (karena video ditaruh di tengah/center)
//     const offsetX = (elementWidth - scaledVideoWidth) / 2;
//     const offsetY = (elementHeight - scaledVideoHeight) / 2;

//     // 4. Konversi koordinat normalized ke koordinat layar yang sudah di-zoom
//     const boxX = (minX * scaledVideoWidth) + offsetX;
//     const boxY = (minY * scaledVideoHeight) + offsetY;
//     const boxW = (maxX - minX) * scaledVideoWidth;
//     const boxH = (maxY - minY) * scaledVideoHeight;

//     // --- MEMBALIK POSISI HORIZONTAL (MIRRORING) ---
//     // Karena CSS pakai rotateY(180deg), kita harus membalik koordinat X relatif terhadap lebar layar
//     const mirroredX = elementWidth - boxW - boxX;

//     // --- PERSIAPAN DATA VALIDASI (Tetap pakai koordinat asli untuk akurasi) ---
//     // Kita hitung rawBox terpisah agar validasi cahaya tetap akurat mengambil data pixel asli video
//     const rawBox = {
//         rawX: minX * videoWidth,
//         rawY: minY * videoHeight,
//         rawW: (maxX - minX) * videoWidth,
//         rawH: (maxY - minY) * videoHeight,
//         width: (maxX - minX) * videoWidth,
//         height: (maxY - minY) * videoHeight
//     };

//     // --- EKSEKUSI VALIDASI ---
//     const lighting = checkLightingConditions(video, rawBox);
//     const pose = getHeadPose(landmarks);

//     // --- LOGIKA PRIORITAS PESAN ---
//     let finalColor = pose.color;
//     let finalMessage = pose.message;

//     if (pose.status === "FORWARD") {
//         if (lighting.status !== 'OK') {
//             finalColor = "red";
//             finalMessage = lighting.msg; //+ ` (${Math.round(lighting.value)})`;
//         }
//     }

//     // --- RENDERING KOTAK ---
//     const highlighter = document.createElement("div");
//     highlighter.className = "highlighter";
//     highlighter.style = `
//         left: ${mirroredX}px; 
//         top: ${boxY}px; 
//         width: ${boxW}px; 
//         height: ${boxH}px;
//         border-color: ${finalColor};
//     `;

//     // --- RENDERING TEXT INFO ---
//     const p = document.createElement("p");
//     p.className = "info";
//     p.innerText = finalMessage;
//     p.style.color = finalColor;
    
//     highlighter.appendChild(p);
//     liveView.appendChild(highlighter);
//     children.push(highlighter);
// }


import {
    FaceLandmarker,
    FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// --- KONFIGURASI ---
const CONFIG = {
    // Pengaturan Lighting
    LIGHTING_INTERVAL_MS: 500,  // Cek cahaya setiap 500ms (Solusi 1)
    LIGHTING_SAMPLE_SIZE: 50,   // Ukuran canvas analisis cuma 50x50px (Solusi 2)
    BRIGHTNESS_LOW: 35,         // Batas bawah kegelapan
    BRIGHTNESS_HIGH: 200,       // Batas atas kecerahan
    
    // Pengaturan Head Pose
    PITCH_DOWN_THRESHOLD: 0.55,
    PITCH_UP_THRESHOLD: 0.45,
    YAW_RIGHT_THRESHOLD: 0.40,
    YAW_LEFT_THRESHOLD: 0.60
};

// --- GLOBAL VARIABLES ---
let faceLandmarker;
let runningMode = "VIDEO";
let video = document.getElementById("webcam");
let liveView = document.getElementById("liveView");
let enableWebcamButton = document.getElementById("webcamButton");
let loadingOverlay = document.getElementById("loadingOverlay");
let children = []; 
let lastVideoTime = -1;

// State untuk Throttling Lighting
let lastLightingCheckTime = 0;
let cachedLightingResult = { status: 'OK', msg: 'OK' };

// Canvas tersembunyi untuk proses lighting (di-cache agar tidak create ulang)
const canvasProcess = document.createElement('canvas');
const ctxProcess = canvasProcess.getContext('2d', { willReadFrequently: true });

// --- INITIALIZATION ---
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
        
        console.log("Model selesai dimuat!");
        updateUIReady();

    } catch (error) {
        console.error("Error initializing:", error);
        loadingOverlay.innerHTML = `<p style='color:red'>Gagal memuat AI. Cek koneksi internet & Refresh.</p>`;
    }
};

function updateUIReady() {
    loadingOverlay.style.display = "none";
    enableWebcamButton.disabled = false;
    enableWebcamButton.innerText = "ENABLE WEBCAM";
}

initializeFaceLandmarker();

// --- WEBCAM HANDLER ---
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    enableWebcamButton.addEventListener("click", enableCam);
} else {
    console.warn("GetUserMedia not supported");
}

async function enableCam(event) {
    if (!faceLandmarker) {
        alert("Model still loading...");
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

// --- PREDICTION LOOP ---
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

// --- LOGIC: VALIDASI POSE KEPALA ---
function getHeadPose(landmarks) {
    const nose = landmarks[1];
    const leftEye = landmarks[263];
    const rightEye = landmarks[33];
    const chin = landmarks[152];
    const topHead = landmarks[10];

    // Hitung Rasio
    const distToLeftEye = Math.abs(nose.x - leftEye.x);
    const distToRightEye = Math.abs(nose.x - rightEye.x);
    const yawRatio = distToRightEye / (distToLeftEye + distToRightEye);

    const distToTop = Math.abs(nose.y - topHead.y);
    const distToChin = Math.abs(nose.y - chin.y);
    const pitchRatio = distToTop / (distToTop + distToChin);

    // Default State
    let status = "FORWARD";
    let color = "rgb(0, 255, 0)"; 
    let message = "OK";

    // Cek Pitch (Nunduk/Dongak)
    if (pitchRatio > CONFIG.PITCH_DOWN_THRESHOLD) {
        status = "DOWN"; color = "red"; message = "JANGAN MENUNDUK";
    } else if (pitchRatio < CONFIG.PITCH_UP_THRESHOLD) {
        status = "UP"; color = "red"; message = "JANGAN MENDONGAK";
    }
    // Cek Yaw (Toleh)
    else if (yawRatio < CONFIG.YAW_RIGHT_THRESHOLD) {
        status = "RIGHT"; color = "red"; message = "HADAP KAMERA";
    } else if (yawRatio > CONFIG.YAW_LEFT_THRESHOLD) {
        status = "LEFT"; color = "red"; message = "HADAP KAMERA";
    }

    return { status, color, message };
}

// --- LOGIC: VALIDASI CAHAYA (OPTIMIZED) ---
// 
function checkLightingConditions(videoElement, box) {
    // Safety check dimensi
    if (box.width <= 0 || box.height <= 0) return { status: 'OK', msg: 'OK' };

    // SOLUSI 2: Downscaling
    // Kita set canvas ke ukuran kecil tetap (misal 50x50), tidak peduli seberapa besar wajahnya.
    // Ini mengurangi jumlah pixel yang harus di-loop dari ribuan menjadi hanya 2500 pixel.
    const sampleSize = CONFIG.LIGHTING_SAMPLE_SIZE;
    canvasProcess.width = sampleSize;
    canvasProcess.height = sampleSize;

    // Draw Image: Ambil potongan wajah dari video (Source), gambar ke canvas kecil (Destination)
    ctxProcess.drawImage(
        videoElement, 
        box.rawX, box.rawY, box.rawW, box.rawH, // Source Area (Wajah Asli)
        0, 0, sampleSize, sampleSize            // Dest Area (50x50)
    );

    // Ambil data pixel dari canvas kecil
    const frameData = ctxProcess.getImageData(0, 0, sampleSize, sampleSize).data;
    let totalBrightness = 0;
    
    // Loop semua pixel (karena ukurannya sudah kecil, kita tidak perlu sampleRate lagi, loop semua saja biar akurat)
    // i += 4 karena data pixel = [R, G, B, A, R, G, B, A...]
    for (let i = 0; i < frameData.length; i += 4) {
        const r = frameData[i];
        const g = frameData[i + 1];
        const b = frameData[i + 2];
        
        // Rumus Luminance (Perceptual Brightness)
        const brightness = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
        totalBrightness += brightness;
    }

    // Hitung rata-rata
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

// --- DISPLAY LOGIC ---
function displayResults(results) {
    // Bersihkan elemen UI lama
    cleanUpUI();

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const elementWidth = video.offsetWidth;
    const elementHeight = video.offsetHeight;

    if (videoWidth === 0 || !results.faceLandmarks || results.faceLandmarks.length === 0) return;

    const landmarks = results.faceLandmarks[0];
    const box = calculateBoundingBox(landmarks, videoWidth, videoHeight, elementWidth, elementHeight);

    // 1. Validasi Head Pose (Setiap Frame - karena gerakan cepat)
    const pose = getHeadPose(landmarks);

    // 2. Validasi Cahaya (SOLUSI 1: Throttling)
    // Hanya cek jika waktu sekarang - waktu terakhir cek > 500ms
    const now = Date.now();
    if (now - lastLightingCheckTime > CONFIG.LIGHTING_INTERVAL_MS) {
        cachedLightingResult = checkLightingConditions(video, box.rawBox);
        lastLightingCheckTime = now;
    }

    // Gabungkan Hasil Logika
    let finalColor = pose.color;
    let finalMessage = pose.message;

    // Prioritas Pesan: Pose Dulu, Baru Cahaya
    if (pose.status === "FORWARD") {
        if (cachedLightingResult.status !== 'OK') {
            finalColor = "red";
            finalMessage = cachedLightingResult.msg;
        }
    }

    // Render ke Layar
    renderOverlay(box, finalColor, finalMessage, elementWidth);
}

// --- HELPER FUNCTIONS ---

function cleanUpUI() {
    for (let child of children) {
        liveView.removeChild(child);
    }
    children.splice(0);
}

function calculateBoundingBox(landmarks, vW, vH, elW, elH) {
    // Cari min/max koordinat (0-1)
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const point of landmarks) {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
    }

    // Hitung Skala CSS object-fit: cover
    const scaleX = elW / vW;
    const scaleY = elH / vH;
    const scale = Math.max(scaleX, scaleY);

    const scaledVW = vW * scale;
    const scaledVH = vH * scale;

    const offsetX = (elW - scaledVW) / 2;
    const offsetY = (elH - scaledVH) / 2;

    // Koordinat Visual (CSS)
    const boxX = (minX * scaledVW) + offsetX;
    const boxY = (minY * scaledVH) + offsetY;
    const boxW = (maxX - minX) * scaledVW;
    const boxH = (maxY - minY) * scaledVH;

    // Koordinat Raw (Untuk pemrosesan gambar asli)
    const rawBox = {
        rawX: minX * vW,
        rawY: minY * vH,
        rawW: (maxX - minX) * vW,
        rawH: (maxY - minY) * vH,
        width: (maxX - minX) * vW, // redundancy for safety
        height: (maxY - minY) * vH
    };

    return { boxX, boxY, boxW, boxH, rawBox };
}

function renderOverlay(box, color, message, screenWidth) {
    // Mirroring posisi X untuk visual
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