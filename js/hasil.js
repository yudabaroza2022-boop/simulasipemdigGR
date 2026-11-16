
const STORAGE_KEY = "klt_demo_votes";

const elements = {
  total: document.getElementById("totalVotes"),
  valid: document.getElementById("validVotes"),
  votes1: document.getElementById("votes1"),
  votes2: document.getElementById("votes2"),
  percent1: document.getElementById("percent1"),
  percent2: document.getElementById("percent2"),
  bar1: document.getElementById("bar1"),
  bar2: document.getElementById("bar2"),
  summary: document.getElementById("summaryTotal"),
  empty: document.getElementById("emptyState"),
  content: document.getElementById("resultContent"),
  refresh: document.getElementById("refreshButton")
};

function readVotes() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Gagal membaca data suara:", error);
    return [];
  }
}

// Mengenali format pilihan yang umum digunakan pada simulasi.
function identifyCandidate(vote) {
  const rawChoice =
    vote.candidate ??
    vote.candidateId ??
    vote.candidateNumber ??
    vote.choice ??
    vote.nomorCalon ??
    "";

  const choice = String(rawChoice).toLowerCase().trim();

  if (
    choice === "1" ||
    choice === "01" ||
    choice.includes("gilang") ||
    choice.includes("calon 1") ||
    choice.includes("nomor urut 1")
  ) {
    return 1;
  }

  if (
    choice === "2" ||
    choice === "02" ||
    choice.includes("calon nomor urut 2") ||
    choice.includes("calon 2") ||
    choice.includes("nomor urut 2")
  ) {
    return 2;
  }

  return 0;
}

function renderDashboard() {
  const votes = readVotes();

  let candidate1 = 0;
  let candidate2 = 0;

  votes.forEach((vote) => {
    const candidate = identifyCandidate(vote);

    if (candidate === 1) candidate1++;
    if (candidate === 2) candidate2++;
  });

  const validTotal = candidate1 + candidate2;
  const totalRecorded = votes.length;

  elements.total.textContent = totalRecorded;
  elements.valid.textContent = validTotal;

  if (validTotal === 0) {
    elements.empty.hidden = false;
    elements.content.hidden = true;
    return;
  }

  elements.empty.hidden = true;
  elements.content.hidden = false;

  const percentage1 = (candidate1 / validTotal) * 100;
  const percentage2 = (candidate2 / validTotal) * 100;

  elements.votes1.textContent = candidate1;
  elements.votes2.textContent = candidate2;

  elements.percent1.textContent = `${percentage1.toFixed(1)}%`;
  elements.percent2.textContent = `${percentage2.toFixed(1)}%`;

  elements.bar1.style.width = `${percentage1}%`;
  elements.bar2.style.width = `${percentage2}%`;

  elements.summary.textContent = `${validTotal} suara`;
}

elements.refresh.addEventListener("click", renderDashboard);

// Perbarui otomatis jika data berubah dari tab browser lain.
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    renderDashboard();
  }
});

renderDashboard();
