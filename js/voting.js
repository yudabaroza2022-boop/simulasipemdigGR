
/* =====================================================
   PILKADES DIGITAL KALENTAMBO
   VOTING SYSTEM - 6 TAHAP
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

const DEFAULT_CANDIDATE = {
    number: 1,
    name: "Gilang Ramadhan, S.Pd.",
    photo: "assets/calon-gilang.jpg"
};

const STEP_NAMES = [
    "Persiapan Pemilih",
    "Verifikasi QR Code",
    "Pemilihan Kandidat",
    "Konfirmasi Pilihan",
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
let submitting = false;

let qrVerified = false;

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

let candidates = getCandidate();

// =====================================================
// 3. ELEMENT HTML
// =====================================================

const $ = id => document.getElementById(id);

const panels = document.querySelectorAll(".voting-panel");
const candidateCard = document.querySelector(".candidate-card");

// Progress
const progressFill = $("votingProgressFill");
const stepText = $("votingStepText");
const stepName = $("votingStepName");

// Tahap 1
const startVotingButton = $("startVotingButton");
const preparationMessage = $("preparationMessage");

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
const finalConfirmPhoto = $("finalConfirmPhoto");
const finalConfirmNumber = $("finalConfirmNumber");
const finalConfirmName = $("finalConfirmName");
const repeatChoiceButton = $("repeatChoiceButton");
const submitVoteButton = $("submitVoteButton");
const finalMessage = $("finalMessage");

// Tahap 5
const receiptCodeElement = $("receiptCode");
const continueToReceiptButton = $("continueToReceiptButton");

// Tahap 6
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

function getCandidate() {
    const config = readStorage(STORAGE_KEYS.candidates, null);

    let name = DEFAULT_CANDIDATE.name;

    if (config && typeof config === "object") {
        name = extractCandidateName(
            config.candidate1 ??
            config[1] ??
            config["1"] ??
            config.candidateName1 ??
            config.namaCalon1
        ) || name;

        if (Array.isArray(config.candidates)) {
            name = extractCandidateName(config.candidates[0]) || name;
        }
    }

    return {
        number: 1,
        name,
        photo: DEFAULT_CANDIDATE.photo
    };
}

function updateCandidateInformation() {
    candidates = getCandidate();

    if (candidateCard) {
        const title = candidateCard.querySelector("h3");

        if (title) {
            title.textContent = candidates.name;
        }
    }

    if (finalConfirmName) {
        finalConfirmName.textContent = candidates.name;
    }
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
        cameraMessage,
        qrMessage,
        candidateMessage,
        finalMessage
    ].forEach(clearMessage);
}

function updateVerificationStatus() {
    if (continueToCandidateButton) {
        continueToCandidateButton.disabled = !qrVerified;
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
// 8. NAVIGASI 6 TAHAP
// =====================================================

function showStep(step) {
    if (step < 1 || step > 6) return;

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
        progressFill.style.width = `${(step / 6) * 100}%`;
    }

    if (stepText) {
        stepText.textContent = `Langkah ${step} dari 6`;
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

    if (step === 6) {
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
// 10. MEMBUAT VIDEO DAN CANVAS SCANNER
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
// 11. MENGHENTIKAN KAMERA
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
// 12. MENDAPATKAN STREAM KAMERA
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
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        },
        {
            video: {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 }
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
// 13. DIAGNOSTIK KAMERA
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
// 14. MEMBACA ISI QR
// =====================================================

function extractVoterCodeFromQR(decodedText) {
    if (!decodedText) return null;

    let text = String(decodedText)
        .trim()
        .toUpperCase();

    text = text.replace(/\s+/g, "");

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

    const qrMatch = text.match(
        /(?:^|[^A-Z0-9])QR-?(KLT(?:00[1-9]|0[1-9]\d|100))(?:$|[^A-Z0-9])/
    );

    if (qrMatch) {
        return qrMatch[1];
    }

    if (isValidVoterCode(text)) {
        return text;
    }

    return null;
}

// =====================================================
// 15. MEMPROSES QR YANG TERDETEKSI
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

    console.log("[jsQR] QR TERDETEKSI:", rawText);

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
        "QR Code berhasil diverifikasi. Silakan lanjutkan.",
        true
    );

    console.log("[jsQR] VERIFIKASI BERHASIL:", voterCode);

    updateVerificationStatus();
}

// =====================================================
// 16. OPTIMASI PEMINDAIAN QR
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

                let code = jsQR(
                    imageData.data,
                    width,
                    height,
                    {
                        inversionAttempts: "dontInvert"
                    }
                );

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
// 17. MEMULAI SCANNER jsQR
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
// 18. EVENT TOMBOL KAMERA
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
// 19. LANJUT KE PEMILIHAN
// =====================================================

if (continueToCandidateButton) {
    continueToCandidateButton.addEventListener("click", function() {
        if (!qrVerified || !voterCode) {
            showMessage(
                qrMessage,
                "Pindai dan verifikasi QR Code terlebih dahulu."
            );

            return;
        }

        showStep(3);
    });
}

// =====================================================
// 20. TAHAP 3 - PILIH GILANG RAMADHAN
// =====================================================

if (candidateCard) {
    candidateCard.addEventListener("click", function() {
        if (submitting) return;

        selectedCandidate = 1;

        candidateCard.classList.add("selected");

        if (candidateButton) {
            candidateButton.disabled = false;
        }

        showMessage(
            candidateMessage,
            `Anda memilih ${candidates.name}.`,
            true
        );
    });
}

if (candidateButton) {
    candidateButton.addEventListener("click", function() {
        if (selectedCandidate !== 1) {
            showMessage(
                candidateMessage,
                "Silakan pilih Gilang Ramadhan terlebih dahulu."
            );

            return;
        }

        if (!qrVerified || !voterCode) {
            showStep(2);
            return;
        }

        updateConfirmationInformation();
        clearMessage(finalMessage);

        showStep(4);
    });
}

// =====================================================
// 21. UPDATE INFORMASI KONFIRMASI
// =====================================================

function updateConfirmationInformation() {
    if (selectedCandidate !== 1) return;

    if (finalConfirmNumber) {
        finalConfirmNumber.textContent = "01";
    }

    if (finalConfirmName) {
        finalConfirmName.textContent = candidates.name;
    }

    if (finalConfirmPhoto) {
        finalConfirmPhoto.src = candidates.photo;
    }
}

// =====================================================
// 22. TAHAP 4 - ULANGI PILIHAN
// =====================================================

if (repeatChoiceButton) {
    repeatChoiceButton.addEventListener("click", function() {
        if (submitting) return;

        selectedCandidate = null;

        if (candidateCard) {
            candidateCard.classList.remove("selected");
        }

        if (candidateButton) {
            candidateButton.disabled = true;
        }

        clearMessage(candidateMessage);
        clearMessage(finalMessage);

        showStep(3);
    });
}

// =====================================================
// 23. SIMPAN SUARA
// =====================================================

function saveVote() {
    if (!voterCode || selectedCandidate !== 1) {
        throw new Error("Data pemilih atau kandidat belum lengkap.");
    }

    if (!qrVerified) {
        throw new Error("Verifikasi QR Code belum dilakukan.");
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
        candidate: 1,
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
// 24. TAHAP 4 - PILIH / SIMPAN SUARA
// =====================================================

if (submitVoteButton) {
    submitVoteButton.addEventListener("click", function() {
        if (submitting) return;

        if (!qrVerified || !voterCode || selectedCandidate !== 1) {
            showMessage(
                finalMessage,
                "Data pemilihan belum lengkap. Silakan periksa kembali."
            );

            return;
        }

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

            showStep(5);

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
// 25. TAHAP 5 - LANJUT KE BUKTI
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

        showStep(6);
    });
}

// =====================================================
// 26. INFORMASI BUKTI
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
// 27. QR BUKTI PEMILIHAN
// =====================================================

function generateReceiptQR() {
    if (!receiptQR || !receiptCode) return;

    receiptQR.innerHTML = "";

    if (typeof QRCode === "undefined") {
        receiptQR.textContent = "Library QRCode belum tersedia.";

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



/* =====================================================
   28. CETAK BUKTI PEMILIHAN
   PILKADES DIGITAL DESA KALENTAMBO
   A4 PORTRAIT - ONE PAGE
===================================================== */

