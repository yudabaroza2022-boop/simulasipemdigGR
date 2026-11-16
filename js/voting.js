
/* =====================================================
   PILKADES DIGITAL KALENTAMBO
   VOTING SYSTEM - 7 TAHAP
   QR ENGINE: jsQR
   DEMO ONLY - FRONTEND STORAGE
===================================================== */

"use strict";

// =====================================================
// 1. KONFIGURASI
// =====================================================

const STORAGE_KEYS = {
    voters: "klt_used_voters",
    votes: "klt_demo_votes",
    candidates: window.KLT_CANDIDATE_CONFIG_KEY || "klt_candidate_config"
};

const DEFAULT_CANDIDATES = {
    1: "Gilang Ramadhan, S.Pd.",
    2: "Calon Nomor Urut 2"
};

const STEP_NAMES = [
    "Persiapan Pemilih",
    "Verifikasi Sidik Jari dan QR",
    "Pemilihan Kandidat",
    "Konfirmasi Pilihan",
    "Konfirmasi Akhir",
    "Suara Berhasil Disimpan",
    "Bukti Pemilihan"
];

// =====================================================
// 2. STATE
// =====================================================

let currentStep = 1;

let voterCode = "";
let selectedCandidate = null;
let receiptCode = "";

let fingerprintVerified = false;
let qrVerified = false;

let fingerprintProcessing = false;
let submitting = false;

let cameraStream = null;
let scannerVideo = null;
let scannerCanvas = null;
let scannerContext = null;
let scannerAnimation = null;

let qrCameraRunning = false;
let qrCameraStarting = false;
let qrScanLocked = false;
let qrDecodeInProgress = false;

let lastRejectedQR = "";
let lastRejectedTime = 0;
let lastScanTime = 0;
let inversionScanCounter = 0;

let candidates = getCandidates();

// =====================================================
// 3. ELEMENT HTML
// =====================================================

const $ = id => document.getElementById(id);

const panels = document.querySelectorAll(".voting-panel");
const candidateCards = document.querySelectorAll(".candidate-card");

// Progress
const progressFill = $("votingProgressFill");
const stepText = $("votingStepText");
const stepName = $("votingStepName");

// Tahap 1
const startVotingButton = $("startVotingButton");
const preparationMessage = $("preparationMessage");

// Tahap 2 - Fingerprint
const fingerprintArea = $("fingerprintArea");
const fingerprintText = $("fingerprintText");
const fingerprintMessage = $("fingerprintMessage");
const fingerprintButton = $("fingerprintButton");

// Tahap 2 - QR
const qrReader = $("qrReader");
const startQrCameraButton = $("startQrCamera");
const stopQrCameraButton = $("stopQrCamera");
const cameraMessage = $("cameraMessage");
const qrMessage = $("qrMessage");
const continueToCandidateButton = $("continueToCandidateButton");

// Tahap 3
const candidateButton = $("candidateButton");
const candidateMessage = $("candidateMessage");

// Tahap 4
const confirmNumber = $("confirmNumber");
const confirmName = $("confirmName");
const confirmPhoto = $("confirmPhoto");
const continueToFinalButton = $("continueToFinalButton");

// Tahap 5
const finalConfirmPhoto = $("finalConfirmPhoto");
const finalConfirmNumber = $("finalConfirmNumber");
const finalConfirmName = $("finalConfirmName");
const repeatChoiceButton = $("repeatChoiceButton");
const submitVoteButton = $("submitVoteButton");
const finalMessage = $("finalMessage");

// Tahap 6
const receiptCodeElement = $("receiptCode");
const continueToReceiptButton = $("continueToReceiptButton");

// Tahap 7
const printReceiptCode = $("printReceiptCode");
const printReceiptDate = $("printReceiptDate");
const receiptQR = $("receiptQR");
const printReceiptButton = $("printReceiptButton");

// =====================================================
// 4. LOCAL STORAGE
// =====================================================

