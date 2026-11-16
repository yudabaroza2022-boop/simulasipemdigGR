
/* =====================================================
   PILKADES DIGITAL KALENTAMBO
   ADMIN DASHBOARD
   QR GENERATOR PDF + UNDANGAN PDF
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

let qrGenerating = false;
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
// 4. NOTIFIKASI
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
// 5. KONFIGURASI KANDIDAT
// =====================================================

function getCandidates() {
    const saved = readJSON(CANDIDATES_KEY, {});

    const candidate1 =
        typeof saved?.candidate1 === "string" && saved.candidate1.trim()
            ? saved.candidate1.trim()
            : DEFAULT_CANDIDATES.candidate1;

    return {
        candidate1,
        candidate2: DEFAULT_CANDIDATES.candidate2
    };
}

// =====================================================
// 6. DATA SUARA DAN PESERTA
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
// 7. IDENTIFIKASI KANDIDAT TUNGGAL
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

    if (
        value === "1" ||
        value === "01" ||
        value === "candidate1" ||
        value === "candidate-1" ||
        value === name1 ||
        /^calon\s*0?1$/.test(value) ||
        /nomor\s*urut\s*0?1/.test(value)
    ) {
        return 1;
    }

    return 0;
}

// =====================================================
// 8. TABEL PESERTA
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
    let invalidVotes = 0;

    votes.forEach(vote => {
        const selected = identifyCandidate(vote, candidates);

        if (selected === 1) count1++;
        else invalidVotes++;
    });

    const validVotes = count1;
    const percent1 = validVotes ? 100 : 0;

    setText("usedParticipants", participants.length);

    setText("candidateName1", candidates.candidate1);
    setText(
        "candidateVotes1",
        `${count1} suara · ${percent1.toFixed(1)}%`
    );

    setWidth("candidateBar1", percent1);

    setText("summaryValid", validVotes);
    setText("summaryInvalid", invalidVotes);

    renderParticipants(participants);
}

// =====================================================
// 10. REFRESH DASHBOARD
// =====================================================

const refreshButton = $("refreshButton");

if (refreshButton) {
    refreshButton.addEventListener("click", function() {
        renderDashboard();
        showAdminToast("Dashboard berhasil diperbarui.");
    });
}

// =====================================================
// 11. KONFIGURASI KODE PESERTA
// =====================================================

function createParticipantCode(number) {
    return `${QR_PREFIX}${String(number).padStart(3, "0")}`;
}

// =====================================================
// 12. PROGRESS QR
// =====================================================

function updateQrProgress(current, message, isError = false) {
    setText("qrCount", `${current} / ${QR_TOTAL} QR Code`);
    setWidth("qrProgressBar", (current / QR_TOTAL) * 100);

    const element = $("qrGeneratorMessage");
    if (!element) return;

    element.textContent = message;
    element.classList.remove("success", "error");

    if (isError) element.classList.add("error");
    else if (current === QR_TOTAL) element.classList.add("success");
}

// =====================================================
// 13. GENERATOR QR CODE KE PDF
// =====================================================

async function generateAllQrCodes() {
    if (qrGenerating) return;

    const button = $("generateQrButton");

    if (typeof QRCode === "undefined") {
        updateQrProgress(
            0,
            "Library QR Code gagal dimuat. Periksa koneksi internet.",
            true
        );
        return;
    }

    qrGenerating = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Sedang Membuat PDF...";
    }

    updateQrProgress(0, "Menyiapkan dokumen PDF...");

    try {
        const jsPDF = await loadJsPDF();

        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true
        });

        const columns = 3;
        const perPage = 12;

        for (let i = 1; i <= QR_TOTAL; i++) {
            if (i === 1 || (i - 1) % perPage === 0) {
                if (i > 1) doc.addPage("a4", "portrait");

                doc.setTextColor(16, 42, 67);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(15);
                doc.text("QR CODE PESERTA", 105, 17, {
                    align: "center"
                });

                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.text(
                    "PEMILIHAN KEPALA DESA KALENTAMBO",
                    105,
                    23,
                    { align: "center" }
                );

                doc.setDrawColor(210, 218, 230);
                doc.line(15, 27, 195, 27);
            }

            const code = createParticipantCode(i);
            const qrImage = await createInvitationQR(code);

            const position = (i - 1) % perPage;
            const column = position % columns;
            const row = Math.floor(position / columns);

            const x = 16 + column * 62;
            const y = 32 + row * 62;

            doc.setDrawColor(210, 218, 230);
            doc.setLineWidth(0.3);
            doc.roundedRect(x, y, 56, 56, 2, 2);

            doc.addImage(
                qrImage,
                "PNG",
                x + 11,
                y + 4,
                34,
                34
            );

            doc.setTextColor(16, 42, 67);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text(code, x + 28, y + 45, {
                align: "center"
            });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.text(
                "PILKADES DIGITAL KALENTAMBO",
                x + 28,
                y + 51,
                { align: "center" }
            );

            updateQrProgress(i, `Sedang membuat QR Code ${code}...`);

            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const pageCount = doc.internal.getNumberOfPages();

        for (let page = 1; page <= pageCount; page++) {
            doc.setPage(page);
            doc.setTextColor(130, 130, 130);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);

            doc.text(
                `Halaman ${page} dari ${pageCount}`,
                105,
                287,
                { align: "center" }
            );
        }

        doc.save("QR-Code-Peserta-Kalentambo.pdf");

        updateQrProgress(
            QR_TOTAL,
            "Berhasil! PDF berisi 100 QR Code telah dibuat dan diunduh."
        );

        showAdminToast("PDF 100 QR Code berhasil dibuat dan diunduh.");

    } catch (error) {
        console.error("[QR PDF GENERATOR]", error);

        updateQrProgress(
            0,
            error.message || "Gagal membuat PDF QR Code.",
            true
        );

        showAdminToast("Gagal membuat PDF QR Code.", "error");

    } finally {
        qrGenerating = false;

        if (button) {
            button.disabled = false;
            button.textContent = "↓ Generate & Download PDF";
        }
    }
}

const generateQrButton = $("generateQrButton");

if (generateQrButton) {
    generateQrButton.addEventListener("click", generateAllQrCodes);
}

// =====================================================
// 14. GENERATOR SURAT UNDANGAN PDF
// =====================================================

function createInvitationPanel() {
    if ($("invitationGeneratorPanel")) return;

    const qrPanel = document.querySelector(".qr-generator-panel");
    if (!qrPanel) return;

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
                <label for="invitationDate">Hari / Tanggal Kegiatan</label>
                <input type="text" id="invitationDate"
                    placeholder="Contoh: Senin, 30 November 2026">
            </div>

            <div class="form-group">
                <label for="invitationTime">Waktu Kegiatan</label>
                <input type="text" id="invitationTime"
                    placeholder="Contoh: 08.00 WIB - selesai">
            </div>

            <div class="form-group">
                <label for="invitationLocation">Tempat Kegiatan</label>
                <input type="text" id="invitationLocation"
                    placeholder="Contoh: Balai Desa Kalentambo">
            </div>

            <div class="form-group">
                <label for="invitationLetterDate">Tanggal Pembuatan Surat</label>
                <input type="text" id="invitationLetterDate"
                    placeholder="Contoh: Kalentambo, 20 November 2026">
            </div>

            <div class="form-group">
                <label for="invitationNumber">Nomor Surat</label>
                <input type="text" id="invitationNumber"
                    value="001/PAN-PILKADES/KLT/XI/2026">
            </div>
        </div>

        <div class="qr-controls">
            <button type="button" id="generateInvitationPDF"
                class="primary-button">
                Unduh 100 Surat Undangan PDF
            </button>
        </div>

        <div class="qr-status">
            <div class="qr-status-heading">
                <strong>Proses Pembuatan PDF</strong>
                <span id="invitationProgressText">0 / 100 surat</span>
            </div>

            <div class="bar-track">
                <div id="invitationProgressBar"
                    class="bar-fill bar-one" style="width: 0%">
                </div>
            </div>

            <p id="invitationMessage" class="form-message"
                role="status" aria-live="polite">
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
// 15. LOAD LIBRARY JSPDF
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
// 16. MEMBUAT QR PNG UNTUK PDF
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
// 17. DESAIN SURAT UNDANGAN A4
// =====================================================

function drawInvitation(doc, data) {
    const pageWidth = 210;
    const margin = 18;

    doc.setDrawColor(35, 55, 80);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 277);

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
    doc.text("Desa Kalentambo", pageWidth / 2, 38, {
        align: "center"
    });

    doc.setDrawColor(16, 42, 67);
    doc.setLineWidth(0.8);
    doc.line(margin, 44, 192, 44);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.text(`Nomor: ${data.number}`, margin, 55);
    doc.text("Lampiran: -", margin, 61);
    doc.text(
        "Perihal: Undangan Pemilihan Kepala Desa",
        margin,
        67
    );

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
        "kode peserta menggunakan QR Code, dilanjutkan dengan",
        "pemilihan calon serta konfirmasi pilihan."
    ];

    doc.text(paragraph, margin, 125, {
        lineHeightFactor: 1.5
    });

    doc.setFont("helvetica", "bold");
    doc.text("INFORMASI KEGIATAN", margin, 177);

    doc.setFont("helvetica", "normal");
    doc.text(`Hari/Tanggal : ${data.date}`, margin, 185);
    doc.text(`Waktu        : ${data.time}`, margin, 192);
    doc.text(`Tempat       : ${data.location}`, margin, 199);

    doc.setFont("helvetica", "bold");
    doc.text("IDENTITAS PEMILIH", margin, 211);

    doc.setFont("helvetica", "normal");
    doc.text(`Nama           : ${data.name}`, margin, 219);
    doc.text(`Nomor Pemilih  : ${data.code}`, margin, 226);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("QR CODE UNDANGAN", 105, 235, {
        align: "center"
    });

    doc.addImage(data.qrImage, "PNG", 86, 239, 38, 38);

    doc.setFontSize(8);
    doc.text(`QR-${data.code}`, 105, 280, {
        align: "center"
    });

    doc.setFontSize(9);
    doc.text(data.letterDate, 153, 211, {
        align: "center"
    });

    doc.text("Panitia Pemilihan,", 153, 218, {
        align: "center"
    });

    doc.text("(____________________)", 153, 249, {
        align: "center"
    });

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
// 18. PROGRESS PDF UNDANGAN
// =====================================================

function updateInvitationProgress(current, message, isError = false) {
    const percentage = (current / QR_TOTAL) * 100;

    const bar = $("invitationProgressBar");
    const text = $("invitationProgressText");
    const messageElement = $("invitationMessage");

    if (bar) bar.style.width = `${percentage}%`;
    if (text) text.textContent = `${current} / ${QR_TOTAL} surat`;

    if (messageElement) {
        messageElement.textContent = message;
        messageElement.classList.remove("success", "error");

        if (isError) messageElement.classList.add("error");
        else if (current === QR_TOTAL) messageElement.classList.add("success");
    }
}

// =====================================================
// 19. GENERATE PDF 100 PEMILIH
// =====================================================

async function generateInvitationPDF() {
    if (generatingPDF) return;

    const date = $("invitationDate")?.value.trim();
    const time = $("invitationTime")?.value.trim();
    const location = $("invitationLocation")?.value.trim();
    const letterDate = $("invitationLetterDate")?.value.trim();
    const number = $("invitationNumber")?.value.trim();

    const button = $("generateInvitationPDF");

    if (!date || !time || !location || !letterDate || !number) {
        updateInvitationProgress(
            0,
            "Lengkapi semua informasi kegiatan dan surat terlebih dahulu.",
            true
        );
        return;
    }

    if (typeof QRCode === "undefined") {
        updateInvitationProgress(
            0,
            "Library QR Code belum tersedia. Periksa koneksi internet.",
            true
        );
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

        doc.save("100-Surat-Undangan-Pemilih-eVoting-Kalentambo.pdf");

        updateInvitationProgress(
            QR_TOTAL,
            "Berhasil! PDF berisi 100 surat undangan siap dicetak."
        );

        showAdminToast("PDF 100 surat undangan berhasil dibuat.");

    } catch (error) {
        console.error("[INVITATION PDF]", error);

        updateInvitationProgress(
            0,
            error.message || "Gagal membuat PDF undangan.",
            true
        );

    } finally {
        generatingPDF = false;

        if (button) {
            button.disabled = false;
            button.textContent = "Unduh 100 Surat Undangan PDF";
        }
    }
}

// =====================================================
// 20. RESET DATA e-VOTING
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
// 21. SINKRONISASI ANTAR TAB
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
// 22. MODERN ADMIN UI - CSS DINAMIS
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
// 23. SIDEBAR, DARK MODE, MOBILE MENU
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

    let actions = $("adminUIActions");

    if (!actions) {
        actions = document.createElement("div");
        actions.id = "adminUIActions";
        actions.className = "admin-ui-actions";

        if (topbar) topbar.appendChild(actions);
        else document.body.appendChild(actions);
    }

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

    if (!$("adminSidebarOverlay")) {
        const overlay = document.createElement("div");

        overlay.id = "adminSidebarOverlay";
        overlay.className = "admin-sidebar-overlay";

        overlay.addEventListener("click", closeMobileSidebar);

        document.body.appendChild(overlay);
    }

    sidebar.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", function() {
            if (window.innerWidth <= 900) {
                closeMobileSidebar();
            }
        });
    });

    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape") closeMobileSidebar();
    });

    window.addEventListener("resize", function() {
        if (window.innerWidth > 900) closeMobileSidebar();
    });
}

function closeMobileSidebar() {
    document.body.classList.remove("mobile-sidebar-open");
}

// =====================================================
// 24. ANIMASI ANGKA STATISTIK
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
    const element = $("usedParticipants");
    if (element) animateStatNumber(element);
}

// =====================================================
// 25. INISIALISASI DASHBOARD
// =====================================================

renderDashboard();

setText("qrCount", `0 / ${QR_TOTAL} QR Code`);
setWidth("qrProgressBar", 0);

updateQrProgress(
    0,
    "Klik tombol untuk membuat PDF QR Code peserta."
);

createInvitationPanel();
initModernAdminUI();
initStatAnimations();

// =====================================================
// 26. INFORMASI SISTEM
// =====================================================

console.log("======================================");
console.log("PILKADES DIGITAL KALENTAMBO");
console.log("Admin Dashboard siap digunakan.");
console.log("QR PDF Generator: Aktif");
console.log("PDF Invitation Generator: Aktif");
console.log("Modern UI: Aktif");
console.log("Dark Mode: Aktif");
console.log("Sidebar Responsive: Aktif");
console.log("Total Pemilih:", QR_TOTAL);
console.log("======================================");
