
/* =========================================================
   PILKADES DIGITAL KALENTAMBO
   ADMIN DASHBOARD - SUPABASE REALTIME
   QR UNIVERSAL + PDF UNDANGAN + MODERN ADMIN UI
========================================================= */

"use strict";

// =========================================================
// 1. KONFIGURASI
// =========================================================

const VOTES_KEY = "klt_demo_votes";
const USED_KEY = "klt_used_voters";
const CANDIDATES_KEY = "klt_candidate_config";
const THEME_KEY = "klt_admin_theme";

const DEFAULT_CANDIDATES = {
    candidate1: "Gilang Ramadhan, S.Pd.",
    candidate2: "Calon Nomor Urut 2"
};

const DEMO_UNIVERSAL_QR = "KLT001";

const SUPABASE_URL =
    "https://quqrevvpxxetezdnpwkh.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_QD5vGnkk1ow1WpU_tkvohg_HHKdRUCI";

if (!window.supabase) {
    throw new Error(
        "Supabase SDK belum dimuat. Periksa script CDN di admin.html."
    );
}

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

let remoteVotes = [];
let voteRealtimeChannel = null;
let qrGenerating = false;
let generatingPDF = false;

const $ = id => document.getElementById(id);

// =========================================================
// 2. LOCAL STORAGE
// =========================================================

function readJSON(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value) ?? fallback;
    } catch (error) {
        console.error("Gagal membaca localStorage:", error);
        return fallback;
    }
}

function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error("Gagal menyimpan localStorage:", error);
        return false;
    }
}

// =========================================================
// 3. HELPER TAMPILAN
// =========================================================

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

    const safe = Number.isFinite(percentage)
        ? Math.max(0, Math.min(100, percentage))
        : 0;

    element.style.width = `${safe}%`;
}

function showMessage(id, message, success = false) {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.classList.remove("success", "error");
    element.classList.add(success ? "success" : "error");
}

// =========================================================
// 4. NOTIFIKASI
// =========================================================

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

// =========================================================
// 5. KONFIGURASI KANDIDAT
// =========================================================

function getCandidates() {
    const saved = readJSON(CANDIDATES_KEY, {});

    return {
        candidate1:
            typeof saved?.candidate1 === "string" &&
            saved.candidate1.trim()
                ? saved.candidate1.trim()
                : DEFAULT_CANDIDATES.candidate1,

        candidate2:
            typeof saved?.candidate2 === "string" &&
            saved.candidate2.trim()
                ? saved.candidate2.trim()
                : DEFAULT_CANDIDATES.candidate2
    };
}

// =========================================================
// 6. DATA SUARA
// =========================================================

function getVotes() {
    return remoteVotes;
}

// =========================================================
// 7. IDENTIFIKASI KANDIDAT
// =========================================================

function identifyCandidate(vote, candidates) {
    if (!vote || typeof vote !== "object") return 0;

    const raw =
        vote.candidate_number ??
        vote.candidate ??
        vote.candidateId ??
        vote.candidateNumber ??
        vote.choice ??
        vote.nomorCalon;

    if (raw === undefined || raw === null) return 0;

    const value = String(raw).trim().toLowerCase();

    if (
        value === "1" ||
        value === "01" ||
        value === "candidate1" ||
        value === "candidate-1" ||
        value === candidates.candidate1.toLowerCase() ||
        /^calon\s*0?1$/.test(value) ||
        /nomor\s*urut\s*0?1/.test(value)
    ) return 1;

    if (
        value === "2" ||
        value === "02" ||
        value === "candidate2" ||
        value === "candidate-2" ||
        value === candidates.candidate2.toLowerCase() ||
        /^calon\s*0?2$/.test(value) ||
        /nomor\s*urut\s*0?2/.test(value)
    ) return 2;

    return 0;
}

// =========================================================
// 8. DASHBOARD REKAP SUARA
// =========================================================

function renderDashboard() {
    const candidates = getCandidates();
    const votes = getVotes();

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
    const totalVotes = votes.length;

    const percent1 = validVotes
        ? count1 / validVotes * 100
        : 0;

    const percent2 = validVotes
        ? count2 / validVotes * 100
        : 0;

    setText("candidateName1", candidates.candidate1);
    setText(
        "candidateVotes1",
        `${count1} suara · ${percent1.toFixed(1)}%`
    );
    setWidth("candidateBar1", percent1);

    setText("candidateName2", candidates.candidate2);
    setText(
        "candidateVotes2",
        `${count2} suara · ${percent2.toFixed(1)}%`
    );
    setWidth("candidateBar2", percent2);

    setText("summaryTotal", totalVotes);
    setText("summaryValid", validVotes);
    setText("summaryInvalid", invalidVotes);

    animateAllStats();
}