function readStorage(key, fallback) {
    try {
        const data = localStorage.getItem(key);

        if (data === null) {
            return fallback;
        }

        return JSON.parse(data) ?? fallback;

    } catch (error) {
        console.error("[STORAGE] Gagal membaca:", error);
        return fallback;
    }
}

function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// =====================================================
// 5. DATA KANDIDAT
// =====================================================

function extractCandidateName(value) {
    if (typeof value === "string") {
        return value.trim();
    }

    if (value && typeof value === "object") {
        return (
            value.name ||
            value.nama ||
            value.title ||
            value.namaCalon ||
            ""
        ).toString().trim();
    }

    return "";
}

function getCandidates() {
    const config = readStorage(STORAGE_KEYS.candidates, null);

    if (!config || typeof config !== "object") {
        return { ...DEFAULT_CANDIDATES };
    }

    let first = "";
    let second = "";

    first = extractCandidateName(
        config.candidate1 ??
        config[1] ??
        config["1"] ??
        config.candidateName1 ??
        config.namaCalon1
    );

    second = extractCandidateName(
        config.candidate2 ??
        config[2] ??
        config["2"] ??
        config.candidateName2 ??
        config.namaCalon2
    );

    if (Array.isArray(config.candidates)) {
        first = extractCandidateName(config.candidates[0]) || first;
        second = extractCandidateName(config.candidates[1]) || second;
    }

    return {
        1: first || DEFAULT_CANDIDATES[1],
        2: second || DEFAULT_CANDIDATES[2]
    };
}

function updateCandidateNames() {
    candidates = getCandidates();

    candidateCards.forEach(card => {
        const number = Number(card.dataset.candidate);
        const title = card.querySelector("h3");

        if (title && candidates[number]) {
            title.textContent = candidates[number];
        }
    });
}

// =====================================================
// 6. PESAN DAN STATUS
// =====================================================

function showMessage(element, message, success = false) {
    if (!element) return;

    element.textContent = message;
    element.style.color = success ? "#269b62" : "#dc5555";
}

function clearMessage(element) {
    if (!element) return;

    element.textContent = "";
    element.style.color = "";
}

function clearAllMessages() {
    [
        preparationMessage,
        fingerprintMessage,
        cameraMessage,
        qrMessage,
        candidateMessage,
        finalMessage
    ].forEach(clearMessage);
}

function updateVerificationStatus() {
    if (continueToCandidateButton) {
        continueToCandidateButton.disabled =
            !(fingerprintVerified && qrVerified);
    }

    if (startQrCameraButton) {
        startQrCameraButton.disabled =
            qrCameraRunning ||
            qrCameraStarting ||
            qrVerified;

        startQrCameraButton.textContent = qrVerified
            ? "QR Berhasil Diverifikasi ✓"
            : qrCameraRunning
                ? "Kamera Aktif"
                : qrCameraStarting
                    ? "Mengaktifkan Kamera..."
                    : "Aktifkan Kamera";
    }

    if (stopQrCameraButton) {
        stopQrCameraButton.disabled = !qrCameraRunning;
    }
}

// =====================================================
// 7. VALIDASI KODE PEMILIH
// =====================================================

function isValidVoterCode(code) {
    return /^KLT(?:00[1-9]|0[1-9]\d|100)$/.test(code);
}

function isVoterAlreadyUsed(code) {
    const usedVoters = readStorage(STORAGE_KEYS.voters, []);

    if (!Array.isArray(usedVoters)) {
        throw new Error("Data pemilih tidak valid.");
    }

    return usedVoters.includes(code);
}

// =====================================================
// 8. NAVIGASI 7 TAHAP
// =====================================================