if (printReceiptButton) {

    printReceiptButton.addEventListener("click", async function() {

        const receipt = document.getElementById("printReceipt");

        // Validasi bukti pemilihan
        if (!receipt || !receiptCode) {
            alert("Bukti pemilihan belum tersedia.");
            return;
        }

        // Buka jendela cetak
        const printWindow = window.open(
            "",
            "_blank",
            "width=850,height=950"
        );

        if (!printWindow) {
            alert(
                "Jendela cetak diblokir browser. " +
                "Izinkan pop-up untuk situs ini, lalu coba kembali."
            );
            return;
        }

        try {

            /* =========================================
               A. SALIN KARTU BUKTI
            ========================================= */

            const clonedReceipt = receipt.cloneNode(true);

            // Ambil QR Code asli
            const originalQr = receipt.querySelector(".qr-receipt");
            const clonedQr = clonedReceipt.querySelector(".qr-receipt");

            if (originalQr && clonedQr) {

                let qrImageSource = "";

                // Prioritaskan canvas untuk mendapatkan QR resolusi asli
                const originalCanvas = originalQr.querySelector("canvas");

                if (originalCanvas) {
                    try {
                        qrImageSource = originalCanvas.toDataURL("image/png");
                    } catch (error) {
                        console.warn("[PRINT] Canvas QR gagal dikonversi:", error);
                    }
                }

                // Jika canvas tidak tersedia, gunakan gambar QR
                if (!qrImageSource) {
                    const originalImage = originalQr.querySelector("img");

                    if (originalImage) {
                        qrImageSource = originalImage.src;
                    }
                }

                // Bersihkan QR ganda dan tampilkan satu gambar saja
                clonedQr.innerHTML = "";

                if (qrImageSource) {
                    const qrImage = document.createElement("img");

                    qrImage.src = qrImageSource;
                    qrImage.alt = "QR Code Bukti Pemilihan";

                    clonedQr.appendChild(qrImage);
                } else {
                    clonedQr.textContent = "QR Code tidak tersedia.";
                }
            }

            /* =========================================
               B. DOKUMEN CETAK
            ========================================= */

            const printDocument = `
<!DOCTYPE html>
<html lang="id">

<head>

    <meta charset="UTF-8">

    <meta name="viewport"
          content="width=device-width, initial-scale=1.0">

    <title>Bukti Pemilihan - Kalentambo</title>

    <style>

        /* =========================================
           PENGATURAN KERTAS A4
        ========================================= */

        @page {
            size: A4 portrait;
            margin: 15mm;
        }

        * {
            box-sizing: border-box;
        }

        html,
        body {
            width: 100%;
            min-height: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #102a43;
            font-family: Arial, Helvetica, sans-serif;
        }

        body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        /* =========================================
           CONTAINER UTAMA
        ========================================= */

        .print-wrapper {
            width: 100%;
            max-width: 380px;
            margin: 0 auto;
            padding: 0;
        }

        /* =========================================
           KARTU BUKTI PEMILIHAN
        ========================================= */

        .print-receipt {
            position: relative;
            width: 100%;
            margin: 0 auto;
            padding: 22px 24px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            background: #ffffff;
            color: #102a43;
            text-align: center;
            overflow: hidden;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .print-receipt::before {
            content: "";
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 5px;
            background: linear-gradient(
                90deg,
                #102a43,
                #d6ad60
            );
        }

        /* =========================================
           HEADER
        ========================================= */

        .receipt-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding-top: 6px;
        }

        .receipt-logo {
            width: 46px;
            height: 46px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 11px;
            background: #102a43;
            color: #e6c786;
            font-size: 23px;
            font-weight: 800;
        }

        .receipt-header h3 {
            margin: 0 0 5px;
            color: #102a43;
            font-size: 16px;
            font-weight: 800;
            letter-spacing: 0.5px;
        }

        .receipt-header strong {
            color: #526174;
            font-size: 10px;
            letter-spacing: 1px;
        }

        .receipt-header > span {
            display: inline-block;
            margin-top: 11px;
            padding: 6px 12px;
            background: #f4f0e7;
            border-radius: 20px;
            color: #94723c;
            font-size: 8px;
            font-weight: 800;
            letter-spacing: 0.8px;
        }

        /* =========================================
           PEMBATAS
        ========================================= */

        .receipt-divider {
            width: 100%;
            height: 1px;
            margin: 16px 0;
            border: 0;
            border-top: 1px dashed #cbd5e1;
        }

        /* =========================================
           GRID INFORMASI
        ========================================= */

        .receipt-information {
            display: flex;
            flex-direction: column;
            gap: 8px;
            text-align: left;
        }

        .receipt-row {
            display: grid;
            grid-template-columns: 1fr 1.3fr;
            align-items: center;
            gap: 10px;
            padding: 10px;
            background: #f8fafc;
            border: 1px solid #e5eaf0;
            border-radius: 7px;
            font-size: 10px;
        }

        .receipt-row span {
            color: #718096;
        }

        .receipt-row strong {
            color: #102a43;
            text-align: right;
            overflow-wrap: anywhere;
        }

        .receipt-row:first-child strong {
            color: #269b62;
        }

        /* =========================================
           STATUS BERHASIL
        ========================================= */

        .receipt-success {
            margin: 18px 0;
            text-align: center;
        }

        .receipt-success > div {
            width: 42px;
            height: 42px;
            margin: 0 auto 9px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: #e8f7ef;
            color: #269b62;
            font-size: 23px;
            font-weight: 800;
        }

        .receipt-success h3 {
            margin: 7px 0 4px;
            color: #269b62;
            font-size: 14px;
            font-weight: 800;
        }

        .receipt-success p {
            margin: 0;
            color: #718096;
            font-size: 10px;
        }

        /* =========================================
           QR CODE
        ========================================= */

        .qr-receipt {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            min-height: 125px;
            margin: 12px auto 5px;
        }

        .qr-receipt img {
            display: block;
            width: 115px;
            height: 115px;
            margin: 0 auto;
            object-fit: contain;
        }

        .receipt-qr-label {
            display: block;
            margin-top: 5px;
            color: #718096;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.8px;
        }

        /* =========================================
           FOOTER
        ========================================= */

        .receipt-footer {
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px dashed #cbd5e1;
            color: #94a3b8;
            font-size: 8px;
            font-weight: 700;
            line-height: 1.7;
            letter-spacing: 0.6px;
        }

        /* =========================================
           PENGATURAN PRINT
        ========================================= */

        @media print {

            html,
            body {
                width: 100%;
                min-height: 0;
                margin: 0;
                padding: 0;
                background: #ffffff;
            }

            .print-wrapper {
                width: 100%;
                max-width: 380px;
                margin: 0 auto;
                padding: 0;
            }

            .print-receipt {
                width: 100%;
                margin: 0 auto;
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }

            .qr-receipt img {
                width: 115px;
                height: 115px;
            }
        }

    </style>

</head>

<body>

    <main class="print-wrapper">

        <section class="print-receipt">

            ${clonedReceipt.innerHTML}

        </section>

    </main>

</body>

</html>
            `;

            /* =========================================
               C. TULIS DOKUMEN CETAK
            ========================================= */

            printWindow.document.open();
            printWindow.document.write(printDocument);
            printWindow.document.close();

            /* =========================================
               D. TUNGGU GAMBAR SELESAI DIMUAT
            ========================================= */

            await new Promise(resolve => {

                const checkReady = async () => {

                    if (printWindow.closed) {
                        resolve();
                        return;
                    }

                    if (
                        printWindow.document.readyState === "complete"
                    ) {

                        const images = Array.from(
                            printWindow.document.images
                        );

                        await Promise.all(
                            images.map(image => {

                                if (image.complete) {
                                    return Promise.resolve();
                                }

                                return new Promise(resolveImage => {
                                    image.onload = resolveImage;
                                    image.onerror = resolveImage;
                                });

                            })
                        );

                        if (printWindow.document.fonts) {
                            await printWindow.document.fonts.ready;
                        }

                        resolve();

                    } else {
                        setTimeout(checkReady, 100);
                    }

                };

                checkReady();

            });

            /* =========================================
               E. JALANKAN PRINT
            ========================================= */

            if (!printWindow.closed) {

                await new Promise(resolve => {
                    setTimeout(resolve, 500);
                });

                printWindow.focus();
                printWindow.print();

            }

            console.log("[PRINT] Bukti pemilihan siap dicetak.");

        } catch (error) {

            console.error("[PRINT] Gagal mencetak:", error);

            if (!printWindow.closed) {
                printWindow.close();
            }

            alert(
                "Terjadi kesalahan saat menyiapkan bukti cetak. " +
                "Silakan coba kembali."
            );

        }

    });

}

/* =====================================================
   END CETAK BUKTI PEMILIHAN
===================================================== */



// =====================================================
// 29. MEMBERSIHKAN KAMERA
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
// 30. INITIALIZE
// =====================================================

function initializeVoting() {
    updateCandidateInformation();

    if (candidateButton) {
        candidateButton.disabled = true;
    }

    if (continueToCandidateButton) {
        continueToCandidateButton.disabled = true;
    }

    if (submitVoteButton) {
        submitVoteButton.disabled = false;
    }

    if (finalConfirmNumber) {
        finalConfirmNumber.textContent = "01";
    }

    if (finalConfirmName) {
        finalConfirmName.textContent = candidates.name;
    }

    if (finalConfirmPhoto) {
        finalConfirmPhoto.src = candidates.photo;
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
