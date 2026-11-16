/* =====================================================
   PILKADES DIGITAL KALENTAMBO
   ADMIN DASHBOARD
   QR GENERATOR + PDF INVITATION
   MODERN INTERACTIVE UI
===================================================== */

"use strict";

// =====================================================
// 1. KONFIGURASI
// =====================================================

const VOTES_KEY = "klt_demo_votes";
const USED_KEY = "klt_used_voters";
const CANDIDATES_KEY = "klt_candidate_config";
const THEME_KEY = "klt_admin_theme";

const DEFAULT_CANDIDATES = {
    candidate1: "Gilang Ramadhan, S.Pd.",
    candidate2: "Calon Nomor Urut 2"
};

const QR_TOTAL = 100;
const QR_PREFIX = "KLT";

const $ = id => document.getElementById(id);

let generatedQrItems = [];
let qrGenerating = false;
let bulkDownloading = false;
let generatingPDF = false;

// =====================================================
// 2. LOCAL STORAGE
// =====================================================

function readJSON(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return fallback;
        return JSON.parse(value) ?? fallback;
    } catch (error) {
        console.error(`Data ${key} tidak dapat dibaca:`, error);
        return fallback;
    }
}

function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Gagal menyimpan ${key}:`, error);
        return false;
    }
}

// =====================================================
// 3. HELPER TAMPILAN
// =====================================================

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
}

function setValue(id, value) {
    const element = $(id);
    if (element) element.value = value;
}

function setWidth(id, percentage) {
    const element = $(id);
    if (!element) return;

    const safePercentage = Number.isFinite(percentage)
        ? Math.max(0, Math.min(100, percentage))
        : 0;

    element.style.width = `${safePercentage}%`;
}

function showMessage(id, message, success = false) {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.classList.remove("success", "error");
    element.classList.add(success ? "success" : "error");
}

// =====================================================
// 4. NOTIFIKASI MODERN
// =====================================================

function showAdminToast(message, type = "success", duration = 3000) {
    let region = $("adminToastRegion");

    if (!region) {
        region = document.createElement("div");
        region.id = "adminToastRegion";
        region.className = "admin-toast-region";
        document.body.appendChild(region);
    }

    const toast = document.createElement("div");
    toast.className = `admin-toast ${type}`;

    const icon = document.createElement("span");
    icon.className = "admin-toast-icon";
    icon.textContent = type === "error" ? "!" : "✓";

    const text = document.createElement("span");
    text.textContent = message;

    toast.append(icon, text);
    region.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

window.showAdminToast = showAdminToast;

// =====================================================
// 5. KONFIGURASI NAMA CALON
// =====================================================

function getCandidates() {
    const saved = readJSON(CANDIDATES_KEY, {});

    if (!saved || typeof saved !== "object") {
        return { ...DEFAULT_CANDIDATES };
    }

    let candidate1 = saved.candidate1;
    let candidate2 = saved.candidate2;

    if (Array.isArray(saved.candidates)) {
        candidate1 =
            saved.candidates[0]?.name ||
            saved.candidates[0]?.nama ||
            candidate1;

        candidate2 =
            saved.candidates[1]?.name ||
            saved.candidates[1]?.nama ||
            candidate2;
    }

    return {
        candidate1:
            typeof candidate1 === "string" && candidate1.trim()
                ? candidate1.trim()
                : DEFAULT_CANDIDATES.candidate1,

        candidate2:
            typeof candidate2 === "string" && candidate2.trim()
                ? candidate2.trim()
                : DEFAULT_CANDIDATES.candidate2
    };
}

// =====================================================
// 6. AMBIL DATA SUARA
// =====================================================

function getVotes() {
    const data = readJSON(VOTES_KEY, []);
    return Array.isArray(data) ? data : [];
}

function getUsedParticipants() {
    const data = readJSON(USED_KEY, []);

    if (Array.isArray(data)) {
        return [
            ...new Set(
                data
                    .filter(item => item !== null && item !== undefined)
                    .map(item => String(item).trim())
                    .filter(Boolean)
            )
        ];
    }

    if (data && typeof data === "object") {
        return Object.keys(data).filter(key => data[key]);
    }

    return [];
}

// =====================================================
// 7. IDENTIFIKASI KANDIDAT
// =====================================================

function identifyCandidate(vote, candidates) {
    if (!vote || typeof vote !== "object") return 0;

    const raw = [
        vote.candidate,
        vote.candidateId,
        vote.candidateNumber,
        vote.choice,
        vote.nomorCalon
    ].find(value => value !== undefined && value !== null);

    if (raw === undefined) return 0;

    const value = String(raw).trim().toLowerCase();
    const name1 = candidates.candidate1.toLowerCase();
    const name2 = candidates.candidate2.toLowerCase();

    if (
        value === "1" ||
        value === "01" ||
        value === "candidate1" ||
        value === "candidate-1" ||
        value === name1 ||
        /^calon\s*0?1$/.test(value) ||
        /nomor\s*urut\s*0?1/.test(value)
    ) return 1;

    if (
        value === "2" ||
        value === "02" ||
        value === "candidate2" ||
        value === "candidate-2" ||
        value === name2 ||
        /^calon\s*0?2$/.test(value) ||
        /nomor\s*urut\s*0?2/.test(value)
    ) return 2;

    return 0;
}

// =====================================================
// 8. TABEL PEMILIH
// =====================================================

function renderParticipants(participants) {
    const table = $("participantTable");
    if (!table) return;

    table.replaceChildren();

    if (participants.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 3;
        cell.className = "empty-cell";
        cell.textContent = "Belum ada kode pemilih yang digunakan.";

        row.appendChild(cell);
        table.appendChild(row);
        return;
    }

    participants.forEach((code, index) => {
        const row = document.createElement("tr");

        const numberCell = document.createElement("td");
        numberCell.textContent = index + 1;

        const codeCell = document.createElement("td");
        codeCell.textContent = String(code);

        const statusCell = document.createElement("td");
        const status = document.createElement("span");

        status.className = "status-used";
        status.textContent = "Sudah digunakan";

        statusCell.appendChild(status);
        row.append(numberCell, codeCell, statusCell);

        table.appendChild(row);
    });
}

// =====================================================
// 9. DASHBOARD
// =====================================================

function renderDashboard() {
    const candidates = getCandidates();
    const votes = getVotes();
    const participants = getUsedParticipants();

    let count1 = 0;
    let count2 = 0;
    let invalidVotes = 0;

    votes.forEach(vote => {
        const selected = identifyCandidate(vote, candidates);

        if (selected === 1) count1++;
        else if (selected === 2) count2++;
        else invalidVotes++;
    });

    const validVotes = count1 + count2;

    const percent1 = validVotes ? (count1 / validVotes) * 100 : 0;
    const percent2 = validVotes ? (count2 / validVotes) * 100 : 0;

    setText("totalVotes", votes.length);
    setText("validVotes", validVotes);
    setText("usedParticipants", participants.length);

    setText("candidateName1", candidates.candidate1);
    setText("candidateName2", candidates.candidate2);

    setText(
        "candidateVotes1",
        `${count1} suara · ${percent1.toFixed(1)}%`
    );

    setText(
        "candidateVotes2",
        `${count2} suara · ${percent2.toFixed(1)}%`
    );

    setWidth("candidateBar1", percent1);
    setWidth("candidateBar2", percent2);

    setText("summaryValid", validVotes);
    setText("summaryInvalid", invalidVotes);

    setValue("candidate1", candidates.candidate1);
    setValue("candidate2", candidates.candidate2);

    renderParticipants(participants);
}

// =====================================================
// 10. FORM NAMA KANDIDAT
// =====================================================

const candidateForm = $("candidateForm");

if (candidateForm) {
    candidateForm.addEventListener("submit", function(event) {
        event.preventDefault();

        const candidate1 = $("candidate1")?.value.trim() || "";
        const candidate2 = $("candidate2")?.value.trim() || "";

        if (!candidate1 || !candidate2) {
            showMessage(
                "candidateMessage",
                "Nama kedua calon harus diisi."
            );
            return;
        }

        if (candidate1.toLowerCase() === candidate2.toLowerCase()) {
            showMessage(
                "candidateMessage",
                "Nama kedua calon tidak boleh sama."
            );
            return;
        }

        const saved = writeJSON(CANDIDATES_KEY, {
            candidate1,
            candidate2
        });

        if (!saved) {
            showMessage(
                "candidateMessage",
                "Gagal menyimpan nama calon. Periksa penyimpanan browser."
            );
            return;
        }

        showMessage(
            "candidateMessage",
            "Nama calon berhasil disimpan.",
            true
        );

        renderDashboard();
        showAdminToast("Nama calon berhasil diperbarui.");
    });
}

// =====================================================
// 11. REFRESH DASHBOARD
// =====================================================

const refreshButton = $("refreshButton");

if (refreshButton) {
    refreshButton.addEventListener("click", function() {
        renderDashboard();
        showAdminToast("Dashboard berhasil diperbarui.");
    });
}

// =====================================================
// 12. QR CODE GENERATOR
// =====================================================

function createParticipantCode(number) {
    return `${QR_PREFIX}${String(number).padStart(3, "0")}`;
}

function updateQrProgress(current, message) {
    setText("qrCount", `${current} / ${QR_TOTAL} QR Code`);
    setWidth("qrProgressBar", (current / QR_TOTAL) * 100);

    if (message) {
        showMessage("qrGeneratorMessage", message, true);
    }
}

function showQrEmptyState() {
    const grid = $("qrCodeGrid");
    if (!grid) return;

    grid.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "qr-empty-state";

    const icon = document.createElement("div");
    icon.className = "qr-empty-icon";
    icon.textContent = "▦";

    const title = document.createElement("strong");
    title.textContent = "Belum ada QR Code";

    const description = document.createElement("p");
    description.textContent =
        'Klik tombol "Buat 100 QR Code" untuk memulai generator.';

    empty.append(icon, title, description);
    grid.appendChild(empty);
}

function createQrCard(code) {
    const grid = $("qrCodeGrid");

    if (!grid) {
        throw new Error("Area QR Code tidak ditemukan.");
    }

    const card = document.createElement("article");
    card.className = "qr-card";

    const qrContainer = document.createElement("div");
    qrContainer.className = "qr-image-container";

    const payload = `QR-${code}`;

    new QRCode(qrContainer, {
        text: payload,
        width: 150,
        height: 150,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    const title = document.createElement("strong");
    title.textContent = code;

    const description = document.createElement("small");
    description.textContent = "Pemilih e-Voting Kalentambo";

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "qr-download-button";
    downloadButton.textContent = "↓ Unduh PNG";

    downloadButton.addEventListener("click", function() {
        downloadSingleQr(code, qrContainer);
    });

    card.append(
        qrContainer,
        title,
        description,
        downloadButton
    );

    grid.appendChild(card);

    return {
        code,
        payload,
        container: qrContainer
    };
}

function getQrDataUrl(container) {
    if (!container) return null;

    const canvas = container.querySelector("canvas");

    if (canvas) {
        return canvas.toDataURL("image/png");
    }

    const image = container.querySelector("img");

    if (image && image.src.startsWith("data:image/")) {
        return image.src;
    }

    return null;
}

// =====================================================
// 13. GENERATE 100 QR CODE
// =====================================================

async function generateAllQrCodes() {
    if (qrGenerating) return;

    const grid = $("qrCodeGrid");
    const generateButton = $("generateQrButton");
    const downloadButton = $("downloadAllQrButton");
    const printButton = $("printQrButton");

    if (!grid) {
        console.error("Elemen qrCodeGrid tidak ditemukan.");
        return;
    }

    if (typeof QRCode === "undefined") {
        showMessage(
            "qrGeneratorMessage",
            "Library QRCode tidak berhasil dimuat. Periksa koneksi internet."
        );
        return;
    }

    qrGenerating = true;

    if (generateButton) generateButton.disabled = true;
    if (downloadButton) downloadButton.disabled = true;
    if (printButton) printButton.disabled = true;

    generatedQrItems = [];
    grid.replaceChildren();

    updateQrProgress(0, "Sedang menyiapkan QR Code...");

    try {
        for (let i = 1; i <= QR_TOTAL; i++) {
            const code = createParticipantCode(i);
            const item = createQrCard(code);

            generatedQrItems.push(item);

            updateQrProgress(
                i,
                `Berhasil membuat ${i} dari ${QR_TOTAL} QR Code.`
            );

            if (i % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        if (downloadButton) downloadButton.disabled = false;
        if (printButton) printButton.disabled = false;

        showMessage(
            "qrGeneratorMessage",
            "Berhasil! 100 QR Code pemilih sudah dibuat.",
            true
        );

        updateQrProgress(
            QR_TOTAL,
            "Generator selesai. QR Code siap diunduh atau dicetak."
        );

        showAdminToast("100 QR Code berhasil dibuat.");

    } catch (error) {
        console.error("QR Generator error:", error);

        showMessage(
            "qrGeneratorMessage",
            "Terjadi kesalahan saat membuat QR Code. Periksa koneksi dan library."
        );

        if (downloadButton) {
            downloadButton.disabled = generatedQrItems.length === 0;
        }

        if (printButton) {
            printButton.disabled = generatedQrItems.length === 0;
        }

    } finally {
        qrGenerating = false;

        if (generateButton) {
            generateButton.disabled = false;
        }
    }
}

const generateQrButton = $("generateQrButton");

if (generateQrButton) {
    generateQrButton.addEventListener("click", generateAllQrCodes);
}

// =====================================================
// 14. DOWNLOAD SATU QR CODE
// =====================================================

function downloadSingleQr(code, container) {
    const dataUrl = getQrDataUrl(container);

    if (!dataUrl) {
        showMessage(
            "qrGeneratorMessage",
            `QR ${code} belum siap diunduh.`
        );
        return;
    }

    const link = document.createElement("a");

    link.href = dataUrl;
    link.download = `QR-${code}.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();
}