function showStep(step) {
    if (step < 1 || step > 7) return;

    const target = $(`step${step}`);

    if (!target) {
        console.error(`[VOTING] Panel step${step} tidak ditemukan.`);
        return;
    }

    if (step !== 2 && qrCameraRunning) {
        stopQrCamera();
    }

    currentStep = step;

    panels.forEach(panel => {
        panel.classList.remove("active");
    });

    target.classList.add("active");

    if (progressFill) {
        progressFill.style.width = `${(step / 7) * 100}%`;
    }

    if (stepText) {
        stepText.textContent = `Tahap ${step} dari 7`;
    }

    if (stepName) {
        stepName.textContent = STEP_NAMES[step - 1];
    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    if (step === 2) {
        updateVerificationStatus();
    }

    if (step === 7) {
        updateReceiptInformation();
        generateReceiptQR();
    }
}

// =====================================================
// 9. TAHAP 1 - PERSIAPAN
// =====================================================

if (startVotingButton) {
    startVotingButton.addEventListener("click", function() {
        clearAllMessages();
        showStep(2);
    });
}

// =====================================================
// 10. TAHAP 2 - SIMULASI SIDIK JARI
// =====================================================

if (fingerprintButton) {
    fingerprintButton.addEventListener("click", function() {
        if (fingerprintProcessing || fingerprintVerified) return;

        fingerprintProcessing = true;

        this.disabled = true;
        this.textContent = "Sedang Memindai...";

        if (fingerprintArea) {
            fingerprintArea.classList.remove("success");
            fingerprintArea.classList.add("scanning");
        }

        if (fingerprintText) {
            fingerprintText.textContent = "MEMPROSES SIMULASI...";
        }

        clearMessage(fingerprintMessage);

        setTimeout(() => {
            fingerprintProcessing = false;
            fingerprintVerified = true;

            if (fingerprintArea) {
                fingerprintArea.classList.remove("scanning");
                fingerprintArea.classList.add("success");
            }

            if (fingerprintText) {
                fingerprintText.textContent = "SIMULASI BERHASIL";
            }

            if (fingerprintButton) {
                fingerprintButton.textContent = "Verifikasi Berhasil ✓";
            }

            showMessage(
                fingerprintMessage,
                "Simulasi verifikasi sidik jari berhasil.",
                true
            );

            updateVerificationStatus();

        }, 1200);
    });
}

// =====================================================
// 11. MEMBUAT VIDEO DAN CANVAS SCANNER
// =====================================================

function createScannerElements() {
    if (!qrReader) {
        throw new Error("Elemen qrReader tidak ditemukan.");
    }

    qrReader.innerHTML = "";

    scannerVideo = document.createElement("video");

    scannerVideo.setAttribute("playsinline", "true");
    scannerVideo.setAttribute("autoplay", "true");
    scannerVideo.setAttribute("muted", "true");

    scannerVideo.muted = true;
    scannerVideo.autoplay = true;
    scannerVideo.playsInline = true;

    scannerVideo.style.width = "100%";
    scannerVideo.style.height = "100%";
    scannerVideo.style.objectFit = "cover";
    scannerVideo.style.display = "block";

    scannerCanvas = document.createElement("canvas");
    scannerCanvas.style.display = "none";

    scannerContext = scannerCanvas.getContext("2d", {
        willReadFrequently: true
    });

    if (!scannerContext) {
        throw new Error("Canvas tidak dapat diinisialisasi.");
    }

    qrReader.appendChild(scannerVideo);
    qrReader.appendChild(scannerCanvas);
}

// =====================================================
// 12. MENGHENTIKAN KAMERA
// =====================================================

async function stopQrCamera() {
    if (scannerAnimation) {
        cancelAnimationFrame(scannerAnimation);
        scannerAnimation = null;
    }

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
            track.stop();
        });

        cameraStream = null;
    }

    if (scannerVideo) {
        scannerVideo.pause();
        scannerVideo.srcObject = null;
    }

    qrCameraRunning = false;
    qrCameraStarting = false;
    qrDecodeInProgress = false;

    updateVerificationStatus();

    console.log("[jsQR] Kamera dihentikan.");
}

// =====================================================
// 13. MENDAPATKAN STREAM KAMERA
// =====================================================