// =========================================================
// 9. LOAD DATA DARI SUPABASE
// =========================================================

async function loadVotesFromSupabase(showError = true) {
    try {
        const { data, error } = await supabaseClient
            .from("pilkades_votes")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        remoteVotes = Array.isArray(data) ? data : [];

        renderDashboard();

        setText(
            "connectionStatus",
            "Terhubung ke server"
        );

        const status = $("connectionStatus");
        if (status) {
            status.classList.remove("offline");
            status.classList.add("online");
        }

        console.log(
            "[SUPABASE] Data suara dimuat:",
            remoteVotes.length
        );

        return true;

    } catch (error) {
        console.error("[SUPABASE] Gagal mengambil data:", error);

        setText(
            "connectionStatus",
            "Koneksi server bermasalah"
        );

        const status = $("connectionStatus");
        if (status) {
            status.classList.remove("online");
            status.classList.add("offline");
        }

        if (showError) {
            showAdminToast(
                "Gagal mengambil data suara dari server.",
                "error"
            );
        }

        return false;
    }
}

// =========================================================
// 10. REFRESH DASHBOARD
// =========================================================

const refreshButton = $("refreshButton");

if (refreshButton) {
    refreshButton.addEventListener("click", async function() {
        refreshButton.disabled = true;

        const originalText = refreshButton.textContent;
        refreshButton.textContent = "Memuat...";

        const success = await loadVotesFromSupabase();

        refreshButton.disabled = false;
        refreshButton.textContent = originalText;

        if (success) {
            showAdminToast("Data berhasil diperbarui.");
        }
    });
}

// =========================================================
// 11. REALTIME SUPABASE
// =========================================================

function subscribeVoteRealtime() {
    if (voteRealtimeChannel) {
        supabaseClient.removeChannel(voteRealtimeChannel);
        voteRealtimeChannel = null;
    }

    voteRealtimeChannel = supabaseClient
        .channel("pilkades-votes-realtime")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "pilkades_votes"
            },
            async function(payload) {
                console.log("[REALTIME] Perubahan data:", payload);

                await loadVotesFromSupabase(false);

                if (payload.eventType === "INSERT") {
                    showAdminToast(
                        "Suara baru berhasil diterima."
                    );
                }
            }
        )
        .subscribe(status => {
            console.log("[REALTIME] Status:", status);

            if (status === "SUBSCRIBED") {
                setText("connectionStatus", "Realtime aktif");

                const element = $("connectionStatus");
                if (element) {
                    element.classList.add("online");
                    element.classList.remove("offline");
                }
            }

            if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT"
            ) {
                setText(
                    "connectionStatus",
                    "Realtime terputus"
                );
            }
        });
}

// =========================================================
// 12. STATUS GENERATOR QR
// =========================================================

function updateQrProgress(current, message, isError = false) {
    const element = $("qrGeneratorMessage");
    if (!element) return;

    element.textContent = message;
    element.classList.remove("success", "error");

    if (isError) element.classList.add("error");
    else if (current >= 1) element.classList.add("success");
}

// =========================================================
// 13. LOAD JSPDF
// =========================================================

function loadJsPDF() {
    return new Promise((resolve, reject) => {
        if (window.jspdf?.jsPDF) {
            resolve(window.jspdf.jsPDF);
            return;
        }

        const existing = document.querySelector(
            'script[data-invitation-jspdf="true"]'
        );

        if (existing) {
            existing.addEventListener("load", () => {
                if (window.jspdf?.jsPDF) {
                    resolve(window.jspdf.jsPDF);
                } else {
                    reject(new Error("Library jsPDF gagal dimuat."));
                }
            }, { once: true });

            existing.addEventListener("error", () => {
                reject(new Error("Gagal mengakses CDN jsPDF."));
            }, { once: true });

            return;
        }

        const script = document.createElement("script");

        script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

        script.dataset.invitationJspdf = "true";

        script.onload = () => {
            if (window.jspdf?.jsPDF) {
                resolve(window.jspdf.jsPDF);
            } else {
                reject(new Error("Library jsPDF tidak tersedia."));
            }
        };

        script.onerror = () => {
            reject(new Error("Gagal memuat library PDF."));
        };

        document.head.appendChild(script);
    });
}