// =====================================================
// 15. DOWNLOAD SEMUA QR CODE
// =====================================================

async function downloadAllQrCodes() {
    if (bulkDownloading || generatedQrItems.length === 0) {
        return;
    }

    const button = $("downloadAllQrButton");

    bulkDownloading = true;

    if (button) button.disabled = true;

    try {
        for (let i = 0; i < generatedQrItems.length; i++) {
            const item = generatedQrItems[i];
            const dataUrl = getQrDataUrl(item.container);

            if (dataUrl) {
                const link = document.createElement("a");

                link.href = dataUrl;
                link.download = `QR-${item.code}.png`;

                document.body.appendChild(link);
                link.click();
                link.remove();
            }

            setText(
                "qrGeneratorMessage",
                `Sedang menyiapkan unduhan ${i + 1} dari ${generatedQrItems.length}...`
            );

            await new Promise(resolve => setTimeout(resolve, 180));
        }

        showMessage(
            "qrGeneratorMessage",
            "Proses unduh selesai. Periksa folder Downloads browser.",
            true
        );

        showAdminToast("Proses unduh QR selesai.");

    } catch (error) {
        console.error("Gagal mengunduh QR:", error);

        showMessage(
            "qrGeneratorMessage",
            "Ada QR Code yang gagal diunduh."
        );

    } finally {
        bulkDownloading = false;

        if (button) button.disabled = false;
    }
}