async function getCameraStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
            "Browser tidak mendukung akses kamera. Gunakan Chrome melalui localhost."
        );
    }

    const cameraOptions = [
        {
            video: {
                facingMode: {
                    ideal: "environment"
                },
                width: {
                    ideal: 1920
                },
                height: {
                    ideal: 1080
                }
            },
            audio: false
        },
        {
            video: {
                facingMode: "user",
                width: {
                    ideal: 1280
                },
                height: {
                    ideal: 720
                }
            },
            audio: false
        },
        {
            video: true,
            audio: false
        }
    ];

    let lastError = null;

    for (const constraints of cameraOptions) {
        try {
            console.log("[jsQR] Mencoba konfigurasi kamera:", constraints);

            const stream =
                await navigator.mediaDevices.getUserMedia(constraints);

            return stream;

        } catch (error) {
            lastError = error;

            console.warn(
                "[jsQR] Konfigurasi kamera gagal:",
                error.name,
                error.message
            );
        }
    }

    throw lastError || new Error("Tidak dapat mengakses kamera.");
}

// =====================================================
// 14. DIAGNOSTIK KAMERA
// =====================================================

function getCameraErrorMessage(error) {
    const name = error?.name || "UnknownError";

    if (!window.isSecureContext) {
        return "Akses kamera membutuhkan localhost atau HTTPS.";
    }

    if (name === "NotAllowedError") {
        return "Izin kamera ditolak. Aktifkan izin kamera di Chrome.";
    }

    if (name === "NotFoundError") {
        return "Kamera tidak ditemukan.";
    }

    if (name === "NotReadableError") {
        return "Kamera sedang digunakan aplikasi lain.";
    }

    if (name === "OverconstrainedError") {
        return "Konfigurasi kamera tidak didukung perangkat.";
    }

    return `Kamera gagal diaktifkan: ${error.message || name}`;
}

// =====================================================
// 15. MEMBACA ISI QR
// =====================================================

function extractVoterCodeFromQR(decodedText) {
    if (!decodedText) return null;

    let text = String(decodedText)
        .trim()
        .toUpperCase();

    text = text.replace(/\s+/g, "");

    // Format QR berbentuk JSON
    if (text.startsWith("{")) {
        try {
            const data = JSON.parse(text);

            const values = [
                data.voterCode,
                data.voter_code,
                data.code,
                data.kode,
                data.id,
                data.payload,
                data.value
            ];

            for (const value of values) {
                if (typeof value !== "string") continue;

                const result = extractVoterCodeFromQR(value);

                if (result) return result;
            }

        } catch (error) {
            console.warn("[jsQR] Format JSON tidak valid.");
        }
    }

    // Format QR-KLT001 atau QRKLT001
    const qrMatch = text.match(
        /(?:^|[^A-Z0-9])QR-?(KLT(?:00[1-9]|0[1-9]\d|100))(?:$|[^A-Z0-9])/
    );

    if (qrMatch) {
        return qrMatch[1];
    }

    // Format KLT001
    if (isValidVoterCode(text)) {
        return text;
    }

    return null;
}

// =====================================================
// 16. MEMPROSES QR YANG TERDETEKSI
// =====================================================

async function processScannedQR(decodedText) {
    if (
        qrScanLocked ||
        qrVerified ||
        currentStep !== 2
    ) {
        return;
    }

    const rawText = String(decodedText).trim();

    console.log("================================");
    console.log("[jsQR] QR TERDETEKSI!");
    console.log("[jsQR] Isi QR:", rawText);
    console.log("================================");

    const code = extractVoterCodeFromQR(rawText);

    if (!code) {
        const now = Date.now();

        if (
            rawText !== lastRejectedQR ||
            now - lastRejectedTime > 2500
        ) {
            lastRejectedQR = rawText;
            lastRejectedTime = now;

            showMessage(
                cameraMessage,
                `QR terbaca, tetapi format tidak sesuai: ${rawText.slice(0, 50)}`
            );
        }

        return;
    }

    try {
        if (isVoterAlreadyUsed(code)) {
            qrScanLocked = true;

            await stopQrCamera();

            showMessage(
                cameraMessage,
                "Kode pemilih ini sudah pernah digunakan."
            );

            return;
        }

    } catch (error) {
        showMessage(cameraMessage, error.message);
        return;
    }

    // Kunci hanya setelah kode QR valid
    qrScanLocked = true;
    qrVerified = true;
    voterCode = code;

    await stopQrCamera();

    showMessage(
        cameraMessage,
        `QR berhasil diverifikasi. Kode pemilih: ${voterCode}`,
        true
    );

    showMessage(
        qrMessage,
        "Identitas melalui QR berhasil diverifikasi.",
        true
    );

    console.log("[jsQR] VERIFIKASI BERHASIL:", voterCode);

    updateVerificationStatus();
}

