const STORAGE_KEY = "esgPapers";

const form = document.getElementById("paper-form");
const paperList = document.getElementById("paper-list");
const paperCount = document.getElementById("paper-count");
const statusFilter = document.getElementById("status-filter");
const searchFilter = document.getElementById("search-filter");
const exportCsvButton = document.getElementById("export-csv");
const submitPaperButton = document.getElementById("submit-paper");
const cancelEditButton = document.getElementById("cancel-edit");
const formTitle = document.getElementById("form-title");

let papers = loadPapers();
let editingIndex = null;

const PDF_DB_NAME = "esgPaperPdfs";
const PDF_STORE_NAME = "pdfs";

function loadPapers() {
  const savedPapers = localStorage.getItem(STORAGE_KEY);

  if (!savedPapers) {
    return [];
  }

  try {
    const parsedPapers = JSON.parse(savedPapers);
    return Array.isArray(parsedPapers) ? parsedPapers : [];
  } catch {
    return [];
  }
}

function savePapers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
}

function getFormValue(id) {
  return document.getElementById(id).value.trim();
}

function getPdfInput() {
  return document.getElementById("paper-pdf");
}

function getSelectedPdfFile() {
  const files = getPdfInput().files;
  return files && files.length > 0 ? files[0] : null;
}

function createPaperFromForm(existingPaper = {}) {
  return {
    title: getFormValue("paper-title"),
    link: getFormValue("paper-link"),
    question: getFormValue("research-question"),
    data: getFormValue("paper-data"),
    method: getFormValue("paper-method"),
    findings: getFormValue("paper-findings"),
    notes: getFormValue("paper-notes"),
    status: document.getElementById("paper-status").value,
    pdfName: existingPaper.pdfName || "",
    pdfId: existingPaper.pdfId || ""
  };
}

function openPdfDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PDF_DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(PDF_STORE_NAME);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePdfFile(file, existingPdfId = "") {
  if (!file) {
    return {
      pdfName: "",
      pdfId: existingPdfId
    };
  }

  const pdfId = crypto.randomUUID();
  const db = await openPdfDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PDF_STORE_NAME, "readwrite");
    const store = transaction.objectStore(PDF_STORE_NAME);

    store.put(file, pdfId);

    transaction.oncomplete = () => {
      db.close();
      resolve({
        pdfName: file.name,
        pdfId
      });
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function getPdfFile(pdfId) {
  const db = await openPdfDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PDF_STORE_NAME, "readonly");
    const store = transaction.objectStore(PDF_STORE_NAME);
    const request = store.get(pdfId);

    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function deletePdfFile(pdfId) {
  if (!pdfId) {
    return;
  }

  const db = await openPdfDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PDF_STORE_NAME, "readwrite");
    const store = transaction.objectStore(PDF_STORE_NAME);

    store.delete(pdfId);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function getFilteredPapers() {
  const selectedStatus = statusFilter.value;
  const searchText = searchFilter.value.trim().toLowerCase();

  return papers
    .map((paper, index) => ({ paper, index }))
    .filter(({ paper }) => {
    const matchesStatus = selectedStatus === "All" || paper.status === selectedStatus;
    const searchableText = `${paper.title || ""} ${paper.method || ""}`.toLowerCase();
    const matchesSearch = searchableText.includes(searchText);

    return matchesStatus && matchesSearch;
  });
}

function createField(label, value) {
  if (!value) {
    return "";
  }

  return `
    <div class="paper-field">
      <strong>${label}</strong>
      <div>${escapeHtml(value)}</div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeCsvValue(value) {
  const text = String(value || "");
  return `"${text.replaceAll('"', '""')}"`;
}

function convertPapersToCsv(records) {
  const columns = [
    ["Paper Title", "title"],
    ["Paper Link", "link"],
    ["Research Question", "question"],
    ["Data", "data"],
    ["Method", "method"],
    ["Findings", "findings"],
    ["My Notes", "notes"],
    ["Status", "status"],
    ["PDF File", "pdfName"]
  ];

  const header = columns.map(([label]) => escapeCsvValue(label)).join(",");
  const rows = records.map((paper) =>
    columns.map(([, key]) => escapeCsvValue(paper[key])).join(",")
  );

  return [header, ...rows].join("\r\n");
}

function exportPapersAsCsv() {
  const csv = convertPapersToCsv(papers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "esg-paper-reading.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function createSafeFileName(value) {
  const fileName = String(value || "untitled-paper")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return fileName || "untitled-paper";
}

async function exportCardAsJpg(index) {
  if (typeof html2canvas === "undefined") {
    alert("JPG export is not ready. Please refresh the page and try again.");
    return;
  }

  const card = paperList.querySelector(`[data-card-index="${index}"]`);

  if (!card) {
    alert("This paper card could not be found.");
    return;
  }

  card.classList.add("exporting");

  try {
    const canvas = await html2canvas(card, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true
    });
    const imageUrl = canvas.toDataURL("image/jpeg", 0.92);
    const link = document.createElement("a");
    const paper = papers[index] || {};

    link.href = imageUrl;
    link.download = `${createSafeFileName(paper.title)}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    alert("The JPG could not be exported. Please try again.");
  } finally {
    card.classList.remove("exporting");
  }
}

function renderPapers() {
  const filteredPapers = getFilteredPapers();
  paperCount.textContent = `${filteredPapers.length} ${filteredPapers.length === 1 ? "paper" : "papers"}`;

  if (filteredPapers.length === 0) {
    paperList.innerHTML = '<div class="empty-state">No papers match the current filters.</div>';
    return;
  }

  paperList.innerHTML = filteredPapers
    .map(({ paper, index }) => `
      <article class="paper-card" data-card-index="${index}">
        <h3>${escapeHtml(paper.title || "Untitled Paper")}</h3>
        <span class="status">${escapeHtml(paper.status || "No Status")}</span>
        ${paper.link ? `
          <div class="paper-field">
            <strong>Paper Link</strong>
            <a href="${escapeHtml(paper.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(paper.link)}</a>
          </div>
        ` : ""}
        ${createField("Research Question", paper.question)}
        ${createField("Data", paper.data)}
        ${createField("Method", paper.method)}
        ${createField("Findings", paper.findings)}
        ${createField("My Notes", paper.notes)}
        ${paper.pdfName ? `
          <div class="paper-field">
            <strong>Original PDF</strong>
            <button type="button" class="secondary-button" data-action="open-pdf" data-index="${index}">${escapeHtml(paper.pdfName)}</button>
          </div>
        ` : ""}
        <div class="card-actions">
          <button type="button" class="secondary-button" data-action="export-jpg" data-index="${index}">Export JPG</button>
          <button type="button" class="secondary-button" data-action="edit" data-index="${index}">Edit</button>
          <button type="button" class="danger-button" data-action="delete" data-index="${index}">Delete</button>
        </div>
      </article>
    `)
    .join("");
}

function fillFormForEdit(paper) {
  document.getElementById("paper-title").value = paper.title || "";
  document.getElementById("paper-link").value = paper.link || "";
  document.getElementById("research-question").value = paper.question || "";
  document.getElementById("paper-data").value = paper.data || "";
  document.getElementById("paper-method").value = paper.method || "";
  document.getElementById("paper-findings").value = paper.findings || "";
  document.getElementById("paper-notes").value = paper.notes || "";
  document.getElementById("paper-status").value = paper.status || "To Read";
  getPdfInput().value = "";
}

function startEdit(index) {
  editingIndex = index;
  fillFormForEdit(papers[index]);
  formTitle.textContent = "Edit Paper";
  submitPaperButton.textContent = "Save Changes";
  cancelEditButton.classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEdit() {
  editingIndex = null;
  form.reset();
  formTitle.textContent = "Add a Paper";
  submitPaperButton.textContent = "Add Paper";
  cancelEditButton.classList.add("hidden");
}

async function openStoredPdf(index) {
  const paper = papers[index];

  if (!paper || !paper.pdfId) {
    alert("No PDF is saved for this paper.");
    return;
  }

  const file = await getPdfFile(paper.pdfId);

  if (!file) {
    alert("The PDF could not be found in this browser.");
    return;
  }

  const url = URL.createObjectURL(file);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function deletePaper(index) {
  const paper = papers[index];
  const confirmed = confirm(`Delete "${paper.title || "Untitled Paper"}"?`);

  if (!confirmed) {
    return;
  }

  await deletePdfFile(paper.pdfId);
  papers.splice(index, 1);
  savePapers();

  if (editingIndex === index) {
    cancelEdit();
  } else if (editingIndex !== null && editingIndex > index) {
    editingIndex -= 1;
  }

  renderPapers();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const existingPaper = editingIndex === null ? {} : papers[editingIndex];
  const paper = createPaperFromForm(existingPaper);
  const pdfFile = getSelectedPdfFile();

  if (pdfFile && pdfFile.type !== "application/pdf" && !pdfFile.name.toLowerCase().endsWith(".pdf")) {
    alert("Please choose a PDF file.");
    return;
  }

  try {
    const pdfInfo = await savePdfFile(pdfFile, existingPaper.pdfId);
    paper.pdfName = pdfFile ? pdfInfo.pdfName : existingPaper.pdfName || "";
    paper.pdfId = pdfFile ? pdfInfo.pdfId : existingPaper.pdfId || "";

    if (pdfFile && existingPaper.pdfId && existingPaper.pdfId !== paper.pdfId) {
      await deletePdfFile(existingPaper.pdfId);
    }
  } catch {
    alert("The PDF could not be saved. Please try again.");
    return;
  }

  if (editingIndex === null) {
    papers.unshift(paper);
  } else {
    papers[editingIndex] = paper;
  }

  savePapers();
  cancelEdit();
  renderPapers();
});

statusFilter.addEventListener("change", renderPapers);
searchFilter.addEventListener("input", renderPapers);
exportCsvButton.addEventListener("click", exportPapersAsCsv);
cancelEditButton.addEventListener("click", cancelEdit);
paperList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const index = Number(button.dataset.index);
  const action = button.dataset.action;

  if (action === "edit") {
    startEdit(index);
  }

  if (action === "delete") {
    await deletePaper(index);
  }

  if (action === "open-pdf") {
    await openStoredPdf(index);
  }

  if (action === "export-jpg") {
    await exportCardAsJpg(index);
  }
});

renderPapers();