// =========================================================
// 14. MEMBUAT QR PNG
// =========================================================

function createInvitationQR(code = DEMO_UNIVERSAL_QR) {
    return new Promise((resolve, reject) => {
        if (typeof QRCode === "undefined") {
            reject(new Error("Library QRCode tidak tersedia."));
            return;
        }

        const container = document.createElement("div");

        container.style.position = "fixed";
        container.style.left = "-10000px";
        container.style.top = "0";

        document.body.appendChild(container);

        try {
            new QRCode(container, {
                text: DEMO_UNIVERSAL_QR,
                width: 400,
                height: 400,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });

            requestAnimationFrame(() => {
                const canvas = container.querySelector("canvas");

                if (canvas) {
                    const image = canvas.toDataURL("image/png");
                    container.remove();
                    resolve(image);
                    return;
                }

                const img = container.querySelector("img");

                if (img && img.complete && img.naturalWidth > 0) {
                    const image = img.src;
                    container.remove();
                    resolve(image);
                    return;
                }

                container.remove();
                reject(new Error(`QR ${code} gagal dibuat.`));
            });

        } catch (error) {
            container.remove();
            reject(error);
        }
    });
}

// =========================================================
// 15. GENERATOR QR CODE KE PDF
// =========================================================

async function generateAllQrCodes() {
    if (qrGenerating) return;

    const button = $("generateQrButton");

    if (typeof QRCode === "undefined") {
        showAdminToast(
            "Library QR Code gagal dimuat.",
            "error"
        );
        return;
    }

    qrGenerating = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Sedang Membuat PDF...";
    }

    try {
        const jsPDF = await loadJsPDF();

        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true
        });

        const qrImage = await createInvitationQR();

        doc.setTextColor(16, 42, 67);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);

        doc.text("QR CODE UNIVERSAL", 105, 24, {
            align: "center"
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        doc.text(
            "PEMILIHAN KEPALA DESA KALENTAMBO",
            105,
            32,
            { align: "center" }
        );

        doc.setDrawColor(210, 218, 230);
        doc.roundedRect(55, 48, 100, 116, 3, 3);

        doc.addImage(qrImage, "PNG", 75, 57, 60, 60);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);

        doc.text(DEMO_UNIVERSAL_QR, 105, 130, {
            align: "center"
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        doc.text(
            "Gunakan QR yang sama untuk simulasi pemungutan suara.",
            105,
            180,
            { align: "center" }
        );

        doc.setTextColor(130, 130, 130);
        doc.setFontSize(8);

        doc.text(
            "SISTEM e-VOTING DESA KALENTAMBO",
            105,
            287,
            { align: "center" }
        );

        doc.save("QR-Code-Universal-KLT001.pdf");

        showAdminToast("QR universal berhasil dibuat.");

    } catch (error) {
        console.error("[QR PDF]", error);

        showAdminToast(
            error.message || "Gagal membuat PDF QR.",
            "error"
        );

    } finally {
        qrGenerating = false;

        if (button) {
            button.disabled = false;
            button.textContent = "↓ Unduh QR";
        }
    }
}

const generateQrButton = $("generateQrButton");

if (generateQrButton) {
    generateQrButton.textContent = "↓ Unduh QR";
    generateQrButton.addEventListener(
        "click",
        generateAllQrCodes
    );
}

// =========================================================
// 16. PANEL SURAT UNDANGAN
// =========================================================

function createInvitationPanel() {
    if ($("invitationGeneratorPanel")) return;

    const qrPanel = document.querySelector(".qr-generator-panel");
    if (!qrPanel) return;

    const panel = document.createElement("section");

    panel.id = "invitationGeneratorPanel";
    panel.className = "panel invitation-generator-panel";

    panel.innerHTML = `
        <div class="qr-controls">
            <button
                type="button"
                id="generateInvitationPDF"
                class="primary-button"
            >
                ↓ Unduh Surat Undangan
            </button>
        </div>
    `;

    qrPanel.insertAdjacentElement("afterend", panel);

    $("generateInvitationPDF").addEventListener(
        "click",
        generateInvitationPDF
    );
}

// =========================================================
// 17. DESAIN SURAT UNDANGAN
// =========================================================

function drawInvitation(doc, data) {
    const pageWidth = 210;
    const margin = 20;

    doc.setDrawColor(35, 55, 80);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 277);

    doc.setTextColor(16, 42, 67);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);

    doc.text(
        "PEMERINTAH DESA KALENTAMBO",
        pageWidth / 2,
        27,
        { align: "center" }
    );

    doc.setFontSize(11);

    doc.text(
        "PANITIA PEMILIHAN KEPALA DESA",
        pageWidth / 2,
        35,
        { align: "center" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    doc.text(
        "DESA KALENTAMBO",
        pageWidth / 2,
        42,
        { align: "center" }
    );

    doc.setDrawColor(16, 42, 67);
    doc.setLineWidth(0.8);
    doc.line(margin, 49, 190, 49);

    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);

    doc.text(
        "SURAT UNDANGAN PEMILIH",
        pageWidth / 2,
        68,
        { align: "center" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    doc.text("Kepada Yth.", margin, 91);

    doc.setFont("helvetica", "bold");

    doc.text(
        "Bapak/Ibu/Saudara(i) Warga Desa Kalentambo",
        margin,
        99
    );

    doc.setFont("helvetica", "normal");
    doc.text("di Tempat", margin, 107);

    const paragraph = [
        "Dengan hormat,",
        "",
        "Dalam rangka pelaksanaan Pemilihan Kepala Desa Kalentambo,",
        "kami mengundang Bapak/Ibu/Saudara(i) untuk berpartisipasi",
        "dalam kegiatan pemungutan suara dan menggunakan hak pilih",
        "sesuai dengan ketentuan yang berlaku.",
        "",
        "Untuk mengikuti simulasi e-Voting, silakan pindai QR Code",
        "yang tertera pada surat ini, kemudian ikuti petunjuk pada",
        "layar hingga proses pemungutan suara selesai.",
        "",
        "Partisipasi dan kerja sama seluruh warga sangat diharapkan",
        "demi kelancaran pelaksanaan Pemilihan Kepala Desa Kalentambo.",
        "",
        "Demikian undangan ini disampaikan. Atas perhatian dan",
        "partisipasi Bapak/Ibu/Saudara(i), kami ucapkan terima kasih."
    ];

    doc.text(paragraph, margin, 124, {
        lineHeightFactor: 1.55
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);

    doc.text(
        "QR CODE E-VOTING",
        pageWidth / 2,
        220,
        { align: "center" }
    );

    doc.addImage(data.qrImage, "PNG", 85, 226, 40, 40);

    doc.setFontSize(9);

    doc.text(
        DEMO_UNIVERSAL_QR,
        pageWidth / 2,
        270,
        { align: "center" }
    );

    doc.setTextColor(130, 130, 130);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    doc.text(
        "SISTEM e-VOTING DESA KALENTAMBO",
        pageWidth / 2,
        282,
        { align: "center" }
    );
}

// =========================================================
// 18. GENERATOR PDF UNDANGAN
// =========================================================

async function generateInvitationPDF() {
    if (generatingPDF) return;

    const button = $("generateInvitationPDF");

    generatingPDF = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Membuat Surat...";
    }

    try {
        const jsPDF = await loadJsPDF();
        const qrImage = await createInvitationQR();

        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true
        });

        drawInvitation(doc, { qrImage });

        doc.save("Surat-Undangan-Pemilih-Kalentambo.pdf");

        showAdminToast("Surat undangan berhasil diunduh.");

    } catch (error) {
        console.error("[INVITATION PDF]", error);

        showAdminToast(
            error.message || "Gagal membuat surat undangan.",
            "error"
        );

    } finally {
        generatingPDF = false;

        if (button) {
            button.disabled = false;
            button.textContent = "↓ Unduh Surat Undangan";
        }
    }
}