// =====================================================
// 17. OPTIMASI PEMINDAIAN QR
// =====================================================

function scanVideoFrame() {
    if (
        !qrCameraRunning ||
        !scannerVideo ||
        !scannerCanvas ||
        !scannerContext ||
        qrScanLocked
    ) {
        return;
    }

    const now = performance.now();

    // Hindari proses decoding bertumpuk
    if (
        scannerVideo.readyState >= scannerVideo.HAVE_ENOUGH_DATA &&
        !qrDecodeInProgress &&
        now - lastScanTime >= 120
    ) {
        lastScanTime = now;

        const sourceWidth = scannerVideo.videoWidth;
        const sourceHeight = scannerVideo.videoHeight;

        if (sourceWidth > 0 && sourceHeight > 0) {
            qrDecodeInProgress = true;

            try {
                /*
                 * Batasi resolusi pemrosesan.
                 * Rasio gambar tetap dipertahankan.
                 */
                const maxWidth = 1280;

                const scale = Math.min(
                    1,
                    maxWidth / sourceWidth
                );

                const width = Math.max(
                    1,
                    Math.round(sourceWidth * scale)
                );

                const height = Math.max(
                    1,
                    Math.round(sourceHeight * scale)
                );

                scannerCanvas.width = width;
                scannerCanvas.height = height;

                scannerContext.drawImage(
                    scannerVideo,
                    0,
                    0,
                    width,
                    height
                );

                const imageData = scannerContext.getImageData(
                    0,
                    0,
                    width,
                    height
                );

                /*
                 * Mayoritas QR yang dihasilkan admin
                 * menggunakan pola hitam di atas putih.
                 *
                 * Mode normal dicoba lebih dahulu
                 * agar decoding lebih ringan.
                 */
                let code = jsQR(
                    imageData.data,
                    width,
                    height,
                    {
                        inversionAttempts: "dontInvert"
                    }
                );

                /*
                 * Setiap beberapa frame, coba mode inversi
                 * untuk mengantisipasi QR dengan warna terbalik.
                 */
                inversionScanCounter++;

                if (
                    !code &&
                    inversionScanCounter % 5 === 0
                ) {
                    code = jsQR(
                        imageData.data,
                        width,
                        height,
                        {
                            inversionAttempts: "attemptBoth"
                        }
                    );
                }

                if (code && code.data) {
                    console.log(
                        "[jsQR] HASIL DECODE:",
                        code.data
                    );

                    /*
                     * Jangan mengunci QR di sini.
                     * processScannedQR yang menentukan
                     * apakah QR valid atau tidak.
                     */
                    processScannedQR(code.data);
                }

            } catch (error) {
                console.error(
                    "[jsQR] Gagal memproses frame:",
                    error
                );

            } finally {
                qrDecodeInProgress = false;
            }
        }
    }

    if (qrCameraRunning && !qrScanLocked) {
        scannerAnimation = requestAnimationFrame(scanVideoFrame);
    }
}

// =====================================================
// 18. MEMULAI SCANNER jsQR
// =====================================================

