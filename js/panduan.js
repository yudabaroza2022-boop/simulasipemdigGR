
/* =====================================
   PILKADES DIGITAL KALENTAMBO
   INTERACTIVE GUIDE
===================================== */

const guideSteps = [

    {
        icon: "📄",
        title: "Persiapan Dokumen",
        description:
            "Pastikan Anda telah membawa Kartu Tanda Penduduk (KTP) dan surat undangan pemungutan suara yang sebelumnya diberikan oleh petugas.",
        note:
            "Pastikan seluruh dokumen telah disiapkan sebelum menuju bilik suara."
    },

    {
        icon: "👆",
        title: "Pemindaian Sidik Jari",
        description:
            "Di bilik suara digital, letakkan ibu jari pada perangkat pemindai sidik jari sesuai petunjuk petugas.",
        note:
            "Pastikan posisi ibu jari sesuai dengan petunjuk pemindaian."
    },

    {
        icon: "📱",
        title: "Pemindaian Kode QR",
        description:
            "Selanjutnya, pindai kode QR yang terdapat pada surat undangan menggunakan tablet pemilihan.",
        note:
            "Pastikan kode QR terlihat jelas saat proses pemindaian."
    },

    {
        icon: "🗳️",
        title: "Pemilihan Calon Kepala Desa",
        description:
            "Sistem akan menampilkan dua kandidat calon kepala desa. Pilih kandidat yang Anda kehendaki dengan menekan foto calon, kemudian tekan tombol Pilih Kandidat untuk melanjutkan.",
        note:
            "Perhatikan nomor urut dan nama calon sebelum menentukan pilihan."
    },

    {
        icon: "🔍",
        title: "Pemeriksaan Pilihan",
        description:
            "Periksa kembali kandidat yang telah Anda pilih. Pastikan pilihan tersebut sudah sesuai dengan keinginan Anda sebelum melanjutkan.",
        note:
            "Pastikan pilihan sudah benar sebelum melakukan konfirmasi akhir."
    },

    {
        icon: "☑️",
        title: "Konfirmasi Akhir",
        description:
            "Tekan kembali tombol Pilih untuk mengonfirmasi dan mengirimkan suara Anda ke sistem pemilihan digital.",
        note:
            "Dalam simulasi ini, suara akan dicatat setelah konfirmasi akhir."
    },

    {
        icon: "✅",
        title: "Pemberitahuan Suara Berhasil",
        description:
            "Tunggu hingga muncul notifikasi bertuliskan Terima Kasih, suara berhasil dikirim dan tersimpan. Notifikasi tersebut menandakan bahwa suara Anda telah berhasil direkam oleh sistem.",
        note:
            "Jangan meninggalkan bilik sebelum muncul pemberitahuan keberhasilan."
    },

    {
        icon: "🧾",
        title: "Pengambilan Bukti Pemilihan",
        description:
            "Serahkan surat undangan pemilih kepada petugas. Selanjutnya, petugas akan memberikan hasil cetak berupa bukti QR Code sebagai tanda bahwa Anda telah menggunakan hak pilih melalui sistem digital.",
        note:
            "Simpan bukti pemilihan yang diberikan oleh petugas."
    }

];


// ELEMENT HTML

const stepIcon = document.getElementById("stepIcon");
const stepNumber = document.getElementById("stepNumber");
const stepTitle = document.getElementById("stepTitle");
const stepDescription = document.getElementById("stepDescription");
const stepNote = document.getElementById("stepNote");

const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");

const stepIndicators = document.querySelectorAll(".step-dot");


// CURRENT STEP

let currentStep = 0;


// DISPLAY STEP

function displayStep(index) {

    const step = guideSteps[index];

    if (!step) return;

    stepIcon.textContent = step.icon;

    stepNumber.textContent =
        `LANGKAH ${String(index + 1).padStart(2, "0")}`;

    stepTitle.textContent = step.title;

    stepDescription.textContent = step.description;

    stepNote.querySelector("p").textContent = step.note;


    // UPDATE PROGRESS

    const progress = ((index + 1) / guideSteps.length) * 100;

    progressFill.style.width = `${progress}%`;

    progressText.textContent =
        `${index + 1} dari ${guideSteps.length} langkah`;


    // UPDATE INDICATORS

    stepIndicators.forEach((dot, i) => {

        dot.classList.remove("active", "completed");

        if (i < index) {
            dot.classList.add("completed");
            dot.textContent = "✓";
        }

        else if (i === index) {
            dot.classList.add("active");
            dot.textContent = i + 1;
        }

        else {
            dot.textContent = i + 1;
        }

    });


    // BUTTON STATE

    prevButton.disabled = index === 0;

    if (index === guideSteps.length - 1) {

        nextButton.textContent = "Mulai Simulasi →";

    } else {

        nextButton.textContent = "Selanjutnya →";

    }

}


// NEXT BUTTON

nextButton.addEventListener("click", function () {

    if (currentStep < guideSteps.length - 1) {

        currentStep++;

        displayStep(currentStep);

    } else {

        window.location.href = "voting.html";

    }

});


// PREVIOUS BUTTON

prevButton.addEventListener("click", function () {

    if (currentStep > 0) {

        currentStep--;

        displayStep(currentStep);

    }

});


// INITIALIZE

displayStep(currentStep);