// =========================================================
// 19. RESET DATA
// =========================================================

const resetButton = $("resetButton");

if (resetButton) {
    resetButton.addEventListener("click", function() {
        const confirmed = confirm(
            "Reset data lokal browser? Data suara di Supabase tidak akan terhapus."
        );

        if (!confirmed) return;

        try {
            localStorage.removeItem(VOTES_KEY);
            localStorage.removeItem(USED_KEY);

            renderDashboard();

            showMessage(
                "resetMessage",
                "Data lokal berhasil dibersihkan. Data server tetap tersimpan.",
                true
            );

            showAdminToast(
                "Data lokal dibersihkan. Data server tidak berubah."
            );

        } catch (error) {
            console.error("Gagal reset:", error);

            showMessage(
                "resetMessage",
                "Gagal membersihkan data lokal."
            );
        }
    });
}

// =========================================================
// 20. SINKRONISASI ANTAR TAB
// =========================================================

window.addEventListener("storage", function(event) {
    if (
        event.key === VOTES_KEY ||
        event.key === CANDIDATES_KEY ||
        event.key === null
    ) {
        renderDashboard();
    }
});

// =========================================================
// 21. MODERN ADMIN UI
// =========================================================

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
            --admin-shadow: 0 8px 28px rgba(25,45,80,.07);
        }

        body.admin-dark-mode {
            --admin-bg: #101827;
            --admin-surface: #192538;
            --admin-text: #e7edf7;
            --admin-muted: #a3b0c5;
            --admin-border: #2b3a50;
            --admin-sidebar: #0b1321;
            --admin-shadow: 0 8px 28px rgba(0,0,0,.2);
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
            transition:
                background .25s ease,
                border-color .25s ease,
                box-shadow .25s ease,
                transform .2s ease;
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

        .online {
            color: #16a34a !important;
        }

        .offline {
            color: #dc2626 !important;
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
                background: rgba(8,18,35,.55);
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

// =========================================================
// 22. SIDEBAR, DARK MODE, MOBILE MENU
// =========================================================

function closeMobileSidebar() {
    document.body.classList.remove("mobile-sidebar-open");
}

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
            toggle.setAttribute(
                "aria-label",
                "Buka atau tutup sidebar"
            );
            toggle.textContent = "☰";

            toggle.addEventListener("click", function() {
                if (window.innerWidth <= 900) {
                    document.body.classList.toggle(
                        "mobile-sidebar-open"
                    );
                } else {
                    layout.classList.toggle("sidebar-collapsed");
                }
            });

            brand.appendChild(toggle);
        }
    }

    if (!$("adminThemeToggle") && topbar) {
        const actions = document.createElement("div");
        actions.className = "admin-ui-actions";

        const themeButton = document.createElement("button");

        themeButton.id = "adminThemeToggle";
        themeButton.type = "button";
        themeButton.className = "admin-icon-button";
        themeButton.setAttribute("aria-label", "Ganti tema");

        if (localStorage.getItem(THEME_KEY) === "dark") {
            document.body.classList.add("admin-dark-mode");
        }

        themeButton.textContent =
            document.body.classList.contains("admin-dark-mode")
                ? "☀"
                : "☾";

        themeButton.addEventListener("click", function() {
            document.body.classList.toggle("admin-dark-mode");

            const isDark =
                document.body.classList.contains("admin-dark-mode");

            localStorage.setItem(
                THEME_KEY,
                isDark ? "dark" : "light"
            );

            themeButton.textContent = isDark ? "☀" : "☾";
        });

        actions.appendChild(themeButton);
        topbar.appendChild(actions);
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

// =========================================================
// 23. ANIMASI ANGKA STATISTIK
// =========================================================

function animateStatNumber(element) {
    if (!element) return;

    const target = Number(element.textContent);

    if (!Number.isFinite(target)) return;

    const duration = 650;
    const startTime = performance.now();

    function update(currentTime) {
        const progress = Math.min(
            (currentTime - startTime) / duration,
            1
        );

        const eased = 1 - Math.pow(1 - progress, 3);

        element.textContent = Math.round(target * eased);

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }

    requestAnimationFrame(update);
}

function animateAllStats() {
    [
        "summaryTotal",
        "summaryValid",
        "summaryInvalid"
    ].forEach(id => {
        animateStatNumber($(id));
    });
}

// =========================================================
// 24. INISIALISASI
// =========================================================

async function initializeAdminDashboard() {
    initModernAdminUI();
    createInvitationPanel();

    await loadVotesFromSupabase();

    subscribeVoteRealtime();

    console.log("======================================");
    console.log("PILKADES DIGITAL KALENTAMBO");
    console.log("Admin Dashboard siap digunakan.");
    console.log("Supabase: Aktif");
    console.log("Realtime: Aktif");
    console.log("QR PDF Generator: Aktif");
    console.log("PDF Invitation Generator: Aktif");
    console.log("Modern UI: Aktif");
    console.log("Dark Mode: Aktif");
    console.log("Sidebar Responsive: Aktif");
    console.log("QR Universal:", DEMO_UNIVERSAL_QR);
    console.log("======================================");
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeAdminDashboard
    );
} else {
    initializeAdminDashboard();
}