async function startQrCamera() {
    if (
        qrCameraRunning ||
        qrCameraStarting ||
        qrVerified ||
        currentStep !== 2
    ) {
        return;
    }

    if (typeof jsQR !== "function") {
        showMessage(
            cameraMessage,
            "Library jsQR belum dimuat. Periksa script CDN di voting.html."
        );

        console.error("[jsQR] Library tidak ditemukan.");
        return;
    }

    if (!window.isSecureContext) {
        showMessage(
            cameraMessage,
            "Akses kamera membutuhkan localhost atau HTTPS."
        );

        return;
    }

    qrCameraStarting = true;
    qrScanLocked = false;
    qrDecodeInProgress = false;

    lastRejectedQR = "";
    lastRejectedTime = 0;
    lastScanTime = 0;
    inversionScanCounter = 0;

    updateVerificationStatus();

    showMessage(
        cameraMessage,
        "Menyiapkan kamera dan scanner QR..."
    );

    try {
        await stopQrCamera();

        // Kembalikan status proses mulai kamera
        qrCameraStarting = true;
        updateVerificationStatus();

        createScannerElements();

        cameraStream = await getCameraStream();

        scannerVideo.srcObject = cameraStream;

        await scannerVideo.play();

        qrCameraRunning = true;
        qrCameraStarting = false;

        showMessage(
            cameraMessage,
            "Kamera aktif. Arahkan QR undangan ke area pemindaian.",
            true
        );

        console.log("[jsQR] Scanner aktif.");

        console.log("[jsQR] Resolusi video:", {
            width: scannerVideo.videoWidth,
            height: scannerVideo.videoHeight
        });

        updateVerificationStatus();

        scannerAnimation = requestAnimationFrame(scanVideoFrame);

    } catch (error) {
        console.error("[jsQR] Kesalahan scanner:", error);

        await stopQrCamera();

        showMessage(
            cameraMessage,
            getCameraErrorMessage(error)
        );

    } finally {
        qrCameraStarting = false;
        updateVerificationStatus();
    }
}

// =====================================================
// 19. EVENT TOMBOL KAMERA
// =====================================================

if (startQrCameraButton) {
    startQrCameraButton.addEventListener(
        "click",
        startQrCamera
    );
}

if (stopQrCameraButton) {
    stopQrCameraButton.addEventListener(
        "click",
        stopQrCamera
    );
}

// =====================================================
// 20. LANJUT KE PEMILIHAN
// =====================================================

if (continueToCandidateButton) {
    continueToCandidateButton.addEventListener("click", function() {
        if (!fingerprintVerified || !qrVerified) {
            showMessage(
                qrMessage,
                "Selesaikan verifikasi sidik jari dan QR terlebih dahulu."
            );

            return;
        }

        showStep(3);
    });
}

// =====================================================
// 21. TAHAP 3 - PILIH KANDIDAT
// =====================================================

candidateCards.forEach(card => {
    card.addEventListener("click", function() {
        if (submitting) return;

        const number = Number(this.dataset.candidate);

        if (![1, 2].includes(number)) return;

        candidateCards.forEach(item => {
            item.classList.remove("selected");
        });

        this.classList.add("selected");

        selectedCandidate = number;

        if (candidateButton) {
            candidateButton.disabled = false;
        }

        showMessage(
            candidateMessage,
            `Anda memilih ${candidates[number]}.`,
            true
        );
    });
});

if (candidateButton) {
    candidateButton.addEventListener("click", function() {
        if (![1, 2].includes(selectedCandidate)) {
            showMessage(
                candidateMessage,
                "Silakan pilih salah satu kandidat."
            );

            return;
        }

        if (!fingerprintVerified || !qrVerified || !voterCode) {
            showStep(2);
            return;
        }

        updateCandidateNames();
        updateConfirmationInformation();

        showStep(4);
    });
}

// =====================================================
// 22. UPDATE KONFIRMASI
// =====================================================