const downloadAllQrButton = $("downloadAllQrButton");

if (downloadAllQrButton) {
    downloadAllQrButton.addEventListener(
        "click",
        downloadAllQrCodes
    );
}

// =====================================================
// 16. CETAK SEMUA KARTU QR
// =====================================================

function printAllQrCards() {
    if (generatedQrItems.length === 0) {
        showMessage(
            "qrGeneratorMessage",
            "Buat QR Code terlebih dahulu sebelum mencetak."
        );
        return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
        showMessage(
            "qrGeneratorMessage",
            "Jendela cetak diblokir browser. Izinkan pop-up untuk halaman ini."
        );
        return;
    }

    const cards = generatedQrItems.map(item => {
        const dataUrl = getQrDataUrl(item.container);

        if (!dataUrl) return "";

        return `
            <article class="print-card">
                <div class="print-brand">PILKADES DIGITAL</div>
                <h2>DESA KALENTAMBO</h2>
                <img src="${dataUrl}" alt="QR ${item.code}">
                <h3>${item.code}</h3>
                <p>Kartu Identitas Pemilih</p>
                <div class="print-footer">e-VOTING KALENTAMBO</div>
            </article>
        `;
    }).join("");

    const printContent = `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <title>Kartu QR Pemilih - Kalentambo</title>

            <style>
                * { box-sizing: border-box; }

                body {
                    margin: 0;
                    padding: 15px;
                    font-family: Arial, sans-serif;
                    color: #101d35;
                }

                .print-container {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                }

                .print-card {
                    min-height: 230px;
                    padding: 13px;
                    border: 1px solid #dce2ea;
                    border-radius: 9px;
                    text-align: center;
                    break-inside: avoid;
                }

                .print-brand {
                    font-size: 10px;
                    font-weight: bold;
                    letter-spacing: 1px;
                }

                .print-card h2 {
                    margin: 5px 0 10px;
                    font-size: 13px;
                }

                .print-card img {
                    display: block;
                    width: 115px;
                    height: 115px;
                    margin: 0 auto;
                }

                .print-card h3 {
                    margin: 7px 0 2px;
                    font-size: 17px;
                }

                .print-card p {
                    margin: 0;
                    font-size: 10px;
                }

                .print-footer {
                    margin-top: 8px;
                    font-size: 8px;
                    color: #777;
                    letter-spacing: 1px;
                }

                @page {
                    size: A4;
                    margin: 10mm;
                }

                @media print {
                    body { padding: 0; }
                    .print-container { gap: 8px; }
                    .print-card { border: 1px solid #aaa; }
                }
            </style>
        </head>

        <body>
            <main class="print-container">
                ${cards}
            </main>

            <script>
                window.onload = function () {
                    setTimeout(function () {
                        window.print();
                    }, 700);
                };
            <\/script>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();

    showMessage(
        "qrGeneratorMessage",
        "Halaman cetak berhasil disiapkan.",
        true
    );
}

const printQrButton = $("printQrButton");

if (printQrButton) {
    printQrButton.addEventListener("click", printAllQrCards);
}

// =====================================================
// 17. GENERATOR SURAT UNDANGAN PDF
// =====================================================

function createInvitationPanel() {
    if ($("invitationGeneratorPanel")) return;

    const qrPanel = document.querySelector(".qr-generator-panel");

    if (!qrPanel) {
        console.error("Panel QR Generator tidak ditemukan.");
        return;
    }

    const panel = document.createElement("section");

    panel.id = "invitationGeneratorPanel";
    panel.className = "panel";

    panel.innerHTML = `
        <div class="panel-heading">
            <div>
                <h2>Generator Surat Undangan Pemilih</h2>
                <p>
                    Buat 100 surat undangan untuk 100 pemilih
                    dalam satu dokumen PDF ukuran A4.
                </p>
            </div>

            <span class="pdf-label">PDF GENERATOR</span>
        </div>

        <div class="notice">
            Setiap pemilih mendapatkan satu surat dengan
            QR Code unik yang kompatibel dengan scanner e-Voting.
        </div>

        <div class="candidate-form">

            <div class="form-group">
                <label for="invitationDate">
                    Hari / Tanggal Kegiatan
                </label>
                <input
                    type="text"
                    id="invitationDate"
                    placeholder="Contoh: Senin, 30 November 2026"
                >
            </div>

            <div class="form-group">
                <label for="invitationTime">
                    Waktu Kegiatan
                </label>
                <input
                    type="text"
                    id="invitationTime"
                    placeholder="Contoh: 08.00 WIB - selesai"
                >
            </div>

            <div class="form-group">
                <label for="invitationLocation">
                    Tempat Kegiatan
                </label>
                <input
                    type="text"
                    id="invitationLocation"
                    placeholder="Contoh: Balai Desa Kalentambo"
                >
            </div>

            <div class="form-group">
                <label for="invitationLetterDate">
                    Tanggal Pembuatan Surat
                </label>
                <input
                    type="text"
                    id="invitationLetterDate"
                    placeholder="Contoh: Kalentambo, 20 November 2026"
                >
            </div>

            <div class="form-group">
                <label for="invitationNumber">
                    Nomor Surat
                </label>
                <input
                    type="text"
                    id="invitationNumber"
                    value="001/PAN-PILKADES/KLT/XI/2026"
                >
            </div>

        </div>

        <div class="qr-controls">
            <button
                type="button"
                id="generateInvitationPDF"
                class="primary-button"
            >
                Unduh 100 Surat Undangan PDF
            </button>
        </div>

        <div class="qr-status">
            <div class="qr-status-heading">
                <strong>Proses Pembuatan PDF</strong>
                <span id="invitationProgressText">
                    0 / 100 surat
                </span>
            </div>

            <div class="bar-track">
                <div
                    id="invitationProgressBar"
                    class="bar-fill bar-one"
                    style="width: 0%"
                ></div>
            </div>

            <p
                id="invitationMessage"
                class="form-message"
                role="status"
                aria-live="polite"
            >
                Isi informasi kegiatan sebelum membuat PDF.
            </p>
        </div>

        <p class="helper-text">
            Identitas menggunakan nama Pemilih 1 sampai Pemilih 100.
            Setiap surat memiliki QR Code yang berbeda.
        </p>
    `;

    qrPanel.insertAdjacentElement("afterend", panel);

    $("generateInvitationPDF").addEventListener(
        "click",
        generateInvitationPDF
    );
}

// =====================================================
// 18. LOAD LIBRARY JSPDF
// =====================================================

function loadJsPDF() {
    return new Promise((resolve, reject) => {
        if (window.jspdf?.jsPDF) {
            resolve(window.jspdf.jsPDF);
            return;
        }

        const existingScript = document.querySelector(
            'script[data-invitation-jspdf="true"]'
        );

        if (existingScript) {
            if (
                existingScript.dataset.loaded === "true" &&
                window.jspdf?.jsPDF
            ) {
                resolve(window.jspdf.jsPDF);
                return;
            }

            existingScript.addEventListener("load", () => {
                if (window.jspdf?.jsPDF) {
                    resolve(window.jspdf.jsPDF);
                } else {
                    reject(new Error("Library jsPDF gagal dimuat."));
                }
            }, { once: true });

            existingScript.addEventListener("error", () => {
                reject(new Error("Gagal mengakses CDN jsPDF."));
            }, { once: true });

            return;
        }

        const script = document.createElement("script");

        script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

        script.dataset.invitationJspdf = "true";

        script.onload = () => {
            script.dataset.loaded = "true";

            if (window.jspdf?.jsPDF) {
                resolve(window.jspdf.jsPDF);
            } else {
                reject(new Error("Library jsPDF tidak tersedia."));
            }
        };

        script.onerror = () => {
            reject(new Error(
                "Library PDF gagal dimuat. Periksa koneksi internet."
            ));
        };

        document.head.appendChild(script);
    });
}

// =====================================================
// 19. MEMBUAT QR PNG UNTUK PDF
// =====================================================

function createInvitationQR(code) {
    return new Promise((resolve, reject) => {
        if (typeof QRCode === "undefined") {
            reject(new Error("Library QRCode tidak tersedia."));
            return;
        }

        const temporaryContainer = document.createElement("div");

        temporaryContainer.style.position = "fixed";
        temporaryContainer.style.left = "-10000px";
        temporaryContainer.style.top = "0";

        document.body.appendChild(temporaryContainer);

        try {
            new QRCode(temporaryContainer, {
                text: `QR-${code}`,
                width: 400,
                height: 400,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            requestAnimationFrame(() => {
                const canvas = temporaryContainer.querySelector("canvas");

                if (canvas) {
                    const image = canvas.toDataURL("image/png");
                    temporaryContainer.remove();
                    resolve(image);
                    return;
                }

                const img = temporaryContainer.querySelector("img");

                if (img && img.complete && img.naturalWidth > 0) {
                    const image = img.src;
                    temporaryContainer.remove();
                    resolve(image);
                    return;
                }

                temporaryContainer.remove();
                reject(new Error(`QR ${code} gagal dibuat.`));
            });

        } catch (error) {
            temporaryContainer.remove();
            reject(error);
        }
    });
}

// =====================================================
// 20. DESAIN SURAT UNDANGAN A4
// =====================================================

function drawInvitation(doc, data) {
    const pageWidth = 210;
    const margin = 18;

    // Bingkai
    doc.setDrawColor(35, 55, 80);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 277);

    // Header
    doc.setTextColor(16, 42, 67);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);

    doc.text(
        "PEMERINTAH DESA KALENTAMBO",
        pageWidth / 2,
        25,
        { align: "center" }
    );

    doc.setFontSize(11);

    doc.text(
        "PANITIA PEMILIHAN KEPALA DESA",
        pageWidth / 2,
        32,
        { align: "center" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    doc.text(
        "Desa Kalentambo",
        pageWidth / 2,
        38,
        { align: "center" }
    );

    doc.setDrawColor(16, 42, 67);
    doc.setLineWidth(0.8);
    doc.line(margin, 44, 192, 44);

    // Nomor surat
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);

    doc.text(`Nomor: ${data.number}`, margin, 55);
    doc.text("Lampiran: -", margin, 61);

    doc.text(
        "Perihal: Undangan Pemilihan Kepala Desa",
        margin,
        67
    );

    // Judul
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);

    doc.text(
        "SURAT UNDANGAN PEMILIH",
        pageWidth / 2,
        84,
        { align: "center" }
    );

    doc.setDrawColor(100, 100, 100);
    doc.line(68, 87, 142, 87);

    // Isi surat
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);

    doc.text("Kepada Yth.", margin, 100);

    doc.setFont("helvetica", "bold");
    doc.text(data.name, margin, 106);

    doc.setFont("helvetica", "normal");
    doc.text("di Tempat", margin, 112);

    const paragraph = [
        "Dengan hormat,",
        "",
        "Dalam rangka pelaksanaan Pemilihan Kepala Desa",
        "Desa Kalentambo melalui sistem e-Voting, kami",
        "mengundang Saudara/i untuk menggunakan hak pilih",
        "sesuai jadwal dan ketentuan yang berlaku.",
        "",
        "Proses pemungutan suara dilakukan melalui verifikasi",
        "pemilih menggunakan QR Code dan sidik jari, dilanjutkan",
        "dengan pemilihan calon serta konfirmasi pilihan."
    ];

    doc.text(paragraph, margin, 125, {
        lineHeightFactor: 1.5
    });

    // Informasi kegiatan
    doc.setFont("helvetica", "bold");
    doc.text("INFORMASI KEGIATAN", margin, 177);

    doc.setFont("helvetica", "normal");

    doc.text(`Hari/Tanggal : ${data.date}`, margin, 185);
    doc.text(`Waktu        : ${data.time}`, margin, 192);
    doc.text(`Tempat       : ${data.location}`, margin, 199);

    // Identitas pemilih
    doc.setFont("helvetica", "bold");
    doc.text("IDENTITAS PEMILIH", margin, 211);

    doc.setFont("helvetica", "normal");

    doc.text(`Nama           : ${data.name}`, margin, 219);
    doc.text(`Nomor Pemilih  : ${data.code}`, margin, 226);

    // QR Code
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    doc.text(
        "QR CODE UNDANGAN",
        105,
        235,
        { align: "center" }
    );

    doc.addImage(
        data.qrImage,
        "PNG",
        86,
        239,
        38,
        38
    );

    doc.setFontSize(8);

    doc.text(
        `QR-${data.code}`,
        105,
        280,
        { align: "center" }
    );

    // Tanda tangan
    doc.setFontSize(9);

    doc.text(
        data.letterDate,
        153,
        211,
        { align: "center" }
    );

    doc.text(
        "Panitia Pemilihan,",
        153,
        218,
        { align: "center" }
    );

    doc.text(
        "(____________________)",
        153,
        249,
        { align: "center" }
    );

    // Footer
    doc.setTextColor(130, 130, 130);
    doc.setFontSize(7);

    doc.text(
        "SISTEM e-VOTING DESA KALENTAMBO",
        pageWidth / 2,
        284,
        { align: "center" }
    );
}

// =====================================================
// 21. PROGRESS PDF
// =====================================================

function updateInvitationProgress(current, message) {
    const percentage = (current / QR_TOTAL) * 100;

    const bar = $("invitationProgressBar");
    const text = $("invitationProgressText");
    const messageElement = $("invitationMessage");

    if (bar) {
        bar.style.width = `${percentage}%`;
    }

    if (text) {
        text.textContent = `${current} / ${QR_TOTAL} surat`;
    }

    if (messageElement) {
        messageElement.textContent = message;
        messageElement.classList.remove("error");
        messageElement.classList.add("success");
    }
}

// =====================================================
// 22. GENERATE PDF 100 PEMILIH
// =====================================================

async function generateInvitationPDF() {
    if (generatingPDF) return;

    const date = $("invitationDate")?.value.trim();
    const time = $("invitationTime")?.value.trim();
    const location = $("invitationLocation")?.value.trim();
    const letterDate = $("invitationLetterDate")?.value.trim();
    const number = $("invitationNumber")?.value.trim();

    const button = $("generateInvitationPDF");
    const message = $("invitationMessage");

    if (!date || !time || !location || !letterDate || !number) {
        if (message) {
            message.textContent =
                "Lengkapi semua informasi kegiatan dan surat terlebih dahulu.";

            message.classList.remove("success");
            message.classList.add("error");
        }

        return;
    }

    if (typeof QRCode === "undefined") {
        if (message) {
            message.textContent =
                "Library QR Code belum tersedia. Periksa koneksi internet.";

            message.classList.remove("success");
            message.classList.add("error");
        }

        return;
    }

    generatingPDF = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Sedang Membuat PDF...";
    }

    try {
        updateInvitationProgress(0, "Memuat library PDF...");

        const jsPDF = await loadJsPDF();

        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true
        });

        for (let i = 1; i <= QR_TOTAL; i++) {
            const code = createParticipantCode(i);
            const qrImage = await createInvitationQR(code);

            if (i > 1) {
                doc.addPage("a4", "portrait");
            }

            drawInvitation(doc, {
                number,
                date,
                time,
                location,
                letterDate,
                code,
                name: `Pemilih ${i}`,
                qrImage
            });

            updateInvitationProgress(
                i,
                `Membuat surat Pemilih ${i} (${code})...`
            );

            await new Promise(resolve => setTimeout(resolve, 0));
        }

        doc.save(
            "100-Surat-Undangan-Pemilih-eVoting-Kalentambo.pdf"
        );

        updateInvitationProgress(
            QR_TOTAL,
            "Berhasil! PDF berisi 100 surat undangan siap dicetak."
        );

        showAdminToast("PDF 100 surat undangan berhasil dibuat.");

    } catch (error) {
        console.error("[INVITATION PDF]", error);

        if (message) {
            message.textContent =
                error.message || "Gagal membuat PDF undangan.";

            message.classList.remove("success");
            message.classList.add("error");
        }

    } finally {
        generatingPDF = false;

        if (button) {
            button.disabled = false;
            button.textContent = "Unduh 100 Surat Undangan PDF";
        }
    }
}

// =====================================================
// 23. RESET DATA e-VOTING
// =====================================================

const resetButton = $("resetButton");

if (resetButton) {
    resetButton.addEventListener("click", function() {
        const confirmed = confirm(
            "Yakin ingin menghapus seluruh data suara dan kode pemilih di browser ini? Tindakan ini tidak dapat dibatalkan."
        );

        if (!confirmed) return;

        try {
            localStorage.removeItem(VOTES_KEY);
            localStorage.removeItem(USED_KEY);

            renderDashboard();

            showMessage(
                "resetMessage",
                "Data suara dan kode pemilih berhasil direset.",
                true
            );

            showAdminToast("Data simulasi berhasil direset.");

        } catch (error) {
            console.error("Gagal mereset data:", error);

            showMessage(
                "resetMessage",
                "Gagal mereset data e-Voting."
            );
        }
    });
}

// =====================================================
// 24. SINKRONISASI ANTAR TAB
// =====================================================

window.addEventListener("storage", function(event) {
    if (
        event.key === VOTES_KEY ||
        event.key === USED_KEY ||
        event.key === CANDIDATES_KEY ||
        event.key === null
    ) {
        renderDashboard();
    }
});

// =====================================================
// 25. MODERN ADMIN UI - CSS DINAMIS
// =====================================================

function injectModernAdminStyles() {
    if ($("modern-admin-ui-styles")) return;

    const style = document.createElement("style");
    style.id = "modern-admin-ui-styles";

    style.textContent = `
        :root {
            --admin-bg: #f4f7fb;
            --admin-surface: #ffffff;
            --admin-text: #17243a;
            --admin-muted: #748198;
            --admin-border: #e6ebf2;
            --admin-primary: #2563eb;
            --admin-sidebar: #101d35;
            --admin-shadow: 0 8px 28px rgba(25, 45, 80, .07);
        }

        body.admin-dark-mode {
            --admin-bg: #101827;
            --admin-surface: #192538;
            --admin-text: #e7edf7;
            --admin-muted: #a3b0c5;
            --admin-border: #2b3a50;
            --admin-sidebar: #0b1321;
            --admin-shadow: 0 8px 28px rgba(0, 0, 0, .2);
        }

        body {
            background: var(--admin-bg);
            color: var(--admin-text);
            transition: background .25s ease, color .25s ease;
        }

        .admin-layout {
            transition: grid-template-columns .25s ease;
        }

        .sidebar {
            transition: width .25s ease, transform .25s ease;
        }

        .admin-layout.sidebar-collapsed .sidebar {
            width: 82px;
            min-width: 82px;
        }

        .admin-layout.sidebar-collapsed .sidebar .brand h1,
        .admin-layout.sidebar-collapsed .sidebar .brand p,
        .admin-layout.sidebar-collapsed .sidebar nav a span,
        .admin-layout.sidebar-collapsed .sidebar .nav-label {
            display: none;
        }

        .admin-layout.sidebar-collapsed .sidebar nav a {
            justify-content: center;
            padding-left: 12px;
            padding-right: 12px;
        }

        .admin-layout.sidebar-collapsed .sidebar .brand {
            justify-content: center;
        }

        .admin-layout.sidebar-collapsed .main-content {
            min-width: 0;
        }

        .admin-ui-actions {
            display: flex;
            align-items: center;
            gap: 9px;
            margin-left: auto;
        }

        .admin-icon-button {
            width: 42px;
            height: 42px;
            border: 1px solid var(--admin-border);
            border-radius: 12px;
            background: var(--admin-surface);
            color: var(--admin-text);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 19px;
            cursor: pointer;
            transition: .2s ease;
        }

        .admin-icon-button:hover {
            color: var(--admin-primary);
            transform: translateY(-2px);
            box-shadow: var(--admin-shadow);
        }

        .admin-toast-region {
            position: fixed;
            right: 22px;
            bottom: 22px;
            z-index: 99999;
            display: grid;
            gap: 10px;
            pointer-events: none;
        }

        .admin-toast {
            min-width: 240px;
            max-width: 360px;
            padding: 14px 18px;
            display: flex;
            align-items: center;
            gap: 12px;
            background: var(--admin-surface);
            color: var(--admin-text);
            border: 1px solid var(--admin-border);
            border-radius: 13px;
            box-shadow: var(--admin-shadow);
            opacity: 0;
            transform: translateY(12px);
            transition: .25s ease;
            font-size: 14px;
        }

        .admin-toast.show {
            opacity: 1;
            transform: translateY(0);
        }

        .admin-toast-icon {
            width: 25px;
            height: 25px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            background: #dcfce7;
            color: #15803d;
            font-weight: 800;
            flex-shrink: 0;
        }

        .admin-toast.error .admin-toast-icon {
            background: #fee2e2;
            color: #dc2626;
        }

        .admin-sidebar-overlay {
            display: none;
        }

        .panel,
        .stat-card,
        .qr-generator-panel {
            transition: background .25s ease, border-color .25s ease,
                        box-shadow .25s ease, transform .2s ease;
        }

        body.admin-dark-mode .panel,
        body.admin-dark-mode .stat-card,
        body.admin-dark-mode .qr-generator-panel,
        body.admin-dark-mode .topbar {
            background: var(--admin-surface);
            color: var(--admin-text);
            border-color: var(--admin-border);
        }

        body.admin-dark-mode h1,
        body.admin-dark-mode h2,
        body.admin-dark-mode h3,
        body.admin-dark-mode p,
        body.admin-dark-mode label,
        body.admin-dark-mode th,
        body.admin-dark-mode td {
            color: var(--admin-text);
        }

        body.admin-dark-mode input,
        body.admin-dark-mode select,
        body.admin-dark-mode textarea {
            background: #111c2e;
            color: #e7edf7;
            border-color: var(--admin-border);
        }

        body.admin-dark-mode .table-wrap {
            border-color: var(--admin-border);
        }

        body.admin-dark-mode table th {
            background: #223149;
        }

        body.admin-dark-mode table td {
            border-color: var(--admin-border);
        }

        .stat-card {
            animation: adminFadeUp .45s ease both;
        }

        .stat-card:nth-child(2) { animation-delay: .06s; }
        .stat-card:nth-child(3) { animation-delay: .12s; }
        .stat-card:nth-child(4) { animation-delay: .18s; }

        @keyframes adminFadeUp {
            from {
                opacity: 0;
                transform: translateY(12px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @media (max-width: 900px) {
            .admin-layout.sidebar-collapsed .sidebar {
                width: 260px;
                min-width: 260px;
            }

            .sidebar {
                position: fixed !important;
                z-index: 10001;
                top: 0;
                bottom: 0;
                left: 0;
                width: 260px !important;
                min-width: 260px !important;
                transform: translateX(-105%);
                overflow-y: auto;
            }

            body.mobile-sidebar-open .sidebar {
                transform: translateX(0);
            }

            .admin-sidebar-overlay {
                position: fixed;
                inset: 0;
                z-index: 10000;
                background: rgba(8, 18, 35, .55);
                backdrop-filter: blur(3px);
            }

            body.mobile-sidebar-open .admin-sidebar-overlay {
                display: block;
            }

            .admin-layout.sidebar-collapsed .sidebar .brand h1,
            .admin-layout.sidebar-collapsed .sidebar .brand p,
            .admin-layout.sidebar-collapsed .sidebar nav a span,
            .admin-layout.sidebar-collapsed .sidebar .nav-label {
                display: initial;
            }

            .admin-layout.sidebar-collapsed .sidebar nav a {
                justify-content: flex-start;
            }
        }

        @media (max-width: 600px) {
            .admin-ui-actions {
                gap: 6px;
            }

            .admin-icon-button {
                width: 38px;
                height: 38px;
            }

            .admin-toast-region {
                left: 14px;
                right: 14px;
                bottom: 14px;
            }

            .admin-toast {
                max-width: none;
                width: 100%;
            }
        }
    `;

    document.head.appendChild(style);
}

// =====================================================
// 26. SIDEBAR, DARK MODE, MOBILE MENU
// =====================================================

function initModernAdminUI() {
    injectModernAdminStyles();

    const layout = document.querySelector(".admin-layout");
    const sidebar = document.querySelector(".sidebar");
    const topbar = document.querySelector(".topbar");

    if (!layout || !sidebar) {
        console.warn("Elemen layout admin tidak ditemukan.");
        return;
    }

    // Tombol sidebar
    if (!$("adminSidebarToggle")) {
        const brand = sidebar.querySelector(".brand");

        if (brand) {
            const toggle = document.createElement("button");

            toggle.id = "adminSidebarToggle";
            toggle.type = "button";
            toggle.className = "admin-icon-button";
            toggle.innerHTML = "☰";
            toggle.title = "Ciutkan sidebar";
            toggle.setAttribute("aria-label", "Ciutkan sidebar");

            brand.appendChild(toggle);

            toggle.addEventListener("click", function() {
                if (window.innerWidth <= 900) {
                    document.body.classList.add("mobile-sidebar-open");
                } else {
                    layout.classList.toggle("sidebar-collapsed");

                    toggle.title = layout.classList.contains("sidebar-collapsed")
                        ? "Perluas sidebar"
                        : "Ciutkan sidebar";
                }
            });
        }
    }

    // Area tombol topbar
    let actions = $("adminUIActions");

    if (!actions) {
        actions = document.createElement("div");
        actions.id = "adminUIActions";
        actions.className = "admin-ui-actions";

        if (topbar) {
            topbar.appendChild(actions);
        } else {
            document.body.appendChild(actions);
        }
    }

    // Tombol menu mobile
    if (!$("adminMobileMenu")) {
        const mobileButton = document.createElement("button");

        mobileButton.id = "adminMobileMenu";
        mobileButton.type = "button";
        mobileButton.className = "admin-icon-button";
        mobileButton.innerHTML = "☰";
        mobileButton.title = "Buka menu";

        mobileButton.addEventListener("click", function() {
            document.body.classList.add("mobile-sidebar-open");
        });

        actions.appendChild(mobileButton);
    }

    // Tombol tema
    if (!$("adminThemeToggle")) {
        const themeButton = document.createElement("button");

        themeButton.id = "adminThemeToggle";
        themeButton.type = "button";
        themeButton.className = "admin-icon-button";
        themeButton.title = "Ganti tema";

        const savedTheme = localStorage.getItem(THEME_KEY);
        const dark = savedTheme === "dark";

        document.body.classList.toggle("admin-dark-mode", dark);
        themeButton.innerHTML = dark ? "☀" : "☾";

        themeButton.addEventListener("click", function() {
            const isDark = document.body.classList.toggle("admin-dark-mode");

            localStorage.setItem(
                THEME_KEY,
                isDark ? "dark" : "light"
            );

            themeButton.innerHTML = isDark ? "☀" : "☾";

            showAdminToast(
                isDark ? "Mode gelap diaktifkan." : "Mode terang diaktifkan."
            );
        });

        actions.appendChild(themeButton);
    }

    // Overlay mobile
    if (!$("adminSidebarOverlay")) {
        const overlay = document.createElement("div");

        overlay.id = "adminSidebarOverlay";
        overlay.className = "admin-sidebar-overlay";

        overlay.addEventListener("click", closeMobileSidebar);

        document.body.appendChild(overlay);
    }

    // Tutup menu saat navigasi diklik
    sidebar.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", function() {
            if (window.innerWidth <= 900) {
                closeMobileSidebar();
            }
        });
    });

    // Tombol ESC
    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape") {
            closeMobileSidebar();
        }
    });

    // Penyesuaian saat resize
    window.addEventListener("resize", function() {
        if (window.innerWidth > 900) {
            closeMobileSidebar();
        }
    });
}

function closeMobileSidebar() {
    document.body.classList.remove("mobile-sidebar-open");
}

// =====================================================
// 27. ANIMASI ANGKA STATISTIK
// =====================================================

function animateStatNumber(element) {
    if (!element || element.dataset.animated === "true") return;

    const target = Number(element.textContent);

    if (!Number.isFinite(target)) return;

    element.dataset.animated = "true";

    const duration = 650;
    const startTime = performance.now();

    function update(currentTime) {
        const progress = Math.min(
            (currentTime - startTime) / duration,
            1
        );

        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(target * eased);

        element.textContent = value;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }

    requestAnimationFrame(update);
}

function initStatAnimations() {
    const statIds = [
        "totalVotes",
        "validVotes",
        "usedParticipants"
    ];

    statIds.forEach(id => {
        const element = $(id);
        if (element) animateStatNumber(element);
    });
}

// =====================================================
// 28. INISIALISASI DASHBOARD
// =====================================================

renderDashboard();

showQrEmptyState();

setText("qrCount", `0 / ${QR_TOTAL} QR Code`);
setWidth("qrProgressBar", 0);

if ($("downloadAllQrButton")) {
    $("downloadAllQrButton").disabled = true;
}

if ($("printQrButton")) {
    $("printQrButton").disabled = true;
}

// Tambahkan generator surat undangan
createInvitationPanel();

// Inisialisasi UI modern
initModernAdminUI();

// Animasi statistik
initStatAnimations();

// =====================================================
// 29. INFORMASI SISTEM
// =====================================================

console.log("======================================");
console.log("PILKADES DIGITAL KALENTAMBO");
console.log("Admin Dashboard siap digunakan.");
console.log("QR Generator: Aktif");
console.log("PDF Invitation Generator: Aktif");
console.log("Modern UI: Aktif");
console.log("Dark Mode: Aktif");
console.log("Sidebar Responsive: Aktif");
console.log("Total Pemilih:", QR_TOTAL);
console.log("======================================");