function updateConfirmationInformation() {
    if (![1, 2].includes(selectedCandidate)) return;

    const number = String(selectedCandidate).padStart(2, "0");
    const name = candidates[selectedCandidate];

    if (confirmNumber) {
        confirmNumber.textContent = number;
    }

    if (confirmName) {
        confirmName.textContent = name;
    }

    if (finalConfirmNumber) {
        finalConfirmNumber.textContent = number;
    }

    if (finalConfirmName) {
        finalConfirmName.textContent = name;
    }

    const selectedCard = document.querySelector(
        `.candidate-card[data-candidate="${selectedCandidate}"]`
    );

    const selectedImage = selectedCard?.querySelector("img");

    if (selectedImage) {
        if (confirmPhoto) {
            confirmPhoto.src = selectedImage.src;
        }

        if (finalConfirmPhoto) {
            finalConfirmPhoto.src = selectedImage.src;
        }
    }
}

// =====================================================
// 23. TAHAP 4 - KONFIRMASI PILIHAN
// =====================================================

if (continueToFinalButton) {
    continueToFinalButton.addEventListener("click", function() {
        if (![1, 2].includes(selectedCandidate)) {
            showStep(3);
            return;
        }

        updateConfirmationInformation();
        clearMessage(finalMessage);

        showStep(5);
    });
}

// =====================================================
// 24. TAHAP 5 - ULANGI PILIHAN
// =====================================================

if (repeatChoiceButton) {
    repeatChoiceButton.addEventListener("click", function() {
        if (submitting) return;

        selectedCandidate = null;

        candidateCards.forEach(card => {
            card.classList.remove("selected");
        });

        if (candidateButton) {
            candidateButton.disabled = true;
        }

        clearMessage(candidateMessage);
        clearMessage(finalMessage);

        showStep(3);
    });
}

// =====================================================
// 25. SIMPAN SUARA
// =====================================================

function saveVote() {
    if (!voterCode || ![1, 2].includes(selectedCandidate)) {
        throw new Error("Data pemilih atau kandidat belum lengkap.");
    }

    if (!fingerprintVerified || !qrVerified) {
        throw new Error("Verifikasi pemilih belum lengkap.");
    }

    const usedVoters = readStorage(
        STORAGE_KEYS.voters,
        []
    );

    const votes = readStorage(
        STORAGE_KEYS.votes,
        []
    );

    if (
        !Array.isArray(usedVoters) ||
        !Array.isArray(votes)
    ) {
        throw new Error("Format data simulasi tidak valid.");
    }

    if (usedVoters.includes(voterCode)) {
        throw new Error("Kode pemilih sudah pernah digunakan.");
    }

    const oldVotes = localStorage.getItem(STORAGE_KEYS.votes);
    const oldVoters = localStorage.getItem(STORAGE_KEYS.voters);

    receiptCode =
        "KLT-DEMO-" + Date.now().toString().slice(-8);

    const newVote = {
        candidate: selectedCandidate,
        date: new Date().toISOString(),
        receipt: receiptCode
    };

    try {
        writeStorage(
            STORAGE_KEYS.votes,
            votes.concat(newVote)
        );

        writeStorage(
            STORAGE_KEYS.voters,
            usedVoters.concat(voterCode)
        );

    } catch (error) {
        try {
            if (oldVotes === null) {
                localStorage.removeItem(STORAGE_KEYS.votes);
            } else {
                localStorage.setItem(STORAGE_KEYS.votes, oldVotes);
            }

            if (oldVoters === null) {
                localStorage.removeItem(STORAGE_KEYS.voters);
            } else {
                localStorage.setItem(STORAGE_KEYS.voters, oldVoters);
            }

        } catch (rollbackError) {
            console.error("[VOTING] Rollback gagal:", rollbackError);
        }

        throw error;
    }
}

// =====================================================
// 26. TAHAP 5 - PILIH / SIMPAN
// =====================================================

if (submitVoteButton) {
    submitVoteButton.addEventListener("click", function() {
        if (submitting) return;

        submitting = true;

        this.disabled = true;
        this.textContent = "Menyimpan Suara...";

        if (repeatChoiceButton) {
            repeatChoiceButton.disabled = true;
        }

        try {
            saveVote();

            if (receiptCodeElement) {
                receiptCodeElement.textContent = receiptCode;
            }

            showStep(6);

            console.log("[VOTING] Suara berhasil disimpan.");
            console.log("[VOTING] Bukti:", receiptCode);

        } catch (error) {
            console.error("[VOTING] Gagal menyimpan suara:", error);

            showMessage(
                finalMessage,
                error.message || "Gagal menyimpan suara."
            );

            submitting = false;

            this.disabled = false;
            this.textContent = "PILIH";

            if (repeatChoiceButton) {
                repeatChoiceButton.disabled = false;
            }
        }
    });
}

// =====================================================
// 27. TAHAP 6 - LANJUT KE BUKTI
// =====================================================

if (continueToReceiptButton) {
    continueToReceiptButton.addEventListener("click", function() {
        if (!receiptCode) {
            showMessage(
                finalMessage,
                "Kode bukti pemilihan belum tersedia."
            );

            return;
        }

        showStep(7);
    });
}

// =====================================================
// 28. INFORMASI BUKTI
// =====================================================

function updateReceiptInformation() {
    if (printReceiptCode) {
        printReceiptCode.textContent = receiptCode || "-";
    }

    if (printReceiptDate) {
        printReceiptDate.textContent = new Date().toLocaleString(
            "id-ID",
            {
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }
}

// =====================================================
// 29. QR BUKTI PEMILIHAN
// =====================================================

function generateReceiptQR() {
    if (!receiptQR || !receiptCode) return;

    receiptQR.innerHTML = "";

    if (typeof QRCode === "undefined") {
        receiptQR.textContent =
            "Library QRCode belum tersedia.";

        console.error("[VOTING] QRCode library tidak ditemukan.");
        return;
    }

    const payload = JSON.stringify({
        type: "DEMO",
        village: "Kalentambo",
        receipt: receiptCode
    });

    try {
        new QRCode(receiptQR, {
            text: payload,
            width: 130,
            height: 130,
            colorDark: "#102a43",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });

    } catch (error) {
        console.error("[VOTING] Gagal membuat QR:", error);

        receiptQR.textContent = "Gagal membuat QR bukti.";
    }
}

// =====================================================
// 30. CETAK BUKTI
// =====================================================

if (printReceiptButton) {
    printReceiptButton.addEventListener("click", function() {
        if (!receiptCode) {
            alert("Bukti pemilihan belum tersedia.");
            return;
        }

        window.print();
    });
}

// =====================================================
// 31. MEMBERSIHKAN KAMERA
// =====================================================

window.addEventListener("beforeunload", function() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }

    if (scannerAnimation) {
        cancelAnimationFrame(scannerAnimation);
    }
});

// =====================================================
// 32. INITIALIZE
// =====================================================

function initializeVoting() {
    updateCandidateNames();

    if (candidateButton) {
        candidateButton.disabled = true;
    }

    if (continueToCandidateButton) {
        continueToCandidateButton.disabled = true;
    }

    if (submitVoteButton) {
        submitVoteButton.disabled = false;
    }

    if (confirmNumber) {
        confirmNumber.textContent = "00";
    }

    if (confirmName) {
        confirmName.textContent = "Belum ada pilihan";
    }

    if (finalConfirmNumber) {
        finalConfirmNumber.textContent = "00";
    }

    if (finalConfirmName) {
        finalConfirmName.textContent = "Belum ada pilihan";
    }

    updateVerificationStatus();
    showStep(1);

    console.log("======================================");
    console.log("PILKADES DIGITAL KALENTAMBO");
    console.log("Voting JavaScript berhasil dimuat.");
    console.log("QR Engine:", typeof jsQR);
    console.log("QRCode:", typeof QRCode);
    console.log("Secure Context:", window.isSecureContext);
    console.log("Media Devices:", !!navigator.mediaDevices);
    console.log("======================================");
}

initializeVoting();
